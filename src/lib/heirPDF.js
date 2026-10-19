import { jsPDF } from "jspdf";

/**
 * Generates a professional PDF report from heir search results.
 * Includes Strategic Cloud Browser branding, case info, family tree,
 * identified heirs with contact info, probate details, and confidence scoring.
 */
export function generateHeirPDF(caseData) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const margin = 48;
  let y = 0;

  // === HEADER BAND ===
  doc.setFillColor(5, 8, 13);
  doc.rect(0, 0, W, 80, "F");
  doc.setFillColor(0, 163, 255);
  doc.rect(0, 78, W, 2, "F");

  // Brand mark
  doc.setDrawColor(0, 163, 255);
  doc.setLineWidth(1.5);
  doc.circle(margin + 14, 40, 14, "S");
  doc.setTextColor(200, 210, 222);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("S", margin + 9, 46);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text("STRATEGIC CLOUD BROWSER", margin + 40, 34);
  doc.setTextColor(0, 163, 255);
  doc.setFontSize(8);
  doc.text("INTELLIGENCE IN MOTION", margin + 40, 48);
  doc.setTextColor(150, 160, 175);
  doc.setFontSize(7);
  doc.text("AI STRATEGY  |  AUTOMATION  |  GROWTH", margin + 40, 60);

  // Report title
  doc.setTextColor(0, 163, 255);
  doc.setFontSize(9);
  doc.text("HEIR SEARCH REPORT", W - margin, 34, { align: "right" });
  doc.setTextColor(150, 160, 175);
  doc.setFontSize(7);
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  doc.text(dateStr, W - margin, 48, { align: "right" });

  y = 110;

  // === CASE INFORMATION ===
  sectionHeader(doc, "CASE INFORMATION", margin, y, W);
  y += 28;
  const dd = caseData.deceased_details || {};
  const infoLines = [
    ["Deceased Name", caseData.deceased_name || "—"],
    ["Case Reference", caseData.case_reference || "—"],
    ["Status", (caseData.status || "—").toUpperCase()],
    ["Date of Birth", dd.birth_date || caseData.deceased_dob || "—"],
    ["Date of Death", dd.death_date || dd.death_date || caseData.deceased_dod || "—"],
    ["Last Residence", dd.last_residence || caseData.deceased_last_address || "—"],
    ["Death Location", caseData.death_location || "—"],
    ["Confidence Score", `${caseData.confidence_score || 0}%`],
  ];
  infoLines.forEach(([label, value]) => {
    doc.setTextColor(120, 130, 145);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(label, margin, y);
    doc.setTextColor(30, 35, 45);
    doc.setFont("helvetica", "bold");
    doc.text(String(value), margin + 140, y);
    y += 18;
  });

  y += 10;

  // === DECEASED CONFIRMATION ===
  if (dd.obituary_text || dd.funeral_home || dd.spouse_name) {
    sectionHeader(doc, "DECEASED CONFIRMATION", margin, y, W);
    y += 28;
    if (dd.funeral_home) { drawRow(doc, "Funeral Home", dd.funeral_home, margin, y); y += 18; }
    if (dd.spouse_name) { drawRow(doc, "Spouse", dd.spouse_name, margin, y); y += 18; }
    if (dd.parents_names?.length) { drawRow(doc, "Parents", dd.parents_names.join(", "), margin, y); y += 18; }
    if (dd.children_names?.length) { drawRow(doc, "Children", dd.children_names.join(", "), margin, y); y += 18; }
    if (dd.siblings_names?.length) { drawRow(doc, "Siblings", dd.siblings_names.join(", "), margin, y); y += 18; }
    if (dd.obituary_text) {
      y += 6;
      doc.setTextColor(120, 130, 145);
      doc.setFontSize(8);
      doc.text("Obituary Excerpt:", margin, y);
      y += 14;
      doc.setTextColor(60, 65, 75);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      const obLines = doc.splitTextToSize(dd.obituary_text.substring(0, 500) + "...", W - margin * 2);
      doc.text(obLines, margin, y);
      y += obLines.length * 12 + 10;
    }
  }

  // === FAMILY TREE ===
  const ft = caseData.family_tree || {};
  if (ft.spouse || ft.children?.length || ft.parents?.length || ft.siblings?.length) {
    checkPageBreak(doc, y, 120);
    sectionHeader(doc, "FAMILY TREE", margin, y, W);
    y += 28;
    if (ft.spouse) { drawRow(doc, "Spouse", ft.spouse, margin, y); y += 18; }
    if (ft.ex_spouses?.length) { drawRow(doc, "Ex-Spouse(s)", ft.ex_spouses.join(", "), margin, y); y += 18; }
    if (ft.children?.length) { drawRow(doc, "Children", ft.children.join(", "), margin, y); y += 18; }
    if (ft.parents?.length) { drawRow(doc, "Parents", ft.parents.join(", "), margin, y); y += 18; }
    if (ft.siblings?.length) { drawRow(doc, "Siblings", ft.siblings.join(", "), margin, y); y += 18; }
    if (ft.grandchildren?.length) { drawRow(doc, "Grandchildren", ft.grandchildren.join(", "), margin, y); y += 18; }
    if (ft.nieces_nephews?.length) { drawRow(doc, "Nieces/Nephews", ft.nieces_nephews.join(", "), margin, y); y += 18; }
    if (ft.cousins?.length) { drawRow(doc, "Cousins", ft.cousins.join(", "), margin, y); y += 18; }
  }

  // === PROBATE INFO ===
  const pi = caseData.probate_info || {};
  if (pi.court_county || pi.case_number || pi.executor_name) {
    checkPageBreak(doc, y, 120);
    sectionHeader(doc, "PROBATE COURT RECORDS", margin, y, W);
    y += 28;
    if (pi.court_county) { drawRow(doc, "Court County", pi.court_county, margin, y); y += 18; }
    if (pi.case_number) { drawRow(doc, "Case Number", pi.case_number, margin, y); y += 18; }
    if (pi.executor_name) { drawRow(doc, "Executor", pi.executor_name, margin, y); y += 18; }
    if (pi.executor_contact) { drawRow(doc, "Executor Contact", pi.executor_contact, margin, y); y += 18; }
    if (pi.attorney_name) { drawRow(doc, "Attorney", pi.attorney_name, margin, y); y += 18; }
    if (pi.filing_date) { drawRow(doc, "Filing Date", pi.filing_date, margin, y); y += 18; }
    if (pi.estate_value) { drawRow(doc, "Estate Value", pi.estate_value, margin, y); y += 18; }
    if (pi.will_found !== undefined) { drawRow(doc, "Will Found", pi.will_found ? "Yes" : "No / Unknown", margin, y); y += 18; }
  }

  // === IDENTIFIED HEIRS ===
  const heirs = caseData.identified_heirs || [];
  if (heirs.length > 0) {
    checkPageBreak(doc, y, 80);
    sectionHeader(doc, `IDENTIFIED HEIRS (${heirs.length})`, margin, y, W);
    y += 28;

    const sorted = [...heirs].sort((a, b) => (a.relationship_degree || 9) - (b.relationship_degree || 9));
    sorted.forEach((heir, i) => {
      checkPageBreak(doc, y, 100);

      // Heir card background
      doc.setFillColor(248, 250, 253);
      doc.setDrawColor(225, 230, 238);
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, y - 12, W - margin * 2, 16, 3, 3, "FD");
      doc.setTextColor(0, 163, 255);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(`${i + 1}. ${heir.name || "Unknown"}`, margin + 10, y);
      doc.setTextColor(100, 110, 125);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      const relText = `${heir.relationship || "relative"} | ${heir.inheritance_priority || "unknown"} heir | ${heir.is_living === false ? "likely deceased" : "living"} | confidence: ${heir.confidence || 0}%`;
      doc.text(relText, W - margin - 10, y, { align: "right" });
      y += 16;

      if (heir.phone_numbers?.length) {
        const phones = heir.phone_numbers.map(p => p.number).join(", ");
        drawRow(doc, "  Phones", phones, margin, y); y += 16;
      }
      if (heir.emails?.length) {
        const emails = heir.emails.map(e => e.email).join(", ");
        drawRow(doc, "  Emails", emails, margin, y); y += 16;
      }
      if (heir.address) {
        drawRow(doc, "  Address", heir.address, margin, y); y += 16;
      }
      if (heir.age_or_dob) {
        drawRow(doc, "  Age/DOB", heir.age_or_dob, margin, y); y += 16;
      }
      if (heir.notes) {
        drawRow(doc, "  Notes", heir.notes, margin, y); y += 16;
      }
      y += 8;
    });
  }

  // === SOURCES & METHODS ===
  if (caseData.sources_checked?.length || caseData.methods_used?.length) {
    checkPageBreak(doc, y, 80);
    sectionHeader(doc, "RESEARCH METHODOLOGY", margin, y, W);
    y += 28;
    if (caseData.sources_checked?.length) {
      drawRow(doc, "Sources Checked", `${caseData.sources_checked.length} sources`, margin, y); y += 18;
      doc.setTextColor(80, 85, 95);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      const srcLines = doc.splitTextToSize(caseData.sources_checked.join(", "), W - margin * 2 - 140);
      doc.text(srcLines, margin + 140, y - 18);
      y += srcLines.length * 11;
    }
    if (caseData.methods_used?.length) {
      drawRow(doc, "Methods Used", `${caseData.methods_used.length} methods`, margin, y); y += 18;
    }
  }

  // === FOOTER ===
  const footerY = H - 60;
  doc.setFillColor(5, 8, 13);
  doc.rect(0, footerY, W, 60, "F");
  doc.setFillColor(0, 163, 255);
  doc.rect(0, footerY, W, 1.5, "F");

  doc.setTextColor(0, 163, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("STRATEGIC CLOUD BROWSER", margin, footerY + 22);
  doc.setTextColor(120, 130, 145);
  doc.setFontSize(6);
  doc.text("AI STRATEGY  |  AUTOMATION  |  GROWTH  |  REAL RESULTS", margin, footerY + 34);
  doc.text("Intelligence in Motion — Production-grade heir search & forensic genealogy", margin, footerY + 44);

  // Page numbers
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setTextColor(150, 160, 175);
    doc.setFontSize(7);
    doc.text(`Page ${p} of ${pageCount}`, W - margin, H - 25, { align: "right" });
  }

  return doc;
}

export function downloadHeirPDF(caseData) {
  const doc = generateHeirPDF(caseData);
  const name = (caseData.deceased_name || "HeirSearch").replace(/[^a-zA-Z0-9]/g, "_");
  doc.save(`HeirSearch_${name}.pdf`);
}

// === Helpers ===
function sectionHeader(doc, title, x, y, W) {
  doc.setFillColor(240, 245, 250);
  doc.rect(x, y - 14, W - x * 2, 22, "F");
  doc.setFillColor(0, 163, 255);
  doc.rect(x, y - 14, 3, 22, "F");
  doc.setTextColor(20, 25, 35);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(title, x + 12, y);
}

function drawRow(doc, label, value, x, y) {
  doc.setTextColor(120, 130, 145);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(label, x, y);
  doc.setTextColor(30, 35, 45);
  doc.setFont("helvetica", "bold");
  const valLines = doc.splitTextToSize(String(value), 300);
  doc.text(valLines, x + 140, y);
}

function checkPageBreak(doc, y, needed) {
  const H = doc.internal.pageSize.getHeight();
  if (y + needed > H - 80) {
    doc.addPage();
    return 60;
  }
  return y;
}