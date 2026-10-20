import React from "react";
import SectionCard from "@/components/standards/SectionCard";
import { BUSINESS_STANDARD, BUSINESS_INTEGRITY_RULES } from "@/data/standardsPlaybook";
import { Badge } from "@/components/ui/badge";
import { Ban } from "lucide-react";

const OBJECTION_STATUS = {
  gap: { label: "Unanswered", className: "bg-destructive/10 text-destructive border-destructive/30" },
  partial: { label: "Partly answered", className: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
};

function PointList({ block }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-4">
      <h3 className="font-heading font-semibold text-sm mb-2">{block.title}</h3>
      <ul className="space-y-1.5">
        {block.points.map((p) => (
          <li key={p} className="text-xs text-muted-foreground flex items-start gap-1.5 leading-relaxed">
            <span className="w-1 h-1 rounded-full bg-primary/60 mt-1.5 shrink-0" />
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function BusinessStandard() {
  return (
    <SectionCard
      id="business"
      eyebrow="Section 8"
      title="Business model standard"
      subtitle="Who buys, what is delivered, and how the strongest objection against an automated heir search is answered — clause by clause, including the ones that are not yet answered."
    >
      <div className="grid gap-3 lg:grid-cols-2 mb-6">
        <PointList block={BUSINESS_STANDARD.buyer} />
        <PointList block={BUSINESS_STANDARD.deliverable} />
      </div>

      <h3 className="font-heading font-semibold text-sm mb-3">
        The competitor objection, and our answer to each clause
      </h3>
      <div className="space-y-3 mb-6">
        {BUSINESS_STANDARD.objections.map((o) => {
          const status = OBJECTION_STATUS[o.status] ?? OBJECTION_STATUS.gap;
          return (
            <div key={o.object} className="rounded-xl border border-border bg-background/40 p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className="text-xs font-medium text-foreground/90 leading-relaxed">{o.object}</p>
                <Badge className={`${status.className} shrink-0`}>{status.label}</Badge>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{o.answer}</p>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Ban className="w-4 h-4 text-destructive" />
          <h3 className="font-heading font-semibold text-sm">Commercial integrity rules</h3>
        </div>
        <ul className="space-y-1.5">
          {BUSINESS_INTEGRITY_RULES.map((r) => (
            <li key={r} className="text-xs text-muted-foreground flex items-start gap-1.5 leading-relaxed">
              <span className="w-1 h-1 rounded-full bg-destructive/60 mt-1.5 shrink-0" />
              {r}
            </li>
          ))}
        </ul>
      </div>
    </SectionCard>
  );
}