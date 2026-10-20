import { Badge } from "@/components/ui/badge";
import { Loader2, Activity, AlertTriangle, ShieldCheck, ShieldX } from "lucide-react";

const VERDICT_CLASS = {
  pass: "border-primary/30 bg-primary/10 text-primary",
  conditional: "border-gold/40 bg-gold/10 text-gold",
  blocked: "border-destructive/30 bg-destructive/10 text-destructive",
  failed: "border-destructive/30 bg-destructive/10 text-destructive",
};

/**
 * Live monitoring for one service: every run, its score, whether delivery was
 * permitted, and the alerts it raised. Blocked runs stay visible — a run that
 * was stopped is the system working, not a gap in the list.
 */
export default function RunHistoryPanel({ runs, loading }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Activity className="h-4 w-4 text-primary" />
        <h3 className="font-display text-sm font-semibold tracking-wide">Run monitoring</h3>
        <span className="ml-auto text-[11px] text-muted-foreground">{runs.length} recent run(s)</span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          Loading runs…
        </div>
      ) : runs.length === 0 ? (
        <p className="py-4 text-xs text-muted-foreground">
          No runs yet. The first run for this service will appear here with its step results and its three assurance verdicts.
        </p>
      ) : (
        <div className="space-y-2">
          {runs.map((r) => (
            <div key={r.id} className="rounded-lg border border-border/50 bg-secondary/30 p-3">
              <div className="flex flex-wrap items-center gap-2">
                {r.delivery_allowed ? (
                  <ShieldCheck className="h-4 w-4 text-primary" />
                ) : (
                  <ShieldX className="h-4 w-4 text-destructive" />
                )}
                <Badge className={VERDICT_CLASS[r.verdict] || VERDICT_CLASS.failed}>{r.verdict || "unknown"}</Badge>
                <span className="font-display text-[12px] font-semibold">{r.overall_score ?? 0}/100</span>
                <span className="text-[11px] text-muted-foreground">
                  {r.steps_completed ?? 0}/{r.steps_total ?? 0} steps
                </span>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {r.created_date ? new Date(r.created_date).toLocaleString() : ""}
                </span>
              </div>

              {r.input_sentence && <p className="mt-1.5 text-[11px] text-foreground/80">“{r.input_sentence}”</p>}

              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Chip label={`QA ${r.assurance?.qa?.score ?? "—"}`} />
                <Chip label={`Guardian ${r.assurance?.guardian?.allowed ? "allowed" : "blocked"}`} bad={r.assurance?.guardian?.allowed === false} />
                <Chip label={`Validator ${r.assurance?.validator?.score ?? "—"}`} />
                <Chip label={r.prompt_standard || "prompt: unknown"} />
              </div>

              {r.monitoring?.alerts?.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {r.monitoring.alerts.map((a, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[11px] text-destructive">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                      {a}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ label, bad }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] ${bad ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-border/60 text-muted-foreground"}`}>
      {label}
    </span>
  );
}