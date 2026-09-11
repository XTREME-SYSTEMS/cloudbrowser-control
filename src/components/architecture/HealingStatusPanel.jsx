import React, { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Stethoscope, Flag, Search, Wrench, CheckCircle2, AlertTriangle, Loader2, XCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";

const STATUS_CONFIG = {
  flagged: { icon: Flag, color: "text-red-500", bg: "bg-red-500/10", label: "Flagged" },
  auditing: { icon: Search, color: "text-purple-500", bg: "bg-purple-500/10", label: "Auditing" },
  audited: { icon: Search, color: "text-blue-500", bg: "bg-blue-500/10", label: "Audited" },
  repairing: { icon: Wrench, color: "text-amber-500", bg: "bg-amber-500/10", label: "Repairing" },
  repaired: { icon: Wrench, color: "text-blue-500", bg: "bg-blue-500/10", label: "Repaired" },
  validating: { icon: Loader2, color: "text-cyan-500", bg: "bg-cyan-500/10", label: "Validating" },
  resolved: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10", label: "Resolved" },
  escalated: { icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-500/10", label: "Escalated" },
};

export default function HealingStatusPanel() {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const loadFlags = useCallback(async () => {
    try {
      const data = await base44.entities.HealingFlag.list("-flagged_at", 20);
      setFlags(data);
    } catch (err) {
      console.error("Failed to load healing flags:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFlags(); }, [loadFlags]);

  const runHealing = async () => {
    setRunning(true);
    setLastResult(null);
    try {
      const result = await base44.functions.invoke("runSelfHealingLoop", {});
      setLastResult({ ok: true, data: result?.data || result });
      loadFlags();
    } catch (err) {
      setLastResult({ ok: false, error: err.message });
    } finally {
      setRunning(false);
    }
  };

  const resolved = flags.filter((f) => f.status === "resolved").length;
  const escalated = flags.filter((f) => f.status === "escalated").length;
  const inProgress = flags.filter((f) => !["resolved", "escalated"].includes(f.status)).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-gold-gradient flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-black" />
            </div>
            <div>
              <CardTitle>Self-Healing Pipeline</CardTitle>
              <CardDescription>
                {flags.length} flags · {resolved} resolved · {inProgress} in progress · {escalated} escalated
              </CardDescription>
            </div>
          </div>
          <Button size="sm" onClick={runHealing} disabled={running}>
            {running ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Stethoscope className="w-4 h-4 mr-1" />}
            {running ? "Healing..." : "Run Healing Loop"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {lastResult && (
          <div className={"mb-4 p-3 rounded-lg border text-sm " + (lastResult.ok ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5")}>
            <div className="flex items-center gap-2 mb-1">
              {lastResult.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
              <span className="font-medium">{lastResult.ok ? "Healing cycle complete" : "Healing failed"}</span>
            </div>
            {lastResult.ok ? (
              <pre className="text-xs text-muted-foreground overflow-x-auto">{JSON.stringify(lastResult.data, null, 2).slice(0, 400)}</pre>
            ) : (
              <p className="text-xs text-red-500">{lastResult.error}</p>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : flags.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500" />
            <p className="text-sm text-muted-foreground">No healing flags — system is healthy.</p>
            <p className="text-xs text-muted-foreground">Flags appear when retries fail and the audit → repair → validate pipeline kicks in.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {flags.map((flag) => {
              const cfg = STATUS_CONFIG[flag.status] || STATUS_CONFIG.flagged;
              const StatusIcon = cfg.icon;
              return (
                <div key={flag.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-start gap-3">
                    <div className={"w-8 h-8 rounded-full flex items-center justify-center shrink-0 " + cfg.bg}>
                      <StatusIcon className={"w-4 h-4 " + cfg.color + (flag.status === "validating" ? " animate-spin" : "")} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">{flag.flag_type?.replace(/_/g, " ")}</Badge>
                        <Badge variant="outline" className="text-xs">{cfg.label}</Badge>
                        {flag.assigned_agent && (
                          <span className="text-xs text-muted-foreground">→ {flag.assigned_agent}</span>
                        )}
                      </div>
                      <p className="text-sm font-medium mt-1 truncate">{flag.source_title || flag.source_entity}</p>
                      <p className="text-xs text-muted-foreground truncate">{flag.error_message}</p>
                    </div>
                  </div>

                  {flag.root_cause && (
                    <div className="ml-11 p-2 rounded-md bg-muted/50 text-xs">
                      <span className="font-semibold text-purple-500">Root Cause: </span>
                      <span className="text-muted-foreground">{flag.root_cause}</span>
                      <span className="text-muted-foreground ml-1">({flag.root_cause_confidence}% confidence)</span>
                    </div>
                  )}

                  {flag.repair_action && (
                    <div className="ml-11 p-2 rounded-md bg-muted/50 text-xs">
                      <span className="font-semibold text-amber-500">Repair: </span>
                      <span className="text-muted-foreground">{flag.repair_action}</span>
                      {flag.repair_applied ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 inline ml-1" />
                      ) : (
                        <AlertTriangle className="w-3 h-3 text-orange-500 inline ml-1" />
                      )}
                    </div>
                  )}

                  {flag.validation_status === "passed" && (
                    <div className="ml-11 flex items-center gap-1 text-xs text-emerald-500">
                      <CheckCircle2 className="w-3 h-3" /> Validation passed (score: {flag.validation_score})
                    </div>
                  )}
                  {flag.validation_status === "failed" && (
                    <div className="ml-11 flex items-center gap-1 text-xs text-red-500">
                      <XCircle className="w-3 h-3" /> Validation failed (score: {flag.validation_score})
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}