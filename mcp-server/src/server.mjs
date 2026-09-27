import { createServer } from "node:http";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { toNodeHandler } from "@modelcontextprotocol/node";
import * as z from "zod/v4";
import { bearerAuthorized } from "./auth.mjs";
import { createOAuthManager, OAUTH_SCOPE } from "./oauth.mjs";
import { EngineClient, EngineError } from "./engine-client.mjs";

const PORT = Number(process.env.PORT || process.env.MCP_PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const MCP_ROUTE = "/mcp";
const MCP_KEY = process.env.CLOUD_BROWSER_MCP_KEY || "";
const ENGINE_URL = process.env.BROWSER_ENGINE_URL || "";
const ENGINE_KEY = process.env.ENGINE_API_KEY || "";
const ALLOWED_ORIGINS = new Set((process.env.MCP_ALLOWED_ORIGINS || "").split(",").map(v => v.trim()).filter(Boolean));
const ALLOWED_HOSTS = new Set((process.env.MCP_ALLOWED_HOSTS || "").split(",").map(v => v.trim().toLowerCase()).filter(Boolean));
const oauth = createOAuthManager({
  issuer: process.env.OAUTH_ISSUER_URL || "",
  signingSeed: MCP_KEY,
  setupUntil: process.env.OAUTH_SETUP_UNTIL || "",
});
const TOOL_AUTH_META = { securitySchemes: [{ type: "oauth2", scopes: [OAUTH_SCOPE] }] };
const SENSITIVE_ENGINE_ACTIONS = new Set(["export_cookies", "save_state", "restore_state"]);

if (MCP_KEY.length < 24) {
  console.error("FATAL: CLOUD_BROWSER_MCP_KEY must be set to a strong value (>=24 characters).");
  process.exit(1);
}
if (!ENGINE_URL) {
  console.error("FATAL: BROWSER_ENGINE_URL is required.");
  process.exit(1);
}
if (ENGINE_KEY.length < 16) {
  console.error("FATAL: ENGINE_API_KEY must be set to a strong value (>=16 characters).");
  process.exit(1);
}

function newEngineClient() {
  return new EngineClient({ baseUrl: ENGINE_URL, apiKey: ENGINE_KEY });
}

function textResult(data, isError = false) {
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return { content: [{ type: "text", text }], ...(isError ? { isError: true } : {}) };
}

function structuredResult(data) {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  };
}

async function toolCall(fn) {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof EngineError) {
      return textResult({ error: error.message, engine_status: error.status }, true);
    }
    return textResult({ error: error.message || "Unexpected error" }, true);
  }
}

function buildMcpServer() {
  const server = new McpServer(
    { name: "xtreme-cloud-browser", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.registerTool(
    "browser_health",
    { description: "Check the canonical Cloud Browser engine health and runtime identity.", _meta: TOOL_AUTH_META },
    async () => toolCall(async () => structuredResult(await newEngineClient().health()))
  );

  server.registerTool(
    "browser_start",
    {
      description: "Create a new isolated browser session. The returned session_id is the canonical handle for later calls.",
      _meta: TOOL_AUTH_META,
      inputSchema: z.object({
        use_pool: z.boolean().optional(),
        record_video: z.boolean().optional(),
        blocked_resources: z.array(z.string()).optional(),
        user_agent: z.string().optional(),
        viewport_width: z.number().int().positive().optional(),
        viewport_height: z.number().int().positive().optional(),
      }),
    },
    async (args) => toolCall(async () => {
      const payload = {
        usePool: args.use_pool,
        recordVideo: args.record_video,
        blockedResources: args.blocked_resources,
        userAgent: args.user_agent,
        viewport: args.viewport_width && args.viewport_height
          ? { width: args.viewport_width, height: args.viewport_height }
          : undefined,
      };
      Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
      const data = await newEngineClient().start(payload);
      return structuredResult({ ...data, session_id: data.sessionId || data.session_id });
    })
  );

  server.registerTool(
    "browser_status",
    {
      description: "Read the current state, URL, title and recent runtime metadata for a browser session.",
      _meta: TOOL_AUTH_META,
      inputSchema: z.object({ session_id: z.string().min(1) }),
    },
    async ({ session_id }) => toolCall(async () => structuredResult(await newEngineClient().status(session_id)))
  );

  server.registerTool(
    "browser_navigate",
    {
      description: "Navigate an existing browser session to an http/https URL.",
      _meta: TOOL_AUTH_META,
      inputSchema: z.object({
        session_id: z.string().min(1),
        url: z.string().url(),
        wait_until: z.enum(["load", "domcontentloaded", "networkidle", "commit"]).optional(),
        timeout_ms: z.number().int().positive().max(120000).optional(),
      }),
    },
    async ({ session_id, url, wait_until, timeout_ms }) => toolCall(async () => structuredResult(
      await newEngineClient().execute(session_id, {
        action_type: "goto",
        value: url,
        options: {
          ...(wait_until ? { waitUntil: wait_until } : {}),
          ...(timeout_ms ? { timeout: timeout_ms } : {}),
        },
      })
    ))
  );

  server.registerTool(
    "browser_observe",
    {
      description: "Observe an existing browser session without changing page state. Returns URL, title and bounded visible text.",
      _meta: TOOL_AUTH_META,
      inputSchema: z.object({
        session_id: z.string().min(1),
        max_chars: z.number().int().positive().max(50000).default(20000),
      }),
    },
    async ({ session_id, max_chars }) => toolCall(async () => {
      const engine = newEngineClient();
      const body = await engine.execute(session_id, { action_type: "extract_text", selector: "body", options: {} });
      const status = await engine.status(session_id);
      const rawText = String(body?.data || "");
      return structuredResult({
        session_id,
        url: body?.url || status?.url || null,
        title: body?.title || status?.title || null,
        text: rawText.slice(0, max_chars),
        truncated: rawText.length > max_chars,
      });
    })
  );

  server.registerTool(
    "browser_execute",
    {
      description: "Execute one canonical browser-engine action on an existing session. Use for click, fill, press, wait, extraction, cookies, crawl, pagination and other supported engine actions.",
      _meta: TOOL_AUTH_META,
      inputSchema: z.object({
        session_id: z.string().min(1),
        action_type: z.string().min(1),
        selector: z.string().optional(),
        value: z.any().optional(),
        options: z.record(z.string(), z.any()).optional(),
      }),
    },
    async ({ session_id, action_type, selector, value, options }) => toolCall(async () => {
      if (SENSITIVE_ENGINE_ACTIONS.has(action_type)) {
        return textResult({ error: `Action ${action_type} is intentionally not exposed through MCP because it can disclose or replay authentication state.` }, true);
      }
      return structuredResult(await newEngineClient().execute(session_id, {
        action_type,
        ...(selector !== undefined ? { selector } : {}),
        ...(value !== undefined ? { value } : {}),
        options: options || {},
      }));
    })
  );

  server.registerTool(
    "browser_extract",
    {
      description: "Extract text, HTML, an attribute, a table or JSON from the active page.",
      _meta: TOOL_AUTH_META,
      inputSchema: z.object({
        session_id: z.string().min(1),
        mode: z.enum(["text", "html", "attribute", "table", "json"]),
        selector: z.string().min(1),
        attribute: z.string().optional(),
      }),
    },
    async ({ session_id, mode, selector, attribute }) => toolCall(async () => {
      const actionMap = {
        text: "extract_text",
        html: "extract_html",
        attribute: "extract_attribute",
        table: "extract_table",
        json: "extract_json",
      };
      return structuredResult(await newEngineClient().execute(session_id, {
        action_type: actionMap[mode],
        selector,
        options: attribute ? { attribute } : {},
      }));
    })
  );

  server.registerTool(
    "browser_screenshot",
    {
      description: "Capture the current browser viewport as PNG.",
      _meta: TOOL_AUTH_META,
      inputSchema: z.object({ session_id: z.string().min(1) }),
    },
    async ({ session_id }) => toolCall(async () => {
      const data = await newEngineClient().screenshot(session_id);
      if (!data?.base64) return textResult({ error: "Engine did not return screenshot data" }, true);
      return {
        content: [
          { type: "image", data: data.base64, mimeType: data.mimeType || "image/png" },
          { type: "text", text: JSON.stringify({ session_id, url: data.url || null, title: data.title || null }) },
        ],
      };
    })
  );

  server.registerTool(
    "browser_keepalive",
    {
      description: "Extend an active browser session's idle lifetime.",
      _meta: TOOL_AUTH_META,
      inputSchema: z.object({ session_id: z.string().min(1) }),
    },
    async ({ session_id }) => toolCall(async () => structuredResult(await newEngineClient().keepalive(session_id)))
  );

  server.registerTool(
    "browser_end",
    {
      description: "Close a browser session. This operation is idempotent.",
      _meta: TOOL_AUTH_META,
      inputSchema: z.object({ session_id: z.string().min(1) }),
    },
    async ({ session_id }) => toolCall(async () => structuredResult(await newEngineClient().end(session_id)))
  );

  return server;
}

const mcpHandler = createMcpHandler(buildMcpServer, { legacy: "stateless" });
const nodeMcpHandler = toNodeHandler(mcpHandler);

function reject(res, status, body, headers = {}) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers });
  res.end(JSON.stringify(body));
}

function sendHtml(res, status, body, headers = {}) {
  res.writeHead(status, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", ...headers });
  res.end(body);
}

async function readForm(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk.toString("utf8");
    if (body.length > 65536) throw new Error("Request body too large");
  }
  return new URLSearchParams(body);
}

function requestAllowed(req) {
  const rawHost = String(req.headers.host || "").toLowerCase();
  const host = rawHost.split(":")[0];
  if (ALLOWED_HOSTS.size && !ALLOWED_HOSTS.has(host)) return { ok: false, status: 421, error: "Host not allowed" };
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.size && !ALLOWED_ORIGINS.has(String(origin))) return { ok: false, status: 403, error: "Origin not allowed" };
  return { ok: true };
}

const httpServer = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cache-Control", "no-store");

  if (url.pathname === "/.well-known/oauth-protected-resource" || url.pathname === "/.well-known/oauth-protected-resource/mcp") {
    if (!oauth.configured) return reject(res, 404, { error: "OAuth not configured" });
    return reject(res, 200, oauth.resourceMetadata());
  }

  if (url.pathname === "/.well-known/oauth-authorization-server") {
    if (!oauth.configured) return reject(res, 404, { error: "OAuth not configured" });
    return reject(res, 200, oauth.authorizationServerMetadata());
  }

  if (url.pathname === "/oauth/authorize") {
    if (!oauth.configured) return reject(res, 404, { error: "OAuth not configured" });
    if (req.method === "GET") {
      const page = oauth.authorizationPage(url.searchParams);
      return sendHtml(res, page.status, page.body);
    }
    if (req.method === "POST") {
      try {
        const approved = oauth.approveAuthorization(await readForm(req));
        if (!approved.ok) return reject(res, approved.status, { error: approved.error });
        res.writeHead(302, { location: approved.location, "cache-control": "no-store" });
        return res.end();
      } catch {
        return reject(res, 400, { error: "invalid_request" });
      }
    }
    return reject(res, 405, { error: "method_not_allowed" });
  }

  if (url.pathname === "/oauth/token") {
    if (!oauth.configured) return reject(res, 404, { error: "OAuth not configured" });
    if (req.method !== "POST") return reject(res, 405, { error: "method_not_allowed" });
    try {
      const issued = oauth.issueTokens(await readForm(req));
      if (!issued.ok) return reject(res, issued.status, { error: issued.error });
      return reject(res, 200, issued.body);
    } catch {
      return reject(res, 400, { error: "invalid_request" });
    }
  }

  if (url.pathname === "/healthz") {
    try {
      const engine = await newEngineClient().health();
      return reject(res, 200, {
        ok: true,
        service: "xtreme-cloud-browser-mcp",
        mcp_route: MCP_ROUTE,
        engine: {
          ok: engine?.ok === true,
          status: engine?.status || null,
          version: engine?.engine_version || null,
          worker_id: engine?.worker_id || null,
        },
        oauth: {
          configured: oauth.configured,
          setup_open: oauth.setupOpen(),
        },
      });
    } catch (error) {
      return reject(res, 503, { ok: false, service: "xtreme-cloud-browser-mcp", engine: "unreachable", error: error.message });
    }
  }

  if (url.pathname !== MCP_ROUTE) return reject(res, 404, { error: "Not found" });

  const gate = requestAllowed(req);
  if (!gate.ok) return reject(res, gate.status, { error: gate.error });

  if (!bearerAuthorized(req.headers.authorization, MCP_KEY) && !oauth.accessAuthorized(req.headers.authorization)) {
    const challenge = oauth.configured
      ? `Bearer resource_metadata="${oauth.issuer}/.well-known/oauth-protected-resource", scope="${OAUTH_SCOPE}"`
      : 'Bearer realm="xtreme-cloud-browser-mcp"';
    return reject(
      res,
      401,
      { error: "Unauthorized" },
      { "www-authenticate": challenge }
    );
  }

  try {
    await nodeMcpHandler(req, res);
  } catch (error) {
    if (!res.headersSent) return reject(res, 500, { error: "MCP request failed" });
    res.end();
  }
});

httpServer.listen(PORT, HOST, () => {
  console.error(`Xtreme Cloud Browser MCP listening on http://${HOST}:${PORT}${MCP_ROUTE}`);
});

async function shutdown(signal) {
  console.error(`${signal}: shutting down Xtreme Cloud Browser MCP`);
  httpServer.close();
  try { await mcpHandler.close?.(); } catch {}
  setTimeout(() => process.exit(0), 1000).unref();
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
