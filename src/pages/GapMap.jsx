import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Loader2, Shield, Brain, Zap, CheckCircle2, XCircle, AlertCircle,
  Database, Lock, Server, Wifi, ShieldAlert, CreditCard, Search, Radio,
  RefreshCw, Globe, Layers, Sparkles,
} from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend,
} from "recharts";

const GAP_TYPE_ICONS = {
  database: Database,
  oauth: Lock,
  server_logic: Server,
  websocket: Wifi,
  firewall: ShieldAlert,
  payment: CreditCard,
  search: Search,
  realtime: Radio,
  unknown: AlertCircle,
};

const AUTONOMY_CONFIG = {
  fully_autonomous: { label: "Fully Autonomous", color: "#10b981", bg: "bg-emerald-500/10", icon: CheckCircle2 },
  semi_autonomous: { label: "Semi-Autonomous", color: "#3b82f6", bg: "bg-blue-500/10", icon: Zap },
  inference_engine: { label: "Inference Engine", color: "#f59e0b", bg: "bg-amber-500/10", icon: Brain },
  unresolved: { label: "Unresolved", color: "#ef4444", bg: "bg-red-500/10", icon: XCircle },
};

const STRATEGY_TO_AUTONOMY = {
  template: "fully_autonomous",
  seed_data: "fully_autonomous",
  scrape_similar: "semi_autonomous",
  infer_llm: "inference_engine",
};

const PIE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444"];

export default function GapMap() {
  const [gaps, setGaps] = useState([]);
  const [resolutions, setResolutions] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [g, r, p] = await Promise.all([
        base44.entities.CloneGap.list("-created_date", 200),
        base44.entities.GapResolution.list("-created_date", 200),
        base44.entities.CloneProject.list("-created_date", 50),
      ]);
      setGaps(g);
      setResolutions(r);
      setProjects(p);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute autonomy level for each gap
  const enrichedGaps = useMemo(() => {
    return gaps.map((g) => {
      const resolution = resolutions.find((r) => r.clone_gap_id === g.id);
      const strategy = resolution?.strategy_used || g.resolution_strategy || "";
      const autonomy = STRATEGY_TO_AUTONOMY[strategy] || "unresolved";
      return { ...g, resolution_strategy: strategy, autonomy_level: autonomy, resolution };
    });
  }, [gaps, resolutions]);

  // Filter by selected project
  const filteredGaps = selectedProject
    ? enrichedGaps.filter((g) => g.clone_project_id === selectedProject)
    : enrichedGaps;

  // Aggregate stats
  const stats = useMemo(() => {
    const byType = {};
    const byAutonomy = { fully_autonomous: 0, semi_autonomous: 0, inference_engine: 0, unresolved: 0 };
    const byStrategy = {};
    const byStatus = {};

    for (const g of filteredGaps) {
      byType[g.gap_type] = (byType[g.gap_type] || 0) + 1;
      byAutonomy[g.autonomy_level]++;
      if (g.resolution_strategy) byStrategy[g.resolution_strategy] = (byStrategy[g.resolution_strategy] || 0) + 1;
      byStatus[g.status] = (byStatus[g.status] || 0) + 1;
    }

    const avgConfidence = filteredGaps.length > 0
      ? Math.round(filteredGaps.reduce((s, g) => s + (g.confidence_score || 0), 0) / filteredGaps.length)
      : 0;

    const definitiveCount = filteredGaps.filter((g) => g.definitive).length;

    return { byType, byAutonomy, byStrategy, byStatus, avgConfidence, definitiveCount };
  }, [filteredGaps]);

  const pieData = Object.entries(AUTONOMY_CONFIG).map(([key, config]) => ({
    name: config.label,
    value: stats.byAutonomy[key] || 0,
    color: config.color,
  }));

  const barData = Object.entries(stats.byType).map(([type, count]) => ({
    type,
    count,
  }));

  const totalGaps = filteredGaps.length;
  const autonomyPct = totalGaps > 0
    ? Math.round(((stats.byAutonomy.fully_autonomous + stats.byAutonomy.semi_autonomous) / totalGaps) * 100)
    : 0;

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Gap Map Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Visualization of all identified gaps — which parts are fully autonomous vs. which rely on the inference engine
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border hover:bg-accent"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* Project Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setSelectedProject(null)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
            !selectedProject ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"
          }`}
        >
          All Projects ({projects.length})
        </button>
        {projects.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelectedProject(p.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors truncate max-w-[200px] ${
              selectedProject === p.id ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"
            }`}
          >
            {p.target_name || p.target_url}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : totalGaps === 0 ? (
        <Card>
          <CardContent className="pt-12 pb-12 flex flex-col items-center gap-3 text-center">
            <Shield className="w-12 h-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No gaps identified yet. Run a clone or gap playground analysis to populate the gap map.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">Total Gaps</p>
                <p className="text-2xl font-bold mt-1">{totalGaps}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">Definitively Classified</p>
                <p className="text-2xl font-bold mt-1 text-emerald-500">{stats.definitiveCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">Avg Confidence</p>
                <p className="text-2xl font-bold mt-1">{stats.avgConfidence}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">Autonomous Rate</p>
                <p className="text-2xl font-bold mt-1 text-emerald-500">{autonomyPct}%</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Autonomy Pie */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Autonomy Distribution</CardTitle>
                <CardDescription className="text-xs">Fully autonomous vs. inference-dependent</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(value) => <span className="text-xs">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Gap Types Bar */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Gaps by Type</CardTitle>
                <CardDescription className="text-xs">What kinds of unclonable areas were found</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={barData} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="type" tick={{ fontSize: 11 }} width={90} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#C89B00" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Autonomy Breakdown Bars */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Layers className="w-4 h-4" />
                Autonomy Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(AUTONOMY_CONFIG).map(([key, config]) => {
                  const count = stats.byAutonomy[key] || 0;
                  const pct = totalGaps > 0 ? Math.round((count / totalGaps) * 100) : 0;
                  const Icon = config.icon;
                  return (
                    <div key={key} className={`rounded-lg border p-3 ${config.bg}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" style={{ color: config.color }} />
                          <span className="text-sm font-medium">{config.label}</span>
                        </div>
                        <span className="text-sm font-bold" style={{ color: config.color }}>{count}</span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                      <p className="text-xs text-muted-foreground mt-1">{pct}% of total gaps</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Gap Detail List */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Gap Details ({filteredGaps.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {filteredGaps.map((gap) => {
                  const GapIcon = GAP_TYPE_ICONS[gap.gap_type] || AlertCircle;
                  const autoConfig = AUTONOMY_CONFIG[gap.autonomy_level] || AUTONOMY_CONFIG.unresolved;
                  const project = projects.find((p) => p.id === gap.clone_project_id);
                  return (
                    <div key={gap.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${autoConfig.bg}`}>
                          <GapIcon className="w-4 h-4" style={{ color: autoConfig.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">{gap.gap_type}</Badge>
                            {gap.inferred_method && (
                              <span className="font-mono text-xs text-muted-foreground">{gap.inferred_method} {gap.inferred_endpoint}</span>
                            )}
                            {gap.definitive && (
                              <Badge variant="outline" className="text-xs text-emerald-500">
                                <CheckCircle2 className="w-3 h-3 mr-0.5" /> Definitive
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{gap.description}</p>
                          {project && (
                            <p className="text-[10px] text-muted-foreground/70 mt-1 flex items-center gap-1">
                              <Globe className="w-2.5 h-2.5" />
                              {project.target_name || project.target_url}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge variant="outline" className="text-xs" style={{ color: autoConfig.color, borderColor: autoConfig.color }}>
                            {autoConfig.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{gap.confidence_score}% conf.</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}