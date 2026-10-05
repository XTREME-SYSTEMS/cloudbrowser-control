import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Loader2, Rocket } from "lucide-react";
import PipelineOverview from "@/components/factory/PipelineOverview";
import DomainDiscovery from "@/components/factory/DomainDiscovery";
import WebsiteBuilder from "@/components/factory/WebsiteBuilder";
import TemplateGenerator from "@/components/factory/TemplateGenerator";
import RepoGenerator from "@/components/factory/RepoGenerator";
import SandboxPanel from "@/components/factory/SandboxPanel";
import IntegrationStack from "@/components/factory/IntegrationStack";
import CostOptimizer from "@/components/factory/CostOptimizer";

export default function WebsiteFactory() {
  const navigate = useNavigate();
  const [launching, setLaunching] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [stage, setStage] = useState("discover");
  const [freeMode, setFreeMode] = useState(true);

  const launchFull = async () => {
    setLaunching(true); setError(null); setResult(null);
    try {
      const res = await base44.functions.invoke("runBatchOperation", {
        name: "Factory Pipeline", batch_size: 10, template: {}, variables: "[]",
        deploy_targets: freeMode ? ["github"] : ["railway", "github"],
        google_connect: true, social_connect: true, video_generate: !freeMode, content_optimize: true,
        free_mode: freeMode
      });
      setResult(res.data || res);
    } catch (e) { setError(e.message); }
    setLaunching(false);
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <header className="border-b border-[#E5E7EB] bg-white sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="xa-pill-badge">WEBSITE FACTORY</span>
            <h1 className="font-heading font-black text-xl sm:text-2xl text-black mt-1 truncate">Full AI-Enhanced Website Factory</h1>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => navigate("/batch")} className="xa-btn-outline text-xs px-3 py-2">⚡ Batch</button>
            <button onClick={() => navigate("/")} className="xa-btn-outline text-xs px-3 py-2">← Home</button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <WebsiteBuilder />
        <CostOptimizer freeMode={freeMode} setFreeMode={setFreeMode} />
        <PipelineOverview activeStage={stage} />
        <IntegrationStack />
        <DomainDiscovery onDiscovered={() => setStage("buy")} />
        <TemplateGenerator onGenerated={() => setStage("generate")} />
        <RepoGenerator onCreated={() => setStage("build")} />
        <SandboxPanel />

        <button onClick={launchFull} disabled={launching} className="xa-btn-primary w-full py-4 text-base">
          {launching ? <><Loader2 className="w-5 h-5 animate-spin" /> Launching full pipeline…</> : <><Rocket className="w-5 h-5" /> Launch full factory pipeline</>}
        </button>

        {result && (
          <div className="xa-card p-4 bg-green-50 border-green-200">
            <div className="font-bold text-green-700 text-sm">Pipeline dispatched!</div>
            <div className="text-xs text-black/60 mt-1">{result.sites || result.batch_size} sites · {result.tasks_dispatched} autonomous tasks queued.</div>
          </div>
        )}
        {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}

        <div className="xa-card p-4 bg-[#FFF7B3]/30 border-[#E6D400]/30">
          <p className="text-xs text-black/60 leading-relaxed">
            <strong className="text-black">The full stack:</strong> Discover domains across all TLDs → buy via GoDaddy → AI-generate templates → create GitHub repos → build with Base44 → deploy to Vercel + Railway → connect Supabase backend → store data in Drive → auto-connect Google + social → auto-post → auto-analyze → auto-optimize. All from this one page. The worker executes every phase autonomously.
          </p>
        </div>
      </main>
    </div>
  );
}