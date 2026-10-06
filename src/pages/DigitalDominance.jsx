import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Loader2, RefreshCw, Zap, Globe, TrendingUp, Target, FileText, Rocket, AlertCircle } from "lucide-react";

export default function DigitalDominance() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [concepts, setConcepts] = useState([]);
  const [pageCount, setPageCount] = useState(0);
  const [oppCount, setOppCount] = useState(0);
  const [opportunities, setOpportunities] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [domain, setDomain] = useState("");
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [conceptRes, pageCnt, oppCnt, oppRes] = await Promise.all([
        base44.entities.BusinessConcept.filter({}, { sort: "-score", limit: 50 }),
        base44.entities.SEOPage.count({}),
        base44.entities.GrowthOpportunity.count({ status: "new" }),
        base44.entities.GrowthOpportunity.filter({ status: "new" }, { sort: "-created_date", limit: 10 }),
      ]);
      setConcepts(conceptRes.items || []);
      setPageCount(pageCnt || 0);
      setOppCount(oppCnt || 0);
      setOpportunities(oppRes.items || []);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const generatePages = async (conceptId) => {
    setGenerating(true); setError(null); setResult(null);
    try {
      const res = await base44.functions.invoke("runDigitalDominanceEngine", { concept_id: conceptId, domain: domain || "example.com" });
      setResult(res.data || res);
      await load();
    } catch (e) { setError(e.message); }
    setGenerating(false);
  };

  const syncGSC = async () => {
    setSyncing(true); setError(null);
    try {
      const res = await base44.functions.invoke("syncGSCAnalytics", { domain: domain || undefined });
      setResult(res.data || res);
      await load();
    } catch (e) { setError(e.message); }
    setSyncing(false);
  };

  const runScan = async () => {
    setScanning(true); setError(null);
    try {
      const res = await base44.functions.invoke("runGrowthOpportunityScan", { domain: domain || undefined });
      setResult(res.data || res);
      await load();
    } catch (e) { setError(e.message); }
    setScanning(false);
  };

  const OPP_ICON = { keyword_gap: Target, content_gap: FileText, competitor_piggyback: TrendingUp, niche_insight: Zap, aeo_opportunity: Globe, geo_expansion: Globe, social_trend: Zap, backlink: TrendingUp };
  const PRIORITY_COLOR = { P0: "bg-red-100 text-red-700", P1: "bg-orange-100 text-orange-700", P2: "bg-blue-50 text-blue-600", P3: "bg-gray-100 text-gray-500" };

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <header className="border-b border-[#E5E7EB] bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="xa-pill-badge">DIGITAL DOMINANCE</span>
            <h1 className="font-heading font-black text-xl sm:text-2xl text-black mt-1 truncate">Universal SEO/AEO/GEO Engine</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="domain.com" className="xa-input !py-2 !px-3 w-32 sm:w-40 text-sm" />
            <button onClick={() => navigate("/")} className="xa-btn-outline">← Center</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={FileText} label="Business Concepts" value={concepts.length} color="#2563EB" />
          <StatCard icon={Globe} label="SEO Pages" value={pageCount} color="#8A7300" />
          <StatCard icon={TrendingUp} label="Growth Opportunities" value={oppCount} color="#DC2626" />
          <StatCard icon={Target} label="Quick Wins (P0)" value={opportunities.filter(o => o.priority === "P0").length} color="#16A34A" />
        </div>

        {/* Action Panel */}
        <div className="xa-card p-5">
          <h2 className="font-heading font-bold text-lg text-black mb-3 flex items-center gap-2"><Rocket className="w-5 h-5 text-[#CCBB00]" /> Dominance Actions</h2>
          <div className="flex flex-wrap gap-2">
            <button onClick={syncGSC} disabled={syncing} className="xa-btn-primary">
              {syncing ? <><Loader2 className="w-4 h-4 animate-spin" /> Syncing GSC…</> : <><RefreshCw className="w-4 h-4" /> Sync GSC Analytics</>}
            </button>
            <button onClick={runScan} disabled={scanning} className="xa-btn-outline">
              {scanning ? <><Loader2 className="w-4 h-4 animate-spin" /> Scanning…</> : <><Target className="w-4 h-4" /> Run Growth Scan</>}
            </button>
          </div>
          {result && (
            <div className="mt-4 p-3 rounded-xl bg-[#FAFAFA] border border-[#E5E7EB] text-sm">
              {result.pages_generated != null && <div><span className="text-black/50">Pages generated:</span> <span className="font-bold text-black">{result.pages_generated}</span></div>}
              {result.pages_synced != null && <div><span className="text-black/50">Pages synced:</span> <span className="font-bold text-black">{result.pages_synced}</span></div>}
              {result.opportunities_discovered != null && <div><span className="text-black/50">Opportunities found:</span> <span className="font-bold text-black">{result.opportunities_discovered}</span></div>}
            </div>
          )}
          {error && <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
        </div>

        {/* Business Concepts */}
        <div>
          <h2 className="font-heading font-bold text-lg text-black mb-3">Business Concepts</h2>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#CCBB00]" /></div>
          ) : (
            <div className="space-y-2">
              {concepts.map((c) => (
                <div key={c.id} className="xa-card p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#FFF7B3] flex items-center justify-center shrink-0 font-bold text-[#8A7300] text-xs">{c.concept_id}</div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-black text-sm truncate">{c.name}</div>
                    <div className="text-xs text-black/45 truncate">{c.industry} · {c.customer}</div>
                  </div>
                  <div className="text-xs font-bold px-2 py-1 rounded-full shrink-0" style={{ background: c.score >= 75 ? "#DCFCE7" : c.score >= 50 ? "#FFF7B3" : "#FEE2E2", color: c.score >= 75 ? "#16A34A" : c.score >= 50 ? "#8A7300" : "#DC2626" }}>{c.score || 0}</div>
                  <button onClick={() => generatePages(c.id)} disabled={generating} className="xa-btn-primary !py-2 !px-3 !text-xs shrink-0">
                    {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />} Generate
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Growth Opportunities */}
        <div>
          <h2 className="font-heading font-bold text-lg text-black mb-3">Latest Growth Opportunities</h2>
          {opportunities.length === 0 ? (
            <div className="xa-card p-8 text-center text-black/40 text-sm">No opportunities yet. Run a growth scan to discover them.</div>
          ) : (
            <div className="space-y-2">
              {opportunities.map((o) => {
                const Icon = OPP_ICON[o.opportunity_type] || Target;
                return (
                  <div key={o.id} className="xa-card p-4 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#FFF7B3] flex items-center justify-center shrink-0"><Icon className="w-4 h-4 text-[#8A7300]" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-black text-sm">{o.title}</div>
                      <div className="text-xs text-black/45 mt-0.5">{o.description}</div>
                      {o.keyword && <div className="text-xs text-[#CCBB00] font-mono mt-1">"{o.keyword}"</div>}
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${PRIORITY_COLOR[o.priority] || PRIORITY_COLOR.P2}`}>{o.priority}</span>
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

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="xa-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-black/50 uppercase tracking-wide">{label}</span>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="font-heading font-black text-2xl text-black mt-1">{value}</div>
    </div>
  );
}