import { jsPDF } from "jspdf";

/**
 * Strategic Minds AI — Professional Skip Trace Report Generator
 * Branded letterhead with dark background, electric blue accents, "S" logo.
 * Generates an evidence-linked investigative working report for supplied subjects. Not a legal opinion or court certification.
 */

const COLORS = {
  bg: [5, 7, 10],          // #05070a deep obsidian
  bgCard: [12, 16, 22],     // card surface
  blue: [201, 169, 97],       // #c9a961 brand gold
  blueBright: [224, 207, 158], // #e0cf9e light gold highlight
  white: [255, 255, 255],
  silver: [200, 210, 222],   // metallic silver
  grey: [120, 130, 145],     // muted
  greyDark: [60, 68, 80],
  red: [239, 68, 68],
  green: [34, 197, 94],
  amber: [245, 158, 11],
};

export function generateStrategicReportPDF({ subjects, playbook }) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const margin = 48;

  // ===== COVER PAGE =====
  drawCoverPage(doc, W, H, margin, subjects);

  // ===== EXECUTIVE SUMMARY =====
  doc.addPage();
  let y = drawHeader(doc, W, margin, "EXECUTIVE SUMMARY");
  y += 20;
  doc.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  const summaryText = `This report summarizes the case records and evidence supplied to Strategic Minds AI for ${subjects.length} subject(s). It does not claim that a particular source was searched unless that source is listed in the case evidence. Coverage, freshness, and verification depend on the source records attached to each subject.\n\nNames, contact details, addresses, relationships, and property associations should be treated as unverified leads unless the report includes a traceable source reference and an explicit verification status. Conflicting observations and unresolved identity matches require human review; confidence scores are not proof of identity or ownership.\n\nThis document is an investigative working report, not a legal opinion, court certification, or guarantee of completeness. Review the evidence register and source limitations before relying on any finding.`;
  const summaryLines = doc.splitTextToSize(summaryText, W - margin * 2);
  doc.text(summaryLines, margin, y);
  y += summaryLines.length * 15 + 20;

  // Subject overview table
  doc.setTextColor(COLORS.blue[0], COLORS.blue[1], COLORS.blue[2]);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("SUBJECT OVERVIEW", margin, y);
  y += 16;
  subjects.forEach((s, i) => {
    doc.setFillColor(COLORS.bgCard[0], COLORS.bgCard[1], COLORS.bgCard[2]);
    doc.roundedRect(margin, y - 10, W - margin * 2, 36, 4, 4, "F");
    doc.setDrawColor(COLORS.blue[0], COLORS.blue[1], COLORS.blue[2]);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, y - 10, W - margin * 2, 36, 4, 4, "S");
    doc.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`${i + 1}. ${s.target}`, margin + 12, y + 4);
    doc.setTextColor(COLORS.grey[0], COLORS.grey[1], COLORS.grey[2]);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(s.address || "Address not on file", margin + 12, y + 18);
    doc.setTextColor(COLORS.blueBright[0], COLORS.blueBright[1], COLORS.blueBright[2]);
    doc.setFont("helvetica", "bold");
    doc.text(`${s.confidence}% confidence`, W - margin - 12, y + 4, { align: "right" });
    doc.setTextColor(COLORS.grey[0], COLORS.grey[1], COLORS.grey[2]);
    doc.setFont("helvetica", "normal");
    doc.text(`${s.phones?.length || 0} phones  ${s.emails?.length || 0} emails  ${s.addresses?.length || 0} addresses`, W - margin - 12, y + 18, { align: "right" });
    y += 44;
  });

  // ===== INDIVIDUAL SUBJECT REPORTS =====
  subjects.forEach((subject, idx) => {
    doc.addPage();
    y = drawHeader(doc, W, margin, `SUBJECT ${idx + 1} OF ${subjects.length}`);
    y = drawSubjectReport(doc, subject, W, H, margin, y);
  });

  // ===== DATA VERIFICATION & METHODOLOGY =====
  doc.addPage();
  y = drawHeader(doc, W, margin, "DATA VERIFICATION & METHODOLOGY");
  y += 20;
  doc.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const methodIntro = "This section describes evidence limitations; it is not a checklist of sources searched. Only source observations actually attached to a subject may be treated as evidence. A source name or URL alone does not establish identity, ownership, or the truth of a claim. Each observation should retain its source reference, retrieval time where available, verification status, and any conflicting observations. Missing source records mean the corresponding research coverage is unknown, not completed.";
  const methodLines = doc.splitTextToSize(methodIntro, W - margin * 2);
  doc.text(methodLines, margin, y);
  y += methodLines.length * 14 + 16;

  const evidenceSummary = subjects.map((subject) => {
    const evidence = Array.isArray(subject.evidence_records) ? subject.evidence_records : [];
    const sourceRefs = evidence
      .map((record) => record?.source_url || record?.source_name || record?.source)
      .filter((value) => typeof value === "string" && value.trim());
    return {
      subject: subject.target || "Unidentified subject",
      refs: [...new Set(sourceRefs)],
      count: evidence.length,
    };
  });
  evidenceSummary.forEach((entry) => {
    const lines = doc.splitTextToSize(
      `${entry.subject}: ${entry.count} attached evidence record(s). ${entry.refs.length ? entry.refs.join("; ") : "No source references supplied"}`,
      W - margin * 2
    );
    if (y + lines.length * 12 > H - 80) {
      doc.addPage();
      y = drawHeader(doc, W, margin, "ATTACHED EVIDENCE REFERENCES") + 20;
    }
    doc.setTextColor(COLORS.silver[0], COLORS.silver[1], COLORS.silver[2]);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(lines, margin, y);
    y += lines.length * 12 + 8;
  });

  // ===== PAGE NUMBERS ON ALL PAGES =====
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    if (p > 1) drawFooter(doc, W, H, margin, p, pageCount);
  }

  return doc;
}

export function downloadStrategicReportPDF(data) {
  const doc = generateStrategicReportPDF(data);
  doc.save(`StrategicMindsAI_SkipTraceReport_${new Date().toISOString().split("T")[0]}.pdf`);
}

// ─── COVER PAGE ───────────────────────────────────────────────────────────
function drawCoverPage(doc, W, H, margin, subjects) {
  // Full dark background
  doc.setFillColor(COLORS.bg[0], COLORS.bg[1], COLORS.bg[2]);
  doc.rect(0, 0, W, H, "F");

  // Subtle blue radial glow (simulated with concentric circles)
  for (let r = 180; r > 0; r -= 20) {
    doc.setFillColor(0, 168, 255, 0.015);
    doc.circle(W / 2, H * 0.35, r, "F");
  }

  // "S" Logo — metallic ring with stylized S
  const logoX = W / 2;
  const logoY = H * 0.28;
  doc.setDrawColor(COLORS.blue[0], COLORS.blue[1], COLORS.blue[2]);
  doc.setLineWidth(2.5);
  doc.circle(logoX, logoY, 32, "S");
  doc.setLineWidth(1);
  doc.setDrawColor(COLORS.blueBright[0], COLORS.blueBright[1], COLORS.blueBright[2]);
  doc.circle(logoX, logoY, 28, "S");
  doc.setTextColor(COLORS.silver[0], COLORS.silver[1], COLORS.silver[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(36);
  doc.text("S", logoX - 11, logoY + 12);

  // Company name
  doc.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text("STRATEGIC MINDS", W / 2, logoY + 62, { align: "center" });
  doc.setTextColor(COLORS.blueBright[0], COLORS.blueBright[1], COLORS.blueBright[2]);
  doc.text("AI", W / 2 + 100, logoY + 62, { align: "center" });

  // Tagline
  doc.setTextColor(COLORS.silver[0], COLORS.silver[1], COLORS.silver[2]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("I N T E L L I G E N C E   I N   M O T I O N", W / 2, logoY + 80, { align: "center" });

  // Divider line
  doc.setDrawColor(COLORS.blue[0], COLORS.blue[1], COLORS.blue[2]);
  doc.setLineWidth(0.5);
  doc.line(margin + 80, logoY + 95, W - margin - 80, logoY + 95);

  // Report title
  doc.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("FORENSIC SKIP TRACE REPORT", W / 2, logoY + 125, { align: "center" });
  doc.setTextColor(COLORS.blue[0], COLORS.blue[1], COLORS.blue[2]);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Confidential Investigative Document", W / 2, logoY + 142, { align: "center" });

  // Subject list
  doc.setTextColor(COLORS.silver[0], COLORS.silver[1], COLORS.silver[2]);
  doc.setFontSize(9);
  doc.text(`Prepared for: ${subjects.length} Subject Investigation`, W / 2, logoY + 165, { align: "center" });
  subjects.forEach((s, i) => {
    doc.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`${i + 1}. ${s.target}`, W / 2, logoY + 185 + i * 16, { align: "center" });
  });

  // Date
  doc.setTextColor(COLORS.grey[0], COLORS.grey[1], COLORS.grey[2]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  doc.text(`Date of Report: ${dateStr}`, W / 2, H - 90, { align: "center" });

  // Footer bar
  doc.setFillColor(COLORS.blue[0], COLORS.blue[1], COLORS.blue[2]);
  doc.rect(0, H - 50, W, 1.5, "F");
  doc.setTextColor(COLORS.blue[0], COLORS.blue[1], COLORS.blue[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("AI STRATEGY  •  AUTOMATION  •  GROWTH  •  REAL RESULTS", W / 2, H - 30, { align: "center" });
  doc.setTextColor(COLORS.grey[0], COLORS.grey[1], COLORS.grey[2]);
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.text("CONFIDENTIAL — For authorized recipient use only", W / 2, H - 18, { align: "center" });
}

// ─── PAGE HEADER (dark band) ───────────────────────────────────────────────
function drawHeader(doc, W, margin, title) {
  doc.setFillColor(COLORS.bg[0], COLORS.bg[1], COLORS.bg[2]);
  doc.rect(0, 0, W, 70, "F");
  doc.setFillColor(COLORS.blue[0], COLORS.blue[1], COLORS.blue[2]);
  doc.rect(0, 68, W, 1.5, "F");

  // Mini S logo
  doc.setDrawColor(COLORS.blue[0], COLORS.blue[1], COLORS.blue[2]);
  doc.setLineWidth(1);
  doc.circle(margin + 10, 35, 10, "S");
  doc.setTextColor(COLORS.silver[0], COLORS.silver[1], COLORS.silver[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("S", margin + 6, 39);

  doc.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
  doc.setFontSize(11);
  doc.text("STRATEGIC MINDS", margin + 28, 32);
  doc.setTextColor(COLORS.blueBright[0], COLORS.blueBright[1], COLORS.blueBright[2]);
  doc.text("AI", margin + 28 + 76, 32);
  doc.setTextColor(COLORS.grey[0], COLORS.grey[1], COLORS.grey[2]);
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.text("INTELLIGENCE IN MOTION", margin + 28, 44);

  doc.setTextColor(COLORS.blueBright[0], COLORS.blueBright[1], COLORS.blueBright[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(title, W - margin, 35, { align: "right" });

  return 90;
}

// ─── PAGE FOOTER ───────────────────────────────────────────────────────────
function drawFooter(doc, W, H, margin, pageNum, totalPages) {
  const fy = H - 35;
  doc.setDrawColor(COLORS.greyDark[0], COLORS.greyDark[1], COLORS.greyDark[2]);
  doc.setLineWidth(0.3);
  doc.line(margin, fy, W - margin, fy);
  doc.setTextColor(COLORS.grey[0], COLORS.grey[1], COLORS.grey[2]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.text("Strategic Minds AI  |  Intelligence in Motion  |  AI Strategy • Automation • Growth", margin, fy + 12);
  doc.text(`Page ${pageNum} of ${totalPages}`, W - margin, fy + 12, { align: "right" });
  doc.text("CONFIDENTIAL", W / 2, fy + 12, { align: "center" });
}

// ─── SUBJECT REPORT ────────────────────────────────────────────────────────
function drawSubjectReport(doc, subject, W, H, margin, y) {
  // Subject name banner
  doc.setFillColor(COLORS.bgCard[0], COLORS.bgCard[1], COLORS.bgCard[2]);
  doc.roundedRect(margin, y, W - margin * 2, 32, 4, 4, "F");
  doc.setFillColor(COLORS.blue[0], COLORS.blue[1], COLORS.blue[2]);
  doc.rect(margin, y, 3, 32, "F");
  doc.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(subject.target || "Unknown Subject", margin + 12, y + 20);
  doc.setTextColor(COLORS.blueBright[0], COLORS.blueBright[1], COLORS.blueBright[2]);
  doc.setFontSize(9);
  doc.text(`${subject.confidence}% CONFIDENCE`, W - margin - 12, y + 20, { align: "right" });
  y += 44;

  // Target address
  drawField(doc, "Target Address", subject.address || "—", margin, y, W);
  y += 22;
  drawField(doc, "Investigation Status", (subject.status || "—").toUpperCase(), margin, y, W);
  y += 22;
  drawField(doc, "Sources Queried", `${subject.sources_count || 0} sources across ${subject.methods_count || 0} methods`, margin, y, W);
  y += 22;
  drawField(doc, "Search Duration", `${((subject.duration || 0) / 1000).toFixed(1)} seconds`, margin, y, W);
  y += 28;

  // Executive Summary
  y = checkBreak(doc, y, H, 120);
  drawSectionTitle(doc, "EXECUTIVE SUMMARY", margin, y);
  y += 18;
  doc.setTextColor(COLORS.silver[0], COLORS.silver[1], COLORS.silver[2]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const execText = subject.exec_summary || subject.full_report?.executive_summary || "No executive summary available.";
  const execLines = doc.splitTextToSize(execText, W - margin * 2);
  doc.text(execLines, margin, y);
  y += execLines.length * 13 + 16;

  // Key Findings
  if (subject.full_report?.key_findings?.length) {
    y = checkBreak(doc, y, H, 80);
    drawSectionTitle(doc, "KEY FINDINGS", margin, y);
    y += 18;
    subject.full_report.key_findings.forEach((finding) => {
      y = checkBreak(doc, y, H, 30);
      doc.setFillColor(COLORS.blue[0], COLORS.blue[1], COLORS.blue[2]);
      doc.circle(margin + 3, y - 3, 1.5, "F");
      doc.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(finding, W - margin * 2 - 12);
      doc.text(lines, margin + 10, y);
      y += lines.length * 13 + 4;
    });
    y += 8;
  }

  // Contact Information
  y = checkBreak(doc, y, H, 80);
  drawSectionTitle(doc, "CONTACT INFORMATION", margin, y);
  y += 18;

  // Phones
  if (subject.phones?.length) {
    doc.setTextColor(COLORS.grey[0], COLORS.grey[1], COLORS.grey[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("PHONE NUMBERS", margin, y);
    y += 14;
    subject.phones.slice(0, 8).forEach((phone, i) => {
      doc.setTextColor(COLORS.blueBright[0], COLORS.blueBright[1], COLORS.blueBright[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(`${i + 1}.`, margin, y);
      doc.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
      doc.text(phone, margin + 16, y);
      y += 14;
    });
    y += 6;
  }

  // Emails
  if (subject.emails?.length) {
    y = checkBreak(doc, y, H, 60);
    doc.setTextColor(COLORS.grey[0], COLORS.grey[1], COLORS.grey[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("EMAIL ADDRESSES", margin, y);
    y += 14;
    subject.emails.slice(0, 6).forEach((email) => {
      doc.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`• ${email}`, margin + 8, y);
      y += 14;
    });
    y += 6;
  }

  // Addresses
  if (subject.addresses?.length) {
    y = checkBreak(doc, y, H, 60);
    doc.setTextColor(COLORS.grey[0], COLORS.grey[1], COLORS.grey[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("ADDRESSES FOUND", margin, y);
    y += 14;
    subject.addresses.slice(0, 6).forEach((addr) => {
      if (addr && !addr.toLowerCase().includes("not specified") && !addr.toLowerCase().includes("not found") && !addr.toLowerCase().includes("data not")) {
        doc.setTextColor(COLORS.silver[0], COLORS.silver[1], COLORS.silver[2]);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        const lines = doc.splitTextToSize(`• ${addr}`, W - margin * 2 - 8);
        doc.text(lines, margin + 8, y);
        y += lines.length * 12 + 2;
      }
    });
    y += 6;
  }

  // Social Profiles
  if (subject.social?.length) {
    y = checkBreak(doc, y, H, 60);
    doc.setTextColor(COLORS.grey[0], COLORS.grey[1], COLORS.grey[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("SOCIAL MEDIA PROFILES", margin, y);
    y += 14;
    subject.social.slice(0, 5).forEach((soc) => {
      doc.setTextColor(COLORS.blueBright[0], COLORS.blueBright[1], COLORS.blueBright[2]);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      const lines = doc.splitTextToSize(`• ${soc}`, W - margin * 2 - 8);
      doc.text(lines, margin + 8, y);
      y += lines.length * 12 + 2;
    });
    y += 6;
  }

  // Relatives & Associates
  if (subject.relatives?.length) {
    y = checkBreak(doc, y, H, 60);
    drawSectionTitle(doc, "RELATIVES & ASSOCIATES", margin, y);
    y += 18;
    subject.relatives.slice(0, 10).forEach((rel) => {
      if (rel.name && !rel.name.toLowerCase().includes("not specified") && !rel.name.toLowerCase().includes("not found") && !rel.name.toLowerCase().includes("data not")) {
        doc.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(`• ${rel.name}`, margin + 8, y);
        doc.setTextColor(COLORS.grey[0], COLORS.grey[1], COLORS.grey[2]);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.text(rel.relationship || "", W - margin - 8, y, { align: "right" });
        y += 14;
      }
    });
    y += 6;
  }

  // Evidence Chain
  if (subject.full_report?.evidence_chain?.length) {
    y = checkBreak(doc, y, H, 80);
    drawSectionTitle(doc, "EVIDENCE CHAIN", margin, y);
    y += 18;
    subject.full_report.evidence_chain.forEach((ev) => {
      y = checkBreak(doc, y, H, 30);
      doc.setTextColor(COLORS.silver[0], COLORS.silver[1], COLORS.silver[2]);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      const lines = doc.splitTextToSize(`▸ ${ev}`, W - margin * 2 - 10);
      doc.text(lines, margin + 8, y);
      y += lines.length * 12 + 4;
    });
    y += 8;
  }

  // Recommended Actions
  if (subject.full_report?.recommended_actions?.length) {
    y = checkBreak(doc, y, H, 80);
    drawSectionTitle(doc, "RECOMMENDED ACTIONS", margin, y);
    y += 18;
    subject.full_report.recommended_actions.forEach((action, i) => {
      y = checkBreak(doc, y, H, 30);
      doc.setFillColor(COLORS.blue[0], COLORS.blue[1], COLORS.blue[2]);
      doc.circle(margin + 4, y - 3, 2, "F");
      doc.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(`${i + 1}. ${action}`, W - margin * 2 - 14);
      doc.text(lines, margin + 12, y);
      y += lines.length * 13 + 4;
    });
    y += 8;
  }

  // Risk Assessment
  if (subject.enrichment?.risk_flags?.length) {
    y = checkBreak(doc, y, H, 60);
    drawSectionTitle(doc, "RISK ASSESSMENT", margin, y);
    y += 18;
    subject.enrichment.risk_flags.forEach((flag) => {
      doc.setTextColor(COLORS.amber[0], COLORS.amber[1], COLORS.amber[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(`⚠ ${flag}`, margin + 8, y);
      y += 13;
    });
    y += 8;
  }

  // Data Quality Assessment
  if (subject.full_report?.data_quality_assessment) {
    y = checkBreak(doc, y, H, 60);
    drawSectionTitle(doc, "DATA QUALITY ASSESSMENT", margin, y);
    y += 18;
    doc.setTextColor(COLORS.silver[0], COLORS.silver[1], COLORS.silver[2]);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const dqLines = doc.splitTextToSize(subject.full_report.data_quality_assessment, W - margin * 2);
    doc.text(dqLines, margin, y);
    y += dqLines.length * 12 + 10;
  }

  return y;
}

// ─── HELPERS ───────────────────────────────────────────────────────────────
function drawField(doc, label, value, x, y, W) {
  const margin = 48;
  doc.setTextColor(COLORS.grey[0], COLORS.grey[1], COLORS.grey[2]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(label.toUpperCase(), x, y);
  doc.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  const valLines = doc.splitTextToSize(String(value), W - margin * 2 - 130);
  doc.text(valLines, x + 130, y);
}

function drawSectionTitle(doc, title, x, y) {
  doc.setFillColor(COLORS.blue[0], COLORS.blue[1], COLORS.blue[2]);
  doc.rect(x, y - 9, 3, 14, "F");
  doc.setTextColor(COLORS.blueBright[0], COLORS.blueBright[1], COLORS.blueBright[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(title, x + 8, y);
}

function checkBreak(doc, y, H, needed) {
  if (y + needed > H - 60) {
    doc.addPage();
    return 90;
  }
  return y;
}