import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { Brain, CheckCircle2, AlertCircle, Loader2, Zap } from "lucide-react";

const GAP_TYPE_LABELS = {
  database: "Database",
  oauth: "Authentication",
  server_logic: "Server Logic",
  websocket: "WebSocket",
  firewall: "Firewall/Security",
  payment: "Payment",
  search: "Search",
  realtime: "Realtime",
  unknown: "Unknown",
};

const AUTONOMOUS_COLOR = "#10b981"; // emerald
const INFERENCE_COLOR = "#f59e0b"; // amber
const UNRESOLVED_COLOR = "#ef4444"; // red

export default function AutonomyChart({ projectId }) {
  const [gaps, setGaps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = projectId
          ? await base44.entities.CloneGap.filter({ clone_project_id: projectId })
          : await base44.entities.CloneGap.list("-created_date", 200);
        setGaps(data);
      } catch {
        setGaps([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (gaps.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center py-8 text-muted-foreground text-sm">
          No gap data yet — run a clone to see autonomy breakdown.
        </CardContent>
      </Card>
    );
  }

  // Classify: autonomous = resolved, needs inference = everything else
  const autonomous = gaps.filter((g) => g.status === "resolved");
  const needsInference = gaps.filter((g) => g.status !== "resolved");
  const unresolved = gaps.filter((g) => g.status === "unresolved" || g.status === "identified");
  const inferred = gaps.filter((g) => g.status === "inferred" || g.status === "classifying");

  const autonomyPct = gaps.length > 0 ? Math.round((autonomous.length / gaps.length) * 100) : 0;

  // Pie data
  const pieData = [
    { name: "Autonomous", value: autonomous.length, color: AUTONOMOUS_COLOR },
    { name: "Inferred (partial)", value: inferred.length, color: INFERENCE_COLOR },
    { name: "Needs Inference Engine", value: unresolved.length, color: UNRESOLVED_COLOR },
  ].filter((d) => d.value > 0);

  // Bar data by gap type
  const byType = {};
  gaps.forEach((g) => {
    const label = GAP_TYPE_LABELS[g.gap_type] || g.gap_type;
    if (!byType[label]) byType[label] = { type: label, autonomous: 0, inference: 0 };
    if (g.status === "resolved") byType[label].autonomous++;
    else byType[label].inference++;
  });
  const barData = Object.values(byType).sort((a, b) => b.autonomous + b.inference - a.autonomous - a.inference);

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Site Autonomy Breakdown
          </CardTitle>
          <CardDescription>
            Which parts of the target site are fully autonomous vs. which still need the inference engine to resolve
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            {/* Donut Chart */}
            <div className="relative h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold text-emerald-500">{autonomyPct}%</span>
                <span className="text-xs text-muted-foreground">Autonomous</span>
              </div>
            </div>

            {/* Legend & Stats */}
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 rounded-md bg-emerald-500/10">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm font-medium">Fully Autonomous</span>
                </div>
                <span className="text-sm font-bold text-emerald-500">{autonomous.length}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-md bg-amber-500/10">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-medium">Inferred (partial)</span>
                </div>
                <span className="text-sm font-bold text-amber-500">{inferred.length}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-md bg-red-500/10">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-medium">Needs Inference Engine</span>
                </div>
                <span className="text-sm font-bold text-red-500">{unresolved.length}</span>
              </div>
              <div className="pt-2">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Overall Autonomy</span>
                  <span className="font-medium">{autonomyPct}%</span>
                </div>
                <Progress value={autonomyPct} className="h-2" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* By Gap Type Bar Chart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Autonomy by Gap Type</CardTitle>
          <CardDescription>Green = resolved autonomously, Amber = still needs inference engine</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical" margin={{ left: 20, right: 20 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="type" tick={{ fontSize: 11 }} width={90} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                  cursor={{ fill: "hsl(var(--muted))" }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="autonomous" name="Autonomous" stackId="a" fill={AUTONOMOUS_COLOR} />
                <Bar dataKey="inference" name="Needs Inference" stackId="a" fill={INFERENCE_COLOR} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}