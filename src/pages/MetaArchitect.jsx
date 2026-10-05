import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Sparkles, Loader2, CheckCircle2, AlertTriangle, ArrowLeft, Cpu, Wrench } from "lucide-react";

const STAGE_LABELS = {
  agent_start: "Agent loop started",
  inspectRegistry: "Inspect registry (read domains + tasks)",
  dispatchTask: "Dispatch task to action queue",
  runGrowthMission: "Execute growth pipeline",
  growthMissionResult: "Growth pipeline result",
  webSearch: "Web search",
  finalize: "Submit mission brief",
  agent_complete: "Agent loop complete"
};

export default function MetaArchitect() {
  const navigate = useNavigate();
  const [goal, setGoal] = useState("Audit benearme.com, run the growth pipeline, and dispatch any follow-up tasks the specialists should own.");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const run = async () => {
    setRunning(true); setError(null); setResult(null);
    try {
      const res = await base44.functions.invoke("runMetaArchitect", { goal });
      setResult(res.data);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Agent failed");
    } finally { setRunning(false); }
  };

  return (
    <div className="min-h-screen bg-white">
      <section className="border-b border-border bg-gradient-to-b from-muted/30 to-background">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-sm font-semibold text-black/50 hover:text-black mb-6">
            <ArrowLeft className="w-4 h-4" /> Command Center
          </button>
          <span className="xa-pill-badge">TIER 4 · CODE AGENT (LLM TOOL LOOP)</span>
          <h1 className="font-heading font-black text-3xl md:text-4xl text-black mt-4 leading-tight">The Meta Architect</h1>
          <p className="text-base text-black/60 mt-3 max-w-2xl">
            A real agent loop — an LLM with tools scoped to your app. It inspects state, plans, dispatches real tasks,
            runs the growth pipeline, searches the web, and submits a brief. Same architecture that powers a builder agent.
          </p>

          <div className="mt-8">
            <label className="text-xs uppercase tracking-wide text-black/40 font-bold">Goal</label>
            <textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={3} className="xa-input mt-1 h-auto py-3 resize-none" disabled={running} />
            <div className="mt-3">
              <button onClick={run} disabled={running || !goal} className="xa-btn-primary">
                {running ? <><Loader2 className="w-4 h-4 animate-spin" /> Agent running…</> : <><Sparkles className="w-4 h-4" /> Launch agent loop</>}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-10">
        {error && (
          <div className="xa-card p-5 border-red-200 bg-red-50 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
            <div><p className="font-bold text-red-700">Agent error</p><p className="text-sm text-red-600 mt-1">{error}</p></div>
          </div>
        )}

        {result && (
          <div className="space-y-6">
            <div className="xa-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <h2 className="font-heading font-bold text-lg text-black">Agent complete — {result.steps_executed} tool steps</h2>
              </div>
              <div className="flex items-center gap-2 text-sm text-black/60 mb-4">
                <Cpu className="w-4 h-4" /> <span className="font-mono">{result.architecture}</span>
              </div>
              <div className="rounded-lg bg-muted border border-border p-4">
                <p className="text-xs uppercase tracking-wide text-black/40 font-bold mb-2">Mission brief</p>
                <p className="text-sm text-black whitespace-pre-wrap leading-relaxed">{result.final_brief}</p>
              </div>
            </div>

            <div className="xa-card p-6">
              <h3 className="font-heading font-bold text-black mb-4 flex items-center gap-2"><Wrench className="w-4 h-4" /> Tool execution trace</h3>
              <ol className="space-y-2">
                {result.trace.map((t, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center">{i + 1}</span>
                    <div>
                      <p className="font-semibold text-black">{STAGE_LABELS[t.stage] || t.stage}</p>
                      <p className="text-black/50 font-mono text-xs mt-0.5">{JSON.stringify({ ...t, stage: undefined, at: undefined }).replace(/^\{|:undefined|"|\}$/g, m => m === "{" || m === "}" ? "" : m)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="flex gap-3">
              <button onClick={() => navigate("/domains")} className="xa-btn-outline">View domain registry</button>
              <button onClick={() => navigate("/mission")} className="xa-btn-outline">Growth Operator mission</button>
            </div>
          </div>
        )}

        {!result && !error && !running && (
          <div className="xa-card p-10 text-center">
            <p className="text-black/50">Set a goal and press <span className="font-bold text-black">Launch agent loop</span>. The agent will think and act on its own.</p>
          </div>
        )}
      </section>
    </div>
  );
}