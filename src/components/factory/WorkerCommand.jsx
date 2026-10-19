import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Play, Zap } from "lucide-react";

export default function WorkerCommand() {
  const [stats, setStats] = useState(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const loadStats = useCallback(async () => {
    try {
      const [pending, completed, failed] = await Promise.all([
        base44.entities.AgentTask.count({ status: "pending", autonomous: true }),
        base44.entities.AgentTask.count({ status: "completed" }),
        base44.entities.AgentTask.count({ status: "failed" })
      ]);
      setStats({ pending, completed, failed });
    } catch (e) { setStats(null); }
  }, []);
  useEffect(() => { loadStats(); const i = setInterval(loadStats, 15000); return () => clearInterval(i); }, [loadStats]);

  const runLoop = async () => {
    setRunning(true); setError(null); setResult(null);
    try {
      const res = await base44.functions.invoke("runAgentLoop", { max_cycles: 5, trigger: "system_factory" });
      setResult(res.data || res);
      await loadStats();
    } catch (e) { setError(e.message); }
    setRunning(false);
  };

  return (
    <section className="xa-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-lg bg-[#FFF7B3] flex items-center justify-center"><Zap className="w-5 h-5 text-[#8A7300]" /></div>
        <div>
          <h2 className="font-heading font-bold text-lg text-black">Worker Command</h2>
          <p className="text-xs text-black/50">Autonomous execution engine — runs locally + Railway</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="rounded-xl bg-[#FFF7B3]/40 p-3 text-center">
          <div className="font-heading font-black text-2xl text-[#8A7300]">{stats?.pending ?? "—"}</div>
          <div className="text-[10px] font-bold text-black/50 uppercase">Pending</div>
        </div>
        <div className="rounded-xl bg-green-50 p-3 text-center">
          <div className="font-heading font-black text-2xl text-green-600">{stats?.completed ?? "—"}</div>
          <div className="text-[10px] font-bold text-black/50 uppercase">Done</div>
        </div>
        <div className="rounded-xl bg-red-50 p-3 text-center">
          <div className="font-heading font-black text-2xl text-red-500">{stats?.failed ?? "—"}</div>
          <div className="text-[10px] font-bold text-black/50 uppercase">Failed</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={runLoop} disabled={running} className="xa-btn-primary flex-1 min-w-[140px]">
          {running ? <><Loader2 className="w-4 h-4 animate-spin" /> Running…</> : <><Play className="w-4 h-4" /> Run loop now</>}
        </button>
      </div>

      {result && (
        <div className="mt-3 p-3 rounded-lg bg-[#FAFAFA] border border-[#E5E7EB] text-xs">
          <span className="text-black/50">Last run:</span> <span className="font-bold text-black">{result.actions_executed}</span> actions · <span className="font-bold text-[#CCBB00]">{result.followups_dispatched}</span> dispatched · <span className="font-bold text-black">{result.emails_sent || 0}</span> emails
        </div>
      )}
      {error && <div className="mt-3 p-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>}
    </section>
  );
}