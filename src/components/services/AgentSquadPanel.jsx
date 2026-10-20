import { Shield, ShieldCheck, Gauge, Eye, Truck, Wrench } from "lucide-react";

const ROLE_META = {
  producer: { label: "Producing agent", icon: Wrench, note: "Does the work" },
  monitor: { label: "Monitoring agent", icon: Eye, note: "Watches for drift" },
  qa: { label: "QA agent", icon: Gauge, note: "Scores the work" },
  guardian: { label: "Guardian agent", icon: Shield, note: "Can block delivery" },
  validator: { label: "Validation agent", icon: ShieldCheck, note: "Independent model" },
  delivery: { label: "Delivery agent", icon: Truck, note: "Ships and logs" },
};

const ORDER = ["producer", "monitor", "qa", "guardian", "validator", "delivery"];

function scoreFor(role, run) {
  if (!run?.assurance) return null;
  const a = run.assurance[role];
  if (!a) return null;
  if (role === "guardian") return { text: a.allowed ? "delivery permitted" : "delivery blocked", ok: a.allowed === true };
  if (typeof a.score === "number") return { text: `${a.score}/100`, ok: a.score >= 85 };
  return null;
}

/**
 * Every service carries the same assurance triad — QA, guardian, independent
 * validation — on separate model families, because a review produced by the
 * same model that produced the work is not a review.
 */
export default function AgentSquadPanel({ service, run }) {
  const grouped = ORDER.map((role) => ({
    role,
    meta: ROLE_META[role],
    agents: service.agents.filter((a) => a.role === role),
  })).filter((g) => g.agents.length > 0);

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h3 className="font-display text-sm font-semibold tracking-wide">The agent squad</h3>
        <span className="text-[11px] text-muted-foreground">{service.agents.length} named agents, no manual steps</span>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        You are not in this list. Every step is owned by an agent; the only thing you supply is the instruction and the decisions the guardian escalates.
      </p>

      <div className="space-y-2">
        {grouped.map(({ role, meta, agents }) => {
          const Icon = meta.icon;
          const score = scoreFor(role, run);
          return (
            <div key={role} className="rounded-lg border border-border/50 bg-secondary/30 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Icon className="h-4 w-4 text-primary" />
                <span className="font-display text-[12px] font-semibold tracking-wide">{meta.label}</span>
                <span className="text-[10px] text-muted-foreground">{meta.note}</span>
                {score && (
                  <span className={`ml-auto rounded-full border px-2 py-0.5 text-[10px] ${score.ok ? "border-primary/30 bg-primary/10 text-primary" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>
                    {score.text}
                  </span>
                )}
              </div>
              {agents.map((a) => (
                <div key={a.name} className="mt-1.5 flex flex-wrap items-baseline gap-2 pl-6">
                  <span className="text-[12px] font-medium">{a.name}</span>
                  <span className="text-[11px] text-muted-foreground">{a.specialty}</span>
                  {run?.assurance?.[role]?.model && (
                    <span className="rounded-sm border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {run.assurance[role].model}
                    </span>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {run?.assurance?.model_separation_ok === false && (
        <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 text-[11px] text-destructive">
          Model separation was not achieved on this run — the reviews are not independent and should not be treated as assurance.
        </p>
      )}
    </div>
  );
}