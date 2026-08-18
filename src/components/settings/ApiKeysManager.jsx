import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Key, Plus, Trash2, Copy, Check, Eye, EyeOff } from "lucide-react";

const ALL_SCOPES = [
  "sessions:read", "sessions:write",
  "jobs:read", "jobs:write",
  "schedules:read", "schedules:write",
  "screenshots:read", "results:read",
  "projects:read", "projects:write",
  "settings:read", "settings:write",
];

export default function ApiKeysManager() {
  const [keys, setKeys] = useState([]);
  const [newName, setNewName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState(["sessions:read", "sessions:write", "jobs:read", "jobs:write"]);
  const [createdKey, setCreatedKey] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = async () => { try { setKeys(await base44.entities.ApiKey.list("-created_date", 50)); } catch (e) {} };
  useEffect(() => { load(); }, []);

  const toggleScope = (scope) => {
    setSelectedScopes((prev) => prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]);
  };

  const create = async () => {
    if (!newName) return;
    setCreating(true);
    try {
      const res = await base44.functions.invoke("createApiKey", { name: newName, scopes: selectedScopes });
      setCreatedKey(res.data.api_key);
      setNewName("");
      setShowKey(true);
      load();
    } catch (e) { alert(e.response?.data?.error || e.message); }
    finally { setCreating(false); }
  };

  const copyKey = () => {
    navigator.clipboard.writeText(createdKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const revoke = async (id) => {
    if (!confirm("Revoke this API key? This cannot be undone.")) return;
    await base44.entities.ApiKey.delete(id);
    load();
  };

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Key className="w-5 h-5" />API Keys</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Generate API keys to integrate CloudBrowser into your systems. Keys are shown only once — copy them immediately.</p>

        {/* Created key banner */}
        {createdKey && (
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-300">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-amber-800">Your new API key — copy it now!</span>
              <Button size="sm" variant="ghost" onClick={() => setShowKey(!showKey)}>{showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</Button>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-2 rounded bg-white border font-mono text-xs sm:text-sm break-all">
                {showKey ? createdKey : "cb_live_••••••••••••••••••••••••••••••••••••••••••"}
              </code>
              <Button size="sm" onClick={copyKey} className="shrink-0">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => setCreatedKey(null)}>Done</Button>
          </div>
        )}

        {/* Create new key */}
        <div className="space-y-3 p-3 border rounded-lg">
          <div><Label>Key Name</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Production, Staging, CI/CD..." /></div>
          <div>
            <Label>Scopes</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {ALL_SCOPES.map((scope) => (
                <button key={scope} onClick={() => toggleScope(scope)} className={`px-2 py-1 rounded text-xs font-mono ${selectedScopes.includes(scope) ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{scope}</button>
              ))}
            </div>
          </div>
          <Button onClick={create} disabled={creating || !newName} size="sm"><Plus className="w-4 h-4 mr-1" />{creating ? "Generating..." : "Generate Key"}</Button>
        </div>

        {/* Existing keys */}
        {keys.length > 0 && (
          <div className="space-y-2">
            {keys.map((k) => (
              <div key={k.id} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <span className="font-medium">{k.name}</span>
                  <span className="text-sm text-muted-foreground font-mono ml-2">{k.key_prefix}…</span>
                  {k.last_used && <span className="text-xs text-muted-foreground block mt-0.5">Last used: {new Date(k.last_used).toLocaleDateString()}</span>}
                </div>
                <Button size="sm" variant="ghost" onClick={() => revoke(k.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}