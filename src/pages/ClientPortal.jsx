import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Loader2, RefreshCw, TrendingUp, Target, Clock, Globe, BarChart3, Bell, FileText, Sparkles, Share2 } from "lucide-react";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

export default function ClientPortal() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [domain, setDomain] = useState("");
  const [domains, setDomains] = useState([]);
  const [pages, setPages] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [socialAccounts, setSocialAccounts] = useState([]);
  const [recommendation, setRecommendation] = useState(null);
  const [generatingRec, setGeneratingRec] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Get unique domains from SEO pages
      const pageRes = await base44.entities.SEOPage.filter({ status: "published" }, { sort: "-created_date", limit: 500, fields: ["domain", "title", "slug", "gsc_impressions", "gsc_clicks", "gsc_position", "gsc_ctr", "page_type", "optimization_score"] });
      const allPages = pageRes.items || [];
      const uniqueDomains = [...new Set(allPages.map(p => p.domain).filter(Boolean))];
      setDomains(uniqueDomains);
      const targetDomain = domain || uniqueDomains[0] || "";
      if (!domain && targetDomain) setDomain(targetDomain);
      setPages(allPages.filter(p => p.domain === targetDomain));

      // Growth opportunities for this domain
      const oppRes = await base44.entities.GrowthOpportunity.filter({ domain: targetDomain, status: "new" }, { sort: "-created_date", limit: 20 });
      setOpportunities(oppRes.items || []);

      // Pending approvals
      const apprRes = await base44.entities.Approval.filter({ status: "pending" }, { sort: "-created_date", limit: 10 });
      setApprovals(apprRes.items || []);

      // Social accounts
      const socialRes = await base44.entities.SocialMediaAccount.filter({ status: "active" }, { limit: 20 });
      setSocialAccounts(socialRes.items || []);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [domain]);

  useEffect(() => { load(); }, [load]);

  const generateRecommendation = async () => {
    setGeneratingRec(true);
    try {
      const res = await base44.functions.invoke('invokeGatewayLLM', {
        prompt: `You are an AI SEO advisor for the domain ${domain}. Based on these current metrics:

Pages: ${pages.length}
Total GSC impressions: ${pages.reduce((s, p) => s + (p.gsc_impressions || 0), 0)}
Total GSC clicks: ${pages.reduce((s, p) => s + (p.gsc_clicks || 0), 0)}
Average position: ${(pages.reduce((s, p) => s + (p.gsc_position || 0), 0) / Math.max(pages.length, 1)).toFixed(1)}
Growth opportunities: ${opportunities.length}

Top opportunities:
${opportunities.slice(0, 5).map(o => `- ${o.title} (${o.priority})`).join('\n')}

Generate a JSON object with:
- daily_summary: one paragraph summarizing today's performance and momentum
- top_3_actions: the 3 most impactful actions to take right now to improve Google rankings
- weekly_forecast: what to expect in the next 7 days based on current trends
- competitive_alert: one insight about competitor activity or market changes`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            daily_summary: { type: "string" },
            top_3_actions: { type: "array", items: { type: "string" } },
            weekly_forecast: { type: "string" },
            competitive_alert: { type: "string" },
          },
        },
      });
      setRecommendation(res.data?.result || res.data || res);
    } catch (e) { setError(e.message); }
    setGeneratingRec(false);
  };

  // Chart data: simulate 7-day trend from current metrics
  const chartData = pages.slice(0, 7).map((p, i) => ({
    name: p.slug || "home",
    impressions: p.gsc_impressions || 0,
    clicks: p.gsc_clicks || 0,
    position: p.gsc_position || 0,
  }));

  const totalImpressions = pages.reduce((s, p) => s + (p.gsc_impressions || 0), 0);
  const totalClicks = pages.reduce((s, p) => s + (p.gsc_clicks || 0), 0);
  const avgPosition = pages.length > 0 ? (pages.reduce((s, p) => s + (p.gsc_position || 0), 0) / pages.length).toFixed(1) : "—";
  const avgScore = pages.length > 0 ? Math.round(pages.reduce((s, p) => s + (p.optimization_score || 0), 0) / pages.length) : 0;

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <header className="border-b border-[#E5E7EB] bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="xa-pill-badge">CLIENT PORTAL</span>
            <h1 className="font-heading font-black text-xl sm:text-2xl text-black mt-1 truncate">Your Digital Dashboard</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <select value={domain} onChange={(e) => setDomain(e.target.value)} className="xa-input !py-2 !px-3 w-36 sm:w-48 text-sm">
              <option value="">Select domain…</option>
              {domains.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <button onClick={() => navigate("/")} className="xa-btn-outline">← Center</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}

        {/* Performance Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={BarChart3} label="Impressions (28d)" value={totalImpressions.toLocaleString()} color="#2563EB" />
          <StatCard icon={TrendingUp} label="Clicks (28d)" value={totalClicks.toLocaleString()} color="#16A34A" />
          <StatCard icon={Target} label="Avg Position" value={avgPosition} color="#8A7300" />
          <StatCard icon={Sparkles} label="Optimization Score" value={`${avgScore}/100`} color={avgScore >= 80 ? "#16A34A" : "#DC2626"} />
        </div>

        {/* Charts */}
        {chartData.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="xa-card p-5">
              <h3 className="font-heading font-bold text-sm text-black mb-3">Impressions by Page</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="impressions" fill="#FFEA00" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="xa-card p-5">
              <h3 className="font-heading font-bold text-sm text-black mb-3">Clicks by Page</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="clicks" fill="#16A34A" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* AI Daily Recommendation */}
        <div className="xa-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading font-bold text-lg text-black flex items-center gap-2"><Sparkles className="w-5 h-5 text-[#CCBB00]" /> Daily AI Recommendations</h2>
            <button onClick={generateRecommendation} disabled={generatingRec} className="xa-btn-primary !py-2 !px-3 !text-xs">
              {generatingRec ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Generate
            </button>
          </div>
          {recommendation ? (
            <div className="space-y-3">
              <p className="text-sm text-black/70">{recommendation.daily_summary}</p>
              <div>
                <div className="text-xs font-bold text-black/50 uppercase mb-1">Top 3 Actions</div>
                <ol className="list-decimal list-inside space-y-1 text-sm text-black/70">
                  {recommendation.top_3_actions?.map((a, i) => <li key={i}>{a}</li>)}
                </ol>
              </div>
              <div className="text-sm text-black/60"><span className="font-bold text-black/50">Forecast:</span> {recommendation.weekly_forecast}</div>
              <div className="text-sm text-black/60"><span className="font-bold text-black/50">Competitive Alert:</span> {recommendation.competitive_alert}</div>
            </div>
          ) : (
            <p className="text-sm text-black/40">Click "Generate" to get your daily AI-powered performance analysis and recommendations.</p>
          )}
        </div>

        {/* Growth Opportunities */}
        <div>
          <h2 className="font-heading font-bold text-lg text-black mb-3 flex items-center gap-2"><Target className="w-5 h-5 text-[#CCBB00]" /> Growth Opportunities</h2>
          {loading ? <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-[#CCBB00]" /></div> : opportunities.length === 0 ? (
            <div className="xa-card p-6 text-center text-black/40 text-sm">No growth opportunities for this domain yet. Run a growth scan from the Digital Dominance dashboard.</div>
          ) : (
            <div className="space-y-2">
              {opportunities.map((o) => (
                <div key={o.id} className="xa-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-black text-sm">{o.title}</div>
                      <div className="text-xs text-black/45 mt-0.5">{o.description}</div>
                      {o.action_required && <div className="text-xs text-[#CCBB00] font-semibold mt-1">→ {o.action_required}</div>}
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${o.priority === "P0" ? "bg-red-100 text-red-700" : o.priority === "P1" ? "bg-orange-100 text-orange-700" : "bg-blue-50 text-blue-600"}`}>{o.priority}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Approval Gates */}
        <div>
          <h2 className="font-heading font-bold text-lg text-black mb-3 flex items-center gap-2"><Bell className="w-5 h-5 text-[#CCBB00]" /> Approval Gates</h2>
          {approvals.length === 0 ? (
            <div className="xa-card p-6 text-center text-black/40 text-sm">No pending approvals. You're all caught up!</div>
          ) : (
            <div className="space-y-2">
              {approvals.map((a) => (
                <div key={a.id} className="xa-card p-4 flex items-center gap-3">
                  <Clock className="w-4 h-4 text-[#8A7300] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-black text-sm">{a.title || a.description || "Approval required"}</div>
                    {a.description && <div className="text-xs text-black/45 mt-0.5">{a.description}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Social Media Management */}
        <div>
          <h2 className="font-heading font-bold text-lg text-black mb-3 flex items-center gap-2"><Share2 className="w-5 h-5 text-[#CCBB00]" /> Social Media Management</h2>
          {socialAccounts.length === 0 ? (
            <div className="xa-card p-6 text-center text-black/40 text-sm">No social media accounts connected yet.</div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {socialAccounts.map((s) => (
                <div key={s.id} className="xa-card p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-black text-sm capitalize">{s.platform}</div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{s.status}</span>
                  </div>
                  <div className="text-xs text-black/45 mt-1">@{s.handle}</div>
                  <div className="flex gap-3 mt-2 text-xs text-black/50">
                    <span>{s.followers || 0} followers</span>
                    <span>{s.posts_count || 0} posts</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SEO Pages */}
        <div>
          <h2 className="font-heading font-bold text-lg text-black mb-3 flex items-center gap-2"><FileText className="w-5 h-5 text-[#CCBB00]" /> Your SEO Pages</h2>
          {loading ? <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-[#CCBB00]" /></div> : pages.length === 0 ? (
            <div className="xa-card p-6 text-center text-black/40 text-sm">No pages published for this domain yet.</div>
          ) : (
            <div className="space-y-2">
              {pages.map((p) => (
                <div key={p.id} className="xa-card p-4 flex items-center gap-3">
                  <Globe className="w-4 h-4 text-black/30 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-black text-sm truncate">{p.title}</div>
                    <div className="text-xs text-black/45">/{p.slug || ""} · {p.page_type}</div>
                  </div>
                  <div className="flex gap-3 text-xs text-black/50 shrink-0">
                    <span>{p.gsc_impressions || 0} imp</span>
                    <span>{p.gsc_clicks || 0} clicks</span>
                    {p.gsc_position > 0 && <span>#{p.gsc_position.toFixed(1)}</span>}
                  </div>
                </div>
              ))}
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
      <div className="font-heading font-black text-xl sm:text-2xl text-black mt-1">{value}</div>
    </div>
  );
}