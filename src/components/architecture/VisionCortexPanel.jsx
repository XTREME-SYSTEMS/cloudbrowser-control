import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Zap, RefreshCw, Code, ShieldCheck, AlertTriangle, Loader2, CheckCircle2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function VisionCortexPanel({ onAction }) {
  const [busy, setBusy] = useState(null);
  const [lastResult, setLastResult] = useState(null);

  const runAction = async (action) => {
    setBusy(action);
    setLastResult(null);
    try {
      let result;
      if (action === "seed") {
        result = await base44.functions.invoke("seedArchitectureGoals", {});
      } else if (action === "audit") {
        result = await base44.functions.invoke("runAutonomousAudit", { scope: "architecture" });
      } else if (action === "optimize") {
        result = await base44.functions.invoke("runEnhancementCycle", { target: "architecture", mandate: 100 });
      } else if (action === "validate") {
        result = await base44.functions.invoke("runComprehensiveScore", { scope: "architecture" });
      } else if (action === "operate") {
        result = await base44.functions.invoke("visionCortexOperate", { operation: "full_cycle", target: "architecture" });
      }
      setLastResult({ action, ok: true, data: result?.data || result });
      if (onAction) onAction();
    } catch (err) {
      setLastResult({ action, ok: false, error: err.message || "Failed" });
    } finally {
      setBusy(null);
    }
  };

  const actions = [
    { id: "seed", label: "Seed Goals", icon: Code, desc: "Initialize the maxed-out architecture checklist (41 goals across 6 phases)", variant: "outline" },
    { id: "audit", label: "Audit Architecture", icon: Eye, desc: "Vision Cortex scans all architecture goals and scores each one", variant: "outline" },
    { id: "optimize", label: "Auto-Optimize to 100", icon: Zap, desc: "Automatically implement + validate every goal until score reaches 100", variant: "default" },
    { id: "validate", label: "Run Validation Tests", icon: ShieldCheck, desc: "Execute comprehensive test suite and score every component", variant: "outline" },
    { id: "operate", label: "Full VC Cycle", icon: RefreshCw, desc: "Vision Cortex full cycle: audit → heal → optimize → enhance → operate", variant: "default" },
  ];

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-gold-gradient flex items-center justify-center">
            <Eye className="w-5 h-5 text-black" />
          </div>
          <div>
            <CardTitle>Vision Cortex Architecture Control</CardTitle>
            <CardDescription>Monitor · Audit · Edit · Auto-Optimize until 100</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {actions.map((a) => (
            <div key={a.id} className="p-3 rounded-lg border space-y-2">
              <div className="flex items-center gap-2">
                <a.icon className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">{a.label}</span>
              </div>
              <p className="text-xs text-muted-foreground">{a.desc}</p>
              <Button size="sm" variant={a.variant} className="w-full" onClick={() => runAction(a.id)} disabled={busy !== null}>
                {busy === a.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <a.icon className="w-3 h-3 mr-1" />}
                {busy === a.id ? "Running..." : "Execute"}
              </Button>
            </div>
          ))}
        </div>

        {lastResult && (
          <div className={"p-3 rounded-lg border text-sm " + (lastResult.ok ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5")}>
            <div className="flex items-center gap-2 mb-1">
              {lastResult.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 text-red-500" />}
              <span className="font-medium">{lastResult.action} — {lastResult.ok ? "Success" : "Failed"}</span>
            </div>
            {lastResult.ok ? (
              <pre className="text-xs text-muted-foreground overflow-x-auto">{JSON.stringify(lastResult.data, null, 2).slice(0, 500)}</pre>
            ) : (
              <p className="text-xs text-red-500">{lastResult.error}</p>
            )}
          </div>
        )}

        <div className="p-3 rounded-lg bg-muted/50 border border-dashed">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Mandate:</strong> Auto-optimize until every goal achieves 100/100.
            Vision Cortex will audit the architecture page, implement missing capabilities, run validation tests,
            and auto-retry until all tests pass at 100. This is the to-do reference point for all agents.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}