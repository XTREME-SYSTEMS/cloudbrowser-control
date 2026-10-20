import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Sparkles, Play, Loader2, AlertCircle, CheckCircle2, HelpCircle } from "lucide-react";

/**
 * The front door to a service: the operator types a sentence, the prompt
 * enhancement engine turns it into the brief that will drive the run, and then
 * that brief drives it.
 *
 * Nothing here is optional for the operator — enhancement is the default path,
 * and the run records which standard it was driven under.
 */
export default function PromptIntake({ service, onRunComplete }) {
  const [sentence, setSentence] = useState("");
  const [enhanced, setEnhanced] = useState(null);
  const [enhancing, setEnhancing] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);

  const enhance = async () => {
    setEnhancing(true);
    setError(null);
    setNote(null);
    try {
      const res = await base44.functions.invoke("enhanceServicePrompt", {
        sentence,
        service_slug: service.slug,
        surface: "service_detail",
      });
      const data = res?.data || res;
      if (data?.error) throw new Error(data.error);
      setEnhanced(data.enhanced);
      setNote(
        data.enhancement_ran
          ? `Brief built against ${(data.enhanced?.standards_applied || []).length} standards. Review it, then run.`
          : "The enhancement model was unavailable, so this is your instruction unimproved. Run only if you are satisfied with it as written.",
      );
    } catch (err) {
      setError(err?.message || "Could not enhance the instruction.");
    } finally {
      setEnhancing(false);
    }
  };

  const run = async () => {
    setRunning(true);
    setError(null);
    setNote(null);
    try {
      const res = await base44.functions.invoke("runServiceWorkflow", {
        service_slug: service.slug,
        sentence,
        enhanced_prompt: enhanced?.prompt || undefined,
      });
      const data = res?.data || res;
      if (data?.error) throw new Error(data.error);
      setNote(
        data.delivery_allowed
          ? `Run completed — ${data.verdict} at ${data.overall_score}/100. Delivery permitted.`
          : `Run completed — ${data.verdict} at ${data.overall_score}/100. Delivery is NOT permitted. Read the alerts below before using anything from this run.`,
      );
      onRunComplete?.(data);
    } catch (err) {
      setError(err?.message || "The run did not complete.");
    } finally {
      setRunning(false);
    }
  };

  const openQuestions = enhanced?.open_questions || [];

  return (
    <div className="rounded-xl border border-primary/20 bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="font-display text-sm font-semibold tracking-wide">Run this service</h3>
      </div>

      <textarea
        value={sentence}
        onChange={(e) => {
          setSentence(e.target.value);
          setEnhanced(null);
          setNote(null);
        }}
        rows={3}
        placeholder={`Say what you want in plain words. Example: ${service.workflow[0].desc.toLowerCase()}`}
        className="xa-input resize-none"
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={enhance} disabled={!sentence.trim() || enhancing || running}>
          {enhancing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          Enhance prompt
        </Button>
        <Button size="sm" onClick={run} disabled={!sentence.trim() || running || enhancing}>
          {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
          Run {service.workflow.length} steps
        </Button>
        <span className="text-[11px] text-muted-foreground">
          {enhanced ? "Driven by the enhanced brief below" : "Running without enhancement still executes every step"}
        </span>
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {note && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-primary/25 bg-primary/5 p-3 text-xs">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span>{note}</span>
        </div>
      )}

      {enhanced && (
        <div className="mt-3 rounded-lg border border-border/60 bg-secondary/40 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
              Enhanced brief
            </span>
            {(enhanced.standards_applied || []).map((std) => (
              <span key={std} className="rounded-sm border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {std}
              </span>
            ))}
          </div>

          <p className="text-xs leading-relaxed text-foreground/90 whitespace-pre-wrap">{enhanced.prompt}</p>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {enhanced.objective && <Detail label="Objective" value={enhanced.objective} />}
            {enhanced.required_evidence?.length > 0 && (
              <Detail label="Evidence required" value={enhanced.required_evidence.join("; ")} />
            )}
            {enhanced.acceptance_criteria?.length > 0 && (
              <Detail label="Acceptance criteria" value={enhanced.acceptance_criteria.join("; ")} />
            )}
            {enhanced.output_format && <Detail label="Output format" value={enhanced.output_format} />}
            {enhanced.done_definition && <Detail label="Done means" value={enhanced.done_definition} />}
          </div>

          {enhanced.authority_check && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground/80">Authority:</span> {enhanced.authority_check}
            </p>
          )}

          {openQuestions.length > 0 && (
            <div className="mt-3 rounded-lg border border-gold/30 bg-gold/5 p-2.5">
              <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-gold">
                <HelpCircle className="h-3 w-3" />
                Answer these before relying on the output
              </div>
              <ul className="ml-4 list-disc space-y-0.5 text-[11px] text-foreground/80">
                {openQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div className="rounded-md border border-border/50 bg-card p-2">
      <div className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[11px] text-foreground/85">{value}</div>
    </div>
  );
}