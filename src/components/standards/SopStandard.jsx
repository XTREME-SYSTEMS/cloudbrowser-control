import React from "react";
import SectionCard from "@/components/standards/SectionCard";
import { SOPS } from "@/data/standardsPlaybook";
import { ListChecks } from "lucide-react";

export default function SopStandard() {
  return (
    <SectionCard
      id="sop"
      eyebrow="Section 5"
      title="Standard operating procedures"
      subtitle="How the work must be carried out, phase by phase. These are the operating instructions behind the workflow checklist."
    >
      <div className="grid gap-3 lg:grid-cols-2">
        {SOPS.map((sop) => (
          <div key={sop.id} className="rounded-xl border border-border bg-background/40 p-4">
            <div className="flex items-center gap-2 mb-3">
              <ListChecks className="w-4 h-4 text-primary shrink-0" />
              <span className="font-mono text-[11px] text-primary">{sop.id}</span>
              <h3 className="font-heading font-semibold text-sm">{sop.title}</h3>
            </div>
            <ol className="space-y-2">
              {sop.procedures.map((p, i) => (
                <li key={p} className="flex gap-2 text-xs text-muted-foreground leading-relaxed">
                  <span className="font-mono text-[10px] text-primary/70 mt-0.5 shrink-0 w-4">
                    {i + 1}.
                  </span>
                  {p}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}