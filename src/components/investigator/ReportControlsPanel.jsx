import React, { useState } from "react";
import { FileText, Download, Loader2, Scale, AlertTriangle, CheckCircle2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { generateCourtReadyPDF } from "@/lib/courtReadyPDF";

/** The configured SKIP TRACE folder, so delivered reports land where the firm files them. */
const DELIVERY_FOLDER_ID = "1VyAeFWxWA9nQIw1OcbHjp6-fWkE5WDM8";

/**
 * Report controls.
 *
 * The certified path is offered only when the gate permits it, and when the gate
 * refuses, the refusal is displayed verbatim rather than retried until something
 * comes out. A draft remains available — a working document is legitimate — but
 * it is generated as a draft and says so on its face.
 */
export default function ReportControlsPanel({ brief }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  if (!brief?.case) return null;

  const certified = brief.verification?.exportable_as_certified === true;

  const run = async (label, fn) => {
    setBusy(label);
    setError(null);
    setResult(null);
    try {
      const out = await fn();
      setResult(out);
    } catch (err) {
      const data = err?.response?.data;
      setError(data?.error || err?.message || "The report could not be generated.");
    } finally {
      setBusy("");
    }
  };

  const generateFindings = (mode) =>
    run(mode === "certified" ? "certified" : "draft", async () => {
      const res = await base44.functions.invoke("generateFindingsReport", {
        heir_search_id: brief.case.id,
        folder_id: DELIVERY_FOLDER_ID,
        mode,
      });
      const data = res.data || res;
      if (!data?.doc_url) throw new Error(data?.error || "No document was returned.");
      window.open(data.doc_url, "_blank");
      return { tone: "good", text: `${data.watermark || "Report"} saved to Drive.` };
    });

  const generateWorkingPdf = () =>
    run("pdf", async () => {
      const c = brief.case;
      const doc = generateCourtReadyPDF({
        deceased_name: c.deceased_name,
        deceased_details: c.deceased_details || {},
        family_tree: c.family_tree || {},
        identified_heirs: c.identified_heirs || [],
        probate_info: c.probate_info || {},
        sources_checked: c.sources_checked || [],
        methods_used: c.methods_used || [],
        confidence_score: Number(c.confidence_score) || 0,
        case_reference: c.case_reference || "",
        death_location: c.death_location || "",
        qa_certification: brief.certification || {},
      });

      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const r = reader.result;
          resolve(typeof r === "string" ? r.split(",")[1] || "" : "");
        };
        reader.readAsDataURL(doc.output("blob"));
      });

      const res = await base44.functions.invoke("uploadCourtReadyPDF", {
        file_data: base64,
        filename: `HeirSearch_${String(c.deceased_name || "Report").replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`,
        folder_id: DELIVERY_FOLDER_ID,
        heir_search_id: c.id,
      });
      const data = res.data || res;
      if (!data?.file_url) throw new Error(data?.error || "No file was returned.");
      window.open(data.file_url, "_blank");
      return { tone: "good", text: "Investigative working PDF saved to Drive." };
    });

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-display font-semibold">Report Controls</h3>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => generateFindings(certified ? "certified" : "draft")}
            disabled={busy !== ""}
            className="bg-primary/10 text-primary border border-primary/40 hover:bg-primary/20"
          >
            {busy === "certified" || busy === "draft" ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <FileText className="w-3.5 h-3.5 mr-1.5" />
            )}
            {certified ? "Generate findings report" : "Generate draft report"}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={generateWorkingPdf}
            disabled={busy !== "" || !certified}
            title={certified ? "" : "A certified case is required before a court-ready document can be produced."}
          >
            {busy === "pdf" ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
            Court-ready PDF
          </Button>
        </div>

        <p className="text-[11px] text-muted-foreground mt-3 inline-flex items-start gap-1.5">
          <Scale className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {certified
            ? "The gate permits certified delivery for this case: certification is live, the evidence is re-verified and an investigator has approved."
            : "Certified delivery is refused for this case. A watermarked draft can still be produced for working purposes, and the server will label it as a draft."}
        </p>
      </div>

      {result && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-xs text-emerald-700 dark:text-emerald-300">{result.text}</p>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}
    </div>
  );
}