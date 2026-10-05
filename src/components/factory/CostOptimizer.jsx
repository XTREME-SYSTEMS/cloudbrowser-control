import React from "react";
import { CheckCircle2, DollarSign, Zap, ZapOff } from "lucide-react";

const FREE_SERVICES = [
  { name: "Domain Discovery", note: "RDAP public API", limit: "Unlimited" },
  { name: "GitHub Repos", note: "Public repos", limit: "Unlimited" },
  { name: "Gmail Sending", note: "OAuth — no fees", limit: "Unlimited" },
  { name: "Local Worker", note: "Your machine", limit: "Unlimited" },
  { name: "Vercel Frontend", note: "Hobby tier", limit: "100GB BW" },
  { name: "Supabase Backend", note: "Free tier", limit: "500MB DB" },
  { name: "Google Drive", note: "Free tier", limit: "15GB" },
  { name: "Control Plane", note: "No LLM — deterministic", limit: "Unlimited" }
];

const PAID_SERVICES = [
  { name: "Railway Worker 24/7", cost: "~$5/mo", note: "After $5 free credit", skippable: true },
  { name: "AI Video Generation", cost: "30 cr/video", note: "Most expensive op", skippable: true },
  { name: "AI Template Gen", note: "1 LLM call per batch", cost: "1 cr", skippable: false },
  { name: "AI Build Planning", note: "Skipped — template used directly", cost: "0 cr", skippable: false },
  { name: "Domain Buying", cost: "$1-15/domain", note: "Unavoidable cost", skippable: false }
];

export default function CostOptimizer({ freeMode, setFreeMode }) {
  return (
    <section className="xa-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-[#FFF7B3] flex items-center justify-center"><DollarSign className="w-5 h-5 text-[#8A7300]" /></div>
          <div>
            <h2 className="font-heading font-bold text-lg text-black">Free Tier Strategy</h2>
            <p className="text-xs text-black/50">Maximize free, minimize paid</p>
          </div>
        </div>
        <button onClick={() => setFreeMode(!freeMode)} className={freeMode ? "xa-btn-primary text-xs px-3 py-2" : "xa-btn-outline text-xs px-3 py-2"}>
          {freeMode ? <><Zap className="w-3 h-3" /> Free Mode ON</> : <><ZapOff className="w-3 h-3" /> Free Mode OFF</>}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1.5 mb-3">
        {FREE_SERVICES.map(s => (
          <div key={s.name} className="flex items-center gap-1.5 p-2 rounded-lg bg-green-50 border border-green-100">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-black truncate">{s.name}</div>
              <div className="text-[9px] text-black/40 truncate">{s.limit}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        {PAID_SERVICES.map(s => {
          const isOff = freeMode && s.skippable;
          return (
            <div key={s.name} className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${isOff ? "bg-gray-50 border-gray-100 opacity-50" : "bg-orange-50 border-orange-100"}`}>
              <div className={`w-2 h-2 rounded-full ${isOff ? "bg-gray-300" : "bg-orange-400"}`} />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold text-black truncate">{s.name}</div>
                <div className="text-[9px] text-black/40 truncate">{s.note}</div>
              </div>
              <span className="text-[10px] font-bold text-black/60 shrink-0">{s.cost}</span>
              {isOff && <span className="text-[9px] font-bold text-gray-400 shrink-0">OFF</span>}
            </div>
          );
        })}
      </div>

      <div className="mt-3 p-3 rounded-xl bg-black text-white">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold">Est. monthly cost</span>
          <span className="font-heading font-black text-lg">{freeMode ? "$0.00" : "~$10"} <span className="text-xs font-normal text-white/50">+ domains</span></span>
        </div>
        <p className="text-[10px] text-white/50 mt-1">{freeMode ? "Only domain buying is unavoidable. Everything else runs on free tiers." : "Railway worker + AI video enabled. Toggle Free Mode to drop to $0/mo."}</p>
      </div>
    </section>
  );
}