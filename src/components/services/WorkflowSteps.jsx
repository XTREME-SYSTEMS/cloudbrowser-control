import { CheckCircle2, Circle, XCircle, MinusCircle } from "lucide-react";

const STATUS = {
  done: { icon: CheckCircle2, className: "text-primary border-primary/40 bg-primary/10" },
  failed: { icon: XCircle, className: "text-destructive border-destructive/40 bg-destructive/10" },
  skipped: { icon: MinusCircle, className: "text-muted-foreground border-border bg-secondary" },
  pending: { icon: Circle, className: "text-muted-foreground border-border bg-card" },
};

/**
 * The whole industry workflow, numbered, in the order it actually runs.
 * Number, name, description, and the result the step is accountable for.
 * When a run exists, each step also shows what that run actually returned.
 */
export default function WorkflowSteps({ service, run }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h3 className="font-display text-sm font-semibold tracking-wide">The production workflow</h3>
        <span className="text-[11px] text-muted-foreground">{service.workflow.length} numbered steps</span>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Step 1 is not a formality and the final step is not the delivery — it is the watch that keeps the delivery true.
      </p>

      <ol className="space-y-2.5">
        {service.workflow.map((step) => {
          const executed = run?.steps?.find((s) => s.n === step.n);
          const status = STATUS[executed?.status] || null;
          const StatusIcon = status?.icon;
          return (
            <li key={step.n} className="flex gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 font-display text-[11px] font-bold text-primary">
                {step.n}
              </div>
              <div className="min-w-0 flex-1 border-b border-border/40 pb-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-[13px] font-semibold tracking-wide">{step.name}</span>
                  {StatusIcon && (
                    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] ${status.className}`}>
                      <StatusIcon className="h-2.5 w-2.5" />
                      {executed.status}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{step.desc}</p>
                <p className="mt-1 text-[11px] text-foreground/80">
                  <span className="font-semibold text-foreground/60">Result:</span>{" "}
                  {executed?.result || step.result}
                </p>
                {executed?.output && (
                  <p className="mt-1 rounded-md border border-border/50 bg-secondary/40 p-2 text-[11px] text-foreground/85">
                    {executed.output}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}