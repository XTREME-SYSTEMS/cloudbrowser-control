import { useState } from "react";
import SectionCard from "@/components/standards/SectionCard";
import { HEIR_SEARCH_CATALOG, SKIP_TRACE_DEEP_CATALOG } from "@/lib/searchSourceCatalog";
import { ChevronDown, ChevronRight, Layers } from "lucide-react";

const FULL_TIER = HEIR_SEARCH_CATALOG;
const DEEP_TIER = SKIP_TRACE_DEEP_CATALOG;

function TierBlock({ title, note, categories }) {
  const [open, setOpen] = useState(null);
  const sourceCount = categories.reduce((n, c) => n + (c.sources?.length || 0), 0);

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 bg-muted/40 border-b border-border">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          <h3 className="font-heading font-semibold text-sm">{title}</h3>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          {categories.length} categories · {sourceCount} named sources · {note}
        </p>
      </div>
      <div className="divide-y divide-border">
        {categories.map((c) => {
          const isOpen = open === c.id;
          return (
            <div key={c.id}>
              <button
                onClick={() => setOpen(isOpen ? null : c.id)}
                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
              >
                {isOpen ? (
                  <ChevronDown className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium">{c.name}</span>
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                      {c.sources?.length || 0}
                    </span>
                  </div>
                  {c.description && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">{c.description}</p>
                  )}
                </div>
              </button>
              {isOpen && (
                <ul className="px-4 pb-4 pl-11 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                  {(c.sources || []).map((s) => (
                    <li key={s} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-primary/60 mt-1.5 shrink-0" />
                      {s}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SourceCoverage() {
  return (
    <SectionCard
      id="sources"
      eyebrow="Section 5"
      title="Source coverage register"
      subtitle="Every source the sweep is required to consider, taken from the live source catalog rather than restated by hand. OS-01 requires each applicable category to end as searched, exhausted, or excluded with a reason."
    >
      <div className="space-y-4">
        <TierBlock
          title="Core search tier"
          note="runs on every heir-search case"
          categories={FULL_TIER}
        />
        <TierBlock
          title="Deep trace tier"
          note="runs on skip-trace cases and on core cases escalated for depth"
          categories={DEEP_TIER}
        />
      </div>
      <p className="text-[11px] text-muted-foreground mt-4 leading-relaxed">
        Source list is read from the catalog at <span className="font-mono">searchSourceCatalog</span>, so this
        register cannot drift from what the sweep actually searches. Several listed categories are subject to
        compliance restrictions — DMV, consumer-report and financial-institution data are only reachable inside
        a recorded legal matter with a recorded permissible purpose.
      </p>
    </SectionCard>
  );
}