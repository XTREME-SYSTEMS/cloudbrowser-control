import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { decideDelivery } from "../../shared/deliveryGate.ts";
import { caseFingerprint } from "../../shared/independentCertification.ts";

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
    // Routed through the same shared gate as every other report path, so there is
    // one answer to "may this go out, and what may it claim?" rather than one
    // answer per function. This previously inspected only the certificate
    // itself: it had no staleness check and no investigator approval, so a
    // certificate overtaken by later edits — or never signed off by anyone —
    // could still deliver a court-ready PDF.
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

    let investigatorReview: any = null;
    try {
      const approvals = await base44.entities.Approval.filter(
        { action_type: "heir_search_report_approval", target: heir_search_id },
        { sort: "-created_date", limit: 1 }
      );
      const items = (approvals as any).items || approvals;
      const latest = Array.isArray(items) ? items[0] : null;
      if (latest) {
        investigatorReview = {
          approved: latest.status === "granted",
          rejected: latest.status === "rejected",
          rejection_reason: latest.reason,
          approved_by_email: latest.approved_by,
          approved_at: latest.approved_at,
        };
      }
    } catch (err) {
      console.error("Approval lookup failed:", err);
    }

    const delivery = decideDelivery({
      mode: "certified",
      certification: caseRecord.certification,
      investigator_review: investigatorReview,
      current_fingerprint: caseFingerprint(caseRecord),
    });

    if (!delivery.allowed) {
      console.warn("uploadCourtReadyPDF refused:", delivery.failed_rules);
      return Response.json(
        {
          error: `Delivery refused. ${delivery.reasons.join(" ")} Correct the deficiencies, re-run independent QA, and obtain investigator approval before a court-ready PDF is produced.`,
          blocked_from_delivery: true,
          refused_certified_delivery: true,
          failed_rules: delivery.failed_rules,
          reasons: delivery.reasons,
          gate_version: delivery.gate_version,
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