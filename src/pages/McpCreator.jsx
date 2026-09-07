import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import CopyBlock from "@/components/CopyBlock";
import {
  Bot, Sparkles, Code2, Globe, Plus, RefreshCw, Check, Copy,
  MessageSquare, Zap, FileText, Wand2, Key, ExternalLink, Trash2
} from "lucide-react";

const clients = [
  { id: "chatgpt", label: "ChatGPT", icon: MessageSquare, desc: "OpenAI ChatGPT custom connectors" },
  { id: "claude", label: "Claude Desktop", icon: Sparkles, desc: "Anthropic Claude Desktop app" },
  { id: "gemini", label: "Gemini", icon: Globe, desc: "Google Gemini extensions" },
  { id: "cursor", label: "Cursor IDE", icon: Code2, desc: "Cursor code editor" },
  { id: "windsurf", label: "Windsurf", icon: Wand2, desc: "Windsurf AI IDE" },
  { id: "generic", label: "Generic MCP", icon: Bot, desc: "Any MCP-compatible client" },
];

const allScopes = [
  { id: "sessions:read", label: "Read Sessions" },
  { id: "sessions:write", label: "Create Sessions" },
  { id: "jobs:read", label: "Read Jobs" },
  { id: "jobs:write", label: "Create Jobs" },
  { id: "scrape:run", label: "Run Scrapers" },
  { id: "clone:run", label: "Clone Websites" },
  { id: "agent:run", label: "Run AI Agents" },
  { id: "sandbox:manage", label: "Manage Sandboxes" },
];

export default function McpCreator() {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [selectedClient, setSelectedClient] = useState("claude");
  const [configName, setConfigName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState(["sessions:read", "sessions:write", "scrape:run"]);

  const load = async () => {
    try {
      const data = await base44.entities.McpConfig.list("-created_date", 50).catch(() => []);
      setConfigs(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const toggleScope = (scope) => {
    setSelectedScopes(prev => prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]);
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await base44.functions.invoke("generateMcpConfig", {
        name: configName || `MCP Config ${new Date().toLocaleDateString()}`,
        target_client: selectedClient,
        scopes: selectedScopes,
      });
      const data = res.data || res;
      setResult(data);
      load();
    } catch (e) { alert(e.response?.data?.error || e.message); }
    finally { setGenerating(false); }
  };

  const revoke = async (id) => {
    if (!confirm("Revoke this MCP configuration?")) return;
    try {
      await base44.entities.McpConfig.update(id, { status: "revoked" });
      load();
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2"><Bot className="w-6 h-6" />MCP Creator</h1>
        <p className="text-muted-foreground mt-1">Connect your AI tools (ChatGPT, Claude, Gemini) to CloudBrowser via Model Context Protocol.</p>
      </div>

      {/* Generated config banner */}
      {result && (
        <Card className="border-emerald-300">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-emerald-600" />
              <span className="font-semibold">MCP Configuration Generated for {result.client_label}</span>
            </div>
            <p className="text-sm text-muted-foreground">{result.instructions}</p>
            {result.api_key && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                <div className="flex items-center gap-2 mb-1">
                  <Key className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-800">Your API key (copy now — shown only once):</span>
                </div>
                <code className="text-xs font-mono break-all">{result.api_key}</code>
              </div>
            )}
            <div>
              <Label className="mb-2 block">Configuration JSON</Label>
              <CopyBlock text={result.config_json} label="MCP config" />
            </div>
            <div>
              <Label className="mb-2 block">MCP Server URL</Label>
              <CopyBlock text={result.mcp_url} label="MCP endpoint" />
            </div>
            <Button variant="outline" size="sm" onClick={() => setResult(null)}>Done</Button>
          </CardContent>
        </Card>
      )}

      {/* Create new config */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Plus className="w-5 h-5" />Create New MCP Connection</CardTitle>
          <CardDescription>Generate an MCP config to connect your AI tool to CloudBrowser.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label className="mb-3 block">Config name</Label>
            <Input value={configName} onChange={(e) => setConfigName(e.target.value)} placeholder="e.g. My Claude Desktop" />
          </div>
          <div>
            <Label className="mb-3 block">Choose your AI tool</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {clients.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedClient(c.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                    selectedClient === c.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/50"
                  }`}
                >
                  <c.icon className={`w-5 h-5 shrink-0 ${selectedClient === c.id ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="min-w-0">
                    <div className="font-medium text-sm">{c.label}</div>
                    <div className="text-xs text-muted-foreground truncate">{c.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="mb-3 block">Permissions (scopes)</Label>
            <div className="flex flex-wrap gap-2">
              {allScopes.map(scope => (
                <button
                  key={scope.id}
                  onClick={() => toggleScope(scope.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                    selectedScopes.includes(scope.id) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  {selectedScopes.includes(scope.id) && <Check className="w-3 h-3 inline mr-1" />}
                  {scope.label}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={generate} disabled={generating} className="w-full">
            {generating ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
            Generate MCP Config
          </Button>
        </CardContent>
      </Card>

      {/* Existing configs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your MCP Connections</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : configs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No MCP connections yet. Create one above to connect your AI tools.</p>
          ) : (
            <div className="space-y-2">
              {configs.map(c => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3 min-w-0">
                    <Bot className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <Badge variant="outline" className="capitalize text-xs">{c.target_client}</Badge>
                        <Badge variant={c.status === "active" ? "default" : "secondary"} className="text-xs">{c.status}</Badge>
                        <span>· {c.usage_count} uses</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => {
                      setResult({ config_json: c.config_json, mcp_url: c.mcp_url, client_label: c.target_client, instructions: "Your saved config:", api_key: null });
                    }}>
                        <Copy className="w-3 h-3" />
                    </Button>
                    {c.status === "active" && (
                      <Button size="sm" variant="ghost" onClick={() => revoke(c.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
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