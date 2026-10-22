import { Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const TONE = {
  production_ready: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  operational_with_gaps: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  degraded: "border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-400",
  critical: "border-destructive/40 bg-destructive/10 text-destructive",
};

/** The one score that says whether the system is fit to deliver, and what that score is made of. */
export default function HealthVerdict({ qa, lastQA, tests }) {
  const score = qa?.overall_score ?? lastQA?.score_points ?? null;
  const status = qa?.system_status || null;
  const cat = qa?.category_scores || null;

  const rows = cat
    ? [
        {
          label: "Engines",
          score: cat.engine?.score,
          note: cat.engine
            ? `${cat.engine.status || "unknown"} · ${cat.engine.healthy_engines ?? 0}/${cat.engine.total_engines ?? 0} healthy`
            : null,
        },
        {
          label: "Capabilities",
          score: cat.capabilities?.score,
          note: cat.capabilities
            ? `${cat.capabilities.implemented ?? 0} implemented · ${cat.capabilities.gaps ?? 0} gaps`
            : null,
        },
        {
          label: "Validation",
          score: cat.validation?.score,
          note: cat.validation
            ? `${cat.validation.tests_passed ?? 0}/${cat.validation.tests_total ?? 0} tests passed`
            : null,
        },
        {
          label: "Visual",
          score: cat.visual?.score,
          note: cat.visual?.available === false ? "unavailable — screenshot storage is not configured" : "available",
        },
      ]
    : [];

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Activity className="h-4 w-4 text-primary" />
        <h2 className="font-display text-sm font-semibold tracking-wide">Health verdict</h2>
        {status && <Badge className={TONE[status] || "border-border bg-secondary text-secondary-foreground"}>{status}</Badge>}
        <span className="ml-auto text-[11px] text-muted-foreground">
          {qa?.timestamp
            ? `measured ${new Date(qa.timestamp).toLocaleString()}`
            : lastQA?.created_date
              ? `last stored run ${new Date(lastQA.created_date).toLocaleString()} — press Run QA validation for the current reading`
              : "never measured on this system"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-4">
        <div className="font-heading text-4xl font-bold leading-none">
          {score ?? "--"}
          <span className="text-base font-normal text-muted-foreground">/100</span>
        </div>
        {tests && (
          <div className="text-[11px] leading-snug text-muted-foreground">
            {tests.passed} passing and {tests.failed} failing stored test records
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {rows.map((r) => (
            <div key={r.label} className="rounded-lg border border-border/60 bg-secondary/25 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{r.label}</div>
              <div className="font-display text-lg font-bold">{r.score ?? "--"}</div>
              {r.note && <div className="text-[10px] leading-snug text-muted-foreground">{r.note}</div>}
            </div>
          ))}
        </div>
      )}

      {!qa && !lastQA && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Press Run QA validation to measure the system now. The score is the weighted result of engine health, the
          capability matrix, every validation suite and the visual check.
        </p>
      )}
    </section>
  );
}