/**
 * DEEP Clone Template Catalog
 * Reference engine code library for backend reconstruction.
 * Contains stack signatures, route templates, and mock logic generators
 * used by reconstructBackend to infer unclonable server-side logic.
 */

// ═══════════════════════════════════════════
// Stack Signatures — fingerprint response headers/URLs to identify the stack
// ═══════════════════════════════════════════

export interface StackSignature {
  stackType: "NextjsAPI" | "NodeExpress" | "PythonFastAPI" | "RubyRails" | "UnknownREST";
  headerPatterns: Record<string, RegExp>;
  urlPatterns: RegExp[];
  description: string;
}

export const STACK_SIGNATURES: StackSignature[] = [
  {
    stackType: "NextjsAPI",
    headerPatterns: {
      "x-powered-by": /next\.js/i,
      "server": /next/i,
    },
    urlPatterns: [
      /\/_next\/data\//,
      /\/_next\/static\//,
      /\/api\/.*\?_vercel=/,
    ],
    description: "Next.js with API routes or server actions",
  },
  {
    stackType: "NodeExpress",
    headerPatterns: {
      "x-powered-by": /express/i,
    },
    urlPatterns: [
      /\/api\/v\d+\//,
    ],
    description: "Node.js with Express framework",
  },
  {
    stackType: "PythonFastAPI",
    headerPatterns: {
      "server": /uvicorn|gunicorn/i,
    },
    urlPatterns: [
      /\/docs$/,
      /\/openapi\.json$/,
      /\/api\/v\d+\//,
    ],
    description: "Python FastAPI with Uvicorn/Gunicorn",
  },
  {
    stackType: "RubyRails",
    headerPatterns: {
      "x-powered-by": /phusion passenger|rails/i,
      "server": /nginx.*passenger/i,
    },
    urlPatterns: [
      /\/rails\//,
      /\.(json|xml)$/,
    ],
    description: "Ruby on Rails with Passenger",
  },
];

/**
 * Fingerprint the infrastructure stack from captured HTTP transactions.
 */
export function deduceInfrastructureStack(
  xhrLog: Array<{ url: string; responseHeaders?: Record<string, string> }>
): StackSignature["stackType"] {
  for (const tx of xhrLog) {
    for (const sig of STACK_SIGNATURES) {
      // Check header patterns
      if (tx.responseHeaders) {
        for (const [header, pattern] of Object.entries(sig.headerPatterns)) {
          const val = tx.responseHeaders[header] || tx.responseHeaders[header.toLowerCase()] || "";
          if (pattern.test(val)) return sig.stackType;
        }
      }
      // Check URL patterns
      for (const urlPattern of sig.urlPatterns) {
        if (urlPattern.test(tx.url)) return sig.stackType;
      }
    }
  }
  return "UnknownREST";
}

// ═══════════════════════════════════════════
// Route Templates — common API patterns for gap filling
// ═══════════════════════════════════════════

export interface RouteTemplate {
  id: string;
  name: string;
  interactionPattern: RegExp;
  inferredEndpoint: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  defaultRequest: object;
  defaultResponse: object;
  executableCodeSnippet: string;
  description: string;
}

export const ROUTE_TEMPLATES: RouteTemplate[] = [
  {
    id: "auth_login",
    name: "Authentication Login",
    interactionPattern: /login|signin|sign-in|auth/i,
    inferredEndpoint: "/api/auth/login",
    method: "POST",
    defaultRequest: { email: "string", password: "string" },
    defaultResponse: { token: "string", user: { id: "string", email: "string", name: "string" } },
    executableCodeSnippet: `export async function handle(req, res) {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Missing credentials" });
  const token = Buffer.from(email + ":" + Date.now()).toString("base64");
  return res.status(200).json({ token, user: { id: "1", email, name: email.split("@")[0] } });
}`,
    description: "Login endpoint accepting email/password, returning JWT token",
  },
  {
    id: "auth_register",
    name: "Authentication Register",
    interactionPattern: /register|signup|sign-up|create.account/i,
    inferredEndpoint: "/api/auth/register",
    method: "POST",
    defaultRequest: { email: "string", password: "string", name: "string" },
    defaultResponse: { token: "string", user: { id: "string", email: "string", name: "string" } },
    executableCodeSnippet: `export async function handle(req, res) {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Missing fields" });
  const token = Buffer.from(email + ":" + Date.now()).toString("base64");
  return res.status(201).json({ token, user: { id: "1", email, name: name || email.split("@")[0] } });
}`,
    description: "Registration endpoint creating a new user account",
  },
  {
    id: "crud_list",
    name: "CRUD List Collection",
    interactionPattern: /list|collection|items|products|posts|articles/i,
    inferredEndpoint: "/api/items",
    method: "GET",
    defaultRequest: { page: "number", limit: "number", search: "string" },
    defaultResponse: { items: [{ id: "string", name: "string" }], total: "number", page: "number" },
    executableCodeSnippet: `export async function handle(req, res) {
  const { page = 1, limit = 20, search = "" } = req.query;
  const items = MOCK_ITEMS.filter(i => i.name.includes(search));
  const start = (page - 1) * limit;
  return res.status(200).json({ items: items.slice(start, start + limit), total: items.length, page: +page });
}`,
    description: "Paginated list endpoint returning a collection of items",
  },
  {
    id: "crud_create",
    name: "CRUD Create Item",
    interactionPattern: /create|add|new|submit|save/i,
    inferredEndpoint: "/api/items",
    method: "POST",
    defaultRequest: { name: "string", data: "object" },
    defaultResponse: { id: "string", name: "string", created_at: "string" },
    executableCodeSnippet: `export async function handle(req, res) {
  const body = req.body;
  const item = { id: Date.now().toString(), ...body, created_at: new Date().toISOString() };
  MOCK_ITEMS.push(item);
  return res.status(201).json(item);
}`,
    description: "Create endpoint for adding a new item to a collection",
  },
  {
    id: "crud_update",
    name: "CRUD Update Item",
    interactionPattern: /update|edit|modify|patch/i,
    inferredEndpoint: "/api/items/:id",
    method: "PUT",
    defaultRequest: { id: "string", name: "string", data: "object" },
    defaultResponse: { id: "string", name: "string", updated_at: "string" },
    executableCodeSnippet: `export async function handle(req, res) {
  const { id } = req.params;
  const idx = MOCK_ITEMS.findIndex(i => i.id === id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });
  MOCK_ITEMS[idx] = { ...MOCK_ITEMS[idx], ...req.body, updated_at: new Date().toISOString() };
  return res.status(200).json(MOCK_ITEMS[idx]);
}`,
    description: "Update endpoint for modifying an existing item",
  },
  {
    id: "crud_delete",
    name: "CRUD Delete Item",
    interactionPattern: /delete|remove|destroy/i,
    inferredEndpoint: "/api/items/:id",
    method: "DELETE",
    defaultRequest: { id: "string" },
    defaultResponse: { success: "boolean", id: "string" },
    executableCodeSnippet: `export async function handle(req, res) {
  const { id } = req.params;
  const idx = MOCK_ITEMS.findIndex(i => i.id === id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });
  MOCK_ITEMS.splice(idx, 1);
  return res.status(200).json({ success: true, id });
}`,
    description: "Delete endpoint for removing an item",
  },
  {
    id: "search",
    name: "Search Query",
    interactionPattern: /search|query|filter|find/i,
    inferredEndpoint: "/api/search",
    method: "GET",
    defaultRequest: { q: "string", page: "number" },
    defaultResponse: { results: [{ id: "string", title: "string", url: "string" }], total: "number" },
    executableCodeSnippet: `export async function handle(req, res) {
  const { q = "", page = 1 } = req.query;
  const results = MOCK_ITEMS.filter(i => i.name.includes(q));
  return res.status(200).json({ results, total: results.length });
}`,
    description: "Search endpoint returning filtered results",
  },
  {
    id: "upload",
    name: "File Upload",
    interactionPattern: /upload|file|attachment|image/i,
    inferredEndpoint: "/api/upload",
    method: "POST",
    defaultRequest: { file: "binary" },
    defaultResponse: { url: "string", filename: "string", size: "number" },
    executableCodeSnippet: `export async function handle(req, res) {
  if (!req.files || !req.files.file) return res.status(400).json({ error: "No file" });
  const file = req.files.file;
  return res.status(200).json({ url: "/uploads/" + file.name, filename: file.name, size: file.size });
}`,
    description: "File upload endpoint accepting multipart form data",
  },
  {
    id: "webhook",
    name: "Webhook Receiver",
    interactionPattern: /webhook|callback|notify|event/i,
    inferredEndpoint: "/api/webhook",
    method: "POST",
    defaultRequest: { event: "string", data: "object" },
    defaultResponse: { received: "boolean" },
    executableCodeSnippet: `export async function handle(req, res) {
  const { event, data } = req.body;
  console.log("Webhook received:", event, data);
  return res.status(200).json({ received: true });
}`,
    description: "Webhook endpoint receiving external event notifications",
  },
  {
    id: "websocket",
    name: "WebSocket Realtime",
    interactionPattern: /ws|socket|realtime|live|stream/i,
    inferredEndpoint: "/ws",
    method: "WS",
    defaultRequest: { channel: "string", action: "string" },
    defaultResponse: { type: "string", data: "object" },
    executableCodeSnippet: `export async function handle(ws, req) {
  ws.on("message", (msg) => {
    const { channel, action } = JSON.parse(msg);
    ws.send(JSON.stringify({ type: "ack", data: { channel, action } }));
  });
  ws.on("close", () => console.log("WS disconnected"));
}`,
    description: "WebSocket endpoint for realtime bidirectional communication",
  },
];

/**
 * Find the closest functional match for a gap's interaction pattern.
 */
export function findClosestFunctionalMatch(interactionPattern: string): RouteTemplate {
  const text = interactionPattern.toLowerCase();
  // Try exact pattern match first
  for (const t of ROUTE_TEMPLATES) {
    if (t.interactionPattern.test(text)) return t;
  }
  // Fallback: match by keyword overlap
  for (const t of ROUTE_TEMPLATES) {
    const keywords = t.id.split("_");
    if (keywords.some(k => text.includes(k))) return t;
  }
  // Default: CRUD create
  return ROUTE_TEMPLATES.find(t => t.id === "crud_create")!;
}

// ═══════════════════════════════════════════
// JSON Schema Derivation Utilities
// ═══════════════════════════════════════════

export function deriveJSONSchema(obj: any): any {
  if (obj === null || obj === undefined) return { type: "null" };
  if (Array.isArray(obj)) {
    return { type: "array", items: obj.length > 0 ? deriveJSONSchema(obj[0]) : {} };
  }
  const t = typeof obj;
  if (t !== "object") return { type: t };
  const schema: any = { type: "object", properties: {} };
  for (const key of Object.keys(obj)) {
    schema.properties[key] = deriveJSONSchema(obj[key]);
  }
  return schema;
}

/**
 * Generate stateful mock logic from a sample response body.
 */
export function generateStatefulMockLogic(sampleResponse: any): string {
  const sample = JSON.stringify(sampleResponse, null, 2);
  return `export async function handle(req, res) {
  res.setHeader("Content-Type", "application/json");
  return res.status(200).send(JSON.stringify(${sample}));
}`;
}

/**
 * Parse a relative path from a full URL.
 */
export function parseRelativePath(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + (u.search || "");
  } catch {
    return url;
  }
}

/**
 * Identify system gaps — DOM interactions that lack matching network endpoints.
 */
export function identifySystemGaps(
  domTree: any,
  explicitRoutes: Array<{ endpoint: string; method: string }>
): Array<{
  gapType: string;
  interactionPattern: string;
  inferredEndpoint: string;
  inferredMethod: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "WS";
}> {
  const gaps: Array<any> = [];
  const knownEndpoints = new Set(explicitRoutes.map(r => r.endpoint));

  // Scan DOM tree for interactive elements (forms, buttons with handlers, data-action attributes)
  const scanNode = (node: any) => {
    if (!node || typeof node !== "object") return;

    const tag = node.tagName?.toLowerCase() || "";
    const attrs = node.attributes || {};
    const action = attrs.action || attrs["data-action"] || attrs["data-endpoint"] || "";
    const onclick = attrs.onclick || attrs["data-onclick"] || "";

    // Form elements without matching endpoints
    if (tag === "form" && action && !knownEndpoints.has(action)) {
      const method = (attrs.method || "POST").toUpperCase() as any;
      gaps.push({
        gapType: "server_logic",
        interactionPattern: action,
        inferredEndpoint: action,
        inferredMethod: method,
      });
    }

    // Button/clickable elements with data endpoints
    if (["button", "a"].includes(tag) && action && !knownEndpoints.has(action)) {
      gaps.push({
        gapType: "server_logic",
        interactionPattern: action,
        inferredEndpoint: action,
        inferredMethod: "POST",
      });
    }

    // Recurse into children
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(scanNode);
    }
    if (node.childNodes && Array.isArray(node.childNodes)) {
      node.childNodes.forEach(scanNode);
    }
  };

  scanNode(domTree);
  return gaps;
}