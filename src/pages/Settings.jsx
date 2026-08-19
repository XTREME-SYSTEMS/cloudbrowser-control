import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Cpu, Key, Globe, RefreshCw, Plus, Trash2, CheckCircle, XCircle, Settings2, Shield } from "lucide-react";
import ApiKeysManager from "@/components/settings/ApiKeysManager";
import ProjectsManager from "@/components/settings/ProjectsManager";
import SessionDefaultsManager from "@/components/settings/SessionDefaultsManager";
import ConcurrencyLimitsManager from "@/components/settings/ConcurrencyLimitsManager";
import SecurityManager from "@/components/settings/SecurityManager";
import StorageRetentionManager from "@/components/settings/StorageRetentionManager";
import WebhooksManager from "@/components/settings/WebhooksManager";
import ExtensionsManager from "@/components/settings/ExtensionsManager";
import ProfilesManager from "@/components/settings/ProfilesManager";
import EngineConnectionManager from "@/components/settings/EngineConnectionManager";

export default function Settings() {
  const [health, setHealth] = useState(null);
  const [checking, setChecking] = useState(false);
  const [proxies, setProxies] = useState([]);
  const [newProxy, setNewProxy] = useState({ name: "", server: "", username: "", password: "", country: "", protocol: "http" });

  useEffect(() => {
    checkHealth();
    loadProxies();
  }, []);

  const checkHealth = async () => {
    setChecking(true);
    try {
      const res = await base44.functions.invoke("engineHealth", {});
      setHealth(res.data);
    } catch (e) { setHealth({ ok: false, error: e.message }); }
    finally { setChecking(false); }
  };

  const loadProxies = async () => {
    try { setProxies(await base44.entities.Proxy.list("-created_date", 50)); } catch (e) {}
  };

  const addProxy = async () => {
    if (!newProxy.name || !newProxy.server) return;
    try {
      await base44.functions.invoke("saveProxy", newProxy);
      setNewProxy({ name: "", server: "", username: "", password: "", country: "", protocol: "http" });
      loadProxies();
    } catch (e) { alert(e.response?.data?.error || e.message); }
  };

  const removeProxy = async (id) => {
    await base44.entities.Proxy.delete(id);
    loadProxies();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-heading font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your browser automation platform</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="w-full justify-start mb-4 overflow-x-auto flex-nowrap">
          <TabsTrigger value="general" className="flex-1 sm:flex-none"><Settings2 className="w-4 h-4 mr-1" />General</TabsTrigger>
          <TabsTrigger value="api" className="flex-1 sm:flex-none"><Key className="w-4 h-4 mr-1" />API & Projects</TabsTrigger>
          <TabsTrigger value="integrations" className="flex-1 sm:flex-none"><Globe className="w-4 h-4 mr-1" />Integrations</TabsTrigger>
          <TabsTrigger value="security" className="flex-1 sm:flex-none"><Shield className="w-4 h-4 mr-1" />Security</TabsTrigger>
        </TabsList>

        {/* ─── General Tab ─── */}
        <TabsContent value="general" className="space-y-6">
          {/* Engine status */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2"><Cpu className="w-5 h-5" />Browser Engine</CardTitle>
                <Button size="sm" variant="outline" onClick={checkHealth} disabled={checking}>
                  <RefreshCw className={`w-4 h-4 mr-1 ${checking ? "animate-spin" : ""}`} />Check
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {health?.ok ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="w-5 h-5" />
                    <span>Connected — {health.active_sessions} active sessions, uptime {Math.round(health.uptime)}s</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="p-2 rounded bg-muted/40 text-center"><p className="text-lg font-bold">{health.active_sessions}</p><p className="text-xs text-muted-foreground">Active</p></div>
                    <div className="p-2 rounded bg-muted/40 text-center"><p className="text-lg font-bold">{health.max_sessions}</p><p className="text-xs text-muted-foreground">Max</p></div>
                    <div className="p-2 rounded bg-muted/40 text-center"><p className="text-lg font-bold">{health.pool_size}</p><p className="text-xs text-muted-foreground">Pooled</p></div>
                  </div>
                </div>
              ) : health?.configured === false ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-orange-600">
                    <XCircle className="w-5 h-5" /><span>Not configured</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Set <code className="bg-muted px-1 rounded">ENGINE_URL</code> and{" "}
                    <code className="bg-muted px-1 rounded">ENGINE_API_KEY</code> in Settings → Secrets,
                    then deploy the browser engine from the <code className="bg-muted px-1 rounded">browser-engine/</code> folder to Railway.
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-600">
                  <XCircle className="w-5 h-5" /><span>Unreachable: {health?.error || "check your deployment"}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <EngineConnectionManager />

          <SessionDefaultsManager />
          <ConcurrencyLimitsManager />
          <StorageRetentionManager />
        </TabsContent>

        {/* ─── API & Projects Tab ─── */}
        <TabsContent value="api" className="space-y-6">
          <ProjectsManager />
          <ApiKeysManager />
        </TabsContent>

        {/* ─── Integrations Tab ─── */}
        <TabsContent value="integrations" className="space-y-6">
          {/* Proxies */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Globe className="w-5 h-5" />Proxy Pool</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div><Label>Name</Label><Input value={newProxy.name} onChange={(e) => setNewProxy({ ...newProxy, name: e.target.value })} /></div>
                <div><Label>Server (host:port)</Label><Input value={newProxy.server} onChange={(e) => setNewProxy({ ...newProxy, server: e.target.value })} /></div>
                <div><Label>Country</Label><Input value={newProxy.country} onChange={(e) => setNewProxy({ ...newProxy, country: e.target.value })} /></div>
                <div><Label>Username</Label><Input value={newProxy.username} onChange={(e) => setNewProxy({ ...newProxy, username: e.target.value })} /></div>
                <div><Label>Password</Label><Input type="password" value={newProxy.password} onChange={(e) => setNewProxy({ ...newProxy, password: e.target.value })} /></div>
                <div className="flex items-end"><Button onClick={addProxy}><Plus className="w-4 h-4 mr-1" />Add</Button></div>
              </div>
              {proxies.length > 0 && (
                <div className="space-y-2">
                  {proxies.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-3 border rounded">
                      <div><span className="font-medium">{p.name}</span> <span className="text-sm text-muted-foreground">— {p.server} ({p.country || "—"})</span></div>
                      <Button size="sm" variant="ghost" onClick={() => removeProxy(p.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <WebhooksManager />
          <ExtensionsManager />
          <ProfilesManager />
        </TabsContent>

        {/* ─── Security Tab ─── */}
        <TabsContent value="security" className="space-y-6">
          <SecurityManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}