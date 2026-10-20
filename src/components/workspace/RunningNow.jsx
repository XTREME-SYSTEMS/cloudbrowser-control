import { Loader2, CheckCircle2, Circle, XCircle, MinusCircle, Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const ICONS = {
  done: { icon: CheckCircle2, className: "text-primary" },
  running: { icon: Loader2, className: "text-primary animate-spin" },
  failed: { icon: XCircle, className: "text-destructive" },
  blocked: { icon: XCircle, className: "text-destructive" },
  skipped: { icon: MinusCircle, className: "text-muted-foreground" },
  pending: { icon: Circle, className: "text-muted-foreground/50" },
};

function elapsed(from) {
  if (!from) return "";
  const secs = Math.max(0, Math.round((Date.now() - new Date(from).getTime()) / 1000));
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

/**
 * Running Now. Nothing on screen but progress: which stage is running, how long
 * it has been going, and each finished stage's result as it lands. No log wall,
 * no model assignments, no prompt boxes.
 */
export default function RunningNow({ run, onRerunStage, busyStage }) {
  if (!run) return null;
  const stages = Array.isArray(run.stages) ? run.stages : [];
  const finished = stages.filter((s) => ["done", "failed", "skipped", "blocked"].includes(s.status)).length;
  const active = run.status === "running" || run.status === "assurance" || run.status === "queued";

  return (
    <section className="rounded-xl border border-primary/25 bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {active ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <CheckCircle2 className="h-4 w-4 text-primary" />}
        <h3 className="font-display text-sm font-semibold tracking-wide">
          {active ? `Running — ${run.current_stage || "starting"}` : `Finished — ${run.current_stage || "complete"}`}
        </h3>
        <span className="text-[11px] text-muted-foreground">{finished} of {stages.length || 9} stages have a result</span>
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {active ? elapsed(run.created_date) : `${Math.round((run.duration_ms || 0) / 1000)}s`}
        </span>
      </div>

      <ol className="space-y-1.5">
        {stages.map((stage) => {
          const meta = ICONS[stage.status] || ICONS.pending;
          const Icon = meta.icon;
          return (
            <li key={stage.key} className={`flex gap-2.5 rounded-lg border p-2.5 ${stage.status === "running" ? "border-primary/40 bg-primary/5" : "border-border/50 bg-secondary/20"}`}>
              <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${meta.className}`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-display text-[11px] font-bold text-muted-foreground">{stage.n}</span>
                  <span className="font-display text-[12px] font-semibold tracking-wide">{stage.name}</span>
                  {stage.status !== "done" && (
                    <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{stage.status}</span>
                  )}
                  {!active && onRerunStage && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto h-6 px-2 text-[10px]"
                      disabled={busyStage === stage.key}
                      onClick={() => onRerunStage(stage.key)}
                    >
                      <RefreshCw className={`h-3 w-3 ${busyStage === stage.key ? "animate-spin" : ""}`} />
                      Re-run
                    </Button>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-foreground/85">
                  {stage.result || (stage.status === "running" ? "working…" : stage.skipped_reason || "waiting")}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}