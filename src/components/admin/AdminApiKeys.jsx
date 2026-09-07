import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Key, Plus, Copy, Check, Trash2, Eye, EyeOff, ShieldCheck } from "lucide-react";

const SCOPES = [
  "sessions:read", "sessions:write",
  "jobs:read", "jobs:write",
  "scrape:run", "clone:run",
  "agent:run", "sandbox:manage",
  "admin:all",
];

export default function AdminApiKeys() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState({ name: "", scopes: ["sessions:read", "sessions:write", "scrape:run"], expiresInDays: 30 });
  const [generatedKey, setGeneratedKey] = useState(null);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    try {
      const data = await base44.entities.ApiKey.list("-created_date", 100);
      setKeys(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const toggleScope = (scope) => {
    setNewKey(prev => ({
      ...prev,
      scopes: prev.scopes.includes(scope)
        ? prev.scopes.filter(s => s !== scope)
        : [...prev.scopes, scope],
    }));
  };

  const handleCreate = async () => {
    if (!newKey.name.trim()) return;
    setCreating(true);
    try {
      const res = await base44.functions.invoke("createApiKey", {
        name: newKey.name,
        scopes: newKey.scopes,
        expiresInDays: newKey.expiresInDays,
      });
      const fullKey = res.data?.key || res.data?.api_key || res.data?.fullKey;
      if (fullKey) {
        setGeneratedKey(fullKey);
        setCopied(false);
        setShowCreate(false);
        setNewKey({ name: "", scopes: ["sessions:read", "sessions:write", "scrape:run"], expiresInDays: 30 });
        load();
      } else {
        alert("Key created but full key not returned. Check the API Keys page.");
        load();
      }
    } catch (e) {
      alert(e.response?.data?.error || e.message || "Failed to create key");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (keyId) => {
    if (!confirm("Revoke this API key? This cannot be undone.")) return;
    try {
      await base44.entities.ApiKey.update(keyId, { active: false });
      load();
    } catch (e) {
      alert("Failed to revoke key");
    }
  };

  const copyKey = () => {
    navigator.clipboard.writeText(generatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div className="text-muted-foreground text-sm">Loading API keys…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">API Keys</h1>
          <p className="text-muted-foreground text-sm mt-1">Generate and manage API keys for system access.</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          <Plus className="w-4 h-4 mr-1" /> Generate Key
        </Button>
      </div>

      {/* Generated key display */}
      {generatedKey && (
        <Card className="border-amber-300 bg-amber-50/50">
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-5 h-5 text-amber-600" />
              <h3 className="font-semibold text-sm">API Key Generated — Copy Now!</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              This is the only time the full key will be shown. Store it securely.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-black/5 rounded-md text-xs font-mono break-all">
                {generatedKey}
              </code>
              <Button size="sm" variant="outline" onClick={copyKey}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setGeneratedKey(null)}>
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create form */}
      {showCreate && (
        <Card>
          <CardContent className="pt-5 space-y-4">
            <div className="space-y-2">
              <Label>Key Name</Label>
              <Input
                placeholder="e.g. Vision Cortex Admin, Production API"
                value={newKey.name}
                onChange={e => setNewKey({ ...newKey, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Expiration (days)</Label>
              <Input
                type="number"
                value={newKey.expiresInDays}
                onChange={e => setNewKey({ ...newKey, expiresInDays: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Scopes</Label>
              <div className="flex flex-wrap gap-2">
                {SCOPES.map(scope => (
                  <button
                    key={scope}
                    onClick={() => toggleScope(scope)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      newKey.scopes.includes(scope)
                        ? "bg-amber-500 text-black border-amber-500"
                        : "bg-transparent text-muted-foreground border-border hover:border-amber-300"
                    }`}
                  >
                    {scope}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={creating || !newKey.name.trim()}>
                {creating ? "Generating…" : "Generate Key"}
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key list */}
      <div className="grid gap-3">
        {keys.map(k => (
          <Card key={k.id} className="border-border/50">
            <CardContent className="pt-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${k.active === false ? "bg-muted" : "bg-amber-100"}`}>
                  <Key className={`w-5 h-5 ${k.active === false ? "text-muted-foreground" : "text-amber-600"}`} />
                </div>
                <div>
                  <div className="font-semibold text-sm">{k.name}</div>
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">
                    {k.key_prefix || "****"}…{k.active === false ? " (revoked)" : ""}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(k.scopes || []).slice(0, 4).map(s => (
                      <span key={s} className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{s}</span>
                    ))}
                    {(k.scopes || []).length > 4 && (
                      <span className="text-xs text-muted-foreground">+{(k.scopes || []).length - 4} more</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {k.active !== false && k.expires_at && new Date(k.expires_at) < new Date() && (
                  <Badge variant="destructive" className="text-xs">Expired</Badge>
                )}
                {k.active !== false && (
                  <Button size="sm" variant="ghost" onClick={() => handleRevoke(k.id)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {keys.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">No API keys yet. Generate one to get started.</div>
        )}
      </div>
    </div>
  );
}