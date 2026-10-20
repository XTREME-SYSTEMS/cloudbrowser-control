import React from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

/**
 * The enumerated gaps, grouped by the area they belong to.
 *
 * Each row carries the rule that raised it. A gap list that only says "review
 * needed" cannot be worked through, and cannot be shown to anyone later.
 */
const AREA_LABELS = {
  gate: "Delivery gate",
  relationship: "Relationships",
  evidence: "Evidence",
  source: "Source coverage",
  identity: "Identity",
};

export default function ResearchGapsPanel({ gaps = [] }) {
  if (gaps.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 flex items-start gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-display font-semibold text-emerald-700 dark:text-emerald-300">
            No open gaps are recorded
          </p>
          <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
            No gate rule is refusing, no relationship is unresolved, no source is blocked and no
            conflict is awaiting a decision.
          </p>
        </div>
      </div>
    );
  }

  const areas = [...new Set(gaps.map((g) => g.area))];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <p className="text-xs text-amber-700 dark:text-amber-300">
          {gaps.length} open gap{gaps.length === 1 ? "" : "s"} across {areas.length} area
          {areas.length === 1 ? "" : "s"}. Each names the rule that raised it.
        </p>
      </div>

      {areas.map((area) => (
        <div key={area} className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-display font-semibold mb-2">
            {AREA_LABELS[area] || area}{" "}
            <span className="text-muted-foreground font-normal">
              ({gaps.filter((g) => g.area === area).length})
            </span>
          </h3>
          <ul className="space-y-1.5">
            {gaps.filter((g) => g.area === area).map((g, i) => (
              <li key={`${g.code}-${i}`} className="border-l-2 border-amber-500/40 pl-2.5">
                <p className="text-[11px] text-foreground/90">{g.message}</p>
                <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{g.code}</p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}