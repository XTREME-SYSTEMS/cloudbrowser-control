import { useMemo, useState } from "react";
import { Search, Play, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { serviceIcon, categoryStyle } from "@/components/services/serviceIcons";

/**
 * The board: every service one card, grouped in the fixed category order and
 * never alphabetical. Reading down the board is reading the whole product.
 */
export default function ServiceBoard({ services, categories, onRun, runningSlug, uncategorised = [] }) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return services;
    return services.filter((s) =>
      `${s.name} ${s.tagline} ${s.summary} ${s.buyer} ${s.category}`.toLowerCase().includes(q),
    );
  }, [services, query]);

  const grouped = categories
    .map((category) => ({
      category,
      services: filtered.filter((s) => s.category === category),
    }))
    .filter((g) => g.services.length > 0);

  const visible = activeCategory === "All" ? grouped : grouped.filter((g) => g.category === activeCategory);

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="font-display text-sm font-semibold tracking-wide uppercase text-muted-foreground">
          Services
        </h2>
        <span className="text-[11px] text-muted-foreground">
          {services.length} services, grouped by what the buyer is buying
        </span>
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the services…"
            className="xa-input h-9 py-0 pl-8 text-xs"
          />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        <Chip label={`All (${services.length})`} active={activeCategory === "All"} onClick={() => setActiveCategory("All")} />
        {categories.map((category) => {
          const count = services.filter((s) => s.category === category).length;
          if (count === 0) return null;
          return (
            <Chip
              key={category}
              label={`${category} (${count})`}
              active={activeCategory === category}
              onClick={() => setActiveCategory(category)}
            />
          );
        })}
      </div>

      {uncategorised.length > 0 && (
        <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 text-[11px] text-destructive">
          {uncategorised.length} service(s) sit in no category and are hidden from the board: {uncategorised.join(", ")}
        </p>
      )}

      {visible.length === 0 && (
        <p className="rounded-xl border border-border/60 bg-card p-6 text-center text-xs text-muted-foreground">
          Nothing matches “{query}”.
        </p>
      )}

      <div className="space-y-5">
        {visible.map(({ category, services: group }) => (
          <div key={category}>
            <div className="mb-2 flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${categoryStyle(category).dot}`} />
              <h3 className="font-display text-[13px] font-semibold tracking-wide">{category}</h3>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {group.map((service) => (
                <ServiceCard key={service.slug} service={service} onRun={onRun} running={runningSlug === service.slug} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Chip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-[11px] transition-colors ${
        active ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function ServiceCard({ service, onRun, running }) {
  const Icon = serviceIcon(service.icon);
  const style = categoryStyle(service.category);
  const band = (service.pricing?.range || "").split(";")[0];

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-xl border border-border/60 bg-card p-4 transition-all hover:border-primary/40">
      <div className={`absolute left-0 top-0 h-full w-0.5 ${style.bar} opacity-60`} />
      <div className="flex items-start gap-2.5 pl-1.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
          <Icon className="h-4.5 w-4.5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-display text-[13px] font-semibold leading-tight tracking-wide">{service.name}</h4>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{service.tagline}</p>
        </div>
      </div>

      <dl className="mt-3 space-y-1 text-[11px]">
        <Row label="Buyer comes for" value={service.buyer} />
        <Row label="Price band" value={band} />
        <Row label="Steps" value={`${service.workflow.length} work steps inside the 9 stages`} />
        <Row label="Agents" value={`${service.agents.length}, three of them reviewers`} />
      </dl>

      <div className="mt-3 flex items-center gap-2 pt-1">
        <Button size="sm" onClick={() => onRun(service)} disabled={running} className="h-8">
          {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
          {running ? "Running" : "Run this"}
        </Button>
        <span className="ml-auto inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
          Opens the input with this service bound
          <ArrowRight className="h-2.5 w-2.5" />
        </span>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 text-foreground/85">{value}</dd>
    </div>
  );
}