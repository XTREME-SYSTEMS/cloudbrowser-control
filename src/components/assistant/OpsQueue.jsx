import { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ListChecks, Loader2, Check, AlertCircle, Clock } from "lucide-react";

const PRIORITY_CLASS = {
  urgent: "border-destructive/30 bg-destructive/10 text-destructive",
  high: "border-gold/40 bg-gold/10 text-gold",
  normal: "border-border/60 text-muted-foreground",
  low: "border-border/60 text-muted-foreground",
};

/**
 * Every unit of operating work the assistant has queued, with the agent that
 * owns it. The queue is the operator's whole to-do surface: if it is not here,
 * nobody has been asked to do it.
 */
export default function OpsQueue({ refreshKey = 0 }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const page = await base44.entities.OpsTask.filter(
        { status: { $in: ["open", "in_progress", "blocked"] } },
        { sort: "-created_date", limit: 40 },
      );
      setTasks(page?.items || (Array.isArray(page) ? page : []));
    } catch (err) {
      setError(err?.message || "Could not load the operating queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const complete = async (task) => {
    try {
      await base44.entities.OpsTask.update(task.id, { status: "done" });
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
    } catch (err) {
      setError(err?.message || "Could not close that task.");
    }
  };

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <ListChecks className="h-4 w-4 text-primary" />
        <h3 className="font-display text-sm font-semibold tracking-wide">Operating queue</h3>
        <span className="ml-auto text-[11px] text-muted-foreground">{tasks.length} open</span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-5 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          Loading queue…
        </div>
      ) : error ? (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      ) : tasks.length === 0 ? (
        <p className="py-5 text-xs text-muted-foreground">
          Nothing queued. Give the assistant an instruction above and the work it creates lands here, owned by an agent.
        </p>
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => (
            <div key={t.id} className="rounded-lg border border-border/50 bg-secondary/30 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={PRIORITY_CLASS[t.priority] || PRIORITY_CLASS.normal}>{t.priority || "normal"}</Badge>
                <span className="font-display text-[12px] font-semibold">{t.title}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto h-6 px-2 text-[11px]"
                  onClick={() => complete(t)}
                >
                  <Check className="h-3 w-3" />
                  Done
                </Button>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span>{t.owner_agent}</span>
                <span>· {t.kind}</span>
                <span>· {t.channel}</span>
                {t.due_at && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    {new Date(t.due_at).toLocaleString()}
                  </span>
                )}
                {t.status === "blocked" && <span className="text-destructive">blocked — {t.blocked_reason || "reason not recorded"}</span>}
              </div>
              {t.instruction && <p className="mt-1 text-[11px] text-foreground/80">{t.instruction}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}