import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { file_data, filename, folder_id, heir_search_id } = body;

    if (!file_data || !filename) {
      return Response.json(
        { error: "Missing file_data or filename" },
        { status: 400 }
      );
    }

    // ===== DELIVERY GATE =====
    // A court-ready PDF is the delivery of certified work. If the case holds no
    // live independent certification this refuses. A warning badge printed on an
    // already-generated document is not a gate, because the document exists by
    // then and will be sent anyway.
    if (!heir_search_id) {
      return Response.json(
        { error: "heir_search_id is required. A court-ready PDF delivers one specific certified case." },
        { status: 400 }
      );
    }

    const caseRecord = await base44.entities.HeirSearch.get(heir_search_id).catch(() => null);
    if (!caseRecord) {
      return Response.json({ error: "Heir search case not found." }, { status: 404 });
    }

    const certification = caseRecord.certification || null;
    if (certification?.certified !== true || certification?.model_separation_ok !== true) {
      console.warn("uploadCourtReadyPDF refused: case is not independently certified.", certification?.failed_rules);
      return Response.json(
        {
          error: `Delivery refused. This case holds no independent certification${
            certification?.failed_rules?.length ? ` (failed rules: ${certification.failed_rules.join(", ")})` : ""
          }. Correct the deficiencies and re-run independent QA before a court-ready PDF is produced.`,
          blocked_from_delivery: true,
          failed_rules: certification?.failed_rules || [],
          reasons: certification?.reasons || [],
        },
        { status: 409 }
      );
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection("googledrive");

    // Decode base64 PDF
    const binaryString = atob(file_data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Build multipart upload body
    const boundary = "-------strategicminds" + Math.random().toString(16).slice(2);
    const metadata = {
      name: filename,
      parents: folder_id ? [folder_id] : undefined,
    };

    const multipartBody =
      `--${boundary}\r\n` +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      JSON.stringify(metadata) +
      "\r\n" +
      `--${boundary}\r\n` +
      "Content-Type: application/pdf\r\n\r\n" +
      String.fromCharCode(...bytes) +
      `\r\n--${boundary}--`;

    const uploadRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      }
    );

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.error("Drive upload failed:", uploadRes.status, errText);
      return Response.json(
        { error: `Drive upload failed: ${uploadRes.status}` },
        { status: 500 }
      );
    }

    const uploaded = await uploadRes.json();

    return Response.json({
      ok: true,
      file_id: uploaded.id,
      file_url: uploaded.webViewLink,
      filename,
    });
  } catch (error) {
    console.error("uploadCourtReadyPDF error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}