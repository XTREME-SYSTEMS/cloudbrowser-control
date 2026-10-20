import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Sparkles, Play, Loader2, ChevronDown, AlertCircle } from "lucide-react";

/**
 * The input, pinned so it is always in reach. One sentence, or one card, or one
 * stage control — there is nothing else to configure to get work out.
 *
 * The brief appears before anything runs, with the prompt editable: the
 * operator's edit becomes the instruction of record.
 */
export default function CommandBar({ service, sentence, setSentence, onRun, running }) {
  const [brief, setBrief] = useState(null);
  const [briefPrompt, setBriefPrompt] = useState("");
  const [enhancing, setEnhancing] = useState(false);
  const [showBrief, setShowBrief] = useState(false);
  const [error, setError] = useState(null);

  const enhance = async () => {
    if (!sentence.trim()) return;
    setEnhancing(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("enhanceServicePrompt", {
        sentence,
        service_slug: service?.slug,
        surface: "workspace",
      });
      const data = res?.data || res;
      if (!data?.enhanced?.prompt) throw new Error("The enhancement returned no brief.");
      setBrief(data.enhanced);
      setBriefPrompt(data.enhanced.prompt);
      setShowBrief(true);
    } catch (err) {
      setError(err?.message || "The brief could not be built.");
    } finally {
      setEnhancing(false);
    }
  };

  const run = () => {
    if (!service || !sentence.trim()) return;
    onRun({
      service_slug: service.slug,
      sentence,
      enhanced_prompt: briefPrompt || undefined,
    });
  };

  const open = service?.decision_questions?.length > 0;

  return (
    <div className="sticky bottom-0 z-20 mt-4 rounded-xl border border-primary/25 bg-card/95 p-3 shadow-lg backdrop-blur">
      {open && (
        <div className="mb-2 rounded-lg border border-gold/40 bg-gold/5 p-2.5">
          <p className="text-[11px] font-semibold text-gold">This run needs a decision from you</p>
          <ul className="mt-1 ml-4 list-disc space-y-0.5 text-[11px] text-foreground/85">
            {service.decision_questions.slice(0, 2).map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Answer in the box below and run again — the answer becomes part of the brief it works from.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-primary">
          {service ? service.name : "No service bound"}
        </span>
        {brief && (
          <span className="text-[10px] text-muted-foreground">
            {brief.standards_applied?.length || 0} standards applied · brief ready
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-end gap-2">
        <textarea
          value={sentence}
          onChange={(e) => setSentence(e.target.value)}
          rows={2}
          placeholder={
            service
              ? `Say what you want from ${service.name} — or press Run and let the brief be built.`
              : "Pick a service card, or type what you want done."
          }
          className="xa-input min-w-[240px] flex-1 resize-none text-sm"
        />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={enhance} disabled={!sentence.trim() || enhancing || running}>
            {enhancing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Build the brief
          </Button>
          <Button size="sm" onClick={run} disabled={!service || !sentence.trim() || running}>
            {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
            {running ? "Running" : "Run the workflow"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-[11px] text-destructive">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
          {error}
        </div>
      )}

      {brief && (
        <div className="mt-2 rounded-lg border border-border/60 bg-secondary/30">
          <button
            onClick={() => setShowBrief((v) => !v)}
            className="flex w-full items-center gap-2 p-2.5 text-left text-[11px] font-semibold"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showBrief ? "" : "-rotate-90"}`} />
            The brief of record
            <span className="ml-auto font-normal text-muted-foreground">
              {brief.industry_standard ? "industry standard named" : "standard not named"}
              {brief.open_questions?.length ? ` · ${brief.open_questions.length} open question(s)` : ""}
            </span>
          </button>

          {showBrief && (
            <div className="space-y-2.5 border-t border-border/60 p-3 text-[11px]">
              <Field label="Objective" value={brief.objective} />
              <Field label="Service fit" value={brief.service_fit} />
              <Field label="Industry standard" value={brief.industry_standard} />
              <Field label="What correct means" value={brief.quality_definition} />
              <Listy label="What would be wrong" items={brief.would_be_wrong} />
              <Listy label="What waits, and for what" items={brief.automation_notes} />
              <Listy label="Acceptance criteria" items={brief.acceptance_criteria} />
              <Listy label="Evidence required" items={brief.required_evidence} />
              <Listy label="Must cause a refusal" items={brief.refusal_conditions} />
              <Field label="Authority" value={brief.authority_check} />

              {brief.stage_plan?.length > 0 && (
                <div>
                  <div className="mb-1 font-semibold text-muted-foreground">Stage by stage, for this brief</div>
                  <ol className="space-y-0.5">
                    {brief.stage_plan.map((s, i) => (
                      <li key={i}>
                        <span className="font-medium">{s.stage}</span> — {s.does}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {brief.open_questions?.length > 0 && (
                <div className="rounded-md border border-gold/40 bg-gold/5 p-2">
                  <div className="font-semibold text-gold">Answer these and the brief tightens</div>
                  <ul className="mt-0.5 ml-4 list-disc">
                    {brief.open_questions.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <div className="mb-1 font-semibold text-muted-foreground">
                  The instruction of record — edit it and your edit is what runs
                </div>
                <textarea
                  value={briefPrompt}
                  onChange={(e) => setBriefPrompt(e.target.value)}
                  rows={6}
                  className="xa-input resize-y font-mono text-[11px]"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <div className="font-semibold text-muted-foreground">{label}</div>
      <p className="text-foreground/85">{value}</p>
    </div>
  );
}

function Listy({ label, items }) {
  if (!items?.length) return null;
  return (
    <div>
      <div className="font-semibold text-muted-foreground">{label}</div>
      <ul className="ml-4 list-disc space-y-0.5 text-foreground/85">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}