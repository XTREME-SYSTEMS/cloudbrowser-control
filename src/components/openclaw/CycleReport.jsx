import React from "react";
import { Check, X, AlertTriangle, Activity } from "lucide-react";

const VERDICT_TONE = {
  clean: "text-primary",
  healed_verified: "text-primary",
  healed_unverified: "text-gold",
  awaiting_approval: "text-gold",
  escalated: "text-gold",
  failed: "text-destructive",
};

const VERDICT_LABEL = {
  clean: "Nothing needed doing",
  healed_verified: "Repaired and independently verified",
  healed_unverified: "Repaired, not yet proven",
  awaiting_approval: "Waiting on your approval",
  escalated: "Needs a human decision",
  failed: "A repair failed",
};

const ACTION_TONE = {
  applied: "text-primary",
  failed: "text-destructive",
  refused: "text-muted-foreground",
};

function List({ title, items, empty }) {
  return (
    <div>
      <h4 className="text-[11px] font-semibold">{title}</h4>
      {items.length === 0 ? (
        <p className="mt-1 text-[11px] text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {items.map((item, index) => (
            <li key={index} className="text-[11px] leading-snug text-muted-foreground">{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * One cycle, read end to end: what was wrong, what the guardian allowed or refused,
 * what ran, and what the independent check proved. Refusals and unproven repairs are
 * shown as prominently as successes, because those are the parts that need a human.
 */
export default function CycleReport({ cycle }) {
  if (!cycle) {
    return (
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm font-semibold tracking-wide">Latest cycle</h2>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">No cycle has run yet. Run one to see the system read itself.</p>
      </section>
    );
  }

  const guardian = cycle.guardian || {};
  const validation = cycle.validation || {};
  const checks = validation.checks || [];

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Activity className="h-4 w-4 text-primary" />
        <h2 className="font-display text-sm font-semibold tracking-wide">Latest cycle</h2>
        <span className={`text-[11px] font-medium ${VERDICT_TONE[cycle.verdict] || "text-foreground"}`}>
          {VERDICT_LABEL[cycle.verdict] || cycle.verdict}
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {cycle.triggered_by} · {cycle.duration_ms ? `${Math.round(cycle.duration_ms / 1000)}s` : "—"} · {cycle.policy_version}
        </span>
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">{cycle.summary}</p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <List
          title="What was wrong"
          items={(cycle.problems || []).map((problem) => `${problem.issue} (${problem.severity}) — ${problem.evidence}`)}
          empty="Nothing was found wrong."
        />
        <List
          title="Guardian: refused or escalated"
          items={[
            ...(guardian.refused || []).map((entry) => `${entry.action} refused — ${entry.reason}`),
            ...(cycle.escalations || []).map((item) => `escalated — ${item}`),
          ]}
          empty="Nothing was refused and nothing needed you."
        />
      </div>

      <div className="mt-4">
        <h4 className="text-[11px] font-semibold">Repairs</h4>
        {(cycle.actions || []).length === 0 ? (
          <p className="mt-1 text-[11px] text-muted-foreground">No repair was applied in this cycle.</p>
        ) : (
          <div className="mt-1 space-y-1.5">
            {(cycle.actions || []).map((action, index) => (
              <div key={index} className="rounded-lg border border-border/60 bg-secondary/20 p-2">
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className={`font-medium ${ACTION_TONE[action.status] || "text-foreground"}`}>{action.status}</span>
                  <span>{action.label}</span>
                  <span className="text-muted-foreground">· {action.target}</span>
                  {action.operator_approved ? <span className="xa-pill-badge">you approved</span> : null}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{action.summary}</p>
                {action.command ? (
                  <pre className="xa-scroll mt-1 max-h-20 overflow-auto rounded-md border border-border/60 bg-muted/40 p-2 text-[10px]">{action.command}</pre>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4">
        <h4 className="text-[11px] font-semibold">
          Independent check {validation.model ? `· ${validation.model}` : ""}
          {validation.verdict ? ` · ${validation.verdict}` : ""}
        </h4>
        {checks.length === 0 ? (
          <p className="mt-1 text-[11px] text-muted-foreground">{validation.notes || "Nothing was applied, so there was nothing to verify."}</p>
        ) : (
          <div className="mt-1 space-y-1.5">
            {checks.map((check, index) => (
              <div key={index} className="rounded-lg border border-border/60 bg-secondary/20 p-2">
                <div className="flex items-start gap-2 text-[11px]">
                  {check.passed ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /> : <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />}
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{check.claim}</span>
                    <span className="block text-muted-foreground">before {check.before} · after {check.after}</span>
                    <span className="block text-muted-foreground">re-measured: {check.method}</span>
                    {check.judged ? (
                      <span className="block text-muted-foreground">
                        validator: {check.judged.proved ? "proved" : "not proved"} — {check.judged.why}
                      </span>
                    ) : null}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        {validation.notes ? <p className="mt-2 text-[11px] text-muted-foreground">{validation.notes}</p> : null}
      </div>

      {guardian.notes ? (
        <p className="mt-3 flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" /> {guardian.notes}
        </p>
      ) : null}
    </section>
  );
}