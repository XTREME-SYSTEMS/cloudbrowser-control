import express from "express";
import cors from "cors";
import fs from "fs";
import { chromium } from "playwright";

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

const ENGINE_API_KEY = process.env.ENGINE_API_KEY || "changeme";
const PORT = process.env.PORT || 8080;
const MAX_SESSIONS = parseInt(process.env.MAX_SESSIONS || "10", 10);
const DEFAULT_TIMEOUT = parseInt(process.env.DEFAULT_TIMEOUT || "30000", 10);
const SESSION_TTL_MS = parseInt(process.env.SESSION_TTL_MS || "300000", 10);
const POOL_SIZE = parseInt(process.env.POOL_SIZE || "3", 10);
const VIDEO_DIR = process.env.VIDEO_DIR || "/tmp/videos";

if (!fs.existsSync(VIDEO_DIR)) fs.mkdirSync(VIDEO_DIR, { recursive: true });

// ---- Stores ----
const sessions = new Map();
const pool = [];
const savedStates = new Map();
let cdpPortCounter = 9222;

function uid() { return "sess_" + Math.random().toString(36).slice(2) + Date.now().toString(36); }
function getNextCdpPort() { return cdpPortCounter++; }

// ---- Auth ----
app.use((req, res, next) => {
  if (req.path === "/health") return next();
  const key = req.headers["x-api-key"];
  if (!key || key !== ENGINE_API_KEY) return res.status(401).json({ error: "Unauthorized" });
  next();
});

// ---- Stealth ----
const stealthScript = `
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
window.chrome = { runtime: {} };
const originalQuery = window.navigator.permissions.query;
window.navigator.permissions.query = (parameters) =>
  parameters.name === 'notifications' ? Promise.resolve({ state: Notification.permission }) : originalQuery(parameters);
`;

// ---- Helpers ----
async function closeSession(id, reason = "ended") {
  const s = sessions.get(id);
  if (!s) return;
  try { s.status = reason; await s.context.close(); } catch (e) {}
  try { await s.browser?.close(); } catch (e) {}
  sessions.delete(id);
  const idx = pool.indexOf(id);
  if (idx >= 0) pool.splice(idx, 1);
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
      const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
      const context = await browser.newContext();
      await context.addInitScript(stealthScript);
      const page = await context.newPage();
      const id = uid();
      sessions.set(id, { id, browser, context, page, status: "pooled", url: "", title: "", lastActivity: Date.now(), createdAt: Date.now(), consoleLogs: [], networkLogs: [], isPooled: true });
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
      await new Promise(r => setTimeout(r, 5000));
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
  if (options.type === "image") {
    const submitRes = await fetch("https://2captcha.com/in.php", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: apiKey, method: "base64", body: options.imageBase64, json: 1 }),
    });
    const submitData = await submitRes.json();
    if (submitData.status !== 1) throw new Error(submitData.request || "Submit failed");
    const captchaId = submitData.request;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const resRes = await fetch(`https://2captcha.com/res.php?key=${apiKey}&action=get&id=${captchaId}&json=1`);
      const resData = await resRes.json();
      if (resData.status === 1) return { solved: true, text: resData.request };
      if (resData.request !== "CAPCHA_NOT_READY") throw new Error(resData.request);
    }
    throw new Error("CAPTCHA solving timed out");
  }
  throw new Error(`Unsupported CAPTCHA type: ${options.type}`);
}

// ---- Cleanup ----
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (s.status === "pooled") continue;
    if (now - s.lastActivity > SESSION_TTL_MS) closeSession(id, "timed_out").catch(() => {});
  }
}, 60000);

warmPool();
setInterval(() => warmPool(), 120000);

// ---- Health ----
app.get("/health", (req, res) => {
  res.json({ ok: true, uptime: process.uptime(), active_sessions: sessions.size, max_sessions: MAX_SESSIONS, pool_size: pool.length, version: "2.0.0" });
});

// ---- Config ----
app.get("/config", (req, res) => {
  res.json({
    maxSessions: MAX_SESSIONS, activeSessions: sessions.size, poolSize: pool.length,
    features: { videoRecording: true, cdpDebugging: true, sessionPooling: true, sessionResume: true, extensions: true, persistentProfiles: true, captchaSolving: true, networkMocking: true, sessionSharing: true },
  });
});

// ---- Create session ----
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
        return res.json({ sessionId: s.id, status: "idle", fromPool: true });
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

    // CDP
    let cdpUrl = null;
    if (opts.enableCDP) {
      const cdpPort = getNextCdpPort();
      launchArgs.push(`--remote-debugging-port=${cdpPort}`);
      cdpUrl = `http://localhost:${cdpPort}`;
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
    const session = { id, browser, context, page, status: "idle", url: "", title: "", lastActivity: Date.now(), createdAt: Date.now(), consoleLogs: [], networkLogs: [], recordVideo: !!opts.recordVideo, cdpUrl, userDataDir: opts.userDataDir };

    page.on("console", (msg) => session.consoleLogs.push({ type: msg.type(), text: msg.text(), time: Date.now() }));
    page.on("pageerror", (err) => session.consoleLogs.push({ type: "error", text: err.message, time: Date.now() }));
    page.on("request", (req) => session.networkLogs.push({ method: req.method(), url: req.url(), type: req.resourceType(), time: Date.now() }));
    page.on("response", (res) => { const e = session.networkLogs.find((l) => l.url === res.url() && !l.status); if (e) e.status = res.status(); });

    sessions.set(id, session);
    res.json({ sessionId: id, status: "idle", cdpUrl });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---- Get session ----
app.get("/sessions/:id", (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: "Session not found" });
  res.json({ sessionId: s.id, status: s.status, url: s.url, title: s.title, createdAt: s.createdAt, lastActivity: s.lastActivity, cdpUrl: s.cdpUrl, consoleLogs: s.consoleLogs.slice(-50), networkLogs: s.networkLogs.slice(-50) });
});

// ---- Execute action ----
app.post("/sessions/:id/execute", async (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: "Session not found" });
  const { action_type, selector, value, options = {} } = req.body;
  const page = s.page;
  s.lastActivity = Date.now();
  s.status = "running";

  try {
    let result = { ok: true, action_type };
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
      case "download": { const [dl] = await Promise.all([page.waitForEvent("download"), (await locate(page, selector)).click()]); const p = `/tmp/${dl.suggestedFilename()}`; await dl.saveAs(p); result.path = p; result.filename = dl.suggestedFilename(); break; }
      case "handle_dialog": { page.once("dialog", async (d) => { if (options.accept) await d.accept(value || ""); else await d.dismiss(); }); break; }
      case "new_tab": { const np = await s.context.newPage(); s.page = np; s.tabs = s.tabs || []; s.tabs.push(np); result.tabIndex = s.tabs.length - 1; break; }
      case "switch_tab": { const idx = parseInt(value, 10) || 0; if (s.tabs?.[idx]) { s.page = s.tabs[idx]; s.url = s.page.url(); result.url = s.url; } break; }
      case "close_tab": { const idx = parseInt(value, 10) || 0; if (s.tabs?.[idx]) { await s.tabs[idx].close(); s.tabs.splice(idx, 1); } break; }
      case "extract_text": { result.data = await (await locate(page, selector)).innerText(); break; }
      case "extract_html": { result.data = await (await locate(page, selector)).innerHTML(); break; }
      case "extract_attribute": { result.data = await (await locate(page, selector)).getAttribute(options.attribute || "href"); break; }
      case "extract_table": { result.data = await page.evaluate((sel) => { const t = document.querySelector(sel); if (!t) return []; return [...t.querySelectorAll("tr")].map((r) => [...r.querySelectorAll("th,td")].map((c) => c.innerText.trim())); }, selector); break; }
      case "extract_json": { result.data = await page.evaluate(options.evaluateFn || `(selector) => document.querySelector(selector)?.innerText`, selector); try { result.data = JSON.parse(result.data); } catch (e) {} break; }
      case "ai_extract": { result.data = await page.evaluate(() => document.body.innerText.slice(0, 50000)); result.url = s.url; result.title = s.title; break; }
      case "screenshot": { const buf = await page.screenshot({ fullPage: options.fullPage || false, type: "png" }); result.base64 = buf.toString("base64"); result.mimeType = "image/png"; break; }
      case "pdf": { const buf = await page.pdf({ format: options.format || "A4", printBackground: options.printBackground !== false }); result.base64 = buf.toString("base64"); result.mimeType = "application/pdf"; break; }
      case "set_cookies": { await s.context.addCookies(options.cookies || []); break; }
      case "set_headers": { await s.context.setExtraHTTPHeaders(options.headers || {}); break; }
      case "set_local_storage": { await page.evaluate(([k, v]) => localStorage.setItem(k, v), [options.key, options.value]); break; }
      case "capture_response": { result.data = await page.evaluate(() => performance.getEntriesByType("navigation")[0]?.responseStatus || 200); break; }
      case "solve_captcha": { result.data = await solveCaptcha(page, options); break; }
      case "mock_response": { await page.route(options.url, (route) => route.fulfill({ status: options.status || 200, contentType: options.contentType || "application/json", body: options.body || "" })); result.data = { mocked: options.url }; break; }
      case "save_state": { const cookies = await s.context.cookies(); const storageState = await s.context.storageState(); const stateToken = "state_" + Math.random().toString(36).slice(2); savedStates.set(stateToken, { cookies, storageState, url: s.url, title: s.title }); result.data = { stateToken, url: s.url }; break; }
      case "restore_state": { const state = savedStates.get(options.stateToken); if (!state) throw new Error("State not found"); if (state.cookies) await s.context.addCookies(state.cookies); if (state.storageState?.origins) { for (const origin of state.storageState.origins) { for (const { key, value: val } of origin.localStorage || []) { await page.evaluate(({ k, v }) => localStorage.setItem(k, v), { k: key, v: val }); } } } if (state.url) await page.goto(state.url); result.data = { restored: true, url: state.url }; break; }
      default: return res.status(400).json({ error: `Unknown action_type: ${action_type}` });
    }
    s.status = "idle";
    s.url = page.url();
    s.title = await page.title().catch(() => s.title);
    result.url = s.url; result.title = s.title;
    res.json(result);
  } catch (err) {
    s.status = "errored"; s.error = err.message;
    res.status(500).json({ ok: false, action_type, error: err.message });
  }
});

// ---- Close session ----
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
  await closeSession(req.params.id, "ended");
  res.json({ ok: true, videoBase64 });
});

// ---- List sessions ----
app.get("/sessions", (req, res) => {
  const list = [...sessions.values()].map((s) => ({ sessionId: s.id, status: s.status, url: s.url, title: s.title, createdAt: s.createdAt, lastActivity: s.lastActivity, cdpUrl: s.cdpUrl, recordVideo: s.recordVideo }));
  res.json({ sessions: list, count: list.length });
});

// ---- Share session ----
app.post("/sessions/:id/share", async (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: "Session not found" });
  const shareToken = Math.random().toString(36).slice(2);
  s.shareToken = shareToken;
  res.json({ shareToken });
});

// ---- Screenshot (for live view) ----
app.get("/sessions/:id/screenshot", async (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: "Session not found" });
  try {
    const buf = await s.page.screenshot({ type: "png" });
    res.json({ base64: buf.toString("base64"), mimeType: "image/png", url: s.url, title: s.title });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- Pool management ----
app.post("/pool/warm", async (req, res) => { await warmPool(); res.json({ poolSize: pool.length }); });
app.post("/pool/drain", async (req, res) => { while (pool.length > 0) { const id = pool.shift(); await closeSession(id, "drained"); } res.json({ poolSize: 0 }); });

app.listen(PORT, () => { console.log(`Browser engine v2.0 running on port ${PORT}`); console.log(`Max sessions: ${MAX_SESSIONS}, Pool size: ${POOL_SIZE}`); });