import React from "react";
import SectionCard from "@/components/standards/SectionCard";
import { TECH_LAYERS, TECH_STATUS_LABEL } from "@/data/standardsPlaybook";
import { Badge } from "@/components/ui/badge";

export default function TechnologyStandard() {
  return (
    <SectionCard
      id="tech"
      eyebrow="Section 10"
      title="Technology standard"
      subtitle="The technical stack the standard is enforced through, with an honest status on each layer — including the layers that are still gaps."
    >
      <div className="space-y-3">
        {TECH_LAYERS.map((t) => {
          const status = TECH_STATUS_LABEL[t.status] ?? TECH_STATUS_LABEL.gap;
          return (
            <div key={t.layer} className="rounded-xl border border-border bg-background/40 p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="font-heading font-semibold text-sm">{t.layer}</h3>
                <Badge className={`${status.className} shrink-0`}>{status.label}</Badge>
              </div>
              <p className="text-xs text-foreground/90 leading-relaxed">{t.standard}</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed mt-2 pt-2 border-t border-border/60">
                {t.caveat}
              </p>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}