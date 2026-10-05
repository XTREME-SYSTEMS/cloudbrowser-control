import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Loader2, RefreshCw, Play, Activity, CheckCircle2, Clock, AlertTriangle, Zap } from "lucide-react";

const STATUS_META = {
  pending: { icon: Clock, color: "#8A7300", bg: "#FFF7B3", label: "Pending" },
  in_progress: { icon: Activity, color: "#2563EB", bg: "#DBEAFE", label: "Running" },
  needs_approval: { icon: AlertTriangle, color: "#DC2626", bg: "#FEE2E2", label: "Approval" },
  completed: { icon: CheckCircle2, color: "#16A34A", bg: "#DCFCE7", label: "Done" },
  failed: { icon: AlertTriangle, color: "#DC2626", bg: "#FEE2E2", label: "Failed" }
};

const PRIORITY_STYLE = {
  urgent: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-blue-50 text-blue-600",
  low: "bg-gray-100 text-gray-500"
};

export default function MissionControl() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [loopResult, setLoopResult] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.entities.AgentTask.filter({}, { sort: "-created_date", limit: 50 });
      setTasks(res.items || []);
    } catch (e) { setTasks([]); setError(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const runLoop = async () => {
    setRunning(true); setError(null); setLoopResult(null);
    try {
      const res = await base44.functions.invoke("runAgentLoop", { max_cycles: 5, trigger: "mission_control" });
      setLoopResult(res.data || res);
      await load();
    } catch (e) { setError(e.message); }
    setRunning(false);
  };

  const counts = tasks.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {});

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <header className="border-b border-[#E5E7EB] bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="xa-pill-badge">MISSION CONTROL</span>
            <h1 className="font-heading font-black text-xl sm:text-2xl text-black mt-1 truncate">Autonomous Operations</h1>
          </div>
          <button onClick={() => navigate("/")} className="xa-btn-outline shrink-0">← Center</button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Pending", value: counts.pending || 0, icon: Clock, color: "#8A7300" },
            { label: "Running", value: counts.in_progress || 0, icon: Activity, color: "#2563EB" },
            { label: "Completed", value: counts.completed || 0, icon: CheckCircle2, color: "#16A34A" },
            { label: "Failed", value: counts.failed || 0, icon: AlertTriangle, color: "#DC2626" }
          ].map((s) => (
            <div key={s.label} className="xa-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-black/50 uppercase tracking-wide">{s.label}</span>
                <s.icon className="w-4 h-4" style={{ color: s.color }} />
              </div>
              <div className="font-heading font-black text-2xl text-black mt-1">{s.value}</div>
            </div>
          ))}
        </div>

        <div className="xa-card p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="font-heading font-bold text-lg text-black flex items-center gap-2">
                <Zap className="w-5 h-5 text-[#CCBB00]" /> Agent Loop
              </h2>
              <p className="text-sm text-black/55 mt-1">Runs the full observe → decide → act → record → repeat cycle. Autonomous tasks execute and self-dispatch follow-ups.</p>
            </div>
            <button onClick={runLoop} disabled={running} className="xa-btn-primary shrink-0">
              {running ? <><Loader2 className="w-4 h-4 animate-spin" /> Running loop…</> : <><Play className="w-4 h-4" /> Run loop now</>}
            </button>
          </div>

          {loopResult && (
            <div className="mt-4 p-4 rounded-xl bg-[#FAFAFA] border border-[#E5E7EB]">
              <div className="flex flex-wrap gap-4 text-sm">
                <div><span className="text-black/50">Cycles:</span> <span className="font-bold text-black">{loopResult.cycles_run}</span></div>
                <div><span className="text-black/50">Actions:</span> <span className="font-bold text-black">{loopResult.actions_executed}</span></div>
                <div><span className="text-black/50">Follow-ups:</span> <span className="font-bold text-[#CCBB00]">{loopResult.followups_dispatched}</span></div>
                <div><span className="text-black/50">LLM:</span> <span className="font-bold text-black">{loopResult.llm_used ? "yes" : "no (deterministic)"}</span></div>
              </div>
              {loopResult.trace && loopResult.trace.length > 0 && (
                <details className="mt-3">
                  <summary className="text-xs font-semibold text-black/50 cursor-pointer hover:text-black">Execution trace ({loopResult.trace.length} steps)</summary>
                  <div className="mt-2 space-y-1 max-h-48 overflow-y-auto xa-scroll">
                    {loopResult.trace.map((t, i) => (
                      <div key={i} className="text-xs font-mono text-black/60 flex gap-2">
                        <span className="text-[#CCBB00] shrink-0">{t.phase || t.stage}</span>
                        <span className="text-black/40 truncate">{JSON.stringify({...t, phase: undefined, stage: undefined, at: undefined})}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
          {error && <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading font-bold text-lg text-black">Task Queue</h2>
            <button onClick={load} disabled={loading} className="text-black/50 hover:text-black">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#CCBB00]" /></div>
          ) : tasks.length === 0 ? (
            <div className="xa-card p-10 text-center">
              <Clock className="w-8 h-8 mx-auto text-black/20" />
              <p className="text-black/50 mt-2 text-sm">No tasks in the queue. Run a growth mission or the loop to generate work.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((t) => {
                const meta = STATUS_META[t.status] || STATUS_META.pending;
                const Icon = meta.icon;
                return (
                  <div key={t.id} className="xa-card p-4 flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: meta.bg }}>
                      <Icon className="w-4 h-4" style={{ color: meta.color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-black text-sm">{t.title}</span>
                        {t.autonomous && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#FFF7B3] text-[#8A7300]">AUTO</span>}
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${PRIORITY_STYLE[t.priority] || PRIORITY_STYLE.medium}`}>{t.priority}</span>
                      </div>
                      <div className="text-xs text-black/45 mt-0.5">
                        {t.agent_name} · {t.task_type || "generic"}
                        {t.domain && <span> · {t.domain}</span>}
                      </div>
                      {t.result && <div className="text-xs text-black/40 mt-1 truncate font-mono">{t.result}</div>}
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}