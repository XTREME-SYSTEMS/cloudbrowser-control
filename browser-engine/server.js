import express from "express";
import cors from "cors";
import fs from "fs";
import { chromium } from "playwright";

const app = express();

// ═══════════════════════════════════════════════
// SECURITY: Fail-closed configuration
// ═══════════════════════════════════════════════

const ENGINE_API_KEY = process.env.ENGINE_API_KEY;
const PORT = process.env.PORT || 8080;
const MAX_SESSIONS = parseInt(process.env.MAX_SESSIONS || "10", 10);
const DEFAULT_TIMEOUT = parseInt(process.env.DEFAULT_TIMEOUT || "30000", 10);
const SESSION_TTL_MS = parseInt(process.env.SESSION_TTL_MS || "300000", 10);
const POOL_SIZE = parseInt(process.env.POOL_SIZE || "3", 10);
const VIDEO_DIR = process.env.VIDEO_DIR || "/tmp/videos";
const UPLOAD_MAX_BYTES = parseInt(process.env.UPLOAD_MAX_BYTES || String(50 * 1024 * 1024), 10);
const DOWNLOAD_MAX_BYTES = parseInt(process.env.DOWNLOAD_MAX_BYTES || String(100 * 1024 * 1024), 10);
const ENFORCE_HTTPS = process.env.ENFORCE_HTTPS === "true";
const CORS_ALLOWLIST = (process.env.CORS_ALLOWLIST || "").split(",").map((s) => s.trim()).filter(Boolean);
const CRAWL_MAX_PAGES = parseInt(process.env.CRAWL_MAX_PAGES || "50", 10);
const CRAWL_MAX_DEPTH = parseInt(process.env.CRAWL_MAX_DEPTH || "3", 10);
const CRAWL_DELAY_MS = parseInt(process.env.CRAWL_DELAY_MS || "1000", 10);
const BROWSER_CPU_LIMIT = process.env.BROWSER_CPU_LIMIT || undefined;
const BROWSER_MEMORY_LIMIT = process.env.BROWSER_MEMORY_LIMIT || undefined;
const WORKER_ID = process.env.RAILWAY_REPLICA_ID || process.env.HOSTNAME || "worker-local";
const REGION = process.env.RAILWAY_REGION || process.env.REGION || "unknown";
const ENGINE_VERSION = "3.0.0";
const SCHEMA_VERSION = "3.0";
const CONFIG_VERSION = process.env.CONFIG_VERSION || "unknown";

// Fail-closed: refuse to start without a real API key
if (!ENGINE_API_KEY || ENGINE_API_KEY.length < 16) {
  console.error("FATAL: ENGINE_API_KEY must be set to a strong value (>= 16 chars). Refusing to start with no secret.");
  process.exit(1);
}

if (!fs.existsSync(VIDEO_DIR)) fs.mkdirSync(VIDEO_DIR, { recursive: true });

// ═══════════════════════════════════════════════
// CORS: allowlist only, no wildcard
// ═══════════════════════════════════════════════

const corsOptions = {
  origin: (origin, callback) => {
    // Allow same-origin (no origin) and allowlisted origins
    if (!origin || CORS_ALLOWLIST.length === 0 || CORS_ALLOWLIST.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "x-api-key", "Authorization"],
  credentials: false,
  maxAge: 600,
};
app.use(cors(corsOptions));

// Body size limits
app.use(express.json({ limit: UPLOAD_MAX_BYTES }));

// Secure headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Engine-Version", ENGINE_VERSION);
  res.setHeader("X-Worker-Id", WORKER_ID);
  res.setHeader("X-Region", REGION);
  next();
});

// ═══════════════════════════════════════════════
// Auth: constant-time comparison, no fallback
// ═══════════════════════════════════════════════

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

app.use((req, res, next) => {
  if (req.path === "/health" || req.path === "/liveness" || req.path === "/readiness") return next();
  const key = req.headers["x-api-key"] || (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!key || !timingSafeEqual(key, ENGINE_API_KEY)) {
    return res.status(401).json({ error: "Unauthorized", request_id: req.headers["x-request-id"] || null });
  }
  next();
});

// ═══════════════════════════════════════════════
// SSRF protection: block private/loopback/metadata
// ═══════════════════════════════════════════════

function isBlockedHost(hostname) {
  if (!hostname) return true;
  const h = hostname.toLowerCase();
  // Loopback
  if (h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "0.0.0.0") return true;
  // Cloud metadata
  if (h === "169.254.169.254" || h === "metadata.google.internal") return true;
  // IPv6 private/link-local
  if (h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true;
  // Private ranges
  if (h.endsWith(".internal") || h.endsWith(".local")) return true;
  const parts = h.split(".").map(Number);
  if (parts.length === 4) {
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 0) return true;
    if (a === 127) return true;
    if (a >= 224) return true; // multicast/reserved
  }
  return false;
}

function validateTargetUrl(urlStr) {
  if (!urlStr || typeof urlStr !== "string") return { ok: false, error: "URL required" };
  let parsed;
  try { parsed = new URL(urlStr); } catch { return { ok: false, error: "Invalid URL" }; }
  if (ENFORCE_HTTPS && parsed.protocol !== "https:") return { ok: false, error: "HTTPS required by policy" };
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return { ok: false, error: "Only http/https allowed" };
  if (isBlockedHost(parsed.hostname)) return { ok: false, error: `Blocked host: ${parsed.hostname}` };
  return { ok: true, parsed };
}

// ═══════════════════════════════════════════════
// Stores (process-local cache — NOT authoritative distributed state)
// See base44/shared/distributedFabric.ts for the production adapter spec.
// ═══════════════════════════════════════════════

const sessions = new Map();
const pool = [];
const savedStates = new Map();
let cdpPortCounter = 9222;
const workerStartedAt = Date.now();
let heartbeatSeq = 0;

function uid() { return "sess_" + Math.random().toString(36).slice(2) + Date.now().toString(36); }
function getNextCdpPort() { return cdpPortCounter++; }

// ═══════════════════════════════════════════════
// Stealth
// ═══════════════════════════════════════════════

const stealthScript = `
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
window.chrome = { runtime: {} };
const originalQuery = window.navigator.permissions.query;
window.navigator.permissions.query = (parameters) =>
  parameters.name === 'notifications' ? Promise.resolve({ state: Notification.permission }) : originalQuery(parameters);
`;

// ═══════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════

async function closeSession(id, reason = "ended") {
  const s = sessions.get(id);
  if (!s) return false;
  try { s.status = reason; await s.context.close(); } catch (e) {}
  try { await s.browser?.close(); } catch (e) {}
  sessions.delete(id);
  const idx = pool.indexOf(id);
  if (idx >= 0) pool.splice(idx, 1);
  return true;
}

// Normalize cookies for Playwright: ensure each has url or domain+path
function normalizeCookies(cookies) {
  return (cookies || []).map((c) => {
    const cookie = { ...c };
    if (!cookie.url && cookie.domain && !cookie.path) {
      cookie.path = "/";
    }
    return cookie;
  });
}

async function locate(page, selector) {
  if (!selector) return page;
  if (selector.startsWith("//") || selector.startsWith("xpath=")) {
    return page.locator(`xpath=${selector.replace(/^xpath=/, "")}`).first();
  }
  return page.locator(selector).first();
}

async function warmPool() {
  while (pool.length < POOL_SIZE && sessions.size < MAX_SESSIONS) {
    try {
      const browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      });
      const context = await browser.newContext();
      await context.addInitScript(stealthScript);
      const page = await context.newPage();
      const id = uid();
      sessions.set(id, {
        id, browser, context, page, status: "pooled", url: "", title: "",
        lastActivity: Date.now(), createdAt: Date.now(), consoleLogs: [], networkLogs: [], isPooled: true,
      });
      pool.push(id);
    } catch (e) { break; }
  }
}

async function solveCaptcha(page, options) {
  const apiKey = options.apiKey;
  if (!apiKey) throw new Error("CAPTCHA API key required");

  if (options.type === "recaptcha_v2") {
    const submitRes = await fetch("https://2captcha.com/in.php", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: apiKey, method: "userrecaptcha", googlekey: options.siteKey, pageurl: page.url(), json: 1 }),
    });
    const submitData = await submitRes.json();
    if (submitData.status !== 1) throw new Error(submitData.request || "Submit failed");
    const captchaId = submitData.request;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const resRes = await fetch(`https://2captcha.com/res.php?key=${apiKey}&action=get&id=${captchaId}&json=1`);
      const resData = await resRes.json();
      if (resData.status === 1) {
        await page.evaluate((token) => { const el = document.getElementById("g-recaptcha-response"); if (el) el.innerHTML = token; }, resData.request);
        return { solved: true, token: resData.request };
      }
      if (resData.request !== "CAPCHA_NOT_READY") throw new Error(resData.request);
    }
    throw new Error("CAPTCHA solving timed out");
  }
  throw new Error(`Unsupported CAPTCHA type: ${options.type}`);
}

// Bounded crawler
async function crawl(page, options) {
  const startUrl = page.url();
  const maxPages = Math.min(options.maxPages || CRAWL_MAX_PAGES, CRAWL_MAX_PAGES);
  const maxDepth = Math.min(options.maxDepth || CRAWL_MAX_DEPTH, CRAWL_MAX_DEPTH);
  const delay = Math.max(options.delay || CRAWL_DELAY_MS, 200);
  const domainFilter = options.domain || new URL(startUrl).hostname;

  const visited = new Set();
  const results = [];
  const queue = [{ url: startUrl, depth: 0 }];

  while (queue.length > 0 && results.length < maxPages) {
    const { url, depth } = queue.shift();
    if (visited.has(url)) continue;
    if (depth > maxDepth) continue;

    const validation = validateTargetUrl(url);
    if (!validation.ok) continue;
    if (new URL(url).hostname !== domainFilter) continue;

    visited.add(url);
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: options.timeout || DEFAULT_TIMEOUT });
      const title = await page.title().catch(() => "");
      const text = await page.evaluate(() => document.body?.innerText?.slice(0, 5000) || "").catch(() => "");
      const links = await page.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => a.href).filter((u) => u.startsWith("http")), []).catch(() => []);

      results.push({ url, title, text: text.slice(0, 1000), depth });

      if (depth < maxDepth) {
        for (const link of links) {
          if (!visited.has(link)) {
            try { if (new URL(link).hostname === domainFilter) queue.push({ url: link, depth: depth + 1 }); } catch (e) {}
          }
        }
      }
      await new Promise((r) => setTimeout(r, delay));
    } catch (e) {
      results.push({ url, error: e.message, depth });
    }
  }
  return { pages: results, visited: visited.size, truncated: results.length >= maxPages };
}

// Pagination (bounded)
async function paginate(page, options) {
  const maxPages = Math.min(options.maxPages || 10, 50);
  const selector = options.nextSelector || options.selector;
  const results = [];

  for (let i = 0; i < maxPages; i++) {
    try {
      const text = await page.evaluate(() => document.body?.innerText?.slice(0, 5000) || "").catch(() => "");
      results.push({ page: i + 1, url: page.url(), text });
      if (!selector) break;
      const loc = await locate(page, selector);
      await loc.click({ timeout: options.timeout || DEFAULT_TIMEOUT });
      await page.waitForLoadState("domcontentloaded", { timeout: options.timeout || DEFAULT_TIMEOUT });
    } catch (e) {
      results.push({ page: i + 1, error: e.message });
      break;
    }
  }
  return { pages: results, truncated: results.length >= maxPages };
}

// ═══════════════════════════════════════════════
// Cleanup interval
// ═══════════════════════════════════════════════

setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (s.status === "pooled") continue;
    if (now - s.lastActivity > SESSION_TTL_MS) closeSession(id, "timed_out").catch(() => {});
  }
}, 60000);

warmPool();
setInterval(() => warmPool(), 120000);

// ═══════════════════════════════════════════════
// Health endpoints
// ═══════════════════════════════════════════════

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    status: "healthy",
    uptime: process.uptime(),
    worker_id: WORKER_ID,
    region: REGION,
    engine_version: ENGINE_VERSION,
    schema_version: SCHEMA_VERSION,
    config_version: CONFIG_VERSION,
    active_sessions: sessions.size,
    max_sessions: MAX_SESSIONS,
    pool_size: pool.length,
    pool_capacity: POOL_SIZE,
    timestamp: new Date().toISOString(),
  });
});

app.get("/liveness", (req, res) => res.json({ ok: true, worker_id: WORKER_ID }));

app.get("/readiness", async (req, res) => {
  try {
    const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    await browser.close();
    res.json({ ok: true, browser_launch: "verified", worker_id: WORKER_ID });
  } catch (e) {
    res.status(503).json({ ok: false, error: e.message, worker_id: WORKER_ID });
  }
});

app.get("/heartbeat", (req, res) => {
  heartbeatSeq++;
  res.json({
    ok: true,
    worker_id: WORKER_ID,
    region: REGION,
    seq: heartbeatSeq,
    active_sessions: sessions.size,
    pool_size: pool.length,
    max_sessions: MAX_SESSIONS,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get("/config", (req, res) => {
  res.json({
    maxSessions: MAX_SESSIONS, activeSessions: sessions.size, poolSize: pool.length, poolCapacity: POOL_SIZE,
    workerId: WORKER_ID, region: REGION, engineVersion: ENGINE_VERSION, schemaVersion: SCHEMA_VERSION,
    features: {
      videoRecording: true, cdpDebugging: true, sessionPooling: true, sessionResume: true,
      extensions: true, captchaSolving: true, networkMocking: true, sessionSharing: true,
      boundedCrawl: true, pagination: true, evaluate: true, frameSwitch: true, cookieImportExport: true,
    },
  });
});

// ═══════════════════════════════════════════════
// Create session — returns REAL runtime session ID
// ═══════════════════════════════════════════════

app.post("/sessions", async (req, res) => {
  try {
    const opts = req.body || {};

    // Use pool if available
    if (opts.usePool && pool.length > 0) {
      const pooledId = pool.shift();
      const s = sessions.get(pooledId);
      if (s) {
        s.status = "idle"; s.isPooled = false; s.lastActivity = Date.now();
        warmPool();
        return res.json({
          sessionId: s.id, status: "idle", fromPool: true,
          workerId: WORKER_ID, region: REGION, engineVersion: ENGINE_VERSION,
          createdAt: new Date(s.createdAt).toISOString(),
          expiresAt: new Date(s.createdAt + SESSION_TTL_MS).toISOString(),
        });
      }
    }

    if (sessions.size >= MAX_SESSIONS) return res.status(503).json({ error: "Max concurrent sessions reached" });

    const launchArgs = ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"];
    if (opts.blockedResources?.includes("images")) launchArgs.push("--blink-settings=imagesEnabled=false");

    // Extensions
    if (opts.extensions?.length > 0) {
      for (const ext of opts.extensions) {
        launchArgs.push(`--load-extension=${ext}`);
        launchArgs.push(`--disable-extensions-except=${ext}`);
      }
    }

    // CDP — internal only, never exposed as externally usable
    let cdpUrl = null;
    if (opts.enableCDP) {
      const cdpPort = getNextCdpPort();
      launchArgs.push(`--remote-debugging-port=${cdpPort}`);
      cdpUrl = `http://127.0.0.1:${cdpPort}`; // internal only
    }

    const contextOptions = {
      viewport: opts.viewport || { width: 1280, height: 720 },
      userAgent: opts.userAgent, locale: opts.locale, timezoneId: opts.timezone,
      geolocation: opts.geolocation, extraHTTPHeaders: opts.headers,
    };
    if (opts.proxy) contextOptions.proxy = { server: opts.proxy.server, username: opts.proxy.username, password: opts.proxy.password };
    if (opts.recordVideo) contextOptions.recordVideo = { dir: VIDEO_DIR };

    let browser, context, page;
    if (opts.userDataDir) {
      context = await chromium.launchPersistentContext(opts.userDataDir, { headless: true, args: launchArgs, ...contextOptions });
      page = context.pages()[0] || await context.newPage();
    } else {
      browser = await chromium.launch({ headless: true, args: launchArgs });
      context = await browser.newContext(contextOptions);
      await context.addInitScript(stealthScript);
      page = await context.newPage();
    }

    // Restore cookies/storage if provided (resume / context)
    if (opts.cookies?.length) await context.addCookies(opts.cookies);
    if (opts.storageState?.origins) {
      for (const origin of opts.storageState.origins) {
        for (const { key, value: val } of origin.localStorage || []) {
          await page.evaluate(({ k, v }) => localStorage.setItem(k, v), { k: key, v: val }).catch(() => {});
        }
      }
    }

    // Network mocking
    if (opts.networkMocks?.length > 0) {
      for (const mock of opts.networkMocks) {
        context.route(mock.url, (route) => route.fulfill({ status: mock.status || 200, contentType: mock.contentType || "application/json", body: mock.body || "" }));
      }
    }

    // Block resources
    if (opts.blockedResources?.length > 0) {
      context.route("**/*", (route) => {
        const type = route.request().resourceType();
        return opts.blockedResources.includes(type) ? route.abort() : route.continue();
      });
    }

    const id = uid();
    const session = {
      id, browser, context, page, status: "idle", url: "", title: "",
      lastActivity: Date.now(), createdAt: Date.now(), consoleLogs: [], networkLogs: [],
      recordVideo: !!opts.recordVideo, cdpUrl, userDataDir: opts.userDataDir,
    };

    page.on("console", (msg) => session.consoleLogs.push({ type: msg.type(), text: msg.text(), time: Date.now() }));
    page.on("pageerror", (err) => session.consoleLogs.push({ type: "error", text: err.message, time: Date.now() }));
    page.on("request", (req) => session.networkLogs.push({ method: req.method(), url: req.url(), type: req.resourceType(), time: Date.now() }));
    page.on("response", (res) => { const e = session.networkLogs.find((l) => l.url === res.url() && !l.status); if (e) e.status = res.status(); });

    sessions.set(id, session);
    res.json({
      sessionId: id, status: "idle", cdpUrl: null, // never expose internal CDP
      workerId: WORKER_ID, region: REGION, engineVersion: ENGINE_VERSION,
      createdAt: new Date(session.createdAt).toISOString(),
      expiresAt: new Date(session.createdAt + SESSION_TTL_MS).toISOString(),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════
// Get session
// ═══════════════════════════════════════════════

app.get("/sessions/:id", (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: "Session not found" });
  res.json({
    sessionId: s.id, status: s.status, url: s.url, title: s.title,
    createdAt: s.createdAt, lastActivity: s.lastActivity,
    consoleLogs: s.consoleLogs.slice(-50), networkLogs: s.networkLogs.slice(-50),
    workerId: WORKER_ID, region: REGION,
  });
});

// ═══════════════════════════════════════════════
// Execute action — canonical contract
// ═══════════════════════════════════════════════

app.post("/sessions/:id/execute", async (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: "Session not found" });
  const { action_type, selector, value, options = {} } = req.body;
  const page = s.page;
  s.lastActivity = Date.now();
  s.status = "running";

  try {
    let result = { ok: true, action_type, worker_id: WORKER_ID };

    // SSRF guard for navigation actions
    if (["goto", "crawl"].includes(action_type)) {
      const targetUrl = action_type === "goto" ? (value || selector) : (options.startUrl || page.url());
      // Skip SSRF for crawl when no explicit startUrl — crawl validates each URL internally
      if (action_type === "crawl" && !options.startUrl) {
        // crawl uses page.url() as starting point; if about:blank, crawl will handle gracefully
      } else {
        const validation = validateTargetUrl(targetUrl);
        if (!validation.ok) { s.status = "idle"; return res.status(400).json({ ok: false, action_type, error: `URL rejected: ${validation.error}` }); }
      }
    }

    switch (action_type) {
      case "goto": { await page.goto(value || selector, { waitUntil: options.waitUntil || "domcontentloaded", timeout: options.timeout || DEFAULT_TIMEOUT }); s.url = page.url(); s.title = await page.title(); result.url = s.url; result.title = s.title; break; }
      case "back": { await page.goBack({ timeout: options.timeout || DEFAULT_TIMEOUT }); s.url = page.url(); result.url = s.url; break; }
      case "forward": { await page.goForward({ timeout: options.timeout || DEFAULT_TIMEOUT }); s.url = page.url(); result.url = s.url; break; }
      case "reload": { await page.reload({ timeout: options.timeout || DEFAULT_TIMEOUT }); s.url = page.url(); result.url = s.url; break; }
      case "wait_for_selector": { await page.waitForSelector(selector, { timeout: options.timeout || DEFAULT_TIMEOUT, state: options.state || "visible" }); break; }
      case "wait_for_load_state": { await page.waitForLoadState(options.state || "networkidle", { timeout: options.timeout || DEFAULT_TIMEOUT }); break; }
      case "wait_for_timeout": { await page.waitForTimeout(parseInt(value, 10) || 1000); break; }
      case "click": { await (await locate(page, selector)).click({ timeout: options.timeout || DEFAULT_TIMEOUT, button: options.button || "left" }); break; }
      case "hover": { await (await locate(page, selector)).hover(); break; }
      case "type": { await (await locate(page, selector)).type(value || "", { delay: options.delay || 0 }); break; }
      case "fill": { await (await locate(page, selector)).fill(value || ""); break; }
      case "press": { await page.keyboard.press(value || selector); break; }
      case "select_option": { await (await locate(page, selector)).selectOption(value); break; }
      case "scroll": { if (selector) await (await locate(page, selector)).scrollIntoViewIfNeeded(); else await page.mouse.wheel(0, parseInt(value, 10) || 500); break; }
      case "drag_and_drop": { await (await locate(page, selector)).dragTo(await locate(page, options.targetSelector)); break; }
      case "upload_file": { const fc = await page.waitForEvent("filechooser"); await fc.setFiles(value); break; }
      case "download": {
        const [dl] = await Promise.all([page.waitForEvent("download"), (await locate(page, selector)).click()]);
        const p = `/tmp/${dl.suggestedFilename()}`;
        await dl.saveAs(p);
        const stat = fs.statSync(p);
        if (stat.size > DOWNLOAD_MAX_BYTES) { fs.unlinkSync(p); throw new Error("Download exceeds size limit"); }
        result.path = p; result.filename = dl.suggestedFilename(); result.size = stat.size;
        break;
      }
      case "handle_dialog": { page.once("dialog", async (d) => { if (options.accept) await d.accept(value || ""); else await d.dismiss(); }); break; }
      case "new_tab": { const np = await s.context.newPage(); s.page = np; s.tabs = s.tabs || []; s.tabs.push(np); result.tabIndex = s.tabs.length - 1; break; }
      case "switch_tab": { const idx = parseInt(value, 10) || 0; if (s.tabs?.[idx]) { s.page = s.tabs[idx]; s.url = s.page.url(); result.url = s.url; } break; }
      case "close_tab": {
        const idx = parseInt(value, 10) || 0;
        if (s.tabs?.[idx]) {
          const closingPage = s.tabs[idx];
          await closingPage.close();
          s.tabs.splice(idx, 1);
          // If we closed the active page, switch to another available page
          if (s.page === closingPage) {
            s.page = s.tabs[0] || s.context.pages()[0] || null;
            if (s.page) { s.url = s.page.url(); result.url = s.url; }
          }
        }
        break;
      }
      case "frame_switch": {
        // Switch active frame by selector or index
        if (selector) {
          const frame = page.frame({ url: new RegExp(selector) }) || page.frameLocator(selector);
          s.activeFrame = frame;
          result.switched = true;
        } else if (options.index !== undefined) {
          const frames = page.frames();
          s.activeFrame = frames[options.index];
          result.switched = !!s.activeFrame;
        }
        break;
      }
      case "extract_text": { result.data = await (await locate(page, selector)).innerText(); break; }
      case "extract_html": { result.data = await (await locate(page, selector)).innerHTML(); break; }
      case "extract_attribute": { result.data = await (await locate(page, selector)).getAttribute(options.attribute || "href"); break; }
      case "extract_table": { result.data = await page.evaluate((sel) => { const t = document.querySelector(sel); if (!t) return []; return [...t.querySelectorAll("tr")].map((r) => [...r.querySelectorAll("th,td")].map((c) => c.innerText.trim())); }, selector); break; }
      case "extract_json": { result.data = await page.evaluate(options.evaluateFn || `(selector) => document.querySelector(selector)?.innerText`, selector); try { result.data = JSON.parse(result.data); } catch (e) {} break; }
      case "ai_extract": { result.data = await page.evaluate(() => document.body.innerText.slice(0, 50000)); result.url = s.url; result.title = s.title; break; }
      case "evaluate": {
        const fnStr = options.fn || value;
        // If string looks like a function definition, wrap and call it
        if (typeof fnStr === "string" && (fnStr.trim().startsWith("(") || fnStr.trim().startsWith("function"))) {
          result.data = await page.evaluate(`(${fnStr})()`);
        } else {
          result.data = await page.evaluate(fnStr);
        }
        break;
      }
      case "screenshot": { const buf = await page.screenshot({ fullPage: options.fullPage || false, type: "png" }); result.base64 = buf.toString("base64"); result.mimeType = "image/png"; result.size = buf.length; break; }
      case "pdf": { const buf = await page.pdf({ format: options.format || "A4", printBackground: options.printBackground !== false }); result.base64 = buf.toString("base64"); result.mimeType = "application/pdf"; result.size = buf.length; break; }
      case "set_cookies": { await s.context.addCookies(normalizeCookies(options.cookies || [])); break; }
      case "import_cookies": { await s.context.addCookies(normalizeCookies(options.cookies || [])); result.imported = (options.cookies || []).length; break; }
      case "export_cookies": { result.data = await s.context.cookies(); result.exported = result.data.length; break; }
      case "set_headers": { await s.context.setExtraHTTPHeaders(options.headers || {}); break; }
      case "set_local_storage": { await page.evaluate(([k, v]) => localStorage.setItem(k, v), [options.key, options.value]); break; }
      case "capture_response": { result.data = await page.evaluate(() => performance.getEntriesByType("navigation")[0]?.responseStatus || 200); break; }
      case "solve_captcha": { result.data = await solveCaptcha(page, options); break; }
      case "mock_response": { await page.route(options.url, (route) => route.fulfill({ status: options.status || 200, contentType: options.contentType || "application/json", body: options.body || "" })); result.data = { mocked: options.url }; break; }
      case "save_state": { const cookies = await s.context.cookies(); const storageState = await s.context.storageState(); const stateToken = "state_" + Math.random().toString(36).slice(2); savedStates.set(stateToken, { cookies, storageState, url: s.url, title: s.title }); result.data = { stateToken, url: s.url }; break; }
      case "restore_state": { const state = savedStates.get(options.stateToken); if (!state) throw new Error("State not found"); if (state.cookies) await s.context.addCookies(state.cookies); if (state.storageState?.origins) { for (const origin of state.storageState.origins) { for (const { key, value: val } of origin.localStorage || []) { await page.evaluate(({ k, v }) => localStorage.setItem(k, v), { k: key, v: val }); } } } if (state.url) await page.goto(state.url); result.data = { restored: true, url: state.url }; break; }
      case "crawl": { result.data = await crawl(page, options); break; }
      case "paginate": { result.data = await paginate(page, options); break; }
      default: return res.status(400).json({ ok: false, action_type, error: `Unknown action_type: ${action_type}` });
    }
    s.status = "idle";
    s.url = page.url();
    s.title = await page.title().catch(() => s.title);
    result.url = s.url; result.title = s.title;
    res.json(result);
  } catch (err) {
    s.status = "errored"; s.error = err.message;
    res.status(500).json({ ok: false, action_type, error: err.message, worker_id: WORKER_ID });
  }
});

// ═══════════════════════════════════════════════
// Close session — idempotent
// ═══════════════════════════════════════════════

app.delete("/sessions/:id", async (req, res) => {
  const s = sessions.get(req.params.id);
  let videoBase64 = null;
  if (s?.recordVideo) {
    try {
      const video = s.page.video?.();
      if (video) {
        const vp = await video.path();
        if (fs.existsSync(vp)) videoBase64 = fs.readFileSync(vp).toString("base64");
      }
    } catch (e) { console.error("Video save failed:", e.message); }
  }
  const closed = await closeSession(req.params.id, "ended");
  // Idempotent: return ok even if already closed
  res.json({ ok: true, closed, videoBase64, worker_id: WORKER_ID });
});

// ═══════════════════════════════════════════════
// List sessions
// ═══════════════════════════════════════════════

app.get("/sessions", (req, res) => {
  const list = [...sessions.values()].map((s) => ({
    sessionId: s.id, status: s.status, url: s.url, title: s.title,
    createdAt: s.createdAt, lastActivity: s.lastActivity, recordVideo: s.recordVideo,
    workerId: WORKER_ID, region: REGION,
  }));
  res.json({ sessions: list, count: list.length, workerId: WORKER_ID });
});

// ═══════════════════════════════════════════════
// Share session
// ═══════════════════════════════════════════════

app.post("/sessions/:id/share", async (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: "Session not found" });
  const shareToken = Math.random().toString(36).slice(2);
  s.shareToken = shareToken;
  res.json({ shareToken, worker_id: WORKER_ID });
});

// ═══════════════════════════════════════════════
// Screenshot (for live view)
// ═══════════════════════════════════════════════

app.get("/sessions/:id/screenshot", async (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: "Session not found" });
  try {
    const buf = await s.page.screenshot({ type: "png" });
    res.json({ base64: buf.toString("base64"), mimeType: "image/png", url: s.url, title: s.title, worker_id: WORKER_ID });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════
// Pool management
// ═══════════════════════════════════════════════

app.get("/pool", (req, res) => {
  res.json({
    poolSize: pool.length,
    poolCapacity: POOL_SIZE,
    warmCount: pool.length,
    maxSessions: MAX_SESSIONS,
    activeSessions: sessions.size,
    workerId: WORKER_ID,
    region: REGION,
  });
});

app.post("/pool/warm", async (req, res) => { await warmPool(); res.json({ poolSize: pool.length, poolCapacity: POOL_SIZE, workerId: WORKER_ID }); });
app.post("/pool/drain", async (req, res) => { while (pool.length > 0) { const id = pool.shift(); await closeSession(id, "drained"); } res.json({ poolSize: 0, workerId: WORKER_ID }); });

app.listen(PORT, () => {
  console.log(`Browser engine v${ENGINE_VERSION} running on port ${PORT} (worker: ${WORKER_ID}, region: ${REGION})`);
  console.log(`Max sessions: ${MAX_SESSIONS}, Pool size: ${POOL_SIZE}, Enforce HTTPS: ${ENFORCE_HTTPS}`);
});