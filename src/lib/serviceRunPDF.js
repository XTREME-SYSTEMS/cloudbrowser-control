import { jsPDF } from "jspdf";

/**
 * The one download for a finished run: the whole result as a document, with the
 * verdict, the nine stages and their results, the reviews that judged it, and
 * every piece of evidence with its source and retrieval time — including the
 * sources that could not be reached.
 *
 * Deliberately not a marketing PDF: it states the verdict it actually got, and
 * a refused run downloads as a refusal with the reason on the first page.
 */
export function downloadServiceRunPDF(run) {
  if (!run) return;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;
  const maxWidth = W - M * 2;
  let y = 0;

  const newPage = () => {
    doc.addPage();
    y = M;
  };
  const ensure = (needed) => {
    if (y + needed > doc.internal.pageSize.getHeight() - M) newPage();
  };
  const line = (text, opts = {}) => {
    const { size = 10, bold = false, color = [31, 41, 55], gap = 4, indent = 0 } = opts;
    doc.setFontSize(size);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(String(text || ""), maxWidth - indent);
    lines.forEach((l) => {
      ensure(size + 4);
      doc.text(l, M + indent, y);
      y += size + gap;
    });
  };
  const heading = (text) => {
    y += 10;
    ensure(30);
    line(text, { size: 12, bold: true, color: [10, 31, 60], gap: 6 });
  };

  // Cover
  doc.setFillColor(10, 31, 60);
  doc.rect(0, 0, W, 90, "F");
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(run.service_name || "Service run", M, 46);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Run ${run.id || ""} · ${new Date(run.created_date || Date.now()).toLocaleString()}`, M, 66);
  y = 120;

  line(`Instruction of record: "${run.input_sentence || ""}"`, { size: 10, color: [71, 85, 105] });
  y += 6;

  const verdictColors = {
    delivered: [22, 101, 52],
    conditional: [146, 100, 10],
    blocked: [153, 27, 27],
    failed: [153, 27, 27],
  };
  line(`Verdict: ${String(run.verdict || "unknown").toUpperCase()}`, { size: 13, bold: true, color: verdictColors[run.verdict] || [31, 41, 55] });
  line(`Score: ${run.overall_score ?? 0}/100 · Delivery permitted: ${run.delivery_allowed ? "yes" : "no"}`, { size: 10 });
  if (run.block_reason) {
    line(`Why: ${run.block_reason}`, { size: 10, bold: true, color: [153, 27, 27] });
  }
  line(
    `Evidence: ${run.evidence_status || "absent"} — ${(run.evidence || []).length} item(s). Only mechanically re-verified evidence counts as verified.`,
    { size: 9, color: [71, 85, 105] },
  );

  heading("The nine stages");
  (run.stages || []).forEach((s) => {
    line(`${s.n}. ${s.name} [${s.status}]`, { size: 10, bold: true });
    line(s.result || "no result recorded", { size: 9, indent: 14, color: [55, 65, 81] });
  });

  heading("Reviews");
  const a = run.assurance || {};
  line(`QA — ${a.qa?.agent || "n/a"} on ${a.qa?.model || "unknown model"}: ${a.qa?.score ?? "no score"}/100${a.qa?.failed_rules?.length ? ` (failed rules: ${a.qa.failed_rules.join(", ")})` : ""}`, { size: 9 });
  line(`Guardian — ${a.guardian?.agent || "n/a"} on ${a.guardian?.model || "unknown model"}: ${a.guardian?.allowed ? "permitted" : "refused"}${a.guardian?.blocks?.length ? ` (${a.guardian.blocks.join("; ")})` : ""}`, { size: 9 });
  line(`Validator — ${a.validator?.agent || "n/a"} on ${a.validator?.model || "unknown model"}: ${a.validator?.score ?? "no score"}/100`, { size: 9 });
  line(`Independent model families: ${a.model_separation_ok ? "yes" : "NO — these reviews are not independent"}`, { size: 9, bold: true });

  heading("Evidence");
  if (!(run.evidence || []).length) {
    line("No evidence was captured for this run.", { size: 9, color: [153, 27, 27] });
  } else {
    (run.evidence || []).forEach((e) => {
      line(`Step ${e.step_n} — ${e.finding || "finding not stated"}`, { size: 9, bold: true });
      line(`${e.source_url || "no url"} · retrieved ${e.retrieved_at || "time not recorded"} · ${e.verification}`, { size: 8, indent: 14, color: [71, 85, 105] });
    });
  }

  if ((run.unavailable_sources || []).length) {
    heading("Sources that could not be reached");
    run.unavailable_sources.forEach((u) => {
      line(`Step ${u.step_n} (${u.step_name}) needs ${u.missing}`, { size: 9, color: [146, 100, 10] });
    });
  }

  if ((run.iterations || []).length) {
    heading("Iterations");
    run.iterations.forEach((it) => {
      line(`${it.n}. entered because: ${it.entered_because}`, { size: 9, bold: true });
      line(`QA ${it.qa_before} → ${it.qa_after} · ${it.result}`, { size: 9, indent: 14 });
      (it.changed || []).forEach((c) => line(`changed: ${c}`, { size: 8, indent: 22, color: [71, 85, 105] }));
    });
  }
  if (run.iteration_stop_reason) {
    line(`Loop stopped because: ${run.iteration_stop_reason}`, { size: 9, italic: true });
  }

  if ((run.recommendations || []).length) {
    heading("Auto-recommendations for next time");
    run.recommendations.forEach((r, i) => line(`${i + 1}. ${r}`, { size: 9 }));
  }
  if ((run.risks_to_watch || []).length) {
    heading("What would invalidate this result");
    run.risks_to_watch.forEach((r) => line(`· ${r}`, { size: 9 }));
  }

  if ((run.decision_questions || []).length) {
    heading("Decisions needed from the operator");
    run.decision_questions.forEach((q) => line(`· ${q}`, { size: 9, color: [146, 100, 10] }));
  }

  heading("Deliverables this service owes");
  (run.deliverables || []).forEach((d) => line(`· ${d}`, { size: 9 }));

  const name = `ServiceRun_${(run.service_slug || "service").replace(/-/g, "_")}_${new Date(run.created_date || Date.now()).toISOString().slice(0, 10)}.pdf`;
  doc.save(name);
}