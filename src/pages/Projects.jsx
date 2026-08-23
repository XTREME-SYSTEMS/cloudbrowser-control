import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Folder, Plus, Trash2, Copy, Check, Eye, EyeOff, Archive, ArchiveRestore, Monitor, Briefcase, DollarSign, TrendingUp, Plug, ChevronDown, ChevronRight, RefreshCw, Key } from "lucide-react";

const COLORS = [
  { name: "blue", class: "bg-blue-500" },
  { name: "purple", class: "bg-purple-500" },
  { name: "green", class: "bg-emerald-500" },
  { name: "orange", class: "bg-orange-500" },
  { name: "pink", class: "bg-pink-500" },
  { name: "cyan", class: "bg-cyan-500" },
];

const GATEWAY_PATH = "/api/functions/cloudBrowserGatewayV6";
const MCP_PATH = "/api/functions/mcpTools";
const DEFAULT_SCOPES = ["sessions:read", "sessions:write", "jobs:read", "jobs:write"];

function CopyBlock({ text, label }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div>
      {label && <div className="text-xs font-medium text-muted-foreground mb-1">{label}</div>}
      <div className="relative group">
        <pre className="p-3 rounded-md bg-muted text-xs font-mono overflow-x-auto border whitespace-pre-wrap break-all">{text}</pre>
        <Button size="sm" variant="ghost" className="absolute top-1 right-1 opacity-60 group-hover:opacity-100" onClick={copy}>
          {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
        </Button>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, to }) {
  const content = (
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium">{value}</span>
    </div>
  );
  return to ? <Link to={to} className="hover:underline">{content}</Link> : content;
}

function ConnectionDetails({ project, apiKey, onRegenerate }) {
  const [open, setOpen] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "https://app.base44.app";
  const gatewayUrl = origin + GATEWAY_PATH;
  const mcpUrl = origin + MCP_PATH;
  const keyPlaceholder = "<YOUR_API_KEY>";
  const scopes = apiKey?.scopes || DEFAULT_SCOPES;

  const createSessionBody = JSON.stringify({
    path: "/sessions",
    method: "POST",
    data: {
      viewport: { width: 1920, height: 1080 },
      geolocation: { latitude: 32.7767, longitude: -96.7970, accuracy: 100 },
      locale: "en-US",
      timezone: "America/Chicago",
      proxy: { server: "http://your-residential-proxy:8080", username: "user", password: "pass" },
      blocked_resources: ["image", "font", "media"],
      use_pool: true,
      store_id: "store-tx"
    }
  }, null, 2);

  const navigateBody = JSON.stringify({
    tool: "browser_navigate",
    params: {
      session_id: "<SESSION_ID_FROM_STEP_1>",
      url: "https://www.google.com/search?q=concrete+polishing+near+me"
    }
  }, null, 2);

  const extractBody = JSON.stringify({
    tool: "browser_act",
    params: {
      session_id: "<SESSION_ID_FROM_STEP_1>",
      action_type: "evaluate",
      options: {
        fn: "() => { const r=[]; document.querySelectorAll('#search .g').forEach((el,i)=>{const t=el.querySelector('h3'),l=el.querySelector('a[href]');if(t&&l)r.push({position:i+1,title:t.innerText,url:l.href,domain:new URL(l.href).hostname});});return r; }"
      }
    }
  }, null, 2);

  const closeBody = JSON.stringify({
    tool: "browser_end",
    params: { session_id: "<SESSION_ID_FROM_STEP_1>" }
  }, null, 2);

  return (
    <div className="border-t pt-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm font-medium hover:text-primary w-full"
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <Plug className="w-4 h-4" /> Connection Details (copy-paste ready)
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          {/* Endpoints */}
          <div className="grid gap-2">
            <CopyBlock label="Gateway URL (create sessions with geo/proxy)" text={gatewayUrl} />
            <CopyBlock label="MCP Tools URL (navigate, extract, screenshot, close)" text={mcpUrl} />
          </div>

          {/* Auth */}
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">Authorization Header (put on every request)</div>
            <CopyBlock text={`Authorization: Bearer ${keyPlaceholder}`} />
          </div>

          {/* API key status */}
          <div className="p-3 rounded-md bg-muted/50 border text-xs space-y-2">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4" />
              <span className="font-medium">API Key:</span>
              {apiKey ? (
                <code className="font-mono">{apiKey.key_prefix}…</code>
              ) : (
                <span className="text-muted-foreground">No key linked — regenerate to create one</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">Scopes:</span>
              <span className="font-mono text-muted-foreground">{scopes.join(", ")}</span>
            </div>
            <Button size="sm" variant="outline" onClick={onRegenerate} className="mt-1">
              <RefreshCw className="w-3 h-3 mr-1" /> Regenerate Key (old key will be deactivated)
            </Button>
          </div>

          {/* Step-by-step example */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">STEP 1 — Create a geo-targeted session (POST to Gateway URL):</div>
            <CopyBlock text={createSessionBody} />
          </div>
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">STEP 2 — Navigate to Google (POST to MCP Tools URL):</div>
            <CopyBlock text={navigateBody} />
          </div>
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">STEP 3 — Extract organic SERP results (POST to MCP Tools URL):</div>
            <CopyBlock text={extractBody} />
          </div>
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">STEP 4 — Close the session (POST to MCP Tools URL):</div>
            <CopyBlock text={closeBody} />
          </div>

          <div className="p-3 rounded-md bg-blue-50 border border-blue-200 text-xs text-blue-800">
            <strong>How to use:</strong> Replace <code>&lt;YOUR_API_KEY&gt;</code> with the API key shown when you regenerate (or the one shown at project creation).
            Replace <code>&lt;SESSION_ID_FROM_STEP_1&gt;</code> with the <code>control_plane_session_id</code> returned in Step 1's response.
            All four steps use <code>POST</code> with <code>Content-Type: application/json</code>.
          </div>
        </div>
      )}
    </div>
  );
}

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [apiKeys, setApiKeys] = useState({});
  const [stats, setStats] = useState({});
  const [newProj, setNewProj] = useState({ name: "", description: "", color: "blue" });
  const [createdKey, setCreatedKey] = useState(null);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [regenerating, setRegenerating] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await base44.entities.Project.list("-created_date", 50);
      setProjects(list);

      // Fetch linked API keys per project
      const keysById = {};
      for (const p of list) {
        if (p.api_key_id) {
          try {
            const key = await base44.entities.ApiKey.get(p.api_key_id);
            keysById[p.id] = key;
          } catch (e) {}
        }
      }
      setApiKeys(keysById);

      setLoadingStats(true);
      const [sessions, jobs, costEntries] = await Promise.all([
        base44.entities.Session.list("-created_date", 200).catch(() => []),
        base44.entities.Job.list("-created_date", 200).catch(() => []),
        base44.entities.CostEntry.list("-created_date", 200).catch(() => []),
      ]);
      const next = {};
      for (const p of list) {
        const projSessions = sessions.filter((s) => s.project_id === p.id);
        const projJobs = jobs.filter((j) => j.project_id === p.id);
        const projCosts = costEntries.filter((c) => c.job_id && projJobs.some((j) => j.id === c.job_id));
        next[p.id] = {
          sessions: projSessions.length,
          activeSessions: projSessions.filter((s) => !["ended", "errored", "timed_out"].includes(s.status)).length,
          jobs: projJobs.length,
          completedJobs: projJobs.filter((j) => j.status === "completed").length,
          failedJobs: projJobs.filter((j) => j.status === "failed").length,
          totalCost: projCosts.reduce((sum, c) => sum + (c.cost || 0), 0),
        };
      }
      setStats(next);
    } catch (e) {
      console.error("Failed to load projects", e);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!newProj.name) return;
    setCreating(true);
    try {
      const res = await base44.functions.invoke("createProject", newProj);
      if (res.data?.api_key?.api_key) {
        setCreatedKey(res.data.api_key.api_key);
        setShowKey(true);
      }
      setNewProj({ name: "", description: "", color: "blue" });
      load();
    } catch (e) { alert(e.response?.data?.error || e.message); }
    finally { setCreating(false); }
  };

  const copyKey = () => { navigator.clipboard.writeText(createdKey); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const remove = async (id) => {
    if (!confirm("Delete this project? Associated sessions and jobs will remain but lose the project link.")) return;
    await base44.entities.Project.delete(id);
    load();
  };

  const toggleArchive = async (p) => {
    await base44.entities.Project.update(p.id, { status: p.status === "active" ? "archived" : "active" });
    load();
  };

  const regenerate = async (project) => {
    if (!confirm("Regenerate API key? The old key will be deactivated immediately and any external system using it will stop working.")) return;
    setRegenerating(project.id);
    try {
      // Deactivate old key
      const oldKey = apiKeys[project.id];
      if (oldKey) {
        await base44.entities.ApiKey.update(oldKey.id, { active: false }).catch(() => {});
      }
      // Create new key bound to this project
      const res = await base44.functions.invoke("createApiKey", {
        name: `${project.name} (regenerated)`,
        scopes: DEFAULT_SCOPES,
        project_id: project.id,
      });
      const data = res.data || res;
      if (data.api_key) {
        // Link new key to project
        await base44.entities.Project.update(project.id, { api_key_id: data.id }).catch(() => {});
        setCreatedKey(data.api_key);
        setShowKey(true);
        load();
      }
    } catch (e) { alert(e.response?.data?.error || e.message); }
    finally { setRegenerating(null); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold flex items-center gap-2"><Folder className="w-6 h-6" />Projects</h1>
        <p className="text-muted-foreground mt-1">Track every project's sessions, jobs, and costs. Each project has a copy-paste-ready connection block for external systems.</p>
      </div>

      {createdKey && (
        <Card className="border-amber-300">
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-amber-800">API key — copy it now, it won't be shown again!</span>
              <Button size="sm" variant="ghost" onClick={() => setShowKey(!showKey)}>{showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</Button>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-2 rounded bg-amber-50 border font-mono text-xs sm:text-sm break-all">
                {showKey ? createdKey : "cb_live_••••••••••••••••••••••••••••••••••••••••"}
              </code>
              <Button size="sm" onClick={copyKey} className="shrink-0">{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</Button>
            </div>
            <Button size="sm" variant="outline" onClick={() => setCreatedKey(null)}>Done</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Plus className="w-5 h-5" />New Project</CardTitle>
          <CardDescription>Create a project to group sessions and jobs. An API key is generated automatically.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Project Name</Label><Input value={newProj.name} onChange={(e) => setNewProj({ ...newProj, name: e.target.value })} placeholder="My Scraper, Competitor Monitor..." /></div>
          <div><Label>Description</Label><Textarea value={newProj.description} onChange={(e) => setNewProj({ ...newProj, description: e.target.value })} rows={2} /></div>
          <div>
            <Label>Color</Label>
            <div className="flex gap-2 mt-1">
              {COLORS.map((c) => (
                <button key={c.name} onClick={() => setNewProj({ ...newProj, color: c.name })} className={`w-7 h-7 rounded-full ${c.class} ${newProj.color === c.name ? "ring-2 ring-offset-2 ring-primary" : ""}`} />
              ))}
            </div>
          </div>
          <Button onClick={create} disabled={creating || !newProj.name} size="sm"><Plus className="w-4 h-4 mr-1" />{creating ? "Creating..." : "Create Project & Generate Key"}</Button>
        </CardContent>
      </Card>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground text-sm">No projects yet. Create one above to start tracking.</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((p) => {
            const s = stats[p.id] || {};
            return (
              <Card key={p.id} className={p.status === "archived" ? "opacity-60" : ""}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full bg-${p.color || "blue"}-500`} />
                      <div>
                        <CardTitle className="text-base">{p.name}</CardTitle>
                        {p.status === "archived" && <span className="text-xs text-muted-foreground ml-1">(archived)</span>}
                        {p.description && <CardDescription className="mt-0.5">{p.description}</CardDescription>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => toggleArchive(p)}>
                        {p.status === "active" ? <Archive className="w-4 h-4" /> : <ArchiveRestore className="w-4 h-4" />}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <Stat icon={Monitor} label="Sessions" value={loadingStats ? "…" : (s.sessions || 0)} to="/sessions" />
                    <Stat icon={TrendingUp} label="Active" value={loadingStats ? "…" : (s.activeSessions || 0)} to="/sessions" />
                    <Stat icon={Briefcase} label="Jobs" value={loadingStats ? "…" : (s.jobs || 0)} to="/jobs" />
                    <Stat icon={Check} label="Completed" value={loadingStats ? "…" : (s.completedJobs || 0)} to="/jobs" />
                  </div>
                  {s.failedJobs > 0 && (
                    <div className="flex items-center gap-2 text-xs text-red-500">
                      <Briefcase className="w-4 h-4" /> {s.failedJobs} failed job(s)
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Total cost</span>
                    <span className="text-sm font-medium ml-auto">${(s.totalCost || 0).toFixed(4)}</span>
                  </div>

                  <ConnectionDetails
                    project={p}
                    apiKey={apiKeys[p.id]}
                    onRegenerate={() => regenerate(p)}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}