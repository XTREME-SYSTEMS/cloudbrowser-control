import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Check, Plug, Key, Globe, ListChecks, DollarSign, AlertCircle, ShieldCheck } from "lucide-react";

const GATEWAY_PATH = "/api/functions/cloudBrowserGatewayV6";
const MCP_PATH = "/api/functions/mcpTools";

const SCOPES = [
  { scope: "sessions:read", desc: "List sessions, get session details, screenshots, cookies" },
  { scope: "sessions:write", desc: "Create/close sessions, execute actions, keep-alive" },
  { scope: "jobs:read", desc: "List jobs, get job status and results" },
  { scope: "jobs:write", desc: "Create jobs, trigger job runs" },
  { scope: "projects:read", desc: "List projects" },
];

const RATE_LIMITS = [
  { label: "Requests per minute (per API key)", value: "60 (default, configurable)" },
  { label: "Concurrent sessions per project", value: "10 (default)" },
  { label: "Concurrent sessions per store", value: "5 (default)" },
  { label: "Session creations per minute per store", value: "20" },
  { label: "Max batch session creation", value: "20 sessions" },
  { label: "Session idle TTL", value: "5 min (extend with keepalive)" },
  { label: "Max steps per job", value: "100" },
  { label: "Max job duration", value: "30 min" },
];

const COSTS = [
  { resource: "Browser compute", rate: "$0.005 / min" },
  { resource: "LLM (ai_extract)", rate: "$0.02 / call" },
  { resource: "File storage", rate: "$0.02 / GB / month" },
  { resource: "Proxy bandwidth", rate: "$2.00 / GB" },
];

const ACTION_TYPES = [
  "goto", "back", "forward", "reload", "wait_for_selector", "wait_for_load_state", "wait_for_timeout",
  "click", "hover", "type", "fill", "press", "select_option", "scroll", "drag_and_drop",
  "upload_file", "download", "handle_dialog", "new_tab", "switch_tab", "close_tab", "frame_switch",
  "screenshot", "pdf", "extract_text", "extract_html", "extract_attribute", "extract_table",
  "extract_json", "ai_extract", "evaluate", "set_cookies", "import_cookies", "export_cookies",
  "set_headers", "set_local_storage", "capture_response", "solve_captcha", "mock_response",
  "save_state", "restore_state", "crawl", "paginate",
];

const MCP_TOOLS = [
  { tool: "browser_start", scope: "sessions:write", desc: "Create a browser session" },
  { tool: "browser_end", scope: "sessions:write", desc: "Close a session" },
  { tool: "browser_navigate", scope: "sessions:write", desc: "Navigate to a URL" },
  { tool: "browser_act", scope: "sessions:write", desc: "Execute any browser action" },
  { tool: "browser_observe", scope: "sessions:read", desc: "Run JS and return page state" },
  { tool: "browser_extract", scope: "sessions:read", desc: "Extract text/HTML/attribute/table/JSON" },
  { tool: "browser_screenshot", scope: "sessions:read", desc: "Screenshot (returns a URL)" },
  { tool: "browser_list_tabs", scope: "sessions:read", desc: "List open tabs" },
  { tool: "browser_switch_tab", scope: "sessions:write", desc: "Switch to a tab" },
  { tool: "context_create", scope: "sessions:write", desc: "Create persistent browser context" },
  { tool: "context_use", scope: "sessions:read", desc: "Lease a context for a session" },
  { tool: "context_delete", scope: "sessions:write", desc: "Delete a context" },
  { tool: "artifact_get", scope: "sessions:read", desc: "Retrieve artifact metadata" },
];

const GATEWAY_ROUTES = [
  { method: "GET", path: "/health", scope: "none", desc: "Health check" },
  { method: "POST", path: "/sessions", scope: "sessions:write", desc: "Create session (full geo/proxy config)" },
  { method: "POST", path: "/sessions/batch", scope: "sessions:write", desc: "Create up to 20 sessions" },
  { method: "GET", path: "/sessions", scope: "sessions:read", desc: "List sessions (project-scoped)" },
  { method: "GET", path: "/sessions/:id", scope: "sessions:read", desc: "Get session details" },
  { method: "POST", path: "/sessions/:id/action", scope: "sessions:write", desc: "Execute a browser action" },
  { method: "POST", path: "/sessions/:id/keepalive", scope: "sessions:write", desc: "Extend session TTL" },
  { method: "GET", path: "/sessions/:id/cookies", scope: "sessions:read", desc: "Export cookies" },
  { method: "POST", path: "/sessions/:id/cookies", scope: "sessions:write", desc: "Import cookies" },
  { method: "GET", path: "/sessions/:id/screenshot", scope: "sessions:read", desc: "Screenshot (returns base64)" },
  { method: "DELETE", path: "/sessions/:id", scope: "sessions:write", desc: "Close session" },
  { method: "POST", path: "/jobs", scope: "jobs:write", desc: "Create a multi-step job" },
  { method: "POST", path: "/jobs/:id/run", scope: "jobs:write", desc: "Execute a job (async, 202)" },
  { method: "GET", path: "/jobs/:id", scope: "jobs:read", desc: "Get job status" },
  { method: "GET", path: "/jobs/:id/results", scope: "jobs:read", desc: "Get job results" },
  { method: "GET", path: "/projects", scope: "projects:read", desc: "List projects" },
];

function CopyBlock({ text, language = "json" }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="relative group">
      <pre className="p-3 rounded-md bg-muted text-xs font-mono overflow-x-auto border">{text}</pre>
      <Button size="sm" variant="ghost" className="absolute top-1 right-1 opacity-60 group-hover:opacity-100" onClick={copy}>
        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      </Button>
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Icon className="w-5 h-5" />{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">{children}</CardContent>
    </Card>
  );
}

export default function ConnectionInfo() {
  const appOrigin = typeof window !== "undefined" ? window.location.origin : "https://<your-app>.base44.app";
  const gatewayUrl = appOrigin + GATEWAY_PATH;
  const mcpUrl = appOrigin + MCP_PATH;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold flex items-center gap-2"><Plug className="w-6 h-6" />Connection Info</h1>
        <p className="text-muted-foreground mt-1">Everything you need to connect an external app to this browser automation system. Endpoints, auth, scopes, examples, rate limits, and costs — all in one place.</p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="auth">Auth & Keys</TabsTrigger>
          <TabsTrigger value="gateway">Gateway REST</TabsTrigger>
          <TabsTrigger value="mcp">MCP Tools</TabsTrigger>
          <TabsTrigger value="examples">Examples</TabsTrigger>
          <TabsTrigger value="limits">Limits & Costs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <Section icon={Globe} title="API Endpoints">
            <div className="space-y-2">
              <div>
                <span className="text-muted-foreground">Gateway (REST, full control):</span>
                <CopyBlock text={gatewayUrl} />
              </div>
              <div>
                <span className="text-muted-foreground">MCP Tools (agent-friendly):</span>
                <CopyBlock text={mcpUrl} />
              </div>
              <p className="text-xs text-muted-foreground">Both are Base44 backend functions exposed as public HTTPS endpoints. All requests are <code>POST</code> with a JSON body.</p>
            </div>
          </Section>
          <Section icon={Key} title="Authentication Summary">
            <p>Bearer token (API key). Keys are prefixed <code>cb_live_</code> (production) or <code>cb_test_</code> (test). Passed as <code>Authorization: Bearer cb_live_...</code> header or <code>api_key</code> body field. Keys are SHA-256 hashed at rest; plaintext shown only once at creation.</p>
            <p className="text-xs text-muted-foreground">Create keys in <Link to="/projects" className="underline">Projects</Link> or Settings → API Keys.</p>
          </Section>
          <Section icon={ShieldCheck} title="Security">
            <ul className="list-disc pl-5 space-y-1">
              <li>Gateway is public HTTPS; the browser engine is internal-only.</li>
              <li>All secrets (proxy passwords, webhook secrets, cookies) encrypted at rest (AES-GCM).</li>
              <li>Use a dedicated API key per project for hard tenant isolation.</li>
              <li>Advanced stealth fingerprinting (WebGL, Canvas, AudioContext, WebRTC) is automatic.</li>
              <li>Optional IP allowlist configurable in Settings → System.</li>
            </ul>
          </Section>
        </TabsContent>

        <TabsContent value="auth" className="space-y-4 mt-4">
          <Section icon={Key} title="API Key Authentication">
            <p>Every request must include an API key. Two ways to pass it:</p>
            <CopyBlock text={`Authorization: Bearer cb_live_<64hex>`} />
            <p className="text-xs text-muted-foreground">— or in the JSON body —</p>
            <CopyBlock text={`{ "api_key": "cb_live_<64hex>", ... }`} />
          </Section>
          <Section icon={ListChecks} title="Scopes">
            <p>Each API key is granted a set of scopes. Bind a key to a Project for tenant isolation.</p>
            <div className="border rounded-md">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr><th className="text-left p-2 font-medium">Scope</th><th className="text-left p-2 font-medium">Allows</th></tr>
                </thead>
                <tbody>
                  {SCOPES.map((s) => (
                    <tr key={s.scope} className="border-t">
                      <td className="p-2 font-mono">{s.scope}</td>
                      <td className="p-2 text-muted-foreground">{s.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </TabsContent>

        <TabsContent value="gateway" className="space-y-4 mt-4">
          <Section icon={Globe} title="Gateway REST Routes">
            <p>The gateway accepts <code>{`{ path, method, data, api_key }`}</code> in the body and routes internally.</p>
            <div className="border rounded-md overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr><th className="text-left p-2 font-medium">Method</th><th className="text-left p-2 font-medium">Path</th><th className="text-left p-2 font-medium">Scope</th><th className="text-left p-2 font-medium">Description</th></tr>
                </thead>
                <tbody>
                  {GATEWAY_ROUTES.map((r) => (
                    <tr key={r.method + r.path} className="border-t">
                      <td className="p-2 font-mono">{r.method}</td>
                      <td className="p-2 font-mono">{r.path}</td>
                      <td className="p-2 font-mono text-muted-foreground">{r.scope}</td>
                      <td className="p-2 text-muted-foreground">{r.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
          <Section icon={ListChecks} title="Supported Action Types (for /sessions/:id/action)">
            <div className="flex flex-wrap gap-1">
              {ACTION_TYPES.map((a) => (
                <span key={a} className="px-2 py-0.5 rounded bg-muted text-xs font-mono">{a}</span>
              ))}
            </div>
          </Section>
        </TabsContent>

        <TabsContent value="mcp" className="space-y-4 mt-4">
          <Section icon={Plug} title="MCP Tools Surface">
            <p>The simpler, agent-friendly API. Body: <code>{`{ tool, params, api_key }`}</code>.</p>
            <div className="border rounded-md overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted">
                  <tr><th className="text-left p-2 font-medium">Tool</th><th className="text-left p-2 font-medium">Scope</th><th className="text-left p-2 font-medium">Description</th></tr>
                </thead>
                <tbody>
                  {MCP_TOOLS.map((t) => (
                    <tr key={t.tool} className="border-t">
                      <td className="p-2 font-mono">{t.tool}</td>
                      <td className="p-2 font-mono text-muted-foreground">{t.scope}</td>
                      <td className="p-2 text-muted-foreground">{t.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-amber-600 flex items-start gap-1"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />Note: MCP <code>browser_start</code> forwards viewport + user_agent only. For geolocation/proxy/timezone, create the session via the Gateway <code>POST /sessions</code> route, then use MCP tools to drive it.</p>
          </Section>
        </TabsContent>

        <TabsContent value="examples" className="space-y-4 mt-4">
          <Section icon={Globe} title="Create a Geo-Targeted Session (Gateway)">
            <CopyBlock text={`POST ${gatewayUrl}
Authorization: Bearer cb_live_...
Content-Type: application/json

{
  "path": "/sessions",
  "method": "POST",
  "data": {
    "viewport": { "width": 1920, "height": 1080 },
    "geolocation": { "latitude": 32.7767, "longitude": -96.7970, "accuracy": 100 },
    "locale": "en-US",
    "timezone": "America/Chicago",
    "proxy": { "server": "http://tx.proxy:8080", "username": "u", "password": "p" },
    "blocked_resources": ["image", "font", "media"],
    "use_pool": true,
    "store_id": "store-tx"
  }
}`} />
          </Section>
          <Section icon={Plug} title="Navigate + Extract SERP (MCP)">
            <CopyBlock text={`POST ${mcpUrl}
Authorization: Bearer cb_live_...
Content-Type: application/json

{
  "tool": "browser_navigate",
  "params": { "session_id": "sess_abc123", "url": "https://www.google.com/search?q=concrete+polishing" }
}`} />
            <CopyBlock text={`{
  "tool": "browser_act",
  "params": {
    "session_id": "sess_abc123",
    "action_type": "evaluate",
    "options": { "fn": "() => { const r=[]; document.querySelectorAll('#search .g').forEach((el,i)=>{const t=el.querySelector('h3'),l=el.querySelector('a[href]');if(t&&l)r.push({position:i+1,title:t.innerText,url:l.href,domain:new URL(l.href).hostname});});return r; }" }
  }
}`} />
          </Section>
          <Section icon={Plug} title="Close Session (MCP)">
            <CopyBlock text={`{
  "tool": "browser_end",
  "params": { "session_id": "sess_abc123" }
}`} />
          </Section>
        </TabsContent>

        <TabsContent value="limits" className="space-y-4 mt-4">
          <Section icon={ListChecks} title="Rate Limits & Concurrency">
            <div className="border rounded-md">
              <table className="w-full text-xs">
                <tbody>
                  {RATE_LIMITS.map((r) => (
                    <tr key={r.label} className="border-b last:border-0">
                      <td className="p-2 font-medium">{r.label}</td>
                      <td className="p-2 text-muted-foreground text-right">{r.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">429 responses include <code>X-RateLimit-Remaining</code>, <code>X-RateLimit-Reset</code>, and <code>Retry-After</code> headers.</p>
          </Section>
          <Section icon={DollarSign} title="Cost Model">
            <div className="border rounded-md">
              <table className="w-full text-xs">
                <thead className="bg-muted"><tr><th className="text-left p-2 font-medium">Resource</th><th className="text-left p-2 font-medium">Rate</th></tr></thead>
                <tbody>
                  {COSTS.map((c) => (
                    <tr key={c.resource} className="border-t">
                      <td className="p-2">{c.resource}</td>
                      <td className="p-2 font-mono">{c.rate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">Typical SERP check: ~$0.002. Typical AI citation check: ~$0.005.</p>
          </Section>
          <Section icon={AlertCircle} title="Error Handling">
            <div className="border rounded-md">
              <table className="w-full text-xs">
                <thead className="bg-muted"><tr><th className="text-left p-2 font-medium">HTTP</th><th className="text-left p-2 font-medium">Meaning</th></tr></thead>
                <tbody>
                  <tr className="border-t"><td className="p-2 font-mono">400</td><td className="p-2 text-muted-foreground">Bad params</td></tr>
                  <tr className="border-t"><td className="p-2 font-mono">401</td><td className="p-2 text-muted-foreground">Missing/invalid key</td></tr>
                  <tr className="border-t"><td className="p-2 font-mono">403</td><td className="p-2 text-muted-foreground">IP not allowlisted / insufficient scope</td></tr>
                  <tr className="border-t"><td className="p-2 font-mono">404</td><td className="p-2 text-muted-foreground">Session not found / expired TTL</td></tr>
                  <tr className="border-t"><td className="p-2 font-mono">429</td><td className="p-2 text-muted-foreground">Rate limit / concurrency quota</td></tr>
                  <tr className="border-t"><td className="p-2 font-mono">502</td><td className="p-2 text-muted-foreground">Engine upstream failure (retry)</td></tr>
                  <tr className="border-t"><td className="p-2 font-mono">503</td><td className="p-2 text-muted-foreground">Engine not configured / max sessions</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">Retry transient errors (timeout, 502, 503) with exponential backoff: 1s, 2s, 4s.</p>
          </Section>
        </TabsContent>
      </Tabs>
    </div>
  );
}