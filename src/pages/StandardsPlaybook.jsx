import { ShieldCheck } from "lucide-react";
import OperationalStandard from "@/components/standards/OperationalStandard";
import CompositeStandard from "@/components/standards/CompositeStandard";
import ConfidenceGates from "@/components/standards/ConfidenceGates";
import WorkflowChecklist from "@/components/standards/WorkflowChecklist";
import SourceCoverage from "@/components/standards/SourceCoverage";
import SopStandard from "@/components/standards/SopStandard";
import AgentRoster from "@/components/standards/AgentRoster";
import PricingStandard from "@/components/standards/PricingStandard";
import BusinessStandard from "@/components/standards/BusinessStandard";
import TechnologyStandard from "@/components/standards/TechnologyStandard";

const SECTIONS = [
  { id: "operational", label: "Operational" },
  { id: "composite", label: "Chosen Standard" },
  { id: "gates", label: "Gates" },
  { id: "workflow", label: "Workflow" },
  { id: "sources", label: "Sources" },
  { id: "sop", label: "SOPs" },
  { id: "agents", label: "Agents" },
  { id: "pricing", label: "Pricing" },
  { id: "business", label: "Business" },
  { id: "tech", label: "Technology" },
];

export default function StandardsPlaybook() {
  const jump = (id) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-primary/20 bg-primary/5 p-6 md:p-8">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <span className="text-[10px] font-display font-bold uppercase tracking-[0.2em] text-primary/80">
            Industry best standard
          </span>
        </div>
        <h1 className="font-heading font-bold text-2xl md:text-3xl mb-3">
          Operating playbook &amp; checklist
        </h1>
        <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
          The complete standard the heir-search and skip-trace operation runs to: the operational rules,
          the confidence gates that block a case, the end-to-end workflow as a reusable checklist, every
          source the sweep must consider, the SOPs behind each phase, the agent roster, the pricing and
          business model standards, and the technical layers that enforce all of it.
        </p>
        <p className="text-xs text-muted-foreground/80 max-w-3xl mt-3 leading-relaxed">
          Rules are tied to named external authorities — the BCG Genealogical Proof Standard, Rule 702 of
          the Federal Rules of Evidence as amended in December 2023, and the CAFG Standards of Practice.
          Where a capability is not yet built, it is labelled a gap rather than described as working. This
          is an operating standard, not a legal opinion or a certification of heirship.
        </p>
      </header>

      <nav className="sticky top-0 z-20 -mx-1 px-1 py-2 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex gap-1 overflow-x-auto">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => jump(s.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-display text-muted-foreground hover:text-primary hover:bg-primary/5 whitespace-nowrap transition-colors"
            >
              {s.label}
            </button>
          ))}
        </div>
      </nav>

      <OperationalStandard />
      <CompositeStandard />
      <ConfidenceGates />
      <WorkflowChecklist />
      <SourceCoverage />
      <SopStandard />
      <AgentRoster />
      <PricingStandard />
      <BusinessStandard />
      <TechnologyStandard />
    </div>
  );
}