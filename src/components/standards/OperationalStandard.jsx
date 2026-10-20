import React from "react";
import SectionCard from "@/components/standards/SectionCard";
import { OPERATIONAL_STANDARDS, AUTHORITIES } from "@/data/standardsPlaybook";

export default function OperationalStandard() {
  return (
    <SectionCard
      id="operational"
      eyebrow="Section 1"
      title="System operational standard"
      subtitle="The non-negotiables the system operates under. Each rule is tied to a named external authority, not to internal preference, and states where it is enforced."
    >
      <div className="flex flex-wrap gap-2 mb-5">
        {AUTHORITIES.map((a) => (
          <span
            key={a.short}
            title={a.full}
            className="px-2.5 py-1 rounded-md border border-border bg-muted/40 text-[11px] font-mono text-muted-foreground"
          >
            {a.short}
          </span>
        ))}
      </div>

      <div className="space-y-3">
        {OPERATIONAL_STANDARDS.map((s) => (
          <div key={s.id} className="rounded-xl border border-border bg-background/40 p-4">
            <div className="flex items-baseline gap-3 mb-2">
              <span className="font-mono text-[11px] text-primary shrink-0">{s.id}</span>
              <h3 className="font-heading font-semibold text-sm leading-snug">{s.title}</h3>
            </div>
            <p className="text-sm text-foreground/90 leading-relaxed">{s.rule}</p>
            <div className="mt-3 pt-3 border-t border-border/60 space-y-1">
              <p className="text-[11px] text-muted-foreground">
                <span className="text-muted-foreground/70">Authority: </span>
                {s.authority}
              </p>
              <p className="text-[11px] text-muted-foreground">
                <span className="text-muted-foreground/70">Enforcement: </span>
                {s.enforcement}
              </p>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}