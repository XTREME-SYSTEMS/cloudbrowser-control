import React from "react";
import { Brain, ShieldCheck, Code2, Megaphone, Rocket, Sparkles, Copy, Network, Cpu } from 'lucide-react';

const AGENT_ICONS = { orchestrator: Brain, growth_operator: ShieldCheck, code_architect: Code2, social_strategist: Megaphone, sales_engine: Rocket, brand_guardian: Sparkles, replicator: Copy, swarm: Network };

export default function AgentCard({ agent, onLaunch }) {
  const Icon = AGENT_ICONS[agent.name] || Cpu;
  return (
    <article className="xa-card p-6 flex flex-col gap-4 transition-colors duration-200 hover:border-primary/50">
      <div className="flex items-start justify-between gap-3">
        <div className="w-12 h-12 rounded-md border border-primary/25 bg-primary/10 flex items-center justify-center">
          <Icon className="w-6 h-6 text-primary" aria-hidden="true" />
        </div>
        {agent.apex && <span className="xa-pill-badge">APEX</span>}
        {agent.flagship && !agent.apex && <span className="xa-pill-badge">FLAGSHIP</span>}
      </div>
      <div>
        <h3 className="font-heading font-bold text-lg text-black">{agent.label}</h3>
        <p className="text-sm text-black/55 mt-1 leading-relaxed">{agent.description}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {agent.skills.map((s) => (
          <span key={s} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#FAFAFA] border border-[#E5E7EB] text-black/60">{s}</span>
        ))}
      </div>
      <button onClick={() => onLaunch(agent)} className="xa-btn-primary mt-auto w-full">Launch agent</button>
    </article>
  );
}