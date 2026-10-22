import { HeartPulse, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const STATUS_TONE = {
  flagged: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  auditing: "border-border bg-secondary text-muted-foreground",
  audited: "border-border bg-secondary text-muted-foreground",
  repairing: "border-border bg-secondary text-muted-foreground",
  repaired: "border-primary/40 bg-primary/10 text-primary",
  validating: "border-border bg-secondary text-muted-foreground",
  escalated: "border-destructive/40 bg-destructive/10 text-destructive",
  resolved: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

/**
 * What healing actually did, and what it refused to guess at.
 *
 * The loop detects, audits and classifies a failure, and opens a flag carrying
 * the root cause. It does not pretend to have repaired something it has no
 * executable adapter for: an unrecognised failure is escalated with a reason
 * rather than closed. So an escalated flag here is the system being honest, not
 * the system being broken — it is the list of what a human still has to decide.
 */
export default function HealingPanel({ flags, cycle, healLog }) {
  const open = (flags || []).length;

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <HeartPulse className="h-4 w-4 text-primary" />
        <h2 className="font-display text-sm font-semibold tracking-wide">Self-healing</h2>
        <Badge className={open > 0 ? STATUS_TONE.escalated : STATUS_TONE.resolved}>
          {open > 0 ? `${open} open flag(s)` : "no open flags"}
        </Badge>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {(healLog || []).length} infra heal action(s) on record
        </span>
      </div>

      {cycle && (
        <div className="mt-3 rounded-lg border border-border/60 bg-secondary/25 p-2.5 text-[11px]">
          <div className="font-medium">{cycle.message}</div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
            <span>architecture health {cycle.architecture_health ?? "--"}/100</span>
            <span>capabilities {cycle.capability_score ?? "--"}/100</span>
            <span>{cycle.triggered ? "cycle was triggered" : "nothing was below 100"}</span>
            <span>{cycle.goals_retried ?? 0} goal(s) re-tested</span>
            <span>{cycle.flags_created ?? 0} flag(s) opened</span>
            <span>{cycle.flags_resolved ?? 0} resolved</span>
            <span>{cycle.flags_escalated ?? 0} escalated for a decision</span>
            {cycle.duration_ms ? <span>{(cycle.duration_ms / 1000).toFixed(1)}s</span> : null}
          </div>
        </div>
      )}

      {open === 0 ? (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Every flagged issue has been closed. Run the self-heal cycle to re-test the architecture goals.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {flags.map((flag) => (
            <li key={flag.id} className="rounded-lg border border-border/60 bg-secondary/20 p-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={STATUS_TONE[flag.status] || STATUS_TONE.flagged}>{flag.status || "flagged"}</Badge>
                <span className="text-[11px] font-medium">{flag.source_title || flag.source_id || "unnamed source"}</span>
                <span className="text-[11px] text-muted-foreground">{flag.flag_type}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  attempt {flag.retry_count ?? 0} of {flag.max_retries ?? 3}
                </span>
              </div>
              {flag.error_message && <p className="mt-1 text-[11px]">{flag.error_message}</p>}
              {flag.root_cause && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Root cause: {flag.root_cause}
                  {flag.root_cause_confidence ? ` (${flag.root_cause_confidence}% confidence)` : ""}
                </p>
              )}
              {flag.repair_result && (
                <p className="mt-1 flex items-start gap-1 text-[11px] text-primary">
                  <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" />
                  {flag.repair_result}
                </p>
              )}
              {flag.flagged_at && (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  last raised {new Date(flag.flagged_at).toLocaleString()}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}