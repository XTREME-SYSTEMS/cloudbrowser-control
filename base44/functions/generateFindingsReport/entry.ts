import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import {
  decideDelivery,
  describeCertificationClaims,
  resolveMode,
  stripQuotedMaterial,
  QUOTED_MATERIAL_ATTRIBUTE,
} from "../../shared/deliveryGate.ts";
import { caseFingerprint } from "../../shared/independentCertification.ts";

/**
 * generateFindingsReport
 * 
 * Generates an official Strategic Minds AI Findings Report and uploads it
 * to the builder's Google Drive as a Google Doc.
 * 
 * Input:
 *   - heir_search_id (optional): specific case to report on. If omitted, uses the most recent.
 *   - folder_id (optional): Drive folder to save into. If omitted, saves to root.
 * 
 * Returns: { ok, doc_url, doc_id, case_reference, confidence_score }
 */

const BRAND = {
  name: "STRATEGIC MINDS AI",
  tagline: "Intelligence in Motion",
  primary: "#0086e6",
  accent: "#00f2ff",
  dark: "#050a0f",
};

export default async function (req: Request) {
  const base44 = createClientFromRequest(req);

  try {
    // ===== AUTH =====
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const heirSearchId = body.heir_search_id;
    let folderId = body.folder_id || null;

    // If a target_doc_id is provided, resolve its parent folder and save there
    const targetDocId = body.target_doc_id;
    if (targetDocId && !folderId) {
      try {
        const { accessToken: driveToken } = await base44.asServiceRole.connectors.getConnection("googledrive");
        const fileRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${targetDocId}?fields=parents`,
          { headers: { "Authorization": `Bearer ${driveToken}` } }
        );
        if (fileRes.ok) {
          const fileData = await fileRes.json();
          if (fileData.parents && fileData.parents.length > 0) {
            folderId = fileData.parents[0];
          }
        }
      } catch (err) {
        console.error("Failed to resolve target doc folder:", err);
      }
    }

    // ===== LOAD CASE DATA =====
    let heirSearch;
    if (heirSearchId) {
      heirSearch = await base44.entities.HeirSearch.get(heirSearchId);
    } else {
      const res = await base44.entities.HeirSearch.filter(
        {},
        { sort: "-created_date", limit: 1 }
      );
      const items = (res as any).items || res;
      heirSearch = items?.[0];
    }

    if (!heirSearch) {
      return Response.json({ error: "No heir search case found" }, { status: 404 });
    }

    // ===== DELIVERY GATE =====
    // This report previously called itself an "Official Findings Report" and
    // printed "COURT-READY" whenever the producer's own self-reported confidence
    // figure crossed 85 — a number the producer wrote about its own work,
    // promoted into precisely the claim the certification contract exists to
    // prevent. Nothing is certified here without the deterministic rules AND a
    // named investigator's approval.
    const requestedMode = resolveMode(body.mode);

    let investigatorReview: any = null;
    try {
      const approvals = await base44.entities.Approval.filter(
        { action_type: "heir_search_report_approval", target: heirSearch.id },
        { sort: "-created_date", limit: 1 },
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
      mode: requestedMode,
      certification: heirSearch.certification,
      investigator_review: investigatorReview,
      current_fingerprint: caseFingerprint(heirSearch),
    });
    const certifiedMode = delivery.mode === "certified";

    if (!delivery.allowed) {
      console.warn("generateFindingsReport refused:", delivery.failed_rules);
      return Response.json(
        {
          error: `Certified report delivery refused. ${delivery.reasons.join(" ")} A watermarked draft may still be produced by requesting mode "draft".`,
          blocked_from_delivery: true,
          refused_certified_delivery: true,
          failed_rules: delivery.failed_rules,
          reasons: delivery.reasons,
          gate_version: delivery.gate_version,
        },
        { status: 409 },
      );
    }

    // Load related skip traces for contact enrichment
    const skipTraces: any[] = [];
    try {
      const stRes = await base44.entities.SkipTrace.filter(
        { target_owner_name: heirSearch.deceased_name },
        { sort: "-created_date", limit: 5 }
      );
      const stItems = (stRes as any).items || stRes;
      skipTraces.push(...(stItems || []));
    } catch {
      // Skip traces optional
    }

    // ===== BUILD REPORT HTML =====
    const reportDate = new Date().toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });
    const caseRef = heirSearch.case_reference || `SMA-${heirSearch.id?.slice(-8).toUpperCase()}`;
    const confidence = heirSearch.confidence_score || 0;
    const deceased = heirSearch.deceased_details || {};
    const familyTree = heirSearch.family_tree || {};
    const heirs = heirSearch.identified_heirs || [];
    const probate = heirSearch.probate_info || {};
    const sources = heirSearch.sources_checked || [];
    const methods = heirSearch.methods_used || [];

    const html = buildReportHTML({
      reportDate,
      caseRef,
      confidence,
      deceasedName: heirSearch.deceased_name,
      deceasedDOB: heirSearch.deceased_dob,
      deceasedDOD: heirSearch.deceased_dod,
      deathLocation: heirSearch.death_location || deceased.last_residence,
      lastAddress: heirSearch.deceased_last_address,
      deceasedDetails: deceased,
      familyTree,
      heirs,
      probate,
      sources,
      methods,
      skipTraces,
      status: heirSearch.status,
      notes: heirSearch.notes,
      delivery,
    });

    // Defensive: a draft carrying certification language is a bug in the builder,
    // and shipping it would be the exact misrepresentation this gate exists to
    // prevent. Loud, and it stops.
    if (!certifiedMode) {
      // Scanned on what the report ASSERTS. Quoted source material — the
      // investigator's notes, the obituary excerpt — is excluded, because a
      // quoted "legal heirs" in an obituary is evidence about the decedent, not
      // a claim by this document.
      const claims = describeCertificationClaims(stripQuotedMaterial(html));
      if (claims.length > 0) {
        console.error("Draft report contained certification claims:", JSON.stringify(claims));
        return Response.json(
          {
            error: `Report generation refused: the draft contained certification language (${claims
              .map((c) => c.phrase)
              .join(", ")}).`,
            claims,
          },
          { status: 500 },
        );
      }
    }

    // ===== UPLOAD TO GOOGLE DRIVE =====
    const { accessToken } = await base44.asServiceRole.connectors.getConnection("googledrive");

    const boundary = "sma_boundary_" + Date.now();
    const fileName = `${certifiedMode ? "Findings Report" : "DRAFT (NOT CERTIFIED) Findings Report"} - ${heirSearch.deceased_name} - ${reportDate}`;

    // Build multipart body: metadata + media
    const metadata: any = {
      name: fileName,
      mimeType: "application/vnd.google-apps.document",
    };
    if (folderId) metadata.parents = [folderId];

    const multipartBody = [
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      JSON.stringify(metadata),
      `--${boundary}`,
      "Content-Type: text/html",
      "",
      html,
      `--${boundary}--`,
    ].join("\r\n");

    const uploadRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,name",
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
        { error: `Failed to upload report to Google Drive: ${uploadRes.status}` },
        { status: 502 }
      );
    }

    const uploaded = await uploadRes.json();
    const docId = uploaded.id;
    const docUrl = uploaded.webViewLink;

    // ===== UPDATE HEIR SEARCH WITH REPORT LINK =====
    // The report link goes to the audit trail, NOT into the case notes. The
    // notes field is the operator's own text, and appending a machine log line
    // to it fed report-generated sentences back into the report on every
    // subsequent run — which is how this case's notes came to contain an
    // "Official Findings Report generated" line that a later draft then quoted.
    try {
      await base44.entities.AuditLog.create({
        user_id: user.id,
        user_email: user.email,
        action: "export",
        entity_type: "HeirSearch",
        entity_id: heirSearch.id,
        description: `${delivery.watermark.title} | findings report generated: ${docUrl}`,
        metadata: {
          mode: delivery.mode,
          certified: certifiedMode,
          failed_rules: delivery.failed_rules,
          gate_version: delivery.gate_version,
          doc_id: docId,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Report audit log failed:", err);
    }

    return Response.json({
      ok: true,
      doc_url: docUrl,
      doc_id: docId,
      file_name: uploaded.name,
      case_reference: caseRef,
      confidence_score: confidence,
      heir_count: heirs.length,
      mode: delivery.mode,
      certified: certifiedMode,
      watermark: delivery.watermark.title,
      gate_version: delivery.gate_version,
    });
  } catch (error) {
    console.error("generateFindingsReport error:", error);
    return Response.json(
      { error: error.message || "Failed to generate findings report" },
      { status: 500 }
    );
  }
}

// ===== REPORT HTML BUILDER =====

function buildReportHTML(data: any): string {
  const {
    reportDate, caseRef, confidence, deceasedName,
    deceasedDOB, deceasedDOD, deathLocation, lastAddress,
    deceasedDetails, familyTree, heirs, probate, sources, methods,
    skipTraces, status, notes, delivery,
  } = data;

  // A draft may not carry certification language at all. This is switched
  // structurally, at each point the words would be emitted, rather than by
  // scrubbing the finished text — by the time you are scrubbing, the document
  // has already been built and the claim has already been made.
  const certified: boolean = delivery?.mode === "certified";
  const watermark = delivery?.watermark || { tone: "draft", title: "DRAFT — NOT CERTIFIED", lines: [] };
  const reportTitle = certified ? "Official Findings Report" : "Draft Investigative Report";
  const watermarkHtml = `
<div style="border:3px solid ${certified ? "#16a34a" : "#dc2626"};background:${certified ? "#f0fdf4" : "#fef2f2"};padding:14px;margin:0 0 24px 0;">
  <div style="font-size:15px;font-weight:800;color:${certified ? "#166534" : "#991b1b"};letter-spacing:1px;">${escapeHtml(watermark.title)}</div>
  ${(watermark.lines || []).map((l: string) => `<div style="font-size:11px;color:${certified ? "#166534" : "#991b1b"};margin-top:6px;">${escapeHtml(l)}</div>`).join("")}
</div>`;

  const confidenceColor = confidence >= 85 ? "#16a34a" : confidence >= 60 ? "#ca8a04" : "#dc2626";
  const confidenceLabel = confidence >= 85 ? "HIGH CONFIDENCE" : confidence >= 60 ? "MODERATE CONFIDENCE" : "LOW CONFIDENCE";

  const formatList = (items: string[], fallback = "Not identified") =>
    items?.length > 0
      ? `<ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`
      : `<p style="color:#64748b;font-style:italic;">${fallback}</p>`;

  const heirRows = heirs
    .map((h: any, i: number) => {
      const phones = (h.phone_numbers || []).map((p: any) => `${p.number || p.display || ""} (${(p.confidence || 0).toFixed(0)}%)`).join(", ");
      const emails = (h.emails || []).map((e: any) => `${e.email || ""} (${(e.confidence || 0).toFixed(0)}%)`).join(", ");
      const social = (h.social_profiles || []).map((s: any) => `${s.platform}: ${s.url || ""}`).join(", ");
      const priorityBadge = {
        primary: '<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:bold;">PRIMARY</span>',
        secondary: '<span style="background:#fef9c3;color:#854d0e;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:bold;">SECONDARY</span>',
        distant: '<span style="background:#f1f5f9;color:#475569;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:bold;">DISTANT</span>',
        unknown: '<span style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:bold;">UNKNOWN</span>',
      }[h.inheritance_priority || "unknown"];

      return `
        <tr>
          <td style="padding:8px;border:1px solid #e2e8f0;font-weight:bold;">${i + 1}</td>
          <td style="padding:8px;border:1px solid #e2e8f0;font-weight:bold;">${escapeHtml(h.name || "Unknown")}</td>
          <td style="padding:8px;border:1px solid #e2e8f0;">${escapeHtml(h.relationship || "—")}</td>
          <td style="padding:8px;border:1px solid #e2e8f0;">${priorityBadge}</td>
          <td style="padding:8px;border:1px solid #e2e8f0;">${h.is_living === false ? "Deceased" : "Living"}</td>
          <td style="padding:8px;border:1px solid #e2e8f0;">${escapeHtml(phones || "—")}</td>
          <td style="padding:8px;border:1px solid #e2e8f0;">${escapeHtml(emails || "—")}</td>
          <td style="padding:8px;border:1px solid #e2e8f0;">${escapeHtml(h.address || "—")}</td>
          <td style="padding:8px;border:1px solid #e2e8f0;text-align:center;font-weight:bold;color:${confidenceColor};">${(h.confidence || 0).toFixed(0)}%</td>
        </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Strategic Minds AI - ${escapeHtml(reportTitle)}</title>
<style>
  body { font-family: 'Inter', Arial, sans-serif; color: #0a1f3c; max-width: 800px; margin: 0 auto; padding: 40px; }
  h1 { font-size: 28px; color: #0086e6; margin-bottom: 4px; }
  h2 { font-size: 18px; color: #0086e6; border-bottom: 2px solid #0086e6; padding-bottom: 6px; margin-top: 32px; }
  h3 { font-size: 14px; color: #0a1f3c; margin-top: 20px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin: 12px 0; }
  th { background: #f1f5f9; padding: 8px; border: 1px solid #e2e8f0; text-align: left; font-weight: bold; }
  .header { text-align: center; padding: 30px 0; border-bottom: 3px solid #0086e6; margin-bottom: 30px; }
  .brand { font-size: 32px; font-weight: 800; letter-spacing: 2px; }
  .brand-accent { color: #00f2ff; }
  .tagline { font-size: 11px; color: #64748b; letter-spacing: 3px; text-transform: uppercase; margin-top: 4px; }
  .case-header { background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; }
  .case-header table { margin: 0; }
  .confidence-badge { display: inline-block; padding: 6px 16px; border-radius: 6px; font-weight: bold; font-size: 13px; color: white; }
  .section { margin: 24px 0; }
  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #64748b; text-align: center; }
  .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 16px 0; font-size: 12px; }
  ul { margin: 4px 0; padding-left: 20px; }
  li { margin: 2px 0; }
</style>
</head>
<body>

<div class="header">
  <div class="brand">STRATEGIC MINDS <span class="brand-accent">AI</span></div>
  <div class="tagline">Intelligence in Motion</div>
  <h1 style="margin-top:20px;">${escapeHtml(reportTitle)}</h1>
  <p style="color:#64748b;font-size:13px;">Forensic Heir Search &amp; Probate Genealogy Investigation</p>
</div>

${watermarkHtml}

<div class="case-header">
  <table style="width:100%;border:none;">
    <tr style="border:none;">
      <td style="border:none;width:50%;"><strong>Case Reference:</strong> ${escapeHtml(caseRef)}</td>
      <td style="border:none;width:50%;"><strong>Report Date:</strong> ${escapeHtml(reportDate)}</td>
    </tr>
    <tr style="border:none;">
      <td style="border:none;"><strong>Subject (Decedent):</strong> ${escapeHtml(deceasedName || "Unknown")}</td>
      <td style="border:none;"><strong>Case Status:</strong> ${escapeHtml((status || "").toUpperCase())}</td>
    </tr>
    <tr style="border:none;">
      <td style="border:none;" colspan="2">
        <strong>${certified ? "Overall Confidence" : "Producer-reported confidence (self-assessed, not evidence)"}:</strong>
        <span class="confidence-badge" style="background:${confidenceColor};">${confidence.toFixed(0)}% — ${certified ? confidenceLabel : "UNVERIFIED, SELF-REPORTED"}</span>
      </td>
    </tr>
  </table>
</div>

${confidence < 85 ? `
<div class="warning">
  <strong>⚠ EVIDENCE GAP NOTICE:</strong> This case has not reached court-ready confidence threshold (85%).
  Additional primary evidence (death certificate, obituary, probate filing) is required before this report
  can be submitted to a court of law. The findings below represent the best available public-record intelligence.
</div>
` : ""}

<h2>1. Decedent Identity Profile</h2>
<table>
  <tr><th style="width:30%;">Field</th><th>Confirmed Value</th></tr>
  <tr><td><strong>Full Legal Name</strong></td><td>${escapeHtml(deceasedDetails.full_name || deceasedName || "Not confirmed")}</td></tr>
  <tr><td><strong>Date of Birth</strong></td><td>${escapeHtml(deceasedDetails.birth_date || deceasedDOB || "Not confirmed")}</td></tr>
  <tr><td><strong>Date of Death</strong></td><td>${escapeHtml(deceasedDetails.death_date || deceasedDOD || "Not confirmed")}</td></tr>
  <tr><td><strong>Last Known Residence</strong></td><td>${escapeHtml(deceasedDetails.last_residence || deathLocation || "Not confirmed")}</td></tr>
  <tr><td><strong>Last Known Address</strong></td><td>${escapeHtml(lastAddress || "Not available")}</td></tr>
  <tr><td><strong>SSN State Issued</strong></td><td>${escapeHtml(deceasedDetails.ssn_state_issued || "Not confirmed")}</td></tr>
  <tr><td><strong>Death Location</strong></td><td>${escapeHtml(deathLocation || "Not confirmed")}</td></tr>
  <tr><td><strong>Identity ${certified ? "Confirmed" : "Status"}</strong></td><td>${deceasedDetails.confidence ? `${certified ? "Yes" : "Producer-reported match, unverified"} (${deceasedDetails.confidence.toFixed(0)}% match)` : "Pending primary evidence"}</td></tr>
</table>

${deceasedDetails.obituary_text ? `
<div ${QUOTED_MATERIAL_ATTRIBUTE}="obituary-excerpt">
<h3>Obituary Excerpt</h3>
<p style="font-style:italic;background:#f8fafc;padding:12px;border-left:3px solid #0086e6;">${escapeHtml(deceasedDetails.obituary_text.substring(0, 1000))}</p>
${deceasedDetails.obituary_url ? `<p style="font-size:11px;">Source: <a href="${escapeHtml(deceasedDetails.obituary_url)}">${escapeHtml(deceasedDetails.obituary_url)}</a></p>` : ""}
</div>
` : ""}

${deceasedDetails.funeral_home ? `<p><strong>Funeral Home:</strong> ${escapeHtml(deceasedDetails.funeral_home)}</p>` : ""}
${deceasedDetails.cause_of_death ? `<p><strong>Cause of Death:</strong> ${escapeHtml(deceasedDetails.cause_of_death)}</p>` : ""}

<h2>2. Family Tree Reconstruction</h2>
<table>
  <tr><th style="width:30%;">Relation</th><th>Identified</th></tr>
  <tr><td><strong>Spouse</strong></td><td>${escapeHtml(familyTree.spouse || "Not identified")}</td></tr>
  <tr><td><strong>Children</strong></td><td>${formatList(familyTree.children)}</td></tr>
  <tr><td><strong>Parents</strong></td><td>${formatList(familyTree.parents)}</td></tr>
  <tr><td><strong>Siblings</strong></td><td>${formatList(familyTree.siblings)}</td></tr>
  <tr><td><strong>Grandchildren</strong></td><td>${formatList(familyTree.grandchildren)}</td></tr>
  <tr><td><strong>Nieces/Nephews</strong></td><td>${formatList(familyTree.nieces_nephews)}</td></tr>
  <tr><td><strong>Aunts/Uncles</strong></td><td>${formatList(familyTree.aunts_uncles)}</td></tr>
  <tr><td><strong>Cousins</strong></td><td>${formatList(familyTree.cousins)}</td></tr>
  <tr><td><strong>Ex-Spouses</strong></td><td>${formatList(familyTree.ex_spouses)}</td></tr>
</table>

<h2>3. Identified Heirs &amp; Contact Intelligence</h2>
${heirs.length > 0 ? `
<p style="font-size:12px;color:#64748b;">${heirs.length} potential heir(s) identified. ${certified ? "Inheritance priority assigned per state intestacy statutes." : "Relationship statements are research candidates, not legal determinations. No legal heir is declared here."}</p>
<table>
  <tr>
    <th>#</th>
    <th>Name</th>
    <th>Relationship</th>
    <th>Priority</th>
    <th>Living</th>
    <th>Phone Numbers</th>
    <th>Emails</th>
    <th>Address</th>
    <th>Conf.</th>
  </tr>
  ${heirRows}
</table>
` : `<p style="color:#dc2626;font-style:italic;">No heirs identified in this search.</p>`}

<h2>4. Probate Court Information</h2>
<table>
  <tr><th style="width:30%;">Field</th><th>Value</th></tr>
  <tr><td><strong>Court/County</strong></td><td>${escapeHtml(probate.court_county || "Not located")}</td></tr>
  <tr><td><strong>Case Number</strong></td><td>${escapeHtml(probate.case_number || "Not located")}</td></tr>
  <tr><td><strong>Executor Name</strong></td><td>${escapeHtml(probate.executor_name || "Not located")}</td></tr>
  <tr><td><strong>Executor Contact</strong></td><td>${escapeHtml(probate.executor_contact || "Not located")}</td></tr>
  <tr><td><strong>Attorney Name</strong></td><td>${escapeHtml(probate.attorney_name || "Not located")}</td></tr>
  <tr><td><strong>Filing Date</strong></td><td>${escapeHtml(probate.filing_date || "Not located")}</td></tr>
  <tr><td><strong>Will Found</strong></td><td>${probate.will_found === true ? "Yes" : probate.will_found === false ? "No" : "Unknown"}</td></tr>
  ${probate.estate_value ? `<tr><td><strong>Estimated Estate Value</strong></td><td>${escapeHtml(probate.estate_value)}</td></tr>` : ""}
</table>

${skipTraces.length > 0 ? `
<h2>5. Skip Trace Intelligence</h2>
<p style="font-size:12px;color:#64748b;">${skipTraces.length} skip trace operation(s) conducted for contact enrichment.</p>
${skipTraces.map((st: any, i: number) => `
<h3>Trace ${i + 1}: ${escapeHtml(st.target_owner_name || deceasedName)}</h3>
<table>
  <tr><th style="width:30%;">Metric</th><th>Value</th></tr>
  <tr><td><strong>Status</strong></td><td>${escapeHtml(st.status || "—")}</td></tr>
  <tr><td><strong>Confidence</strong></td><td>${(st.confidence_score || 0).toFixed(0)}%</td></tr>
  <tr><td><strong>Phones Found</strong></td><td>${(st.found_phone_numbers || []).length}</td></tr>
  <tr><td><strong>Emails Found</strong></td><td>${(st.found_emails || []).length}</td></tr>
  <tr><td><strong>Addresses Found</strong></td><td>${(st.found_addresses || []).length}</td></tr>
  <tr><td><strong>Sources Checked</strong></td><td>${(st.sources_checked || []).length}</td></tr>
</table>
`).join("")}
` : ""}

<h2>6. Sources &amp; Methodology</h2>
<h3>Data Sources Queried (${sources.length})</h3>
${sources.length > 0 ? `
<table>
  <tr><th style="width:5%;">#</th><th>Source</th></tr>
  ${sources.map((s: string, i: number) => `<tr><td>${i + 1}</td><td>${escapeHtml(s)}</td></tr>`).join("")}
</table>
` : `<p style="color:#64748b;">No sources recorded.</p>`}

<h3>Search Methods Executed (${methods.length})</h3>
${methods.length > 0 ? `
<ul>
  ${methods.map((m: string) => `<li>${escapeHtml(m)}</li>`).join("")}
</ul>
` : `<p style="color:#64748b;">No methods recorded.</p>`}

<h2>7. Confidence Assessment</h2>
<table>
  <tr><th style="width:40%;">Assessment Factor</th><th>Score</th></tr>
  <tr><td><strong>Overall Confidence Score</strong></td><td style="font-weight:bold;color:${confidenceColor};">${confidence.toFixed(0)} / 100</td></tr>
  <tr><td><strong>${certified ? "Court-Ready Threshold" : "Self-reported threshold used by the producer"}</strong></td><td>85 / 100</td></tr>
  <tr><td><strong>Status</strong></td><td>${certified ? "Independently certified" : "Not certified — additional evidence and independent review required"}</td></tr>
</table>

${confidence < 85 ? `
<h3>Required Actions for Court Readiness</h3>
<ul>
  <li>Obtain certified death certificate from state vital records</li>
  <li>Cross-verify decedent identity with primary source documentation</li>
  <li>Confirm heir relationships with vital records (birth/marriage certificates)</li>
  <li>Validate probate court filings with county clerk</li>
</ul>
` : ""}

${notes ? `
<div ${QUOTED_MATERIAL_ATTRIBUTE}="operator-notes">
<h2>8. Investigator Notes</h2>
<p style="font-size:12px;white-space:pre-wrap;">${escapeHtml(notes)}</p>
</div>
` : ""}

<div class="footer">
  <p><strong>STRATEGIC MINDS AI</strong> — Intelligence in Motion</p>
  <p>This report was generated autonomously by the Strategic Minds AI Forensic Genealogy Engine.</p>
  <p>Report ID: ${escapeHtml(caseRef)} | Generated: ${escapeHtml(reportDate)} | Confidence: ${confidence.toFixed(0)}%</p>
  <p style="margin-top:8px;font-weight:bold;color:${certified ? "#166534" : "#991b1b"};">${escapeHtml(watermark.title)}</p>
  <p style="margin-top:8px;font-style:italic;">This document contains confidential investigative findings intended for legal professionals and authorized recipients only.</p>
</div>

</body>
</html>`;
}

function escapeHtml(str: string): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}