import React from "react";
import { Search, ShoppingCart, FileCode, Sparkles, Hammer, Rocket, Link2, ArrowRight } from "lucide-react";

const STAGES = [
  { icon: Search, label: "Discover", color: "#8A7300" },
  { icon: ShoppingCart, label: "Buy", color: "#2563EB" },
  { icon: FileCode, label: "Template", color: 'hsl(var(--primary))' },
  { icon: Sparkles, label: "Generate", color: "#CCBB00" },
  { icon: Hammer, label: "Build", color: "#EA580C" },
  { icon: Rocket, label: "Deploy", color: "#16A34A" },
  { icon: Link2, label: "Connect", color: "#DC2626" }
];

export default function PipelineOverview({ activeStage }) {
  return (
    <section className="xa-card p-4">
      <h2 className="font-heading font-bold text-sm text-black mb-3">Factory Pipeline</h2>
      <div className="flex items-center gap-1 overflow-x-auto xa-scroll pb-1">
        {STAGES.map((s, i) => {
          const Icon = s.icon;
          const isActive = activeStage === s.label.toLowerCase();
          return (
            <React.Fragment key={s.label}>
              <div className={`flex flex-col items-center gap-2 shrink-0 px-2 py-2 rounded-md transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className={`w-9 h-9 rounded-md border flex items-center justify-center ${isActive ? 'bg-primary/15 border-primary' : 'bg-background border-border'}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-[9px] font-mono font-medium uppercase tracking-wide">{s.label}</span>
              </div>
              {i < STAGES.length - 1 && <ArrowRight className="w-3 h-3 text-black/20 shrink-0" />}
            </React.Fragment>
          );
        })}
      </div>
    </section>
  );
}