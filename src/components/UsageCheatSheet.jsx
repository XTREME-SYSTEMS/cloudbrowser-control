import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Calculator, BookOpen, Zap, Lightbulb, Cpu, Globe, Brain, HardDrive,
  TrendingUp, Activity, Gauge, Video, Bug, Layers, Save, Puzzle, UserCircle,
  Shield, Webhook, Network, Share2, ScrollText, Rocket, Target, DollarSign,
} from "lucide-react";

const DEFAULT_RATES = {
  compute_rate_per_min: 0.005, proxy_rate_per_gb: 2.0, llm_rate_per_call: 0.02, storage_rate_per_gb_month: 0.02,
};
const fmt = (c) => (c < 0.01 ? `$${c.toFixed(4)}` : c < 1 ? `$${c.toFixed(3)}` : `$${c.toFixed(2)}`);

const ALL_ACTIONS = [
  { group: "Navigation", items: ["goto", "back", "forward", "reload", "new_tab", "switch_tab", "close_tab"] },
  { group: "Waiting", items: ["wait_for_selector", "wait_for_load_state", "wait_for_timeout"] },
  { group: "Interaction", items: ["click", "hover", "type", "fill", "press", "select_option", "scroll", "drag_and_drop", "handle_dialog"] },
  { group: "File I/O", items: ["upload_file", "download", "screenshot", "pdf"] },
  { group: "Extraction", items: ["extract_text", "extract_html", "extract_attribute", "extract_table", "extract_json", "ai_extract"] },
  { group: "Browser Config", items: ["set_cookies", "set_headers", "set_local_storage", "capture_response", "mock_response"] },
  { group: "Advanced", items: ["solve_captcha", "save_state", "restore_state"] },
];

const FEATURES = [
  { name: "Session Recording", desc: "Record video of browser sessions", icon: Video },
  { name: "CDP Debugging", desc: "Live Chrome DevTools Protocol", icon: Bug },
  { name: "Session Pooling", desc: "Pre-warmed sessions, instant start", icon: Layers },
  { name: "Session Resume", desc: "Save & restore browser state", icon: Save },
  { name: "Extensions", desc: "Load .crx/.zip extensions", icon: Puzzle },
  { name: "Persistent Profiles", desc: "Cookies & localStorage persist", icon: UserCircle },
  { name: "CAPTCHA Solving", desc: "Auto-solve reCAPTCHA v2 & images", icon: Shield },
  { name: "Webhooks", desc: "Event notifications on jobs", icon: Webhook },
  { name: "Network Mocking", desc: "Intercept & mock API responses", icon: Network },
  { name: "Concurrency Control", desc: "Max sessions w/ backpressure", icon: Cpu },
  { name: "Session Sharing", desc: "Live view links for teams", icon: Share2 },
  { name: "Audit Logs", desc: "Track all user actions", icon: ScrollText },
];

const TIPS = [
  { title: "Block unnecessary resources", detail: "Block images, fonts, and CSS in session config to cut bandwidth 30-50% and speed up page loads.", impact: "High" },
  { title: "Use session pooling", detail: "Enable pooling for repetitive jobs — pre-warmed sessions start in <1s vs 3-5s cold start.", impact: "High" },
  { title: "Batch AI extraction", detail: "Each ai_extract step costs $0.02. Extract multiple fields in one call instead of multiple steps.", impact: "Medium" },
  { title: "Set aggressive timeouts", detail: "Lower timeout_ms to 15000-30000. Long-running sessions burn compute at $0.005/min even when stuck.", impact: "Medium" },
  { title: "Use persistent profiles", detail: "Save login state with profiles to skip auth steps on every run — saves 30-60s per job.", impact: "High" },
  { title: "Schedule smartly", detail: "Space out scheduled jobs. 10 jobs/hour = 240/day. At 2 min each = 480 min = $2.40/day compute.", impact: "Medium" },
  { title: "Mock network responses", detail: "Use network mocks for third-party APIs in testing — avoids rate limits and speeds up runs.", impact: "Low" },
  { title: "Clean up screenshots", detail: "Each screenshot is ~0.5MB. 1000 screenshots = 0.5GB = $0.01/month. Delete old ones to save storage.", impact: "Low" },
];

export default function UsageCheatSheet({ engineHealth, stats }) {
  const [rates, setRates] = useState(DEFAULT_RATES);
  const [costEntries, setCostEntries] = useState([]);
  const [budget, setBudget] = useState(0);

  const [jobsPerDay, setJobsPerDay] = useState(10);
  const [avgDuration, setAvgDuration] = useState(2);
  const [stepsPerJob, setStepsPerJob] = useState(5);
  const [aiPerJob, setAiPerJob] = useState(1);
  const [screenshotsPerJob, setScreenshotsPerJob] = useState(2);
  const [usesProxy, setUsesProxy] = useState(false);

  useEffect(() => {
    base44.entities.CostSettings.list("-created_date", 1).then((s) => {
      if (s[0]) { setRates(s[0]); setBudget(s[0].monthly_budget || 0); }
    }).catch(() => {});
    base44.entities.CostEntry.list("-timestamp", 500).then(setCostEntries).catch(() => {});
  }, []);

  const realUsage = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEntries = costEntries.filter((e) => new Date(e.timestamp || e.created_date) >= monthStart);
    const monthTotal = monthEntries.reduce((s, e) => s + (e.cost || 0), 0);
    const catMap = {};
    monthEntries.forEach((e) => { catMap[e.category] = (catMap[e.category] || 0) + (e.cost || 0); });
    const dayOfMonth = now.getDate();
    const dailyAvg = dayOfMonth > 0 ? monthTotal / dayOfMonth : 0;
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const projectedMonth = dailyAvg * daysInMonth;
    return { monthTotal, catMap, dailyAvg, projectedMonth, entryCount: monthEntries.length };
  }, [costEntries]);

  const calc = useMemo(() => {
    const computeMinPerDay = jobsPerDay * avgDuration;
    const computeCostPerDay = computeMinPerDay * rates.compute_rate_per_min;
    const llmCallsPerDay = jobsPerDay * aiPerJob;
    const llmCostPerDay = llmCallsPerDay * rates.llm_rate_per_call;
    const storageItemsPerDay = jobsPerDay * screenshotsPerJob;
    const storageGBPerDay = (storageItemsPerDay * 0.5) / 1024;
    const storageCostPerDay = (storageGBPerDay * rates.storage_rate_per_gb_month) / 30;
    const proxyGBPerDay = usesProxy ? (computeMinPerDay * 2) / 1024 : 0;
    const proxyCostPerDay = proxyGBPerDay * rates.proxy_rate_per_gb;
    const totalPerDay = computeCostPerDay + llmCostPerDay + storageCostPerDay + proxyCostPerDay;
    const totalPerMonth = totalPerDay * 30;
    return {
      computeCostPerDay, llmCostPerDay, storageCostPerDay, proxyCostPerDay,
      totalPerDay, totalPerMonth, computeMinPerDay, llmCallsPerDay, storageItemsPerDay, proxyGBPerDay,
    };
  }, [jobsPerDay, avgDuration, aiPerJob, screenshotsPerJob, usesProxy, rates]);

  const budgetPct = budget > 0 ? (calc.totalPerMonth / budget) * 100 : 0;
  const maxSessions = engineHealth?.max_sessions || 10;
  const activeSessions = engineHealth?.active_sessions || 0;
  const poolSize = engineHealth?.pool_size || 0;
  const capacityPct = maxSessions > 0 ? (activeSessions / maxSessions) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Calculator className="w-5 h-5" />Usage Cheat Sheet</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="calculator">
          <TabsList className="w-full justify-start mb-4 overflow-x-auto flex-nowrap">
            <TabsTrigger value="calculator" className="flex-1 sm:flex-none">Calculator</TabsTrigger>
            <TabsTrigger value="formulas" className="flex-1 sm:flex-none">Formulas</TabsTrigger>
            <TabsTrigger value="capabilities" className="flex-1 sm:flex-none">Capabilities</TabsTrigger>
            <TabsTrigger value="tips" className="flex-1 sm:flex-none">Pro Tips</TabsTrigger>
          </TabsList>

          {/* ─── Calculator Tab ─── */}
          <TabsContent value="calculator" className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Jobs / Day</Label>
                <Input type="number" value={jobsPerDay} onChange={(e) => setJobsPerDay(+e.target.value || 0)} className="h-8" />
              </div>
              <div>
                <Label className="text-xs">Avg Duration (min)</Label>
                <Input type="number" step="0.5" value={avgDuration} onChange={(e) => setAvgDuration(+e.target.value || 0)} className="h-8" />
              </div>
              <div>
                <Label className="text-xs">Steps / Job</Label>
                <Input type="number" value={stepsPerJob} onChange={(e) => setStepsPerJob(+e.target.value || 0)} className="h-8" />
              </div>
              <div>
                <Label className="text-xs">AI Extracts / Job</Label>
                <Input type="number" value={aiPerJob} onChange={(e) => setAiPerJob(+e.target.value || 0)} className="h-8" />
              </div>
              <div>
                <Label className="text-xs">Screenshots / Job</Label>
                <Input type="number" value={screenshotsPerJob} onChange={(e) => setScreenshotsPerJob(+e.target.value || 0)} className="h-8" />
              </div>
              <div className="flex items-center justify-between p-2 border rounded-md h-8 mt-5">
                <span className="text-xs">Proxy?</span>
                <Switch checked={usesProxy} onCheckedChange={setUsesProxy} />
              </div>
            </div>

            {/* Results */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                <Cpu className="w-4 h-4 text-blue-500 mb-1" />
                <p className="text-xs text-muted-foreground">Compute</p>
                <p className="text-lg font-bold">{fmt(calc.computeCostPerDay)}<span className="text-xs font-normal text-muted-foreground">/day</span></p>
                <p className="text-xs text-muted-foreground">{calc.computeMinPerDay.toFixed(0)} min/day</p>
              </div>
              <div className="p-3 rounded-lg bg-purple-50 border border-purple-200">
                <Brain className="w-4 h-4 text-purple-500 mb-1" />
                <p className="text-xs text-muted-foreground">LLM</p>
                <p className="text-lg font-bold">{fmt(calc.llmCostPerDay)}<span className="text-xs font-normal text-muted-foreground">/day</span></p>
                <p className="text-xs text-muted-foreground">{calc.llmCallsPerDay} calls/day</p>
              </div>
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                <HardDrive className="w-4 h-4 text-emerald-500 mb-1" />
                <p className="text-xs text-muted-foreground">Storage</p>
                <p className="text-lg font-bold">{fmt(calc.storageCostPerDay)}<span className="text-xs font-normal text-muted-foreground">/day</span></p>
                <p className="text-xs text-muted-foreground">{calc.storageItemsPerDay} files/day</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                <Globe className="w-4 h-4 text-amber-500 mb-1" />
                <p className="text-xs text-muted-foreground">Proxy</p>
                <p className="text-lg font-bold">{fmt(calc.proxyCostPerDay)}<span className="text-xs font-normal text-muted-foreground">/day</span></p>
                <p className="text-xs text-muted-foreground">{calc.proxyGBPerDay.toFixed(3)} GB/day</p>
              </div>
            </div>

            {/* Monthly projection */}
            <div className="p-4 rounded-lg bg-primary text-primary-foreground">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  <div>
                    <p className="text-xs opacity-80">Projected Monthly Cost</p>
                    <p className="text-2xl font-bold">{fmt(calc.totalPerMonth)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs opacity-80">Daily Cost</p>
                  <p className="text-xl font-bold">{fmt(calc.totalPerDay)}</p>
                </div>
              </div>
              {budget > 0 && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs opacity-80 mb-1">
                    <span>Budget: {fmt(budget)}/mo</span>
                    <span>{budgetPct.toFixed(0)}% used</span>
                  </div>
                  <div className="h-2 rounded-full bg-primary-foreground/20 overflow-hidden">
                    <div className={`h-full rounded-full ${budgetPct >= 100 ? "bg-red-400" : "bg-primary-foreground"}`} style={{ width: `${Math.min(budgetPct, 100)}%` }} />
                  </div>
                </div>
              )}
            </div>

            {/* Real usage this month */}
            {realUsage.entryCount > 0 && (
              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1"><Activity className="w-3.5 h-3.5" /> Your Actual Usage This Month</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Spent:</span> <span className="font-bold">{fmt(realUsage.monthTotal)}</span></div>
                  <div><span className="text-muted-foreground">Daily avg:</span> <span className="font-bold">{fmt(realUsage.dailyAvg)}</span></div>
                  <div><span className="text-muted-foreground">Projected:</span> <span className="font-bold">{fmt(realUsage.projectedMonth)}</span></div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ─── Formulas Tab ─── */}
          <TabsContent value="formulas" className="space-y-3">
            <p className="text-sm text-muted-foreground">Cost = Compute + LLM + Storage + Proxy. Each is calculated per job and summed.</p>
            {[
              { icon: Cpu, color: "text-blue-500", bg: "bg-blue-50", name: "Compute", formula: "session_minutes × rate_per_min", rate: `$${rates.compute_rate_per_min}/min`, example: `30 min × $${rates.compute_rate_per_min} = ${fmt(30 * rates.compute_rate_per_min)}` },
              { icon: Brain, color: "text-purple-500", bg: "bg-purple-50", name: "LLM / AI", formula: "ai_extract_calls × rate_per_call", rate: `$${rates.llm_rate_per_call}/call`, example: `5 calls × $${rates.llm_rate_per_call} = ${fmt(5 * rates.llm_rate_per_call)}` },
              { icon: HardDrive, color: "text-emerald-500", bg: "bg-emerald-50", name: "Storage", formula: "files × 0.5MB ÷ 1024 × rate_per_GB", rate: `$${rates.storage_rate_per_gb_month}/GB/mo`, example: `10 screenshots ≈ 5MB = ${fmt((5 / 1024) * rates.storage_rate_per_gb_month)}/mo` },
              { icon: Globe, color: "text-amber-500", bg: "bg-amber-50", name: "Proxy", formula: "bandwidth_GB × rate_per_GB", rate: `$${rates.proxy_rate_per_gb}/GB`, example: `1 GB × $${rates.proxy_rate_per_gb} = ${fmt(rates.proxy_rate_per_gb)}` },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.name} className={`p-3 rounded-lg ${f.bg} border`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`w-4 h-4 ${f.color}`} />
                    <span className="font-medium text-sm">{f.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{f.rate}</span>
                  </div>
                  <p className="text-xs font-mono text-muted-foreground">{f.formula}</p>
                  <p className="text-xs mt-1">Example: {f.example}</p>
                </div>
              );
            })}
            <div className="p-3 rounded-lg bg-muted/50 border">
              <p className="text-xs font-medium text-muted-foreground mb-1">Quick estimate per job:</p>
              <p className="text-sm font-mono">cost ≈ (steps × 5s ÷ 60) × $0.005 + ai_steps × $0.02 + screenshots × $0.00001</p>
              <p className="text-xs text-muted-foreground mt-1">A 10-step job with 1 AI extract and 2 screenshots ≈ {fmt((10 * 5 / 60) * 0.005 + 0.02 + 2 * 0.00001)}</p>
            </div>
          </TabsContent>

          {/* ─── Capabilities Tab ─── */}
          <TabsContent value="capabilities" className="space-y-4">
            {/* Engine capacity */}
            <div className="p-3 rounded-lg bg-muted/50 border">
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1"><Gauge className="w-3.5 h-3.5" />Engine Capacity</p>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="text-center"><p className="text-lg font-bold">{activeSessions}</p><p className="text-xs text-muted-foreground">Active</p></div>
                <div className="text-center"><p className="text-lg font-bold">{maxSessions}</p><p className="text-xs text-muted-foreground">Max</p></div>
                <div className="text-center"><p className="text-lg font-bold">{poolSize}</p><p className="text-xs text-muted-foreground">Pooled</p></div>
              </div>
              <div className="h-2 rounded-full bg-muted mt-2 overflow-hidden">
                <div className={`h-full rounded-full ${capacityPct >= 80 ? "bg-red-500" : "bg-blue-500"}`} style={{ width: `${Math.min(capacityPct, 100)}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{capacityPct.toFixed(0)}% capacity · {maxSessions - activeSessions} slots available</p>
            </div>

            {/* Features */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1"><Rocket className="w-3.5 h-3.5" />12 Advanced Features</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {FEATURES.map((f) => {
                  const Icon = f.icon;
                  return (
                    <div key={f.name} className="flex items-start gap-2 p-2 rounded-lg border">
                      <Icon className="w-4 h-4 shrink-0 mt-0.5 text-muted-foreground" />
                      <div><p className="text-sm font-medium">{f.name}</p><p className="text-xs text-muted-foreground">{f.desc}</p></div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* All actions */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1"><Zap className="w-3.5 h-3.5" />37 Step Actions Available</p>
              <div className="space-y-2">
                {ALL_ACTIONS.map((g) => (
                  <div key={g.group}>
                    <p className="text-xs font-medium text-muted-foreground">{g.group}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {g.items.map((a) => (
                        <span key={a} className="px-2 py-0.5 rounded text-xs bg-muted font-mono">{a}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* ─── Pro Tips Tab ─── */}
          <TabsContent value="tips" className="space-y-2">
            {TIPS.map((tip, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
                <Target className="w-4 h-4 shrink-0 mt-0.5 text-muted-foreground" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{tip.title}</p>
                    <span className={`text-xs px-2 py-0.5 rounded ${tip.impact === "High" ? "bg-orange-100 text-orange-700" : tip.impact === "Medium" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"}`}>{tip.impact}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{tip.detail}</p>
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}