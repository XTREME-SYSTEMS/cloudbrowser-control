import React from "react";
import { CheckCircle2, AlertCircle, Layers, Cloud, Database, HardDrive, Github, Train, Globe, Cpu } from "lucide-react";

const STACK = [
  { name: "Base44", role: "Templates + Control", icon: Layers, status: "connected", color: "hsl(var(--foreground))" },
  { name: "Vercel AI Gateway", role: "AI generation", icon: Cpu, status: "connected", color: "#000000" },
  { name: "Supabase", role: "Backend / Database", icon: Database, status: "registered", color: "#16A34A" },
  { name: "Vercel", role: "Frontend hosting", icon: Cloud, status: "connected", color: "#000000" },
  { name: "Google Drive", role: "Data storage", icon: HardDrive, status: "registered", color: "#2563EB" },
  { name: "GitHub", role: "Code source of truth", icon: Github, status: "registered", color: "#000000" },
  { name: "Railway", role: "Worker hosting 24/7", icon: Train, status: "active", color: "#7C3AED" },
  { name: "GoDaddy", role: "Domain buying", icon: Globe, status: "needs_api_key", color: "#EA580C" }
];

const STATUS_META = {
  connected: { icon: CheckCircle2, label: "Connected", color: "#16A34A", bg: "#DCFCE7" },
  registered: { icon: CheckCircle2, label: "Registered", color: "#2563EB", bg: "#DBEAFE" },
  active: { icon: CheckCircle2, label: "Active", color: "#16A34A", bg: "#DCFCE7" },
  needs_setup: { icon: AlertCircle, label: "Needs setup", color: "#EA580C", bg: "hsl(var(--muted))" },
  needs_api_key: { icon: AlertCircle, label: "Needs API key", color: "#EA580C", bg: "hsl(var(--muted))" }
};

export default function IntegrationStack() {
  return (
    <section className="xa-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-lg bg-[hsl(var(--muted))] flex items-center justify-center"><Layers className="w-5 h-5 text-[hsl(var(--muted-foreground))]" /></div>
        <div>
          <h2 className="font-heading font-bold text-lg text-black">Integration Stack</h2>
          <p className="text-xs text-black/50">Your full AI-enhanced website factory stack</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {STACK.map(s => {
          const Icon = s.icon;
          const meta = STATUS_META[s.status];
          const StatusIcon = meta.icon;
          return (
            <div key={s.name} className="p-3 rounded-xl bg-[#FAFAFA] border border-[#E5E7EB]">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${s.color}15` }}>
                  <Icon className="w-3.5 h-3.5" style={{ color: s.color }} />
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5" style={{ background: meta.bg, color: meta.color }}>
                  <StatusIcon className="w-2.5 h-2.5" /> {meta.label}
                </span>
              </div>
              <div className="font-bold text-black text-xs truncate">{s.name}</div>
              <div className="text-[10px] text-black/45 truncate">{s.role}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}