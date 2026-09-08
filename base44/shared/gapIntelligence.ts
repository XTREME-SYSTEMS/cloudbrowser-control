/**
 * DEEP Gap Intelligence Engine
 * 
 * Definitively classifies unclonable backend areas using deterministic rules
 * (not LLM guessing), then resolves each gap using a multi-strategy approach:
 *   1. Template matching (from the route template catalog)
 *   2. Similar-system scraping (find sites with same stack/industry, scrape their public APIs)
 *   3. Data seeding (scrape the target site's own public data to seed a mock database)
 *   4. LLM inference (last-resort fallback)
 * 
 * Every unclonable area gets a pre-planned deep system — eliminating ambiguity.
 */

// ═══════════════════════════════════════════
// DEFINITIVE GAP CLASSIFICATION RULES
// ═══════════════════════════════════════════

export type GapType =
  | "database"
  | "oauth"
  | "server_logic"
  | "websocket"
  | "firewall"
  | "payment"
  | "search"
  | "realtime"
  | "unknown";

export interface ClassificationEvidence {
  gap_type: GapType;
  confidence: number; // 0-100
  evidence: string[]; // human-readable reasons
  definitive: boolean; // true = 100% certain based on HTTP evidence
}

interface HarEntry {
  url: string;
  method: string;
  status: number;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  postData?: string;
}

/**
 * Classify a single HTTP transaction definitively.
 * Returns the gap type with evidence — or null if the endpoint is clonable (static).
 */
export function classifyTransaction(tx: HarEntry): ClassificationEvidence | null {
  const url = (tx.url || "").toLowerCase();
  const method = (tx.method || "GET").toUpperCase();
  const status = tx.status || 0;
  const respHeaders = tx.responseHeaders || {};
  const reqHeaders = tx.requestHeaders || {};
  const body = (tx.responseBody || "").toLowerCase();

  const evidence: string[] = [];

  // ── OAUTH: authentication required ──────────────────────
  if (status === 401 || status === 403) {
    evidence.push(`HTTP ${status} — authentication required`);
  }
  if (respHeaders["www-authenticate"]) {
    evidence.push("WWW-Authenticate header present");
  }
  if (reqHeaders["authorization"]) {
    evidence.push("Authorization header in request");
  }
  if (/\/(auth|login|signin|sign-in|oauth|token|callback)\b/i.test(url)) {
    evidence.push(`URL matches auth pattern: ${url}`);
  }
  if (/redirect_to.*(google|github|facebook|microsoft|apple)\.com/i.test(body)) {
    evidence.push("OAuth provider redirect detected in response");
  }
  if (evidence.length >= 1) {
    return {
      gap_type: "oauth",
      confidence: 100,
      evidence,
      definitive: true,
    };
  }

  // ── WEBSOCKET: real-time bidirectional ───────────────────
  if (reqHeaders["upgrade"] === "websocket" || respHeaders["upgrade"] === "websocket") {
    evidence.push("WebSocket upgrade header");
  }
  if (/^wss?:\/\//i.test(url)) {
    evidence.push("WebSocket URL scheme");
  }
  if (/\b(ws|socket|realtime|live|stream)\b/i.test(url)) {
    evidence.push(`URL matches WebSocket pattern: ${url}`);
  }
  if (respHeaders["sec-websocket-accept"]) {
    evidence.push("Sec-WebSocket-Accept header");
  }
  if (evidence.length >= 1) {
    return {
      gap_type: "websocket",
      confidence: 100,
      evidence,
      definitive: true,
    };
  }

  // ── FIREWALL: WAF / bot protection ───────────────────────
  if (status === 403 && (respHeaders["cf-ray"] || respHeaders["server"]?.includes("cloudflare"))) {
    evidence.push("Cloudflare WAF block detected");
  }
  if (respHeaders["x-akamai-transformed"]) {
    evidence.push("Akamai WAF detected");
  }
  if (respHeaders["x-amz-cf-id"]) {
    evidence.push("AWS CloudFront WAF detected");
  }
  if (/captcha|challenge|bot-protection|access denied/i.test(body) && status === 403) {
    evidence.push("Challenge/captcha page served");
  }
  if (respHeaders["retry-after"] || respHeaders["x-ratelimit-limit"]) {
    evidence.push("Rate limiting headers detected");
  }
  if (evidence.length >= 1) {
    return {
      gap_type: "firewall",
      confidence: 100,
      evidence,
      definitive: true,
    };
  }

  // ── PAYMENT: checkout / billing ──────────────────────────
  if (/\/(checkout|payment|pay|charge|billing|subscription)\b/i.test(url)) {
    evidence.push(`URL matches payment pattern: ${url}`);
  }
  if (/stripe|paypal|braintree|square|adyen/i.test(body)) {
    evidence.push("Payment provider SDK detected in response");
  }
  if (respHeaders["stripe-publishable-key"] || /pk_(live|test)_/i.test(body)) {
    evidence.push("Stripe publishable key detected");
  }
  if (/card[_-]?number|cvc|cvv|expiry|card[_-]?exp/i.test(tx.postData || "")) {
    evidence.push("Payment card fields in request body");
  }
  if (evidence.length >= 1) {
    return {
      gap_type: "payment",
      confidence: 100,
      evidence,
      definitive: true,
    };
  }

  // ── REALTIME: server-sent events / polling ───────────────
  if (respHeaders["content-type"]?.includes("text/event-stream")) {
    evidence.push("Server-Sent Events content type");
  }
  if (/\/(live|feed|updates|events|sse|stream)\b/i.test(url) && method === "GET") {
    evidence.push(`URL matches realtime pattern: ${url}`);
  }
  if (evidence.length >= 1) {
    return {
      gap_type: "realtime",
      confidence: 95,
      evidence,
      definitive: true,
    };
  }

  // ── SEARCH: query / filter ───────────────────────────────
  if (/\/(search|query|filter|find)\b/i.test(url)) {
    evidence.push(`URL matches search pattern: ${url}`);
  }
  if (/[?&](q|query|search|term)=/i.test(url)) {
    evidence.push("Search query parameter detected");
  }
  if (evidence.length >= 1) {
    return {
      gap_type: "search",
      confidence: 95,
      evidence,
      definitive: true,
    };
  }

  // ── DATABASE: structured data endpoint ───────────────────
  const isApiCall = /\/(api|data|v\d+)\//i.test(url);
  const hasPagination = /[?&](page|limit|offset|per_page|cursor)=/i.test(url);
  const hasIdFields = /"(id|_id|uuid)"\s*:/.test(tx.responseBody || "");
  const hasTimestamps = /"(created_at|updated_at|created_date|timestamp)"\s*:/.test(tx.responseBody || "");
  const returnsArray = /^\s*\[/.test(tx.responseBody?.trim() || "");

  if (isApiCall && (hasPagination || hasIdFields || hasTimestamps || returnsArray)) {
    if (hasPagination) evidence.push("Pagination parameters detected");
    if (hasIdFields) evidence.push("ID fields in response — database-backed");
    if (hasTimestamps) evidence.push("Timestamp fields — database-managed");
    if (returnsArray) evidence.push("Array response — collection endpoint");
  }
  if (evidence.length >= 1) {
    return {
      gap_type: "database",
      confidence: 90,
      evidence,
      definitive: true,
    };
  }

  // ── SERVER_LOGIC: stateful operations ────────────────────
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    if (/\/(create|add|new|submit|save|update|edit|delete|remove|process|calculate|generate)\b/i.test(url)) {
      evidence.push(`${method} to stateful endpoint: ${url}`);
    }
    if (status === 201) {
      evidence.push("HTTP 201 Created — resource was created server-side");
    }
    if (tx.postData && tx.postData.length > 10) {
      evidence.push("Request body with data — server-side processing");
    }
    if (/\/graphql\b/i.test(url)) {
      evidence.push("GraphQL endpoint — complex server logic");
    }
  }
  if (evidence.length >= 1) {
    return {
      gap_type: "server_logic",
      confidence: 85,
      evidence,
      definitive: true,
    };
  }

  // If it's a static GET that returned 200 with no API indicators → clonable
  if (method === "GET" && status === 200 && !isApiCall) {
    return null;
  }

  // Fallback: unknown gap
  return {
    gap_type: "unknown",
    confidence: 30,
    evidence: [`Unclassifiable endpoint: ${method} ${url} (${status})`],
    definitive: false,
  };
}

/**
 * Classify all transactions in a HAR trace.
 * Returns a map of endpoint → classification.
 */
export function classifyAllTransactions(harEntries: HarEntry[]): Map<string, ClassificationEvidence> {
  const results = new Map<string, ClassificationEvidence>();
  for (const tx of harEntries) {
    // Skip static assets
    if (/\.(js|css|png|jpg|jpeg|gif|svg|woff2?|ttf|ico|map)$/i.test(tx.url)) continue;
    // Skip third-party analytics
    if (/(google-analytics|googletagmanager|facebook\.net|doubleclick|hotjar|segment|mixpanel|amplitude)/i.test(tx.url)) continue;

    const classification = classifyTransaction(tx);
    if (classification) {
      const key = `${tx.method} ${new URL(tx.url).pathname}`;
      // Keep the highest-confidence classification per endpoint
      const existing = results.get(key);
      if (!existing || classification.confidence > existing.confidence) {
        results.set(key, classification);
      }
    }
  }
  return results;
}

// ═══════════════════════════════════════════
// RESOLUTION STRATEGY MATRIX
// ═══════════════════════════════════════════

export type ResolutionStrategy = "template" | "scrape_similar" | "seed_data" | "infer_llm";

export interface ResolutionPlan {
  strategies: ResolutionStrategy[]; // ordered — first viable wins
  description: string;
}

/**
 * For each gap type, return the ordered resolution strategies.
 * This is the deterministic plan that eliminates ambiguity.
 */
export function getResolutionPlan(gapType: GapType): ResolutionPlan {
  const plans: Record<GapType, ResolutionPlan> = {
    database: {
      strategies: ["seed_data", "scrape_similar", "template"],
      description: "Seed a mock database from the site's own public data, then scrape similar systems for schema inference, then fall back to CRUD template",
    },
    oauth: {
      strategies: ["template"],
      description: "Generate OAuth mock with redirect flow and placeholder credentials",
    },
    server_logic: {
      strategies: ["template", "scrape_similar", "infer_llm"],
      description: "Match against route template catalog, scrape similar systems for API shape, then LLM inference",
    },
    websocket: {
      strategies: ["template"],
      description: "Generate WebSocket mock server stub with ping/pong and event broadcast",
    },
    firewall: {
      strategies: ["template"],
      description: "Generate rate-limited proxy handler that respects WAF patterns",
    },
    payment: {
      strategies: ["template"],
      description: "Generate Stripe checkout mock with test keys and payment intent flow",
    },
    search: {
      strategies: ["seed_data", "template", "scrape_similar"],
      description: "Seed search index from site content, generate search endpoint template, scrape similar systems",
    },
    realtime: {
      strategies: ["template"],
      description: "Generate Server-Sent Events mock with periodic data updates",
    },
    unknown: {
      strategies: ["infer_llm", "template"],
      description: "LLM inference fallback, then generic template",
    },
  };
  return plans[gapType];
}

// ═══════════════════════════════════════════
// INDUSTRY DETECTION — drives data seeding
// ═══════════════════════════════════════════

export type Industry =
  | "ecommerce"
  | "real_estate"
  | "job_board"
  | "saas"
  | "social"
  | "news"
  | "education"
  | "healthcare"
  | "finance"
  | "directory"
  | "generic";

export function detectIndustry(url: string, htmlContent: string, harEntries: HarEntry[]): Industry {
  const combined = (url + " " + htmlContent).toLowerCase();

  // Check structured data (JSON-LD) for industry hints
  const hasJsonLd = /application\/ld\+json/i.test(htmlContent);
  const jsonLdMatch = htmlContent.match(/"@type"\s*:\s*"([^"]+)"/gi) || [];
  const jsonLdTypes = jsonLdMatch.map((m) => m.match(/"([^"]+)"/)?.[1]?.toLowerCase() || "").join(" ");

  const checks: [Industry, RegExp[]][] = [
    ["ecommerce", [/product|cart|checkout|shop|store|price|add to cart|stripe|shopify|woocommerce/i, /"@type"\s*:\s*"(product|offer|aggregateoffer)"/i]],
    ["real_estate", [/realty|real estate|property|listing|mls|bedroom|bathroom|sqft|zillow|realtor/i]],
    ["job_board", [/job|career|position|hiring|resume|apply now|salary|job posting/i, /"@type"\s*:\s*"jobposting"/i]],
    ["saas", [/dashboard|sign up|pricing|subscription|free trial|workspace|api key|integration/i]],
    ["social", [/post|like|comment|share|follow|profile|feed|timeline|friend/i]],
    ["news", [/article|breaking news|subscribe|author|published|category|headline/i, /"@type"\s*:\s*"newsarticle"/i]],
    ["education", [/course|lesson|tutorial|enroll|student|teacher|syllabus|quiz/i, /"@type"\s*:\s*"(course|educationalevent)"/i]],
    ["healthcare", [/doctor|patient|appointment|clinic|hospital|medical|health|prescription/i]],
    ["finance", [/bank|account|transfer|deposit|loan|credit|investment|portfolio|trading/i]],
    ["directory", [/directory|listing|business|category|browse by|find near/i]],
  ];

  for (const [industry, patterns] of checks) {
    for (const pattern of patterns) {
      if (pattern.test(combined) || pattern.test(jsonLdTypes)) {
        return industry as Industry;
      }
    }
  }

  return "generic";
}

// ═══════════════════════════════════════════
// DATA SEEDING TEMPLATES — industry-specific
// ═══════════════════════════════════════════

export interface SeedTemplate {
  industry: Industry;
  collections: { name: string; fields: Record<string, string>; recordCount: number }[];
  description: string;
}

export function getSeedTemplate(industry: Industry): SeedTemplate {
  const templates: Record<Industry, SeedTemplate> = {
    ecommerce: {
      industry: "ecommerce",
      description: "Products, categories, orders, and reviews",
      collections: [
        {
          name: "products",
          recordCount: 24,
          fields: { id: "string", name: "string", price: "number", category: "string", image_url: "string", description: "string", in_stock: "boolean", rating: "number" },
        },
        {
          name: "categories",
          recordCount: 6,
          fields: { id: "string", name: "string", slug: "string", product_count: "number" },
        },
        {
          name: "orders",
          recordCount: 5,
          fields: { id: "string", customer_email: "string", total: "number", status: "string", items: "array", created_at: "string" },
        },
      ],
    },
    real_estate: {
      industry: "real_estate",
      description: "Property listings, agents, and inquiries",
      collections: [
        {
          name: "listings",
          recordCount: 20,
          fields: { id: "string", address: "string", price: "number", bedrooms: "number", bathrooms: "number", sqft: "number", image_url: "string", status: "string", agent_id: "string" },
        },
        {
          name: "agents",
          recordCount: 4,
          fields: { id: "string", name: "string", email: "string", phone: "string", listings_count: "number", avatar_url: "string" },
        },
      ],
    },
    job_board: {
      industry: "job_board",
      description: "Job postings, companies, and applications",
      collections: [
        {
          name: "jobs",
          recordCount: 20,
          fields: { id: "string", title: "string", company: "string", location: "string", salary: "string", description: "string", posted_at: "string", remote: "boolean" },
        },
        {
          name: "companies",
          recordCount: 6,
          fields: { id: "string", name: "string", logo_url: "string", industry: "string", job_count: "number" },
        },
      ],
    },
    saas: {
      industry: "saas",
      description: "Users, workspaces, and subscriptions",
      collections: [
        {
          name: "users",
          recordCount: 10,
          fields: { id: "string", email: "string", name: "string", role: "string", avatar_url: "string", created_at: "string" },
        },
        {
          name: "workspaces",
          recordCount: 3,
          fields: { id: "string", name: "string", plan: "string", owner_id: "string", member_count: "number" },
        },
      ],
    },
    social: {
      industry: "social",
      description: "Posts, users, and comments",
      collections: [
        {
          name: "posts",
          recordCount: 20,
          fields: { id: "string", author_id: "string", content: "string", image_url: "string", likes: "number", comments_count: "number", posted_at: "string" },
        },
        {
          name: "users",
          recordCount: 8,
          fields: { id: "string", username: "string", name: "string", avatar_url: "string", followers: "number", bio: "string" },
        },
      ],
    },
    news: {
      industry: "news",
      description: "Articles, authors, and categories",
      collections: [
        {
          name: "articles",
          recordCount: 15,
          fields: { id: "string", title: "string", author: "string", category: "string", image_url: "string", body: "string", published_at: "string" },
        },
        {
          name: "categories",
          recordCount: 5,
          fields: { id: "string", name: "string", slug: "string", article_count: "number" },
        },
      ],
    },
    education: {
      industry: "education",
      description: "Courses, lessons, and enrollments",
      collections: [
        {
          name: "courses",
          recordCount: 12,
          fields: { id: "string", title: "string", instructor: "string", description: "string", image_url: "string", enrolled_count: "number", price: "number" },
        },
        {
          name: "lessons",
          recordCount: 30,
          fields: { id: "string", course_id: "string", title: "string", duration: "number", order: "number" },
        },
      ],
    },
    healthcare: {
      industry: "healthcare",
      description: "Doctors, appointments, and clinics",
      collections: [
        {
          name: "doctors",
          recordCount: 8,
          fields: { id: "string", name: "string", specialty: "string", image_url: "string", rating: "number", clinic_id: "string" },
        },
        {
          name: "appointments",
          recordCount: 10,
          fields: { id: "string", doctor_id: "string", patient_name: "string", date: "string", time: "string", status: "string" },
        },
      ],
    },
    finance: {
      industry: "finance",
      description: "Accounts, transactions, and balances",
      collections: [
        {
          name: "accounts",
          recordCount: 5,
          fields: { id: "string", holder: "string", type: "string", balance: "number", currency: "string" },
        },
        {
          name: "transactions",
          recordCount: 20,
          fields: { id: "string", account_id: "string", amount: "number", type: "string", description: "string", date: "string" },
        },
      ],
    },
    directory: {
      industry: "directory",
      description: "Business listings and categories",
      collections: [
        {
          name: "listings",
          recordCount: 20,
          fields: { id: "string", name: "string", category: "string", address: "string", phone: "string", rating: "number", image_url: "string" },
        },
        {
          name: "categories",
          recordCount: 8,
          fields: { id: "string", name: "string", slug: "string", listing_count: "number" },
        },
      ],
    },
    generic: {
      industry: "generic",
      description: "Generic items and records",
      collections: [
        {
          name: "items",
          recordCount: 15,
          fields: { id: "string", name: "string", description: "string", created_at: "string" },
        },
      ],
    },
  };
  return templates[industry];
}

/**
 * Extract real data from the site's own content (JSON-LD, sitemap, visible text)
 * to seed the mock database with actual data from the target site.
 */
export function extractSeedDataFromContent(htmlContent: string): Record<string, any[]> {
  const collections: Record<string, any[]> = {};

  // Extract JSON-LD structured data
  const jsonLdMatches = htmlContent.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const match of jsonLdMatches) {
    try {
      const jsonStr = match.replace(/<script[^>]*>/, "").replace(/<\/script>/, "");
      const data = JSON.parse(jsonStr);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        const type = (item["@type"] || "generic").toLowerCase();
        const collectionName = type.replace(/^[a-z]/, (c) => c.toUpperCase()) + "s";
        if (!collections[collectionName]) collections[collectionName] = [];
        collections[collectionName].push(item);
      }
    } catch {}
  }

  // Extract product names from common patterns
  const productMatches = htmlContent.match(/<h[23][^>]*>([^<]{3,80})<\/h[23]>/gi) || [];
  if (productMatches.length > 0 && !collections["products"]) {
    collections["products"] = productMatches.slice(0, 20).map((m, i) => {
      const name = m.replace(/<[^>]+>/g, "").trim();
      return { id: `seed-${i}`, name, price: Math.round(19 + Math.random() * 480), in_stock: true };
    });
  }

  return collections;
}

// ═══════════════════════════════════════════
// SIMILAR-SYSTEM DISCOVERY
// ═══════════════════════════════════════════

export interface SimilarSystemCandidate {
  url: string;
  industry: Industry;
  reason: string;
  scrape_priority: number; // 1 = highest
}

/**
 * Generate search queries to find similar systems for a given gap.
 * Uses the target's industry and stack to find comparable public APIs.
 */
export function buildSimilarSystemQueries(targetUrl: string, industry: Industry, gapType: GapType): string[] {
  const host = (() => { try { return new URL(targetUrl).hostname.replace(/^www\./, ""); } catch { return targetUrl; } })();

  const queries: string[] = [];
  const industryTerms: Record<Industry, string> = {
    ecommerce: "ecommerce store",
    real_estate: "real estate listings",
    job_board: "job board",
    saas: "SaaS platform",
    social: "social network",
    news: "news site",
    education: "online courses",
    healthcare: "clinic directory",
    finance: "fintech platform",
    directory: "business directory",
    generic: "website",
  };

  const gapTerms: Record<GapType, string> = {
    database: "API endpoints JSON",
    oauth: "authentication OAuth login",
    server_logic: "REST API documentation",
    websocket: "WebSocket realtime API",
    firewall: "API rate limits",
    payment: "Stripe checkout integration",
    search: "search API endpoint",
    realtime: "SSE realtime feed",
    unknown: "API documentation",
  };

  queries.push(`${industryTerms[industry]} ${gapTerms[gapType]} site:github.com`);
  queries.push(`${industryTerms[industry]} ${gapTerms[gapType]} open source example`);
  queries.push(`similar to ${host} ${gapTerms[gapType]}`);
  queries.push(`${industryTerms[industry]} API schema ${gapTerms[gapType]}`);

  return queries;
}

// ═══════════════════════════════════════════
// CODE GENERATION — per gap type
// ═══════════════════════════════════════════

export function generateGapCode(
  gapType: GapType,
  endpoint: string,
  method: string,
  seedData: Record<string, any[]> | null,
  template: string | null
): string {
  const safePath = endpoint.replace(/:id/g, ":id");

  switch (gapType) {
    case "database":
      const collections = seedData ? Object.keys(seedData).map((k) => `const ${k} = ${JSON.stringify(seedData[k].slice(0, 5), null, 2)};`).join("\n") : "const items = [];";
      return `// DATABASE GAP — Mock data layer for ${safePath}
// Auto-seeded from target site's public content
${collections}

export async function handle(req, res) {
  const { page = 1, limit = 20 } = req.query;
  // Return seeded data with pagination
  const collection = items;
  const start = (page - 1) * limit;
  return res.status(200).json({
    items: collection.slice(start, start + limit),
    total: collection.length,
    page: +page,
  });
}`;

    case "oauth":
      return `// OAUTH GAP — Mock authentication flow for ${safePath}
export async function handle(req, res) {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Missing credentials" });
  // Mock JWT token
  const token = Buffer.from(email + ":" + Date.now()).toString("base64");
  return res.status(200).json({
    token,
    user: { id: "1", email, name: email.split("@")[0] },
  });
}

// OAuth redirect handler
export async function oauthRedirect(req, res) {
  const provider = req.params.provider;
  const state = Buffer.from(Date.now().toString()).toString("base64");
  const redirectUri = encodeURIComponent(\`/api/auth/callback/\${provider}\`);
  return res.redirect(302, \`https://mock-oauth.example.com/auth?client_id=MOCK&redirect_uri=\${redirectUri}&state=\${state}\`);
}`;

    case "server_logic":
      return template || `// SERVER_LOGIC GAP — Mock handler for ${method} ${safePath}
export async function handle(req, res) {
  const body = req.body || {};
  const result = { id: Date.now().toString(), ...body, created_at: new Date().toISOString() };
  return res.status(201).json(result);
}`;

    case "websocket":
      return `// WEBSOCKET GAP — Mock WebSocket server for ${safePath}
import { WebSocketServer } from 'ws';

export function setupWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '${safePath}' });
  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    // Send mock realtime events every 5 seconds
    const interval = setInterval(() => {
      ws.send(JSON.stringify({ type: 'update', data: { timestamp: Date.now(), value: Math.random() } }));
    }, 5000);
    ws.on('message', (msg) => {
      ws.send(JSON.stringify({ type: 'echo', data: msg.toString() }));
    });
    ws.on('close', () => clearInterval(interval));
  });
}`;

    case "firewall":
      return `// FIREWALL GAP — Rate-limited proxy for ${safePath}
const rateLimitMap = new Map();

export async function handle(req, res) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  const maxRequests = 30;

  const entry = rateLimitMap.get(ip) || { count: 0, resetAt: now + windowMs };
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + windowMs; }
  entry.count++;
  rateLimitMap.set(ip, entry);

  if (entry.count > maxRequests) {
    return res.status(429).set('Retry-After', Math.ceil((entry.resetAt - now) / 1000)).json({ error: "Rate limit exceeded" });
  }
  return res.status(200).json({ ok: true, message: "Request allowed" });
}`;

    case "payment":
      return `// PAYMENT GAP — Mock Stripe checkout for ${safePath}
export async function handle(req, res) {
  const { amount, currency = 'usd' } = req.body;
  if (!amount) return res.status(400).json({ error: "Amount required" });
  // Mock payment intent
  const paymentIntent = {
    id: "pi_mock_" + Date.now(),
    amount: Math.round(amount * 100),
    currency,
    status: "succeeded",
    client_secret: "pi_mock_secret_" + Date.now(),
  };
  return res.status(200).json({ paymentIntent });
}`;

    case "search":
      const searchData = seedData?.items || seedData?.products || [];
      return `// SEARCH GAP — Mock search endpoint for ${safePath}
const SEARCH_INDEX = ${JSON.stringify(searchData.slice(0, 20), null, 2)};

export async function handle(req, res) {
  const { q = '', page = 1, limit = 10 } = req.query;
  const results = SEARCH_INDEX.filter(item =>
    JSON.stringify(item).toLowerCase().includes(q.toLowerCase())
  );
  const start = (page - 1) * limit;
  return res.status(200).json({
    results: results.slice(start, start + limit),
    total: results.length,
    page: +page,
  });
}`;

    case "realtime":
      return `// REALTIME GAP — Mock Server-Sent Events for ${safePath}
export async function handle(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  const interval = setInterval(() => {
    res.write('data: ' + JSON.stringify({ timestamp: Date.now(), value: Math.random() }) + '\\n\\n');
  }, 3000);
  req.on('close', () => clearInterval(interval));
}`;

    default:
      return template || `// UNKNOWN GAP — Generic mock for ${method} ${safePath}
export async function handle(req, res) {
  return res.status(200).json({ ok: true, endpoint: '${safePath}' });
}`;
  }
}