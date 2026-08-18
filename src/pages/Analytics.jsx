import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Activity, Gauge, AlertTriangle, TrendingUp, DollarSign } from "lucide-react";

const PIE_COLORS = ["#3b82f6", "#22c55e", "#f97316", "#a855f7"];

export default function Analytics() {
  const [jobs, setJobs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [costs, setCosts] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [j, s, c] = await Promise.all([
          base44.entities.Job.list("-created_date", 200),
          base44.entities.Session.list("-created_date", 200),
          base44.entities.CostEntry.list("-created_date", 200),
        ]);
        setJobs(j); setSessions(s); setCosts(c);
        const [m, f] = await Promise.all([
          base44.functions.invoke("getMetrics", {}).catch(() => ({})),
          base44.functions.invoke("forecastCost", {}).catch(() => ({})),
        ]);
        setMetrics(m.data); setForecast(f.data);
      } catch (e) {} finally { setLoading(false); }
    })();
  }, []);

  // Daily job trend (last 14 days)
  const dailyData = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const dayJobs = jobs.filter((j) => new Date(j.created_date).toDateString() === d.toDateString());
    dailyData.push({ date: d.toLocaleDateString("en", { month: "short", day: "numeric" }), jobs: dayJobs.length, completed: dayJobs.filter((j) => j.status === "completed").length });
  }

  // Status breakdown
  const statusData = ["queued", "running", "completed", "failed", "cancelled"].map((st) => ({ name: st, value: jobs.filter((j) => j.status === st).length })).filter((d) => d.value > 0);

  // Cost by category
  const costByCat = {};
  costs.forEach((c) => { costByCat[c.category] = (costByCat[c.category] || 0) + (c.cost || 0); });
  const costData = Object.entries(costByCat).map(([name, value]) => ({ name, value: +value.toFixed(2) }));

  // Top URLs
  const urlCounts = {};
  jobs.forEach((j) => { if (j.start_url) { try { const u = new URL(j.start_url).hostname; urlCounts[u] = (urlCounts[u] || 0) + 1; } catch {} } });
  const topUrls = Object.entries(urlCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([url, count]) => ({ url, count }));

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-heading font-bold flex items-center gap-2"><Activity className="w-7 h-7" />Analytics</h1>
        <p className="text-muted-foreground mt-1">Usage insights and performance metrics</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-2"><Gauge className="w-4 h-4 text-blue-500" /><span className="text-xs text-muted-foreground">P50 Duration</span></div><p className="text-2xl font-bold mt-1">{metrics?.p50_duration_ms ? `${(metrics.p50_duration_ms / 1000).toFixed(1)}s` : "—"}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-2"><Gauge className="w-4 h-4 text-orange-500" /><span className="text-xs text-muted-foreground">P90 Duration</span></div><p className="text-2xl font-bold mt-1">{metrics?.p90_duration_ms ? `${(metrics.p90_duration_ms / 1000).toFixed(1)}s` : "—"}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-green-500" /><span className="text-xs text-muted-foreground">Success Rate</span></div><p className="text-2xl font-bold mt-1">{metrics?.success_rate ?? 0}%</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-500" /><span className="text-xs text-muted-foreground">Error Rate</span></div><p className="text-2xl font-bold mt-1">{metrics?.error_rate ?? 0}%</p></CardContent></Card>
      </div>

      {/* Cost forecast */}
      {forecast && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><DollarSign className="w-4 h-4" />Cost Forecast</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><p className="text-xs text-muted-foreground">Month to Date</p><p className="text-xl font-bold">${(forecast.month_to_date || 0).toFixed(2)}</p></div>
              <div><p className="text-xs text-muted-foreground">Projected Monthly</p><p className="text-xl font-bold">${(forecast.projected_monthly || 0).toFixed(2)}</p></div>
              <div><p className="text-xs text-muted-foreground">Daily Average</p><p className="text-xl font-bold">${(forecast.daily_average || 0).toFixed(2)}</p></div>
              <div><p className="text-xs text-muted-foreground">Budget Used</p><p className="text-xl font-bold">{forecast.budget_used_pct || 0}%{forecast.will_exceed_budget && <span className="text-red-500 text-sm ml-1">⚠</span>}</p></div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily job trend */}
        <Card>
          <CardHeader><CardTitle className="text-base">Job Activity (14 days)</CardTitle></CardHeader>
          <CardContent><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={dailyData}><CartesianGrid strokeDasharray="3 3" className="stroke-muted" /><XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Legend /><Bar dataKey="jobs" fill="#3b82f6" name="Total" /><Bar dataKey="completed" fill="#22c55e" name="Completed" /></BarChart></ResponsiveContainer></div></CardContent>
        </Card>

        {/* Status breakdown */}
        <Card>
          <CardHeader><CardTitle className="text-base">Job Status Breakdown</CardTitle></CardHeader>
          <CardContent><div className="h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>{statusData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></div></CardContent>
        </Card>

        {/* Cost by category */}
        <Card>
          <CardHeader><CardTitle className="text-base">Cost by Category</CardTitle></CardHeader>
          <CardContent><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={costData}><CartesianGrid strokeDasharray="3 3" className="stroke-muted" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="value" fill="#f97316" name="Cost ($)" /></BarChart></ResponsiveContainer></div></CardContent>
        </Card>

        {/* Top URLs */}
        <Card>
          <CardHeader><CardTitle className="text-base">Top Target URLs</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topUrls.map((u, i) => (
                <div key={u.url} className="flex items-center justify-between text-sm">
                  <span className="truncate"><span className="text-muted-foreground mr-2">#{i + 1}</span>{u.url}</span>
                  <span className="font-bold ml-2">{u.count}</span>
                </div>
              ))}
              {!topUrls.length && <p className="text-sm text-muted-foreground">No data yet</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}