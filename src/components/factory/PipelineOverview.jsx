import React from "react";
import { Search, ShoppingCart, FileCode, Sparkles, Hammer, Rocket, Link2, ArrowRight } from "lucide-react";

const STAGES = [
  { icon: Search, label: "Discover", color: "hsl(var(--muted-foreground))" },
  { icon: ShoppingCart, label: "Buy", color: "#2563EB" },
  { icon: FileCode, label: "Template", color: "#7C3AED" },
  { icon: Sparkles, label: "Generate", color: "hsl(var(--foreground))" },
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
              <div className={`flex flex-col items-center gap-1 shrink-0 px-2 py-2 rounded-xl transition-all ${isActive ? "scale-110" : "opacity-60"}`}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: isActive ? s.color : "#FAFAFA", border: `2px solid ${isActive ? s.color : "#E5E7EB"}` }}>
                  <Icon className="w-4 h-4" style={{ color: isActive ? "#fff" : s.color }} />
                </div>
                <span className="text-[9px] font-bold uppercase" style={{ color: isActive ? s.color : "#00000080" }}>{s.label}</span>
              </div>
              {i < STAGES.length - 1 && <ArrowRight className="w-3 h-3 text-black/20 shrink-0" />}
            </React.Fragment>
          );
        })}
      </div>
    </section>
  );
}