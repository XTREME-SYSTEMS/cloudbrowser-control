import React from "react";

export default function AgentCard({ agent, onLaunch }) {
  return (
    <article className="xa-card p-6 flex flex-col gap-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_20px_25px_-5px_rgba(0,0,0,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,234,0,.15)" }}>
          <span className="text-2xl">{agent.icon}</span>
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