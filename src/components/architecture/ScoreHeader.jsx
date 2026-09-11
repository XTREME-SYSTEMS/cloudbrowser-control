import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Target, CheckCircle2, AlertTriangle, Loader2, XCircle } from "lucide-react";

const PHASES = [
  { key: "hardening", label: "Hardening", color: "text-red-500", bg: "bg-red-500" },
  { key: "competitive", label: "Competitive", color: "text-amber-500", bg: "bg-amber-500" },
  { key: "reliability", label: "Reliability", color: "text-blue-500", bg: "bg-blue-500" },
  { key: "observability", label: "Observability", color: "text-purple-500", bg: "bg-purple-500" },
  { key: "dx", label: "Developer Experience", color: "text-emerald-500", bg: "bg-emerald-500" },
  { key: "proxy_captcha", label: "Proxy & Captcha", color: "text-cyan-500", bg: "bg-cyan-500" },
];

export default function ScoreHeader({ goals, testResults }) {
  const total = goals.length;
  const scores = goals.map((g) => g.audit_result?.score || 0);
  const overallScore = total > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / total) : 0;
  const optimized = goals.filter((g) => g.status === "optimized").length;
  const implemented = goals.filter((g) => g.status === "implemented" || g.status === "audited").length;
  const inProgress = goals.filter((g) => g.status === "in_progress" || g.status === "auditing").length;
  const pending = goals.filter((g) => g.status === "pending").length;
  const failed = goals.filter((g) => g.status === "failed").length;

  const passingTests = testResults.filter((t) => t.status === "pass").length;
  const totalTests = testResults.length;
  const testScore = totalTests > 0 ? Math.round((passingTests / totalTests) * 100) : 0;

  const scoreColor = overallScore >= 100 ? "text-emerald-500" : overallScore >= 75 ? "text-amber-500" : overallScore >= 50 ? "text-blue-500" : "text-red-500";

  return (
    <div className="space-y-4">
      {/* Hero score */}
      <Card className="border-primary/30 overflow-hidden">
        <CardContent className="pt-6 pb-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gold-gradient flex items-center justify-center shrink-0">
                <Building2 className="w-8 h-8 text-black" />
              </div>
              <div>
                <h2 className="text-lg font-heading font-bold">FAANG Enterprise Deep Architecture</h2>
                <p className="text-sm text-muted-foreground">Foundational Formation · Modular Capabilities · Maxed-Out Goal</p>
              </div>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Architecture Score</p>
              <p className={"text-5xl font-bold " + scoreColor}>{overallScore}<span className="text-2xl text-muted-foreground">/100</span></p>
              <p className="text-xs text-muted-foreground mt-1">{optimized}/{total} optimized · {total} total goals</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Test Pass Rate</p>
              <p className={"text-5xl font-bold " + (testScore === 100 ? "text-emerald-500" : "text-amber-500")}>{testScore}<span className="text-2xl text-muted-foreground">%</span></p>
              <p className="text-xs text-muted-foreground mt-1">{passingTests}/{totalTests} tests passing</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status summary */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        <Card><CardContent className="pt-4 pb-4 text-center">
          <Target className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
          <p className="text-2xl font-bold">{total}</p>
          <p className="text-xs text-muted-foreground">Total Goals</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 text-center">
          <CheckCircle2 className="w-5 h-5 mx-auto text-emerald-500 mb-1" />
          <p className="text-2xl font-bold text-emerald-500">{optimized}</p>
          <p className="text-xs text-muted-foreground">Optimized</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 text-center">
          <CheckCircle2 className="w-5 h-5 mx-auto text-blue-500 mb-1" />
          <p className="text-2xl font-bold text-blue-500">{implemented}</p>
          <p className="text-xs text-muted-foreground">Implemented</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 text-center">
          <Loader2 className="w-5 h-5 mx-auto text-amber-500 mb-1" />
          <p className="text-2xl font-bold text-amber-500">{inProgress}</p>
          <p className="text-xs text-muted-foreground">In Progress</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 text-center">
          <AlertTriangle className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
          <p className="text-2xl font-bold">{pending}</p>
          <p className="text-xs text-muted-foreground">Pending</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 text-center">
          <XCircle className="w-5 h-5 mx-auto text-red-500 mb-1" />
          <p className="text-2xl font-bold text-red-500">{failed}</p>
          <p className="text-xs text-muted-foreground">Failed</p>
        </CardContent></Card>
      </div>

      {/* Phase breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {PHASES.map((phase) => {
          const phaseGoals = goals.filter((g) => g.category === phase.key);
          const phaseScores = phaseGoals.map((g) => g.audit_result?.score || 0);
          const phaseScore = phaseGoals.length > 0 ? Math.round(phaseScores.reduce((a, b) => a + b, 0) / phaseGoals.length) : 0;
          const phaseOptimized = phaseGoals.filter((g) => g.status === "optimized").length;
          return (
            <Card key={phase.key}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium">{phase.label}</span>
                  <Badge variant="outline" className="text-xs">{phaseOptimized}/{phaseGoals.length}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className={"h-full rounded-full " + phase.bg} style={{ width: phaseScore + "%" }} />
                  </div>
                  <span className="text-xs font-bold w-8 text-right">{phaseScore}%</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}