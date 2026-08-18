import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import StatCard from "@/components/StatCard";
import { DollarSign, Cpu, Globe, Brain, HardDrive, TrendingUp, AlertTriangle, Lightbulb, Save } from "lucide-react";
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const CATEGORY_COLORS = { compute: "#3b82f6", proxy: "#f59e0b", llm: "#8b5cf6", storage: "#10b981" };
const CATEGORY_ICONS = { compute: Cpu, proxy: Globe, llm: Brain, storage: HardDrive };

const formatCost = (c) => (c < 0.01 ? `$${c.toFixed(4)}` : c < 1 ? `$${c.toFixed(3)}` : `$${c.toFixed(2)}`);

export default function Costs() {
  const [entries, setEntries] = useState([]);
  const [settings, setSettings] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rateForm, setRateForm] = useState({});
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [e, s, j, ses, sch] = await Promise.all([
          base44.entities.CostEntry.list("-timestamp", 500),
          base44.entities.CostSettings.list("-created_date", 1),
          base44.entities.Job.list("-created_date", 50),
          base44.entities.Session.list("-created_date", 50),
          base44.entities.Schedule.list("-created_date", 50),
        ]);
        setEntries(e);
        setSettings(s[0] || null);
        setJobs(j);
        setSessions(ses);
        setSchedules(sch);
        setRateForm(s[0] || { compute_rate_per_min: 0.005, proxy_rate_per_gb: 2.0, llm_rate_per_call: 0.02, storage_rate_per_gb_month: 0.02, monthly_budget: 0, alert_threshold_pct: 80 });
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  // Compute monthly + category breakdown
  const { monthTotal, categoryTotals, dailyTrend } = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEntries = entries.filter((e) => new Date(e.timestamp || e.created_date) >= monthStart);
    const monthTotal = monthEntries.reduce((s, e) => s + (e.cost || 0), 0);

    const catMap = {};
    monthEntries.forEach((e) => { catMap[e.category] = (catMap[e.category] || 0) + (e.cost || 0); });
    const categoryTotals = Object.entries(catMap).map(([name, value]) => ({ name, value: parseFloat(value.toFixed(6)) }));

    // Daily trend (last 14 days)
    const dailyMap = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dailyMap[key] = 0;
    }
    entries.forEach((e) => {
      const key = (e.timestamp || e.created_date || "").slice(0, 10);
      if (key in dailyMap) dailyMap[key] += e.cost || 0;
    });
    const dailyTrend = Object.entries(dailyMap).map(([date, cost]) => ({ date: date.slice(5), cost: parseFloat(cost.toFixed(4)) }));

    return { monthTotal, categoryTotals, dailyTrend };
  }, [entries]);

  // Optimization insights
  const insights = useMemo(() => {
    const tips = [];

    // Jobs without resource blocking
    const noBlocking = jobs.filter((j) => !j.session_config?.blockedResources?.length);
    if (noBlocking.length > 0) {
      tips.push({
        icon: Globe,
        title: "Block unnecessary resources",
        detail: `${noBlocking.length} job(s) don't block images/fonts. Blocking these can reduce bandwidth and compute costs by 30-50%.`,
        impact: "High",
      });
    }

    // Long sessions
    const longSessions = sessions.filter((s) => {
      if (!s.started_at) return false;
      const dur = (s.ended_at ? new Date(s.ended_at) : new Date()) - new Date(s.started_at);
      return dur > 300000; // >5 min
    });
    if (longSessions.length > 0) {
      tips.push({
        icon: Cpu,
        title: "Reduce session timeouts",
        detail: `${longSessions.length} session(s) ran longer than 5 minutes. Lowering timeout_ms can cut compute costs.`,
        impact: "Medium",
      });
    }

    // LLM usage
    const llmJobs = jobs.filter((j) => j.results_summary?.types?.includes("ai_extract"));
    if (llmJobs.length > 0) {
      tips.push({
        icon: Brain,
        title: "Batch AI extraction calls",
        detail: `${llmJobs.length} job(s) use AI extraction. Batching multiple extracts into fewer LLM calls reduces per-call costs.`,
        impact: "Medium",
      });
    }

    // High-frequency schedules
    const frequentSchedules = schedules.filter((s) => s.enabled && s.interval_seconds > 0 && s.interval_seconds < 3600);
    if (frequentSchedules.length > 0) {
      tips.push({
        icon: TrendingUp,
        title: "Reduce schedule frequency",
        detail: `${frequentSchedules.length} schedule(s) run more than once per hour. Consider spacing them out to lower compute spend.`,
        impact: "Medium",
      });
    }

    // Budget alert
    if (settings?.monthly_budget > 0) {
      const pct = (monthTotal / settings.monthly_budget) * 100;
      if (pct >= (settings.alert_threshold_pct || 80)) {
        tips.push({
          icon: AlertTriangle,
          title: "Budget alert",
          detail: `You've used ${pct.toFixed(0)}% of your ${formatCost(settings.monthly_budget)} monthly budget (${formatCost(monthTotal)} spent).`,
          impact: pct >= 100 ? "Critical" : "High",
        });
      }
    }

    return tips;
  }, [jobs, sessions, schedules, settings, monthTotal]);

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      if (settings?.id) {
        await base44.entities.CostSettings.update(settings.id, rateForm);
      } else {
        const created = await base44.entities.CostSettings.create(rateForm);
        setSettings(created);
      }
    } catch (e) { alert(e.response?.data?.error || e.message); }
    finally { setSavingSettings(false); }
  };

  if (loading) return <div className="flex justify-center h-64 items-center"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-heading font-bold">Cost Monitor</h1>
        <p className="text-muted-foreground mt-1">Track, estimate, and optimize your automation spend</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="This Month" value={formatCost(monthTotal)} icon={DollarSign} accent="text-green-500" />
        <StatCard label="Compute" value={formatCost(categoryTotals.find((c) => c.name === "compute")?.value || 0)} icon={Cpu} accent="text-blue-500" />
        <StatCard label="LLM Calls" value={formatCost(categoryTotals.find((c) => c.name === "llm")?.value || 0)} icon={Brain} accent="text-purple-500" />
        <StatCard label="Storage" value={formatCost(categoryTotals.find((c) => c.name === "storage")?.value || 0)} icon={HardDrive} accent="text-emerald-500" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Cost Breakdown</CardTitle></CardHeader>
          <CardContent>
            {categoryTotals.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">No cost data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={categoryTotals} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${formatCost(value)}`}>
                    {categoryTotals.map((e) => <Cell key={e.name} fill={CATEGORY_COLORS[e.name] || "#999"} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatCost(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Daily Cost Trend (14 days)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={dailyTrend}>
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCost(v)} />
                <Tooltip formatter={(v) => formatCost(v)} />
                <Line type="monotone" dataKey="cost" stroke="#0a0a0a" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Optimization insights */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Lightbulb className="w-5 h-5 text-yellow-500" />Optimization Suggestions</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {insights.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground text-sm">No optimization issues detected — you're running efficiently!</p>
          ) : (
            insights.map((tip, i) => {
              const Icon = tip.icon;
              return (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
                  <Icon className="w-5 h-5 shrink-0 mt-0.5 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">{tip.title}</p>
                      <span className={`text-xs px-2 py-0.5 rounded ${tip.impact === "Critical" ? "bg-red-100 text-red-700" : tip.impact === "High" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>{tip.impact}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{tip.detail}</p>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Cost settings */}
      <Card>
        <CardHeader><CardTitle>Cost Rates & Budget</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label>Compute Rate ($/min)</Label>
              <Input type="number" step="0.001" value={rateForm.compute_rate_per_min} onChange={(e) => setRateForm({ ...rateForm, compute_rate_per_min: parseFloat(e.target.value) })} />
            </div>
            <div>
              <Label>Proxy Rate ($/GB)</Label>
              <Input type="number" step="0.1" value={rateForm.proxy_rate_per_gb} onChange={(e) => setRateForm({ ...rateForm, proxy_rate_per_gb: parseFloat(e.target.value) })} />
            </div>
            <div>
              <Label>LLM Rate ($/call)</Label>
              <Input type="number" step="0.001" value={rateForm.llm_rate_per_call} onChange={(e) => setRateForm({ ...rateForm, llm_rate_per_call: parseFloat(e.target.value) })} />
            </div>
            <div>
              <Label>Storage Rate ($/GB/month)</Label>
              <Input type="number" step="0.01" value={rateForm.storage_rate_per_gb_month} onChange={(e) => setRateForm({ ...rateForm, storage_rate_per_gb_month: parseFloat(e.target.value) })} />
            </div>
            <div>
              <Label>Monthly Budget ($)</Label>
              <Input type="number" step="1" value={rateForm.monthly_budget || 0} onChange={(e) => setRateForm({ ...rateForm, monthly_budget: parseFloat(e.target.value) })} placeholder="0 = no budget" />
            </div>
            <div>
              <Label>Alert Threshold (%)</Label>
              <Input type="number" step="1" value={rateForm.alert_threshold_pct} onChange={(e) => setRateForm({ ...rateForm, alert_threshold_pct: parseFloat(e.target.value) })} />
            </div>
          </div>
          <Button onClick={saveSettings} disabled={savingSettings}><Save className="w-4 h-4 mr-2" />{savingSettings ? "Saving..." : "Save Rates"}</Button>
        </CardContent>
      </Card>

      {/* Recent entries */}
      <Card>
        <CardHeader><CardTitle>Recent Cost Entries</CardTitle></CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground text-sm">No cost entries yet. Costs are calculated automatically when jobs complete.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="pb-2 pr-4">Category</th>
                    <th className="pb-2 pr-4">Description</th>
                    <th className="pb-2 pr-4 text-right">Amount</th>
                    <th className="pb-2 pr-4 text-right">Rate</th>
                    <th className="pb-2 text-right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.slice(0, 20).map((e) => {
                    const Icon = CATEGORY_ICONS[e.category];
                    return (
                      <tr key={e.id} className="border-b last:border-0">
                        <td className="py-2 pr-4">
                          <span className="flex items-center gap-1.5">
                            {Icon && <Icon className="w-3.5 h-3.5" style={{ color: CATEGORY_COLORS[e.category] }} />}
                            {e.category}
                          </span>
                        </td>
                        <td className="py-2 pr-4">{e.description}</td>
                        <td className="py-2 pr-4 text-right">{e.amount?.toFixed(2)} {e.unit}</td>
                        <td className="py-2 pr-4 text-right">{formatCost(e.rate)}</td>
                        <td className="py-2 text-right font-medium">{formatCost(e.cost)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}