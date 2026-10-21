import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Download, ShieldCheck, ShieldX, Loader2, ChevronDown, Link2, AlertTriangle, RefreshCw, HelpCircle,
} from "lucide-react";
import { downloadServiceRunPDF } from "@/lib/serviceRunPDF";

const VERDICT_CLASS = {
  delivered: "border-primary/40 bg-primary/10 text-primary",
  conditional: "border-gold/40 bg-gold/10 text-gold",
  blocked: "border-destructive/40 bg-destructive/10 text-destructive",
  failed: "border-destructive/40 bg-destructive/10 text-destructive",
};

const VERDICT_MEANING = {
  delivered: "Reviews passed and the evidence was mechanically re-verified. This is a final deliverable.",
  conditional: "Reviews passed but nothing has re-verified the evidence. Releasable as a working result, not as a final deliverable.",
  blocked: "Delivery was refused. The reason is in one line above.",
  failed: "The run did not complete. Nothing is claimed as done.",
};

/**
 * The result screen. One glance should be enough: the verdict, why, the three
 * reviews that produced it, all nine stages with their results, and every
 * finding with its source — including the sources that could not be reached.
 */
export default function ResultPanel({ run, onDecision, onRerunStage, busyStage }) {
  const [showBrief, setShowBrief] = useState(false);
  const [answer, setAnswer] = useState("");
  if (!run) return null;

  const stages = Array.isArray(run.stages) ? run.stages : [];
  const assurance = run.assurance || {};
  const needsDecision = (run.decision_questions || []).length > 0 && run.verdict === "blocked";

  return (
    <section className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={VERDICT_CLASS[run.verdict] || VERDICT_CLASS.failed}>
            {String(run.verdict || "unknown").toUpperCase()}
          </Badge>
          <span className="font-display text-lg font-bold">{run.overall_score ?? 0}/100</span>
          <span className="text-[11px] text-muted-foreground">{run.service_name}</span>
          <span className="text-[11px] text-muted-foreground">
            · {run.duration_ms ? `${Math.round(run.duration_ms / 1000)}s` : "in progress"}
          </span>
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => downloadServiceRunPDF(run)}>
            <Download className="h-3 w-3" />
            Download the result
          </Button>
        </div>

        {run.block_reason && (
          <p className={`mt-2 rounded-lg border p-2.5 text-[11px] ${run.delivery_allowed ? "border-border/60 bg-secondary/30 text-foreground/85" : "border-destructive/30 bg-destructive/5 text-destructive"}`}>
            {run.block_reason}
          </p>
        )}
        <p className="mt-1.5 text-[11px] text-muted-foreground">{VERDICT_MEANING[run.verdict] || ""}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Evidence: <span className="font-medium">{run.evidence_status || "absent"}</span> ·{" "}
          {(run.evidence || []).length} item(s) recorded · {(run.unavailable_sources || []).length} source(s) unreachable and disclosed
        </p>
      </div>

      {needsDecision && (
        <div className="rounded-xl border border-gold/40 bg-gold/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-gold" />
            <h3 className="font-display text-sm font-semibold tracking-wide">A stage needs your decision</h3>
          </div>
          <ul className="mb-2 ml-4 list-disc space-y-1 text-[11px] text-foreground/85">
            {run.decision_questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Your answer becomes part of the brief"
              className="xa-input h-9 flex-1 py-0 text-xs"
            />
            <Button size="sm" onClick={() => onDecision?.(answer)} disabled={!answer.trim()}>
              Run with this answer
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-3">
        <ReviewCard title="QA" agent={assurance.qa?.agent} model={assurance.qa?.model} value={assurance.qa?.score} suffix="/100" verdict={assurance.qa?.failed_rules?.length ? `failed rules: ${assurance.qa.failed_rules.join(", ")}` : "no failed rules named"} />
        <ReviewCard
          title="Guardian"
          agent={assurance.guardian?.agent}
          model={assurance.guardian?.model}
          value={assurance.guardian?.allowed ? "permitted" : "refused"}
          verdict={(assurance.guardian?.blocks || [])[0] || "no grounds named"}
          ok={assurance.guardian?.allowed === true}
        />
        <ReviewCard title="Independent validator" agent={assurance.validator?.agent} model={assurance.validator?.model} value={assurance.validator?.score} suffix="/100" verdict={`${(assurance.validator?.unverified || []).length} claim(s) left unverified`} />
      </div>
      <p className="text-[11px] text-muted-foreground">
        {assurance.model_separation_ok
          ? `Independent: producer, QA, guardian and validator ran on separate model families (${(assurance.model_families || []).join(", ")}).`
          : "NOT INDEPENDENT — the reviews did not run on separate model families, so they cannot be treated as assurance."}
      </p>

      <div className="rounded-xl border border-border/60 bg-card p-4">
        <h3 className="mb-3 font-display text-sm font-semibold tracking-wide">The nine stages</h3>
        <ol className="space-y-2">
          {stages.map((stage) => (
            <li key={stage.key} className="flex gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 font-display text-[10px] font-bold text-primary">
                {stage.n}
              </div>
              <div className="min-w-0 flex-1 border-b border-border/40 pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-[12px] font-semibold tracking-wide">{stage.name}</span>
                  <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{stage.status}</span>
                  {onRerunStage && run.status !== "running" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto h-6 px-2 text-[10px]"
                      disabled={busyStage === stage.key}
                      onClick={() => onRerunStage(stage.key)}
                    >
                      <RefreshCw className={`h-3 w-3 ${busyStage === stage.key ? "animate-spin" : ""}`} />
                      Re-run this stage
                    </Button>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-foreground/85">{stage.result || "no result recorded"}</p>
                {stage.sub_steps?.length > 0 && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-[10px] text-primary">
                      {stage.sub_steps.length} work step(s) inside this stage
                    </summary>
                    <ul className="mt-1 space-y-0.5">
                      {stage.sub_steps.map((sub) => (
                        <li key={sub.n} className="text-[11px] text-foreground/80">
                          <span className="font-medium">{sub.n}. {sub.name}</span> [{sub.status}] — {sub.result || sub.expected_result}
                          {sub.credential_missing && (
                            <span className="ml-1 text-gold">needs {sub.credential_missing}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-4">
        <h3 className="mb-2 font-display text-sm font-semibold tracking-wide">Evidence</h3>
        {(run.evidence || []).length === 0 ? (
          <p className="text-[11px] text-destructive">No evidence was captured. Nothing in this run is supported by a source.</p>
        ) : (
          <ul className="space-y-1.5">
            {run.evidence.map((e, i) => (
              <li key={i} className="rounded-lg border border-border/50 bg-secondary/25 p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">step {e.step_n}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] ${e.verification === "verified_live" ? "border-primary/30 bg-primary/10 text-primary" : "border-gold/40 bg-gold/10 text-gold"}`}>
                    {e.verification === "verified_live" ? "re-verified" : "claimed, not re-verified"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">retrieved {e.retrieved_at || "time not recorded"}</span>
                </div>
                <p className="mt-1 text-[11px] text-foreground/85">{e.finding}</p>
                {e.source_url && (
                  <a href={e.source_url} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
                    <Link2 className="h-3 w-3" />
                    {e.source_url}
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}

        {(run.unavailable_sources || []).length > 0 && (
          <div className="mt-3 rounded-lg border border-gold/40 bg-gold/5 p-2.5">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-gold">
              <AlertTriangle className="h-3 w-3" />
              Sources this run could not reach
            </div>
            <ul className="ml-4 list-disc space-y-0.5 text-[11px] text-foreground/85">
              {run.unavailable_sources.map((u, i) => (
                <li key={i}>
                  step {u.step_n} ({u.step_name}) needs <span className="font-medium">{u.missing}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {(run.iterations || []).length > 0 && (
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <h3 className="mb-2 font-display text-sm font-semibold tracking-wide">What was iterated, and why it stopped</h3>
          <ul className="space-y-2">
            {run.iterations.map((it) => (
              <li key={it.n} className="rounded-lg border border-border/50 bg-secondary/25 p-2.5">
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="font-semibold">Pass {it.n}</span>
                  <span className="text-muted-foreground">entered because: {it.entered_because}</span>
                  <span className="ml-auto">QA {it.qa_before} → {it.qa_after}</span>
                </div>
                {(it.changed || []).length > 0 && (
                  <ul className="mt-1 ml-4 list-disc text-[11px] text-foreground/85">
                    {it.changed.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                )}
                <p className="mt-1 text-[11px] text-muted-foreground">{it.result}</p>
              </li>
            ))}
          </ul>
          {run.iteration_stop_reason && (
            <p className="mt-2 text-[11px] italic text-muted-foreground">Loop stopped because: {run.iteration_stop_reason}</p>
          )}
        </div>
      )}

      {((run.recommendations || []).length > 0 || (run.risks_to_watch || []).length > 0) && (
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <h3 className="mb-2 font-display text-sm font-semibold tracking-wide">Auto-recommendation</h3>
          <ul className="ml-4 list-disc space-y-0.5 text-[11px] text-foreground/85">
            {(run.recommendations || []).map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
          {(run.risks_to_watch || []).length > 0 && (
            <>
              <div className="mt-2 text-[11px] font-semibold text-gold">What would invalidate this result</div>
              <ul className="ml-4 list-disc space-y-0.5 text-[11px] text-muted-foreground">
                {run.risks_to_watch.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {run.enhancement && (
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <button onClick={() => setShowBrief((v) => !v)} className="flex w-full items-center gap-2 text-left">
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showBrief ? "" : "-rotate-90"}`} />
            <h3 className="font-display text-sm font-semibold tracking-wide">The brief this run worked from</h3>
            <span className="ml-auto text-[10px] text-muted-foreground">
              {run.enhancement.standards_applied?.length || 0} standards · {run.prompt_standard}
            </span>
          </button>
          {showBrief && (
            <div className="mt-2 space-y-2 text-[11px]">
              <p><span className="font-semibold">Objective:</span> {run.enhancement.objective}</p>
              <p><span className="font-semibold">Industry standard:</span> {run.enhancement.industry_standard}</p>
              <p><span className="font-semibold">What correct meant:</span> {run.enhancement.quality_definition}</p>
              {(run.enhancement.automation_notes || []).length > 0 && (
                <div>
                  <div className="font-semibold">What waits, and for what</div>
                  <ul className="ml-4 list-disc">
                    {run.enhancement.automation_notes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ReviewCard({ title, agent, model, value, suffix = "", verdict = "", ok = undefined }) {
  const Icon = ok === false ? ShieldX : ShieldCheck;
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3">
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 ${ok === false ? "text-destructive" : "text-primary"}`} />
        <span className="font-display text-[11px] font-semibold tracking-wide">{title}</span>
      </div>
      <div className="mt-1 text-sm font-semibold">
        {value === undefined || value === null ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : `${value}${suffix || ""}`}
      </div>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{agent || "agent not recorded"} · {model || "model not recorded"}</p>
      {verdict && <p className="mt-1 text-[10px] text-foreground/75">{verdict}</p>}
    </div>
  );
}