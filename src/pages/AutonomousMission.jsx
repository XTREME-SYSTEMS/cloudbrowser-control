import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Play, Loader2, CheckCircle2, AlertTriangle, ArrowLeft, Database, Zap } from "lucide-react";

const STAGE_LABELS = {
  load_domain: "Load domain record",
  create_domain: "Create domain record",
  fetch_robots: "Fetch robots.txt (live HTTP)",
  discover_sitemap: "Discover sitemap",
  inspect_sitemap: "Inspect sitemap & count URLs",
  compute_health: "Compute health score",
  update_domain: "Update domain record",
  create_task: "Dispatch task to action queue"
};

function Metric({ label, value }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-black/40 font-bold">{label}</p>
      <p className="font-heading font-bold text-lg text-black mt-1">{value}</p>
    </div>
  );
}

export default function AutonomousMission() {
  const navigate = useNavigate();
  const [domain, setDomain] = useState("benearme.com");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const runMission = async () => {
    setRunning(true); setError(null); setResult(null);
    try {
      const res = await base44.functions.invoke("runGrowthMission", { domain });
      setResult(res.data);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Mission failed");
    } finally { setRunning(false); }
  };

  return (
    <div className="min-h-screen bg-white">
      <section className="border-b border-[#E5E7EB] bg-gradient-to-b from-[#FFF7B3]/30 to-white">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-sm font-semibold text-black/50 hover:text-black mb-6">
            <ArrowLeft className="w-4 h-4" /> Command Center
          </button>
          <span className="xa-pill-badge">TIER 3 · AUTONOMOUS CODE AGENT</span>
          <h1 className="font-heading font-black text-3xl md:text-4xl text-black mt-4 leading-tight">Live Autonomous Mission</h1>
          <p className="text-base text-black/60 mt-3 max-w-2xl">
            This is not a chat. Click run and a code agent executes the growth pipeline on its own — live HTTP fetches,
            real database writes, real task dispatch. Watch the trace happen.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mt-8">
            <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" className="xa-input sm:max-w-xs" disabled={running} />
            <button onClick={runMission} disabled={running || !domain} className="xa-btn-primary">
              {running ? <><Loader2 className="w-4 h-4 animate-spin" /> Running…</> : <><Play className="w-4 h-4" /> Run autonomous mission</>}
            </button>
          </div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-10">
        {error && (
          <div className="xa-card p-5 border-red-200 bg-red-50 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
            <div><p className="font-bold text-red-700">Mission error</p><p className="text-sm text-red-600 mt-1">{error}</p></div>
          </div>
        )}

        {result && (
          <div className="space-y-6">
            <div className="xa-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <h2 className="font-heading font-bold text-lg text-black">Mission complete — {result.stages_executed} stages executed autonomously</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Metric label="Domain status" value={result.result.domain_status} />
                <Metric label="Health score" value={`${result.result.health_score}/100`} />
                <Metric label="Sitemap" value={result.result.sitemap_ok ? "Found" : "Missing"} />
                <Metric label="Tasks created" value={result.result.tasks_created.length} />
              </div>
              <div className="mt-4 pt-4 border-t border-[#E5E7EB] flex items-center gap-2 text-sm text-black/60">
                <Database className="w-4 h-4" /> Domain record updated: <code className="text-black font-mono">{result.result.domain_id}</code>
              </div>
            </div>

            <div className="xa-card p-6">
              <h3 className="font-heading font-bold text-black mb-4 flex items-center gap-2"><Zap className="w-4 h-4" /> Live execution trace</h3>
              <ol className="space-y-2">
                {result.trace.map((t, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#FFF7B3] text-black font-bold text-xs flex items-center justify-center">{i + 1}</span>
                    <div>
                      <p className="font-semibold text-black">{STAGE_LABELS[t.stage] || t.stage}</p>
                      <p className="text-black/50 font-mono text-xs mt-0.5">{JSON.stringify({ ...t, stage: undefined }).replace(/^\{|:undefined|"|\}$/g, m => m === "{" || m === "}" ? "" : m)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="flex gap-3">
              <button onClick={() => navigate("/domains")} className="xa-btn-outline">View domain registry</button>
              <button onClick={() => navigate("/agents/growth_operator")} className="xa-btn-outline">Chat with Growth Operator</button>
            </div>
          </div>
        )}

        {!result && !error && !running && (
          <div className="xa-card p-10 text-center">
            <p className="text-black/50">Press <span className="font-bold text-black">Run autonomous mission</span> to watch the code agent execute live.</p>
          </div>
        )}
      </section>
    </div>
  );
}