import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { file_data, filename, folder_id } = body;

    if (!file_data || !filename) {
      return Response.json(
        { error: "Missing file_data or filename" },
        { status: 400 }
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