import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { useServiceCatalog } from "@/hooks/useServiceCatalog";
import { serviceIcon, groupStyle } from "@/components/services/serviceIcons";

/**
 * The fourteen services, as the first thing on the dashboard.
 * Each card is a button straight into that service's own page.
 */
export default function ServiceCategoryCards() {
  const { services, loading, error } = useServiceCatalog();

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-card p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        Loading services…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-heading text-base font-semibold tracking-wide">Services</h2>
          <p className="text-xs text-muted-foreground">
            {services.length} production services. Each runs the same spine: numbered steps, then QA, guardian and independent validation before anything is delivered.
          </p>
        </div>
        <Link to="/executive-assistant" className="shrink-0 text-xs text-primary hover:underline">
          Ask the executive assistant →
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {services.map((s) => {
          const Icon = serviceIcon(s.icon);
          const style = groupStyle(s.group);
          return (
            <Link key={s.slug} to={`/services/${s.slug}`}>
              <div className="group relative h-full overflow-hidden rounded-xl border border-border/60 bg-card p-4 transition-all hover:border-primary/50 hover:shadow-md">
                <div className={`absolute left-0 top-0 h-full w-1 ${style.bar} opacity-70`} />
                <div className="flex items-start gap-3 pl-2">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-sm font-semibold leading-tight tracking-wide">{s.name}</h3>
                    <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{s.tagline}</p>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5 pl-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] ${style.chip}`}>
                    {s.group}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    {s.workflow.length} steps
                  </span>
                  <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                    {s.agents.length} agents
                  </span>
                </div>

                <p className="mt-2.5 pl-2 text-[11px] text-muted-foreground">
                  <span className="text-foreground/70">Typical range:</span> {s.pricing.range.split(";")[0]}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}