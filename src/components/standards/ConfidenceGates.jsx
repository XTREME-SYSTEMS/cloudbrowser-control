import React from "react";
import SectionCard from "@/components/standards/SectionCard";
import { CONFIDENCE_GATES, RELIABILITY_TIERS } from "@/data/standardsPlaybook";
import { Lock, Ban } from "lucide-react";

export default function ConfidenceGates() {
  return (
    <SectionCard
      id="gates"
      eyebrow="Section 2"
      title="Confidence gates and thresholds"
      subtitle="The actual thresholds in force. A gate blocks progress — it is not a score reported after the fact, which is the difference between a control and a warning."
    >
      <div className="grid gap-3 lg:grid-cols-2 mb-7">
        {CONFIDENCE_GATES.map((g) => (
          <div key={g.id} className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-[11px] text-primary">{g.id}</span>
              <h3 className="font-heading font-semibold text-sm">{g.gate}</h3>
            </div>
            <p className="text-xs text-foreground/90 font-medium leading-relaxed mb-2">{g.threshold}</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{g.detail}</p>
            <div className="flex items-start gap-1.5 mt-3 pt-3 border-t border-primary/15">
              <Ban className="w-3 h-3 text-destructive mt-0.5 shrink-0" />
              <p className="text-[11px] text-muted-foreground">{g.blocks}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-3">
        <Lock className="w-4 h-4 text-primary" />
        <h3 className="font-heading font-semibold text-sm">Source reliability tiers</h3>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">Tier</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">Score range</th>
              <th className="px-3 py-2 font-medium">Representative sources</th>
            </tr>
          </thead>
          <tbody>
            {RELIABILITY_TIERS.map((t) => (
              <tr key={t.tier} className="border-t border-border">
                <td className="px-3 py-2 font-medium whitespace-nowrap">{t.tier}</td>
                <td className="px-3 py-2 font-mono text-primary whitespace-nowrap">{t.range}</td>
                <td className="px-3 py-2 text-muted-foreground">{t.examples}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}