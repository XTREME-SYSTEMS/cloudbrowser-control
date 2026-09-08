import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Eye, Link2, Unlink, Activity, Loader2, CheckCircle2, AlertTriangle,
  ScanLine, HeartPulse, Zap, Sparkles, Settings, Code, Cpu, Rocket,
  ArrowRightLeft, Play, RefreshCw,
} from "lucide-react";

const PUBLISHED_URL = "https://cloud-browser.base44.app";

const OPERATIONS = [
  { id: "analyze", label: "Analyze", icon: ScanLine, color: "text-blue-600 bg-blue-100", desc: "Scan entire system, detect issues, audit health" },
  { id: "heal", label: "Heal", icon: HeartPulse, color: "text-red-600 bg-red-100", desc: "Auto-fix detected issues — stale sessions, expired promos, failed sandboxes" },
  { id: "optimize", label: "Optimize", icon: Zap, color: "text-amber-600 bg-amber-100", desc: "Analyze usage patterns, auto-pause idle resources, optimize costs" },
  { id: "enhance", label: "Enhance", icon: Sparkles, color: "text-purple-600 bg-purple-100", desc: "Process pending system enhancements and improvements" },
  { id: "manage", label: "Manage", icon: Settings, color: "text-emerald-600 bg-emerald-100", desc: "Process brain commands, reconcile settings drift" },
  { id: "code", label: "Code", icon: Code, color: "text-indigo-600 bg-indigo-100", desc: "AI-driven code analysis and improvement suggestions" },
  { id: "operate", label: "Operate", icon: Cpu, color: "text-orange-600 bg-orange-100", desc: "Full end-to-end system operation — analyze, heal, manage" },
  { id: "full_cycle", label: "Full Cycle", icon: Rocket, color: "text-amber-700 bg-amber-200", desc: "Run ALL operations in sequence — complete autonomous cycle" },
];

export default function AdminVisionCortex() {
  const [connection, setConnection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [operating, setOperating] = useState(null);
  const [operateResult, setOperateResult] = useState(null);
  const [form, setForm] = useState({
    api_endpoint: PUBLISHED_URL + "/functions/",
    admin_api_key: "",
    autonomous_mode: true,
    bidirectional: true,
    operations_enabled: ["analyze", "heal", "optimize", "enhance", "manage", "operate", "code", "full_cycle"],
  });

  const load = async () => {
    try {
      const conns = await base44.entities.VisionCortexConnection.list("-created_date", 5).catch(() => []);
      const conn = conns[0];
      if (conn) {
        setConnection(conn);
        setForm({
          api_endpoint: conn.api_endpoint || PUBLISHED_URL + "/functions/",
          admin_api_key: conn.admin_api_key || "",
          autonomous_mode: conn.autonomous_mode !== false,
          bidirectional: conn.bidirectional !== false,
          operations_enabled: conn.operations_enabled || form.operations_enabled,
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
          bidirectional: form.bidirectional,
          operations_enabled: form.operations_enabled,
          status: "connected",
          connected_at: new Date().toISOString(),
        });
      } else {
        const created = await base44.entities.VisionCortexConnection.create({
          api_endpoint: form.api_endpoint,
          admin_api_key: form.admin_api_key,
          autonomous_mode: form.autonomous_mode,
          bidirectional: form.bidirectional,
          operations_enabled: form.operations_enabled,
          status: "connected",
          connected_at: new Date().toISOString(),
        });
        setConnection(created);
      }
      load();
    } catch (e) { alert(e.message || "Failed to connect"); }
    finally { setSaving(false); }
  };

  const handleDisconnect = async () => {
    if (!connection) return;
    try {
      await base44.entities.VisionCortexConnection.update(connection.id, { status: "disconnected" });
      load();
    } catch (e) { alert("Failed to disconnect"); }
  };

  const toggleOperation = (opId) => {
    setForm(prev => ({
      ...prev,
      operations_enabled: prev.operations_enabled.includes(opId)
        ? prev.operations_enabled.filter(o => o !== opId)
        : [...prev.operations_enabled, opId],
    }));
  };

  const runOperation = async (opId) => {
    setOperating(opId);
    setOperateResult(null);
    try {
      const res = await base44.functions.invoke("visionCortexOperate", { operation: opId });
      setOperateResult({ operation: opId, data: res.data });
      load();
    } catch (e) {
      setOperateResult({ operation: opId, error: e.message || "Operation failed" });
    } finally {
      setOperating(null);
    }
  };

  if (loading) return <div className="text-muted-foreground text-sm">Loading Vision Cortex connection…</div>;

  const isConnected = connection?.status === "connected";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <Eye className="w-6 h-6 text-amber-600" /> Vision Cortex — Bidirectional System Operator
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Vision Cortex operates the entire system end-to-end: analyze, fix, heal, optimize, enhance, code, and manage — autonomously.
        </p>
      </div>

      {/* Connection Status */}
      <Card className={isConnected ? "border-emerald-200" : "border-amber-200"}>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {isConnected ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <AlertTriangle className="w-5 h-5 text-amber-500" />}
              <span className="font-semibold text-sm">Connection: {isConnected ? "Connected" : "Pending"}</span>
              {form.bidirectional && isConnected && (
                <Badge className="bg-emerald-100 text-emerald-700"><ArrowRightLeft className="w-3 h-3 mr-1" /> Bidirectional</Badge>
              )}
            </div>
            <Badge className={isConnected ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>
              {connection?.status || "pending"}
            </Badge>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>API Endpoint</Label>
              <Input value={form.api_endpoint} onChange={e => setForm({ ...form, api_endpoint: e.target.value })} placeholder="https://cloud-browser.base44.app/functions/" />
              <p className="text-xs text-muted-foreground">Base URL for all backend function calls.</p>
            </div>

            <div className="space-y-2">
              <Label>Admin API Key</Label>
              <Input type="password" value={form.admin_api_key} onChange={e => setForm({ ...form, admin_api_key: e.target.value })} placeholder="Generate an admin API key from the API Keys tab" />
              <p className="text-xs text-muted-foreground">Use a Vision Cortex role key with full scopes for bidirectional control.</p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.autonomous_mode} onChange={e => setForm({ ...form, autonomous_mode: e.target.checked })} className="w-4 h-4 rounded" />
                <span className="text-sm">Autonomous Mode</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.bidirectional} onChange={e => setForm({ ...form, bidirectional: e.target.checked })} className="w-4 h-4 rounded" />
                <span className="text-sm">Bidirectional (Read + Write)</span>
              </label>
            </div>

            {/* Enabled Operations */}
            <div className="space-y-2">
              <Label>Enabled Operations</Label>
              <div className="flex flex-wrap gap-2">
                {OPERATIONS.map(op => (
                  <button
                    key={op.id}
                    onClick={() => toggleOperation(op.id)}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                      form.operations_enabled.includes(op.id)
                        ? "bg-amber-500 text-black border-amber-500"
                        : "bg-transparent text-muted-foreground border-border hover:border-amber-300"
                    )}
                  >
                    {op.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleConnect} disabled={saving || !form.api_endpoint.trim()} className="bg-gold-gradient text-black">
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

      {/* Operation Buttons */}
      <div>
        <h2 className="text-lg font-heading font-semibold mb-3">Operations</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {OPERATIONS.map(op => {
            const Icon = op.icon;
            const isRunning = operating === op.id;
            const isEnabled = form.operations_enabled.includes(op.id);
            return (
              <Card key={op.id} className={cn("border-border/50 transition-colors", !isEnabled && "opacity-50")}>
                <CardContent className="pt-4">
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center mb-3", op.color)}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="font-semibold text-sm mb-1">{op.label}</div>
                  <p className="text-xs text-muted-foreground mb-3">{op.desc}</p>
                  <Button
                    size="sm"
                    className="w-full bg-gold-gradient text-black"
                    onClick={() => runOperation(op.id)}
                    disabled={isRunning || !isConnected || !isEnabled}
                  >
                    {isRunning ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Play className="w-4 h-4 mr-1" />}
                    {isRunning ? "Running…" : "Execute"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Operation Result */}
      {operateResult && (
        <Card className="border-amber-200">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-amber-600" />
                <h3 className="font-semibold text-sm capitalize">{operateResult.operation} Result</h3>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setOperateResult(null)}>Dismiss</Button>
            </div>
            {operateResult.error ? (
              <div className="text-sm text-red-500">{operateResult.error}</div>
            ) : (
              <div className="space-y-3">
                {/* Summary */}
                {operateResult.data?.summary && Object.keys(operateResult.data.summary).length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {Object.entries(operateResult.data.summary).slice(0, 8).map(([key, val]) => (
                      <div key={key} className="text-center p-2 rounded-lg bg-muted/50">
                        <div className="text-sm font-bold">{String(val)}</div>
                        <div className="text-xs text-muted-foreground">{key.replace(/_/g, " ")}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                {operateResult.data?.actions?.map((a, i) => (
                  <div key={i} className="p-3 rounded-lg border border-border/50">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-100 text-amber-700">{a.action}</span>
                      {a.count !== undefined && <span className="text-sm font-bold text-amber-600">{a.count}</span>}
                      {a.total_healed !== undefined && <span className="text-sm font-bold text-emerald-600">{a.total_healed} healed</span>}
                    </div>
                    {/* Issues list */}
                    {a.issues?.map((issue, j) => (
                      <div key={j} className="flex items-start gap-2 mt-1">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full shrink-0",
                          issue.severity === "critical" ? "bg-red-100 text-red-700" :
                          issue.severity === "warning" ? "bg-orange-100 text-orange-700" :
                          "bg-blue-100 text-blue-700"
                        )}>{issue.severity}</span>
                        <div>
                          <div className="text-sm">{issue.message}</div>
                          {issue.action && <div className="text-xs text-muted-foreground">→ {issue.action}</div>}
                        </div>
                      </div>
                    ))}
                    {/* Optimizations */}
                    {a.optimizations?.map((opt, j) => (
                      <div key={j} className="text-sm mt-1">
                        <span className="font-medium">{opt.type}:</span> {opt.message}
                        {opt.action && <span className="text-xs text-muted-foreground"> → {opt.action}</span>}
                      </div>
                    ))}
                    {/* Code suggestions */}
                    {a.suggestions?.map((sug, j) => (
                      <div key={j} className="mt-2 p-2 rounded-lg bg-indigo-50 border border-indigo-200">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">{sug.priority}</Badge>
                          <span className="text-sm font-medium">{sug.component}</span>
                        </div>
                        <div className="text-sm">{sug.suggestion}</div>
                        <div className="text-xs text-muted-foreground mt-1">{sug.approach}</div>
                      </div>
                    ))}
                    {/* Other action details */}
                    {a.promos_expired !== undefined && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Promos expired: {a.promos_expired} · Sessions cleaned: {a.sessions_cleaned} · Failed jobs: {a.failed_jobs_detected} · Entities managed: {a.total_entities_managed}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Activity Stats */}
      {connection && (
        <Card className="border-border/50">
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-5 h-5 text-amber-600" />
              <h3 className="font-semibold text-sm">Activity Log</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <div className="text-lg font-bold">{connection.audit_count || 0}</div>
                <div className="text-xs text-muted-foreground">Audits</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <div className="text-lg font-bold">{connection.heal_count || 0}</div>
                <div className="text-xs text-muted-foreground">Heals</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <div className="text-lg font-bold">{connection.operate_count || 0}</div>
                <div className="text-xs text-muted-foreground">Total Ops</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <div className="text-lg font-bold">{connection.issues_detected || 0}</div>
                <div className="text-xs text-muted-foreground">Issues Found</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <div className="text-lg font-bold text-emerald-600">{connection.issues_healed || 0}</div>
                <div className="text-xs text-muted-foreground">Issues Healed</div>
              </div>
            </div>
            {connection.last_operate_at && (
              <div className="text-xs text-muted-foreground mt-3">
                Last operation: <span className="font-medium capitalize">{connection.last_operation || "—"}</span> at {new Date(connection.last_operate_at).toLocaleString()}
                {connection.last_operate_result && ` — ${connection.last_operate_result}`}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}