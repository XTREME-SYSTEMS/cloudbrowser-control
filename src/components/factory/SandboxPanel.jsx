import React from "react";
import { Monitor, Cloud, Play, Copy } from "lucide-react";

export default function SandboxPanel() {
  const localConfig = `APP_URL=https://cloud-browser.base44.app\nWORKER_SECRET=<your-secret>\nPOLL_INTERVAL=60000\nMAX_CYCLES=5`;
  const copyLocal = () => navigator.clipboard.writeText(localConfig);

  return (
    <section className="xa-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-lg bg-[hsl(var(--muted))] flex items-center justify-center"><Monitor className="w-5 h-5 text-[hsl(var(--muted-foreground))]" /></div>
        <div>
          <h2 className="font-heading font-bold text-lg text-black">Sandbox Systems</h2>
          <p className="text-xs text-black/50">Local + Railway execution environments</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="p-3 rounded-xl bg-[#FAFAFA] border border-[#E5E7EB]">
          <div className="flex items-center gap-2 mb-2">
            <Monitor className="w-4 h-4 text-black/60" />
            <span className="font-bold text-black text-sm">Local Sandbox</span>
            <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-600">Ready</span>
          </div>
          <p className="text-xs text-black/50 mb-2">Runs on your machine. Zero dependencies. Polls the agent loop continuously.</p>
          <div className="flex gap-2">
            <button onClick={copyLocal} className="xa-btn-outline text-xs flex-1 py-2"><Copy className="w-3 h-3" /> Copy .env</button>
            <button className="xa-btn-primary text-xs px-3 py-2"><Play className="w-3 h-3" /> Start</button>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[#FAFAFA] border border-[#E5E7EB]">
          <div className="flex items-center gap-2 mb-2">
            <Cloud className="w-4 h-4 text-black/60" />
            <span className="font-bold text-black text-sm">Railway Sandbox</span>
            <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-600">24/7</span>
          </div>
          <p className="text-xs text-black/50 mb-2">Deploys the same worker to Railway for always-on execution. Auto-restarts on failure.</p>
          <div className="flex gap-2">
            <button className="xa-btn-outline text-xs flex-1 py-2"><Copy className="w-3 h-3" /> Copy railway.toml</button>
            <button className="xa-btn-primary text-xs px-3 py-2"><Cloud className="w-3 h-3" /> Deploy to Railway</button>
          </div>
        </div>
      </div>
    </section>
  );
}