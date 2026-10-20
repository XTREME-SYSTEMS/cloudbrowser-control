import React from "react";
import SectionCard from "@/components/standards/SectionCard";
import { PRICING_PRINCIPLES, PRICING_BANDS, PRICING_BAND_NOTE, PRICING_BASIS } from "@/data/standardsPlaybook";
import { Scale, AlertTriangle } from "lucide-react";

export default function PricingStandard() {
  return (
    <SectionCard
      id="pricing"
      eyebrow="Section 8"
      title="Pricing standard"
      subtitle="The fee structure is both an ethical requirement and the commercial contrast against the contingency model."
    >
      <div className="flex items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/5 p-4 mb-5">
        <Scale className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">{PRICING_BASIS}</p>
      </div>

      <div className="space-y-3 mb-6">
        {PRICING_PRINCIPLES.map((p) => (
          <div key={p.rule} className="rounded-xl border border-border bg-background/40 p-4">
            <h3 className="font-heading font-semibold text-sm mb-1.5">{p.rule}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{p.detail}</p>
          </div>
        ))}
      </div>

      <h3 className="font-heading font-semibold text-sm mb-3">Market reference bands</h3>
      <div className="overflow-x-auto rounded-xl border border-border mb-3">
        <table className="w-full text-xs">
          <thead className="bg-muted/40">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">Scope</th>
              <th className="px-3 py-2 font-medium">Flat price</th>
              <th className="px-3 py-2 font-medium">Bundled effort</th>
            </tr>
          </thead>
          <tbody>
            {PRICING_BANDS.map((b) => (
              <tr key={b.band} className="border-t border-border">
                <td className="px-3 py-2">{b.band}</td>
                <td className="px-3 py-2 font-mono text-primary">{b.price}</td>
                <td className="px-3 py-2 text-muted-foreground">{b.hours}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-start gap-2">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">{PRICING_BAND_NOTE}</p>
      </div>
    </SectionCard>
  );
}