import React from "react";
import SectionCard from "@/components/standards/SectionCard";
import { AGENT_ROSTER } from "@/data/standardsPlaybook";
import { Bot } from "lucide-react";

const TOTAL = AGENT_ROSTER.reduce((n, g) => n + g.agents.length, 0);

export default function AgentRoster() {
  return (
    <SectionCard
      id="agents"
      eyebrow="Section 6"
      title={`Agent roster — ${TOTAL} registered agents`}
      subtitle="How many agents the system runs, grouped by function. The separation between research and verification is deliberate: an agent that produced a finding never validates its own work."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {AGENT_ROSTER.map((g) => (
          <div key={g.group} className="rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 bg-muted/40 border-b border-border">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-primary" />
                <h3 className="font-heading font-semibold text-sm">{g.group}</h3>
                <span className="ml-auto text-[10px] font-mono text-muted-foreground">
                  {g.agents.length}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">{g.note}</p>
            </div>
            <div className="divide-y divide-border">
              {g.agents.map((a) => (
                <div key={a.name} className="px-4 py-2.5 flex gap-3">
                  <span className="font-mono text-[11px] text-primary shrink-0 w-40 truncate" title={a.name}>
                    {a.name}
                  </span>
                  <span className="text-[11px] text-muted-foreground leading-relaxed">{a.role}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}