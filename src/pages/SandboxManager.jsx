import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import CopyBlock from "@/components/CopyBlock";
import {
  Server, Plus, RefreshCw, Check, Globe, Zap, Clock, Trash2,
  Box, Shield, Bot, Copy, Monitor, Loader2, ExternalLink, Key
} from "lucide-react";

const capabilities = [
  { id: "scraper", label: "Web Scraper", icon: Globe },
  { id: "headless_browser", label: "Headless Browser", icon: Monitor },
  { id: "form_filler", label: "Form Filler", icon: Box },
  { id: "captcha_solver", label: "Captcha Solver", icon: Shield },
  { id: "clone_engine", label: "Clone Engine", icon: Copy },
  { id: "ai_agent", label: "AI Agent", icon: Bot },
  { id: "proxy_rotation", label: "Proxy Rotation", icon: RefreshCw },
  { id: "stealth_mode", label: "Stealth Mode", icon: Zap },
];

export default function SandboxManager() {
  const [sandboxes, setSandboxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [selectedCaps, setSelectedCaps] = useState(["scraper", "headless_browser"]);
  const [provisionResult, setProvisionResult] = useState(null);

  const load = async () => {
    try {
      const data = await base44.entities.Sandbox.list("-created_date", 50).catch(() => []);
      setSandboxes(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const toggleCap = (cap) => {
    setSelectedCaps(prev => prev.includes(cap) ? prev.filter(c => c !== cap) : [...prev, cap]);
  };

  const create = async () => {
    setCreating(true);
    try {
      const res = await base44.functions.invoke("provisionSandbox", {
        name: newName || `Sandbox ${new Date().toLocaleDateString()}`,
        capabilities: selectedCaps,
      });
      const data = res.data || res;
      setProvisionResult(data);
      setNewName("");
      setNewDesc("");
      setSelectedCaps(["scraper", "headless_browser"]);
      setShowForm(false);
      load();
    } catch (e) { alert(e.response?.data?.error || e.message); }
    finally { setCreating(false); }
  };

  const terminate = async (id) => {
    if (!confirm("Terminate this sandbox? This cannot be undone.")) return;
    try {
      await base44.entities.Sandbox.update(id, { status: "terminated" });
      load();
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2"><Server className="w-6 h-6" />Sandboxes</h1>
          <p className="text-muted-foreground mt-1">Isolated, auto-provisioned backend environments. Zero DevOps required.</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-1" /> New Sandbox
        </Button>
      </div>

      {/* Provision result */}
      {provisionResult && (
        <Card className="border-emerald-300">
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-emerald-600" />
              <span className="font-semibold">Sandbox Provisioned!</span>
            </div>
            {provisionResult.api_key && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                <div className="flex items-center gap-2 mb-1">
                  <Key className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-800">API key (copy now):</span>
                </div>
                <code className="text-xs font-mono break-all">{provisionResult.api_key}</code>
              </div>
            )}
            {provisionResult.engine_url && (
              <div>
                <Label className="mb-1 block">Engine URL</Label>
                <CopyBlock text={provisionResult.engine_url} label="Engine endpoint" />
              </div>
            )}
            <Button variant="outline" size="sm" onClick={() => setProvisionResult(null)}>Done</Button>
          </CardContent>
        </Card>
      )}

      {/* Create form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Provision New Sandbox</CardTitle>
            <CardDescription>We'll auto-provision an isolated Railway backend with your selected capabilities.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <Label className="mb-2 block">Name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="My Production Scraper" />
            </div>
            <div>
              <Label className="mb-2 block">Description (optional)</Label>
              <Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="What will this sandbox be used for?" rows={2} />
            </div>
            <div>
              <Label className="mb-3 block">Capabilities</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {capabilities.map(cap => (
                  <button
                    key={cap.id}
                    onClick={() => toggleCap(cap.id)}
                    className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-all ${
                      selectedCaps.includes(cap.id) ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <cap.icon className={`w-4 h-4 shrink-0 ${selectedCaps.includes(cap.id) ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="text-sm font-medium">{cap.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={create} disabled={creating || selectedCaps.length === 0}>
                {creating ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Provisioning…</> : <><Zap className="w-4 h-4 mr-1" /> Provision Sandbox</>}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sandbox list */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : sandboxes.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <Server className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No sandboxes yet. Create one to get an isolated backend environment.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {sandboxes.map(sb => (
            <Card key={sb.id} className={sb.status === "terminated" ? "opacity-50" : ""}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">{sb.name}</h3>
                    {sb.description && <p className="text-sm text-muted-foreground mt-0.5">{sb.description}</p>}
                  </div>
                  <Badge variant={sb.status === "active" ? "default" : sb.status === "creating" ? "secondary" : "outline"}>
                    {sb.status === "creating" && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                    {sb.status}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1 mb-3">
                  {(sb.capabilities || []).map(cap => (
                    <Badge key={cap} variant="secondary" className="text-xs capitalize">{cap.replace(/_/g, ' ')}</Badge>
                  ))}
                </div>
                {sb.engine_url && sb.status === "active" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Globe className="w-3 h-3" />
                      <span className="font-mono truncate flex-1">{sb.engine_url}</span>
                      <a href={sb.engine_url + "/health"} target="_blank" rel="noopener">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      Max {sb.max_sessions} sessions · {sb.max_browser_hours} browser hrs
                    </div>
                  </div>
                )}
                {sb.status === "active" && (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setProvisionResult({ api_key: sb.api_key, engine_url: sb.engine_url })}>
                      <Key className="w-3 h-3 mr-1" /> View Details
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => terminate(sb.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}