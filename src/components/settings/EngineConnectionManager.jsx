import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Cpu, Save, Eye, EyeOff, Loader2, CheckCircle, XCircle, AlertTriangle, ShieldCheck, Fingerprint } from "lucide-react";

export default function EngineConnectionManager() {
  const [engineUrl, setEngineUrl] = useState("");
  const [candidateKey, setCandidateKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [health, setHealth] = useState(null);
  const [recon, setRecon] = useState(null);
  const [deploy, setDeploy] = useState(null);

  const loadConfig = useCallback(async () => {
    try {
      const rows = await base44.entities.Setting.filter({ setting_key: "engine.url" });
      if (rows[0]?.effective_value) setEngineUrl(rows[0].effective_value);
    } catch (e) {}
    try {
      const h = await base44.functions.invoke("engineHealth", {});
      setHealth(h.data);
    } catch (e) { setHealth({ ok: false, error: e.message }); }
    try {
      const r = await base44.functions.invoke("updateEngineConfig", {});
      setRecon(r.data);
    } catch (e) { setRecon(null); }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const handleTest = async () => {
    setSaving(true);
    setRecon(null);
    try {
      const res = await base44.functions.invoke("updateEngineConfig", {
        engine_url: engineUrl || undefined,
        candidate_key: candidateKey || undefined,
      });
      setRecon(res.data);
    } catch (e) {
      setRecon({ ok: false, error: e.response?.data?.error || e.message });
    } finally {
      setCandidateKey("");
      setSaving(false);
    }
  };

  const handleDeployCheck = async () => {
    try {
      const res = await base44.functions.invoke("getDeploymentStatus", {});
      setDeploy(res.data);
    } catch (e) {
      setDeploy({ error: e.response?.data?.error || e.message });
    }
  };

  const reachable = health?.ok;
  const authed = recon?.secret_vault_valid;
  const credConfigured = recon?.secret_vault_configured;
  const drift = deploy?.drift_count > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Cpu className="w-5 h-5" />Engine Connection</CardTitle>
        <CardDescription>
          Test engine credentials against an authenticated endpoint. The API key is never stored in the database or returned to the browser.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Engine URL */}
        <div className="space-y-2">
          <Label>Engine URL</Label>
          <Input placeholder="https://your-engine.up.railway.app" value={engineUrl} onChange={(e) => setEngineUrl(e.target.value)} />
        </div>

        {/* Candidate key — transient, never persisted */}
        <div className="space-y-2">
          <Label>Candidate API Key (transient — not stored)</Label>
          <div className="flex gap-2">
            <Input
              type={showKey ? "text" : "password"}
              placeholder="Enter candidate key to test against engine"
              value={candidateKey}
              onChange={(e) => setCandidateKey(e.target.value)}
            />
            <Button type="button" variant="outline" size="icon" onClick={() => setShowKey(!showKey)}>
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleTest} disabled={saving || !engineUrl}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
            Test &amp; Reconcile
          </Button>
          <Button variant="outline" onClick={handleDeployCheck}>
            <Fingerprint className="w-4 h-4 mr-2" />Check Deployment
          </Button>
        </div>

        {/* Status grid */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <StatusItem label="Engine Reachable" value={reachable ? "YES" : "NO"} ok={reachable} />
          <StatusItem label="Auth Connection" value={authed ? "VERIFIED" : "NOT VERIFIED"} ok={authed} />
          <StatusItem label="Credential Configured" value={credConfigured ? "YES" : "NO"} ok={credConfigured} />
          <StatusItem label="Reconciliation" value={recon?.reconciliation || "—"} ok={recon?.reconciliation === "SYNCED"} />
        </div>

        {/* Engine details */}
        {health?.ok && (
          <div className="grid grid-cols-2 gap-2 text-sm p-3 rounded bg-muted/30">
            <DetailItem label="Engine Version" value={health.engine_version} />
            <DetailItem label="Worker ID" value={health.worker_id?.slice(0, 12)} />
            <DetailItem label="Region" value={health.region} />
            <DetailItem label="Active Sessions" value={health.active_sessions} />
            <DetailItem label="Pool Size" value={health.pool_size} />
            <DetailItem label="Pool Capacity" value={health.pool_capacity} />
          </div>
        )}

        {/* Credential reference */}
        {recon?.credential_reference && (
          <div className="flex items-center gap-2 text-sm p-2 rounded bg-muted/30">
            <Fingerprint className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Credential Reference:</span>
            <code className="text-xs">{recon.credential_reference}</code>
          </div>
        )}

        {/* Action required */}
        {recon?.action_required && (
          <div className="flex items-start gap-2 p-3 rounded bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 text-sm">
            <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
            <span>{recon.action_required}</span>
          </div>
        )}

        {/* Deployment version */}
        {deploy && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Deployment Version:</span>
              <code className="text-xs">{deploy.deployment_version}</code>
              {drift ? (
                <span className="text-red-600 font-medium flex items-center gap-1"><XCircle className="w-4 h-4" />DRIFT ({deploy.drift_count})</span>
              ) : (
                <span className="text-green-600 font-medium flex items-center gap-1"><CheckCircle className="w-4 h-4" />NO DRIFT</span>
              )}
            </div>
            {drift && (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {Object.entries(deploy.matrix).map(([fn, info]) => (
                  <div key={fn} className={`flex items-center justify-between text-xs p-1.5 rounded ${info.status === "CURRENT" ? "bg-green-50 dark:bg-green-950" : "bg-red-50 dark:bg-red-950"}`}>
                    <span className="font-mono">{fn}</span>
                    <span className={info.status === "CURRENT" ? "text-green-600" : "text-red-600"}>
                      {info.status} (expected {info.expected}, invoked {info.invoked})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusItem({ label, value, ok }) {
  return (
    <div className="flex items-center justify-between p-2 rounded bg-muted/30">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium flex items-center gap-1 ${ok ? "text-green-600" : "text-red-600"}`}>
        {ok ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
        {value}
      </span>
    </div>
  );
}

function DetailItem({ label, value }) {
  return (
    <div>
      <span className="text-muted-foreground text-xs">{label}</span>
      <p className="font-medium truncate">{value || "—"}</p>
    </div>
  );
}