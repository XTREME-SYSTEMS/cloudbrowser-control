import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  HeartPulse, Activity, CheckCircle2, XCircle, Clock,
  Server, Zap, AlertCircle, Loader2, ArrowRightLeft, RotateCcw, Rocket, Ban,
} from "lucide-react";

const ISSUE_LABELS = {
  failed_deployment: "Failed Deploy",
  stuck_deployment: "Stuck Build",
  not_deployed: "Not Deployed",
  engine_down: "Engine Down",
  engine_degraded: "Engine Degraded",
  engine_html_response: "Bad Engine Response",
  primary_recovered: "Primary Recovered",
  cooldown: "Cooldown",
};

const ACTION_LABELS = {
  redeploy: "Redeploy",
  cancel_and_redeploy: "Cancel + Redeploy",
  deploy_latest: "Deploy Latest",
  promote_backup_engine: "Promote Backup",
  revert_to_primary: "Revert to Primary",
  restart: "Restart",
  none: "None",
};

const RESULT_STYLES = {
  success: { color: "text-emerald-500", bg: "bg-emerald-500/10", icon: CheckCircle2 },
  failed: { color: "text-red-500", bg: "bg-red-500/10", icon: XCircle },
  skipped: { color: "text-gray-400", bg: "bg-gray-400/10", icon: Clock },
};

export default function AutoHeal() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState(null);
  const [runResult, setRunResult] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const logsData = await base44.entities.AutoHealLog.list("-healed_at", 50);
      setLogs(logsData);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Load current enabled state
  useEffect(() => {
    (async () => {
      try {
        const settings = await base44.entities.Setting.filter({ setting_key: "autoheal.enabled" });
        if (settings.length > 0) {
          setEnabled(settings[0].effective_value !== "false");
        }
      } catch { /* default enabled */ }
    })();
  }, []);

  const handleToggle = async (checked) => {
    setEnabled(checked);
    try {
      const existing = await base44.entities.Setting.filter({ setting_key: "autoheal.enabled" });
      if (existing.length > 0) {
        await base44.entities.Setting.update(existing[0].id, {
          desired_value: String(checked),
          effective_value: String(checked),
          apply_status: "applied",
          changed_at: new Date().toISOString(),
        });
      } else {
        await base44.entities.Setting.create({
          setting_key: "autoheal.enabled",
          category: "system",
          scope_type: "platform",
          desired_value: String(checked),
          effective_value: String(checked),
          apply_status: "applied",
        });
      }
    } catch (e) {
      setError(e.message);
    }
  };

  const handleRunNow = async () => {
    setRunning(true);
    setError(null);
    setRunResult(null);
    try {
      const response = await base44.functions.invoke("railwayAutoHeal", {});
      const result = response.data ?? response;
      setRunResult(result);
      await fetchData();
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  const healedCount = logs.filter((l) => l.action_result === "success").length;
  const failedCount = logs.filter((l) => l.action_result === "failed").length;
  const successRate = logs.length > 0 ? Math.round((healedCount / logs.length) * 100) : 100;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <HeartPulse className="w-5 h-5 text-emerald-500" />
            Auto-Heal System
          </h1>
          <p className="text-sm text-muted-foreground">
            Autonomous Railway and engine failure remediation — runs every 5 min
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border">
            <Switch checked={enabled} onCheckedChange={handleToggle} />
            <span className="text-sm">{enabled ? "Enabled" : "Disabled"}</span>
          </div>
          <Button size="sm" onClick={handleRunNow} disabled={running}>
            {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
            Run Now
          </Button>
        </div>
      </div>

      {/* Last run result */}
      {runResult && (
        <Card className={`border ${runResult.ok ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"}`}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-2">
              {runResult.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
              <span className="text-sm font-medium">
                {runResult.enabled === false
                  ? "Auto-heal is disabled"
                  : `Heal cycle complete — ${runResult.summary?.healed || 0} healed, ${runResult.summary?.failed || 0} failed`}
              </span>
            </div>
            {runResult.actions?.length > 0 && (
              <div className="space-y-1 mt-2">
                {runResult.actions.map((a, i) => {
                  const style = RESULT_STYLES[a.result] || RESULT_STYLES.skipped;
                  const Icon = style.icon;
                  return (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <Icon className={`w-3 h-3 ${style.color}`} />
                      <span className="font-medium">{a.target_name || a.target_id}</span>
                      <span className="text-muted-foreground">
                        — {ISSUE_LABELS[a.issue] || a.issue} → {ACTION_LABELS[a.action] || a.action}
                      </span>
                      {a.promoted_to && <Badge variant="outline" className="text-xs">→ {a.promoted_to}</Badge>}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Actions</p>
                <p className="text-2xl font-bold">{logs.length}</p>
              </div>
              <Activity className="w-8 h-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/30">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Healed</p>
                <p className="text-2xl font-bold text-emerald-500">{healedCount}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-emerald-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card className={failedCount > 0 ? "border-red-500/30 bg-red-500/5" : ""}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-red-500">{failedCount}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">{successRate}%</p>
              </div>
              <HeartPulse className="w-8 h-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error banner */}
      {error && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="pt-4 pb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-sm text-red-500">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Heal log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Recent Heal Actions
          </CardTitle>
          <CardDescription>Last 50 auto-heal events across Railway services and browser engines</CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500/50" />
              <p className="text-sm text-muted-foreground">No issues detected — all systems healthy</p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => {
                const style = RESULT_STYLES[log.action_result] || RESULT_STYLES.skipped;
                const Icon = style.icon;
                const isEngine = log.target_type === "engine";
                return (
                  <div key={log.id} className={`flex items-start gap-3 p-2.5 rounded-md border ${style.bg}`}>
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${style.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{log.target_name || log.target_id}</span>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {isEngine ? <Server className="w-2.5 h-2.5 mr-1" /> : <HeartPulse className="w-2.5 h-2.5 mr-1" />}
                          {isEngine ? "Engine" : "Service"}
                        </Badge>
                        <Badge variant="outline" className={`text-xs ${style.color}`}>
                          {log.action_result}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {ISSUE_LABELS[log.issue_detected] || log.issue_detected}
                        {" → "}
                        {ACTION_LABELS[log.action_taken] || log.action_taken}
                        {log.details?.promoted_label && ` → promoted ${log.details.promoted_label}`}
                      </p>
                      {log.error_message && (
                        <p className="text-xs text-red-500 mt-0.5 truncate">{log.error_message}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {log.healed_at ? new Date(log.healed_at).toLocaleString() : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">What Auto-Heal Does</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="flex items-start gap-2">
              <RotateCcw className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Failed Deployments</p>
                <p className="text-xs text-muted-foreground">Auto-redeploys any Railway service with a FAILED status</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Ban className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Stuck Builds</p>
                <p className="text-xs text-muted-foreground">Cancels and redeploys builds stuck in RUNNING over 10 min</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Rocket className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Not Deployed Services</p>
                <p className="text-xs text-muted-foreground">Deploys latest commit for services that have never deployed</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <ArrowRightLeft className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Engine Failover</p>
                <p className="text-xs text-muted-foreground">Promotes backup engine when primary is down; reverts when it recovers</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}