import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Globe, Plus, Activity } from "lucide-react";
import ProxyForm from "@/components/proxies/ProxyForm";
import ProxyCard from "@/components/proxies/ProxyCard";

export default function Proxies() {
  const [proxies, setProxies] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [settings, setSettings] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, s, st] = await Promise.all([
        base44.entities.Proxy.list("-created_date", 100),
        base44.entities.Session.list("-created_date", 200).catch(() => []),
        base44.entities.SystemSettings.list("-created_date", 1).catch(() => []),
      ]);
      setProxies(p);
      setSessions(s);
      setSettings(st[0] || null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveProxy = async (form) => {
    try {
      await base44.functions.invoke("saveProxy", { id: editing?.id, ...form });
      setShowForm(false);
      setEditing(null);
      load();
    } catch (e) { alert(e.response?.data?.error || e.message); }
  };

  const removeProxy = async (id) => {
    if (!confirm("Delete this proxy?")) return;
    await base44.entities.Proxy.delete(id);
    load();
  };

  const toggleActive = async (proxy) => {
    await base44.functions.invoke("saveProxy", { id: proxy.id, name: proxy.name, server: proxy.server, active: !proxy.active });
    load();
  };

  const setDefault = async (proxy) => {
    const data = { default_proxy_id: proxy.id };
    if (settings?.id) {
      await base44.entities.SystemSettings.update(settings.id, data);
    } else {
      await base44.entities.SystemSettings.create(data);
    }
    load();
  };

  const testProxy = async (proxyId) => base44.functions.invoke("testProxy", { proxyId });

  const sessionCount = (proxyId) => sessions.filter((s) => s.proxy_id === proxyId).length;
  const activeCount = proxies.filter((p) => p.active).length;
  const groups = [...new Set(proxies.map((p) => p.rotation_group).filter(Boolean))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold flex items-center gap-2"><Globe className="w-7 h-7" />Proxy Management</h1>
          <p className="text-muted-foreground mt-1">Configure, test, and assign proxies to your automation jobs</p>
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(!showForm); }}>
          <Plus className="w-4 h-4 mr-1" />{showForm ? "Cancel" : "Add Proxy"}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{proxies.length}</p><p className="text-xs text-muted-foreground">Total Proxies</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-green-600">{activeCount}</p><p className="text-xs text-muted-foreground">Active</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{groups.length}</p><p className="text-xs text-muted-foreground">Rotation Groups</p></CardContent></Card>
      </div>

      {showForm && <ProxyForm onSave={saveProxy} onCancel={() => setShowForm(false)} />}
      {editing && <ProxyForm initial={editing} onSave={saveProxy} onCancel={() => setEditing(null)} />}

      {loading ? (
        <p className="text-center py-8 text-muted-foreground">Loading proxies…</p>
      ) : proxies.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground"><Globe className="w-10 h-10 mx-auto mb-3 opacity-40" />No proxies yet. Add one to get started.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {proxies.map((p) => (
            <ProxyCard
              key={p.id}
              proxy={p}
              isDefault={settings?.default_proxy_id === p.id}
              sessionCount={sessionCount(p.id)}
              onEdit={(proxy) => { setEditing(proxy); setShowForm(false); }}
              onDelete={removeProxy}
              onTest={testProxy}
              onToggleActive={toggleActive}
              onSetDefault={setDefault}
            />
          ))}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><Activity className="w-4 h-4" />How Assignment Works</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>• <strong>Default proxy</strong> (★) is used automatically for new sessions that don't specify one.</p>
          <p>• <strong>Rotation groups</strong> let the engine round-robin across multiple proxies in the same group.</p>
          <p>• In the <strong>Job Builder</strong>, set <code className="bg-muted px-1 rounded">proxyId</code> in the session config to use a specific proxy for that job.</p>
        </CardContent>
      </Card>
    </div>
  );
}