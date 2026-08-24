import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import CopyBlock from "@/components/CopyBlock";
import CaptchaSolverCard from "@/components/CaptchaSolverCard";
import {
  Key, Plus, RefreshCw, Eye, EyeOff, Plug, Folder, ExternalLink, Package, Copy,
} from "lucide-react";

const GATEWAY_PATH = "/api/functions/cloudBrowserGatewayV6";
const MCP_PATH = "/api/functions/mcpTools";
const DEFAULT_SCOPES = ["sessions:read", "sessions:write", "jobs:read", "jobs:write"];

export default function Dashboard() {
  const [apiKeys, setApiKeys] = useState([]);
  const [projects, setProjects] = useState([]);
  const [createdKey, setCreatedKey] = useState(null);
  const [showKey, setShowKey] = useState(true);
  const [newKeyName, setNewKeyName] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "https://app.base44.app";
  const gatewayUrl = origin + GATEWAY_PATH;
  const mcpUrl = origin + MCP_PATH;

  const load = useCallback(async () => {
    try {
      const [keys, projs] = await Promise.all([
        base44.entities.ApiKey.list("-created_date", 50).catch(() => []),
        base44.entities.Project.list("-created_date", 50).catch(() => []),
      ]);
      setApiKeys(keys);
      setProjects(projs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const generateKey = async () => {
    setGenerating(true);
    try {
      const res = await base44.functions.invoke("createApiKey", {
        name: newKeyName || `Key ${new Date().toLocaleDateString()}`,
        scopes: DEFAULT_SCOPES,
      });
      const data = res.data || res;
      if (data.api_key) {
        setCreatedKey(data.api_key);
        setShowKey(true);
        setNewKeyName("");
        load();
      }
    } catch (e) { alert(e.response?.data?.error || e.message); }
    finally { setGenerating(false); }
  };

  const regenerate = async (key) => {
    if (!confirm("Regenerate this key? The old key stops working immediately.")) return;
    try {
      await base44.entities.ApiKey.update(key.id, { active: false }).catch(() => {});
      const res = await base44.functions.invoke("createApiKey", {
        name: `${key.name} (regenerated)`,
        scopes: key.scopes || DEFAULT_SCOPES,
        project_id: key.project_id,
      });
      const data = res.data || res;
      if (data.api_key) {
        setCreatedKey(data.api_key);
        setShowKey(true);
        load();
      }
    } catch (e) { alert(e.response?.data?.error || e.message); }
  };

  // The full connection package — everything another project needs in one block
  const activeKey = createdKey || "<generate a key below>";
  const connectionPackage = [
    `# CloudBrowser Control — Connection Package`,
    `# Paste these into the other project's environment / secrets`,
    ``,
    `CLOUDBROWSER_GATEWAY_URL=${gatewayUrl}`,
    `CLOUDBROWSER_MCP_URL=${mcpUrl}`,
    `CLOUDBROWSER_API_KEY=${activeKey}`,
  ].join("\n");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2"><Plug className="w-6 h-6" />Connection Hub</h1>
        <p className="text-muted-foreground mt-1">Everything another project needs to connect to CloudBrowser — all in one place.</p>
      </div>

      {/* NEW KEY BANNER */}
      {createdKey && (
        <Card className="border-amber-300">
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-amber-800">New API key — copy it now, it won't be shown again!</span>
              <Button size="sm" variant="ghost" onClick={() => setShowKey(!showKey)}>{showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</Button>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-2 rounded bg-amber-50 border font-mono text-xs sm:text-sm break-all">
                {showKey ? createdKey : "cb_live_••••••••••••••••••••••••••••••••••••••••"}
              </code>
              <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(createdKey); }}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <Button size="sm" variant="outline" onClick={() => setCreatedKey(null)}>Done</Button>
          </CardContent>
        </Card>
      )}

      {/* CAPTCHA SOLVER */}
      <CaptchaSolverCard />

      {/* FULL CONNECTION PACKAGE — the main thing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Package className="w-5 h-5" />Full Connection Package</CardTitle>
          <CardDescription>Copy this entire block and hand it to the other project. That's all they need.</CardDescription>
        </CardHeader>
        <CardContent>
          <CopyBlock text={connectionPackage} label="Environment variables / secrets" />
          <div className="mt-3 p-3 rounded-md bg-blue-50 border border-blue-200 text-xs text-blue-800">
            <strong>Auth:</strong> Every request needs <code>Authorization: Bearer &lt;CLOUDBROWSER_API_KEY&gt;</code>.
            Create sessions via the Gateway URL (geo/proxy), then drive them via the MCP URL (navigate/extract/screenshot).
            Full integration guide: <Link to="/connection-info" className="underline">Connection Info</Link>.
          </div>
        </CardContent>
      </Card>

      {/* ENDPOINTS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Endpoints</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <CopyBlock label="Gateway URL — create geo-targeted sessions" text={gatewayUrl} />
          <CopyBlock label="MCP Tools URL — navigate, extract, screenshot, close" text={mcpUrl} />
          <CopyBlock label="Authorization header (on every request)" text="Authorization: Bearer <CLOUDBROWSER_API_KEY>" />
        </CardContent>
      </Card>

      {/* API KEYS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Key className="w-5 h-5" />API Keys</CardTitle>
          <CardDescription>Keys are shown in plaintext only once — at creation or regeneration. Copy immediately.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Create new */}
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label>Key name (optional)</Label>
              <Input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="e.g. SEO Generator" />
            </div>
            <Button onClick={generateKey} disabled={generating}>
              {generating ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
              Generate Key
            </Button>
          </div>

          {/* Existing keys */}
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : apiKeys.length === 0 ? (
            <p className="text-sm text-muted-foreground">No keys yet — generate one above.</p>
          ) : (
            <div className="space-y-2">
              {apiKeys.map((k) => (
                <div key={k.id} className="flex items-center justify-between p-3 rounded-md border">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{k.name}</span>
                      {k.active ? (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">active</span>
                      ) : (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">inactive</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">
                      {k.key_prefix}… · scopes: {(k.scopes || []).join(", ")}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => regenerate(k)}>
                    <RefreshCw className="w-3 h-3 mr-1" /> Regenerate
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* PROJECTS */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base"><Folder className="w-5 h-5" />Projects</CardTitle>
              <CardDescription>Each project groups sessions, jobs, and costs. Manage full details on the Projects page.</CardDescription>
            </div>
            <Link to="/projects"><Button variant="outline" size="sm">Manage <ExternalLink className="w-3 h-3 ml-1" /></Button></Link>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No projects yet. <Link to="/projects" className="underline">Create one</Link>.</p>
          ) : (
            <div className="space-y-2">
              {projects.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-md border">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2.5 h-2.5 rounded-full bg-${p.color || "blue"}-500 shrink-0`} />
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{p.name}</div>
                      {p.description && <div className="text-xs text-muted-foreground truncate">{p.description}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {p.status === "archived" && <span className="text-xs text-muted-foreground">archived</span>}
                    <Link to="/projects"><Button variant="ghost" size="sm">Details</Button></Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}