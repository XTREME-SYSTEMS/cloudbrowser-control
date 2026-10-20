import { Link } from "react-router-dom";
import { ArrowRight, Lock } from "lucide-react";
import { CAPABILITY_GROUPS, BUYER_NEEDS } from "@/components/dashboard/capabilityCatalog";

/**
 * The whole platform on one screen: every function a cloud browser system is
 * bought for, grouped, with the working screen one click away.
 *
 * A capability with no screen yet is shown as planned rather than as a link,
 * so the map never implies something works when it does not.
 */
export default function CapabilityMap() {
  const built = CAPABILITY_GROUPS.flatMap((g) => g.items).filter((i) => i.route).length;
  const total = CAPABILITY_GROUPS.flatMap((g) => g.items).length;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-heading text-base font-semibold tracking-wide">
            Platform Capabilities
          </h2>
          <p className="text-xs text-muted-foreground">
            Every tool a cloud browser system is bought for. {built} of {total} are live in this
            workspace.
          </p>
        </div>
      </div>

      {CAPABILITY_GROUPS.map((group) => (
        <div key={group.group}>
          <div className="mb-2 flex flex-wrap items-baseline gap-2">
            <h3 className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              {group.group}
            </h3>
            <span className="text-[11px] text-muted-foreground">{group.note}</span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((item) => {
              const Icon = item.icon;
              const body = (
                <div
                  className={`flex h-full items-start gap-3 rounded-lg border p-3 transition-all ${
                    item.route
                      ? "border-border/50 bg-card hover:border-primary/40 hover:bg-primary/5 cursor-pointer"
                      : "border-border/30 bg-card/40"
                  }`}
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                      item.route
                        ? "border-primary/20 bg-primary/10 text-primary"
                        : "border-border/50 bg-secondary text-muted-foreground/60"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`font-display text-sm font-semibold tracking-wide ${
                          item.route ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {item.label}
                      </span>
                      {!item.route && (
                        <span className="inline-flex items-center gap-0.5 rounded-sm border border-border/60 px-1 py-0.5 text-[9px] uppercase tracking-[0.08em] text-muted-foreground/70">
                          <Lock className="h-2.5 w-2.5" />
                          Planned
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{item.desc}</div>
                  </div>
                  {item.route && <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                </div>
              );

              return item.route ? (
                <Link key={item.label} to={item.route}>
                  {body}
                </Link>
              ) : (
                <div key={item.label}>{body}</div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="rounded-xl border border-border/50 bg-card p-4">
        <h3 className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
          What buyers in this market come for
        </h3>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {BUYER_NEEDS.map((need) => (
            <span
              key={need}
              className="rounded-full border border-border/60 bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground"
            >
              {need}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}