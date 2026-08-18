import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Code2, Terminal, Copy, Check, Key } from "lucide-react";

const ENDPOINTS = [
  { method: "GET", path: "/health", scope: "—", desc: "Check API and engine health", params: [], response: '{ "status": "ok", "timestamp": "..." }' },
  { method: "GET", path: "/sessions", scope: "sessions:read", desc: "List all browser sessions", params: [], response: '{ "sessions": [...] }' },
  { method: "POST", path: "/sessions", scope: "sessions:write", desc: "Create a new browser session", params: [{ name: "target_url", type: "string", req: false }, { name: "viewport", type: "object", req: false }, { name: "proxy_id", type: "string", req: false }, { name: "timeout_ms", type: "number", req: false }], response: '{ "session": { "id": "...", "status": "pending" } }' },
  { method: "GET", path: "/sessions/:id", scope: "sessions:read", desc: "Get a specific session", params: [], response: '{ "session": {...} }' },
  { method: "POST", path: "/sessions/:id/action", scope: "sessions:write", desc: "Execute a browser action on a session", params: [{ name: "action_type", type: "string", req: true }, { name: "selector", type: "string", req: false }, { name: "value", type: "string", req: false }], response: '{ "success": true }' },
  { method: "DELETE", path: "/sessions/:id", scope: "sessions:write", desc: "End a browser session", params: [], response: '{ "success": true }' },
  { method: "GET", path: "/jobs", scope: "jobs:read", desc: "List all automation jobs", params: [], response: '{ "jobs": [...] }' },
  { method: "POST", path: "/jobs", scope: "jobs:write", desc: "Create a new automation job with steps", params: [{ name: "name", type: "string", req: true }, { name: "start_url", type: "string", req: true }, { name: "steps", type: "array", req: false }], response: '{ "job": { "id": "...", "status": "queued" } }' },
  { method: "POST", path: "/jobs/:id/run", scope: "jobs:write", desc: "Trigger job execution", params: [], response: '{ "status": "completed" }' },
  { method: "GET", path: "/jobs/:id/results", scope: "jobs:read", desc: "Get extracted results from a job", params: [], response: '{ "results": [...] }' },
  { method: "GET", path: "/projects", scope: "projects:read", desc: "List all projects", params: [], response: '{ "projects": [...] }' },
];

const METHOD_COLORS = {
  GET: "bg-blue-100 text-blue-700",
  POST: "bg-green-100 text-green-700",
  DELETE: "bg-red-100 text-red-700",
};

function buildSnippet(lang, ep, apiKey) {
  const gatewayUrl = "https://your-app.base44.app/api/functions/apiGateway";
  const body = JSON.stringify({ api_key: apiKey || "cb_live_...", path: ep.path, method: ep.method, data: {} }, null, 2);

  if (lang === "curl") {
    return `curl -X POST ${gatewayUrl} \\\n  -H "Content-Type: application/json" \\\n  -d '${body}'`;
  }
  if (lang === "python") {
    return `import requests\n\nresp = requests.post(\n    "${gatewayUrl}",\n    json=${body.replace(/"cb_live_\.\.\."/, '"cb_live_..."')}\n)\nprint(resp.json())`;
  }
  if (lang === "node") {
    return `const res = await fetch("${gatewayUrl}", {\n  method: "POST",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify(${body})\n});\nconst data = await res.json();\nconsole.log(data);`;
  }
  return "";
}

export default function ApiDocs() {
  const [selected, setSelected] = useState(ENDPOINTS[0]);
  const [apiKey, setApiKey] = useState("");
  const [copied, setCopied] = useState(false);

  const copy = (text) => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-heading font-bold flex items-center gap-2"><Code2 className="w-7 h-7" />API Documentation</h1>
        <p className="text-muted-foreground mt-1">REST API for integrating CloudBrowser into your systems</p>
      </div>

      {/* Auth info */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Key className="w-4 h-4" />Authentication</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">All requests are made to the API Gateway endpoint with your API key in the request body. Generate keys in Settings → API & Projects.</p>
          <div className="flex gap-2 items-center">
            <input className="flex-1 px-3 py-1.5 rounded-md border bg-transparent text-sm font-mono" placeholder="Paste your API key to auto-fill snippets" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
          </div>
          <div className="p-3 rounded-md bg-muted/50 text-xs font-mono overflow-x-auto">
            <span className="text-muted-foreground">POST</span> https://your-app.base44.app/api/functions/apiGateway
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Endpoint list */}
        <div className="lg:col-span-1 space-y-1">
          {ENDPOINTS.map((ep) => (
            <button key={ep.method + ep.path} onClick={() => setSelected(ep)} className={`w-full text-left p-2.5 rounded-md border transition-colors ${selected.path === ep.path && selected.method === ep.method ? "bg-primary/5 border-primary" : "border-transparent hover:bg-muted/50"}`}>
              <div className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${METHOD_COLORS[ep.method]}`}>{ep.method}</span>
                <code className="text-xs sm:text-sm font-mono truncate">{ep.path}</code>
              </div>
            </button>
          ))}
        </div>

        {/* Endpoint detail */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-xs font-bold ${METHOD_COLORS[selected.method]}`}>{selected.method}</span>
                <code className="text-lg font-mono">{selected.path}</code>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{selected.desc}</p>
              <div className="flex items-center gap-2 mt-1"><span className="text-xs text-muted-foreground">Required scope:</span><code className="text-xs px-1.5 py-0.5 rounded bg-muted">{selected.scope}</code></div>
            </CardHeader>
            {selected.params.length > 0 && (
              <CardContent>
                <h4 className="text-sm font-medium mb-2">Parameters</h4>
                <div className="space-y-1">
                  {selected.params.map((p) => (
                    <div key={p.name} className="flex items-center gap-2 text-sm">
                      <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted">{p.name}</code>
                      <span className="text-muted-foreground text-xs">{p.type}</span>
                      {p.req ? <span className="text-xs text-red-500">required</span> : <span className="text-xs text-muted-foreground">optional</span>}
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>

          {/* Code snippets */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Terminal className="w-4 h-4" />Code Example</CardTitle></CardHeader>
            <CardContent>
              <Tabs defaultValue="curl">
                <TabsList><TabsTrigger value="curl">curl</TabsTrigger><TabsTrigger value="python">Python</TabsTrigger><TabsTrigger value="node">Node.js</TabsTrigger></TabsList>
                {["curl", "python", "node"].map((lang) => (
                  <TabsContent key={lang} value={lang} className="relative">
                    <Button size="icon" variant="ghost" className="absolute top-2 right-2" onClick={() => copy(buildSnippet(lang, selected, apiKey))}>
                      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </Button>
                    <pre className="p-4 rounded-md bg-slate-900 text-slate-100 text-xs sm:text-sm overflow-x-auto font-mono">{buildSnippet(lang, selected, apiKey)}</pre>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>

          {/* Response */}
          <Card>
            <CardHeader><CardTitle className="text-base">Response</CardTitle></CardHeader>
            <CardContent><pre className="p-4 rounded-md bg-muted text-xs sm:text-sm overflow-x-auto font-mono">{selected.response}</pre></CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}