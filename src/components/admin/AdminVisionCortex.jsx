import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Eye, Link2, Unlink, Activity, HeartPulse, ScanLine, Zap, ShieldCheck, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

const PUBLISHED_URL = "https://cloud-browser.base44.app";

export default function AdminVisionCortex() {
  const [connection, setConnection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [auditing, setAuditing] = useState(false);
  const [healing, setHealing] = useState(false);
  const [auditResult, setAuditResult] = useState(null);
  const [healResult, setHealResult] = useState(null);
  const [form, setForm] = useState({
    api_endpoint: `${PUBLISHED_URL}/functions/`,
    admin_api_key: "",
    autonomous_mode: true,
  });

  const load = async () => {
    try {
      const conns = await base44.entities.VisionCortexConnection.list("-created_date", 5).catch(() => []);
      const conn = conns[0];
      if (conn) {
        setConnection(conn);
        setForm({
          api_endpoint: conn.api_endpoint || `${PUBLISHED_URL}/functions/`,
          admin_api_key: conn.admin_api_key || "",
          autonomous_mode: conn.autonomous_mode !== false,
        });
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleConnect = async () => {
    setSaving(true);
    try {
      if (connection) {
        await base44.entities.VisionCortexConnection.update(connection.id, {
          api_endpoint: form.api_endpoint,
          admin_api_key: form.admin_api_key,
          autonomous_mode: form.autonomous_mode,
          status: "connected",
          connected_at: new Date().toISOString(),
        });
      } else {
        const created = await base44.entities.VisionCortexConnection.create({
          api_endpoint: form.api_endpoint,
          admin_api_key: form.admin_api_key,
          autonomous_mode: form.autonomous_mode,
          status: "connected",
          connected_at: new Date().toISOString(),
        });
        setConnection(created);
      }
      load();
    } catch (e) {
      alert(e.message || "Failed to connect");
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!connection) return;
    try {
      await base44.entities.VisionCortexConnection.update(connection.id, { status: "disconnected" });
      load();
    } catch (e) { alert("Failed to disconnect"); }
  };

  const runAudit = async () => {
    setAuditing(true);
    setAuditResult(null);
    try {
      const res = await base44.functions.invoke("runAutonomousAudit", {});
      setAuditResult(res.data);
    } catch (e) {
      setAuditResult({ error: e.message || "Audit failed" });
    } finally {
      setAuditing(false);
    }
  };

  const runHeal = async () => {
    setHealing(true);
    setHealResult(null);
    try {
      const res = await base44.functions.invoke("preflightHeal", { action: "all" });
      setHealResult(res.data);
    } catch (e) {
      setHealResult({ error: e.message || "Heal failed" });
    } finally {
      setHealing(false);
    }
  };

  if (loading) return <div className="text-muted-foreground text-sm">Loading Vision Cortex connection…</div>;

  const isConnected = connection?.status === "connected";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <Eye className="w-6 h-6 text-amber-600" /> Vision Cortex Connection
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Vision Cortex monitors the system, uses the platform, and auto-fixes/auto-heals issues autonomously.
        </p>
      </div>

      {/* Connection Status */}
      <Card className={isConnected ? "border-emerald-200" : "border-amber-200"}>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {isConnected ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              )}
              <span className="font-semibold text-sm">
                Connection Status: {isConnected ? "Connected" : "Pending"}
              </span>
            </div>
            <Badge className={isConnected ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>
              {connection?.status || "pending"}
            </Badge>
          </div>

          {!isConnected && (
            <p className="text-sm text-muted-foreground mb-4">
              Connect Vision Cortex by providing it with the API endpoint and an admin API key.
              Vision Cortex can then monitor system health, trigger autonomous audits, and auto-heal issues.
            </p>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>API Endpoint</Label>
              <Input
                value={form.api_endpoint}
                onChange={e => setForm({ ...form, api_endpoint: e.target.value })}
                placeholder="https://cloud-browser.base44.app/functions/"
              />
              <p className="text-xs text-muted-foreground">
                Base URL for all backend function calls.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Admin API Key</Label>
              <Input
                type="password"
                value={form.admin_api_key}
                onChange={e => setForm({ ...form, admin_api_key: e.target.value })}
                placeholder="Generate an admin API key from the API Keys page with full scopes."
              />
              <p className="text-xs text-muted-foreground">
                Generate an admin API key from the API Keys tab with <code className="text-xs">admin:all</code> scope.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="autonomous"
                checked={form.autonomous_mode}
                onChange={e => setForm({ ...form, autonomous_mode: e.target.checked })}
                className="w-4 h-4 rounded"
              />
              <Label htmlFor="autonomous" className="text-sm font-normal cursor-pointer">
                Autonomous Mode — VC can operate, scale, and heal without manual intervention
              </Label>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleConnect} disabled={saving || !form.api_endpoint.trim()}>
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Link2 className="w-4 h-4 mr-1" />}
                {isConnected ? "Update Connection" : "Connect Vision Cortex"}
              </Button>
              {isConnected && (
                <Button variant="outline" onClick={handleDisconnect}>
                  <Unlink className="w-4 h-4 mr-1" /> Disconnect
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Autonomous Audit */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ScanLine className="w-5 h-5 text-amber-600" />
              <div>
                <h3 className="font-semibold text-sm">Autonomous Audit</h3>
                <p className="text-xs text-muted-foreground">POST /functions/runAutonomousAudit</p>
              </div>
            </div>
            <Button onClick={runAudit} disabled={auditing || !isConnected} size="sm">
              {auditing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ScanLine className="w-4 h-4 mr-1" />}
              Run Audit
            </Button>
          </div>
          {auditResult && (
            <div className="mt-4 space-y-3">
              {auditResult.error ? (
                <div className="text-sm text-red-500">{auditResult.error}</div>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="text-center p-2 rounded-lg bg-muted/50">
                      <div className="text-lg font-bold">{auditResult.issue_count}</div>
                      <div className="text-xs text-muted-foreground">Issues Found</div>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-muted/50">
                      <div className="text-lg font-bold">{auditResult.summary?.paying_subscriptions || 0}</div>
                      <div className="text-xs text-muted-foreground">Paying Subs</div>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-muted/50">
                      <div className="text-lg font-bold">{auditResult.summary?.active_sessions || 0}</div>
                      <div className="text-xs text-muted-foreground">Active Sessions</div>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-muted/50">
                      <div className="text-lg font-bold capitalize">{auditResult.summary?.engine_health || "unknown"}</div>
                      <div className="text-xs text-muted-foreground">Engine Health</div>
                    </div>
                  </div>
                  {auditResult.issues?.length > 0 && (
                    <div className="space-y-2">
                      {auditResult.issues.map((issue, i) => (
                        <div key={i} className="flex items-start gap-2 p-2 rounded-lg border border-border/50">
                          <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                            issue.severity === "critical" ? "bg-red-100 text-red-700" :
                            issue.severity === "warning" ? "bg-orange-100 text-orange-700" :
                            "bg-blue-100 text-blue-700"
                          }`}>
                            {issue.severity}
                          </span>
                          <div>
                            <div className="text-sm">{issue.message}</div>
                            <div className="text-xs text-muted-foreground">→ {issue.action}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Auto-Heal */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <HeartPulse className="w-5 h-5 text-amber-600" />
              <div>
                <h3 className="font-semibold text-sm">Auto-Heal</h3>
                <p className="text-xs text-muted-foreground">POST /functions/preflightHeal</p>
              </div>
            </div>
            <Button onClick={runHeal} disabled={healing || !isConnected} size="sm">
              {healing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Zap className="w-4 h-4 mr-1" />}
              Run Heal
            </Button>
          </div>
          {healResult && (
            <div className="mt-4">
              {healResult.error ? (
                <div className="text-sm text-red-500">{healResult.error}</div>
              ) : (
                <div className="space-y-2">
                  <div className="text-sm font-medium">{healResult.message}</div>
                  {healResult.actions?.map((a, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <span className="text-sm font-mono">{a.action}</span>
                      <span className="text-sm font-bold text-amber-600">{a.count} healed</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connection stats */}
      {connection && (
        <Card className="border-border/50">
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-5 h-5 text-amber-600" />
              <h3 className="font-semibold text-sm">Activity Log</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <div className="text-lg font-bold">{connection.audit_count || 0}</div>
                <div className="text-xs text-muted-foreground">Audits Run</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <div className="text-lg font-bold">{connection.heal_count || 0}</div>
                <div className="text-xs text-muted-foreground">Heals Run</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <div className="text-lg font-bold">{connection.issues_detected || 0}</div>
                <div className="text-xs text-muted-foreground">Issues Detected</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <div className="text-lg font-bold">{connection.issues_healed || 0}</div>
                <div className="text-xs text-muted-foreground">Issues Healed</div>
              </div>
            </div>
            {connection.last_audit_at && (
              <div className="text-xs text-muted-foreground mt-3">
                Last audit: {new Date(connection.last_audit_at).toLocaleString()}
                {connection.last_audit_result && ` — ${connection.last_audit_result}`}
              </div>
            )}
            {connection.last_heal_at && (
              <div className="text-xs text-muted-foreground mt-1">
                Last heal: {new Date(connection.last_heal_at).toLocaleString()}
                {connection.last_heal_result && ` — ${connection.last_heal_result}`}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}