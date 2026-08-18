import express from "express";
import cors from "cors";
import { chromium } from "playwright";

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

const ENGINE_API_KEY = process.env.ENGINE_API_KEY || "changeme";
const PORT = process.env.PORT || 8080;
const MAX_SESSIONS = parseInt(process.env.MAX_SESSIONS || "10", 10);
const DEFAULT_TIMEOUT = parseInt(process.env.DEFAULT_TIMEOUT || "30000", 10);
const SESSION_TTL_MS = parseInt(process.env.SESSION_TTL_MS || "300000", 10); // 5 min idle

// ---- Session store ----
const sessions = new Map(); // id -> { browser, context, page, status, url, title, lastActivity, createdAt, tabs: [] }

function uid() {
  return "sess_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ---- Auth middleware ----
app.use((req, res, next) => {
  if (req.path === "/health") return next();
  const key = req.headers["x-api-key"];
  if (!key || key !== ENGINE_API_KEY) {
    return res.status(401).json({ error: "Unauthorized: invalid or missing API key" });
  }
  next();
});

// ---- Stealth init script (basic anti-bot evasion) ----
const stealthScript = `
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
window.chrome = { runtime: {} };
const originalQuery = window.navigator.permissions.query;
window.navigator.permissions.query = (parameters) =>
  parameters.name === 'notifications'
    ? Promise.resolve({ state: Notification.permission })
    : originalQuery(parameters);
`;

// ---- Session cleanup ----
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s.lastActivity > SESSION_TTL_MS) {
      console.log(`[cleanup] timing out session ${id}`);
      closeSession(id, "timed_out").catch(() => {});
    }
  }
}, 60000);

async function closeSession(id, reason = "ended") {
  const s = sessions.get(id);
  if (!s) return;
  try {
    s.status = reason;
    await s.context.close();
  } catch (e) {}
  try {
    await s.browser.close();
  } catch (e) {}
  sessions.delete(id);
}

// ---- Helper: resolve selector (CSS or XPath) ----
async function locate(page, selector) {
  if (!selector) return page;
  if (selector.startsWith("//") || selector.startsWith("xpath=")) {
    const xpath = selector.replace(/^xpath=/, "");
    return page.locator(`xpath=${xpath}`).first();
  }
  return page.locator(selector).first();
}

// ---- Health ----
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    uptime: process.uptime(),
    active_sessions: sessions.size,
    max_sessions: MAX_SESSIONS,
    version: "1.0.0",
  });
});

// ---- Create session ----
app.post("/sessions", async (req, res) => {
  try {
    if (sessions.size >= MAX_SESSIONS) {
      return res.status(503).json({ error: "Max concurrent sessions reached" });
    }
    const opts = req.body || {};
    const launchArgs = ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"];
    if (opts.blockedResources?.includes("images")) launchArgs.push("--blink-settings=imagesEnabled=false");

    const browser = await chromium.launch({ headless: true, args: launchArgs });

    const contextOptions = {
      viewport: opts.viewport || { width: 1280, height: 720 },
      userAgent: opts.userAgent,
      locale: opts.locale,
      timezoneId: opts.timezone,
      geolocation: opts.geolocation,
      extraHTTPHeaders: opts.headers,
    };
    if (opts.proxy) {
      contextOptions.proxy = {
        server: opts.proxy.server,
        username: opts.proxy.username,
        password: opts.proxy.password,
      };
    }
    const context = await browser.newContext(contextOptions);

    // Stealth
    await context.addInitScript(stealthScript);

    // Block resources
    if (opts.blockedResources && opts.blockedResources.length > 0) {
      context.route("**/*", (route) => {
        const type = route.request().resourceType();
        if (opts.blockedResources.includes(type)) return route.abort();
        return route.continue();
      });
    }

    const page = await context.newPage();
    const id = uid();
    const session = {
      id,
      browser,
      context,
      page,
      status: "idle",
      url: "",
      title: "",
      lastActivity: Date.now(),
      createdAt: Date.now(),
      consoleLogs: [],
      networkLogs: [],
    };

    // Capture console + network
    page.on("console", (msg) => session.consoleLogs.push({ type: msg.type(), text: msg.text(), time: Date.now() }));
    page.on("pageerror", (err) => session.consoleLogs.push({ type: "error", text: err.message, time: Date.now() }));
    page.on("request", (req) => session.networkLogs.push({ method: req.method(), url: req.url(), type: req.resourceType(), time: Date.now() }));
    page.on("response", (res) => {
      const entry = session.networkLogs.find((l) => l.url === res.url() && !l.status);
      if (entry) entry.status = res.status();
    });

    sessions.set(id, session);
    res.json({ sessionId: id, status: "idle" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Get session status ----
app.get("/sessions/:id", (req, res) => {
  const s = sessions.get(req.params.id);
  if (!s) return res.status(404).json({ error: "Session not found" });
  res.json({
    sessionId: s.id,
    status: s.status,
    url: s.url,
    title: s.title,
    createdAt: s.createdAt,
    lastActivity: s.lastActivity,
    consoleLogs: s.consoleLogs.slice(-50),
    networkLogs: s.networkLogs.slice(-50),
  });
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
      // --- Navigation ---
      case "goto": {
        await page.goto(value || selector, { waitUntil: options.waitUntil || "domcontentloaded", timeout: options.timeout || DEFAULT_TIMEOUT });
        s.url = page.url();
        s.title = await page.title();
        result.url = s.url;
        result.title = s.title;
        break;
      }
      case "back": { await page.goBack({ timeout: options.timeout || DEFAULT_TIMEOUT }); s.url = page.url(); result.url = s.url; break; }
      case "forward": { await page.goForward({ timeout: options.timeout || DEFAULT_TIMEOUT }); s.url = page.url(); result.url = s.url; break; }
      case "reload": { await page.reload({ timeout: options.timeout || DEFAULT_TIMEOUT }); s.url = page.url(); result.url = s.url; break; }

      // --- Waiting ---
      case "wait_for_selector": {
        await page.waitForSelector(selector, { timeout: options.timeout || DEFAULT_TIMEOUT, state: options.state || "visible" });
        break;
      }
      case "wait_for_load_state": { await page.waitForLoadState(options.state || "networkidle", { timeout: options.timeout || DEFAULT_TIMEOUT }); break; }
      case "wait_for_timeout": { await page.waitForTimeout(parseInt(value, 10) || 1000); break; }

      // --- Interaction ---
      case "click": { await (await locate(page, selector)).click({ timeout: options.timeout || DEFAULT_TIMEOUT, button: options.button || "left" }); break; }
      case "hover": { await (await locate(page, selector)).hover(); break; }
      case "type": { await (await locate(page, selector)).type(value || "", { delay: options.delay || 0 }); break; }
      case "fill": { await (await locate(page, selector)).fill(value || ""); break; }
      case "press": { await page.keyboard.press(value || selector); break; }
      case "select_option": { await (await locate(page, selector)).selectOption(value); break; }
      case "scroll": {
        if (selector) await (await locate(page, selector)).scrollIntoViewIfNeeded();
        else await page.mouse.wheel(0, parseInt(value, 10) || 500);
        break;
      }
      case "drag_and_drop": {
        const src = await locate(page, selector);
        const dst = await locate(page, options.targetSelector);
        await src.dragTo(dst);
        break;
      }
      case "upload_file": {
        const fileChooser = await page.waitForEvent("filechooser");
        await fileChooser.setFiles(value); // path or URL
        break;
      }
      case "download": {
        const [download] = await Promise.all([page.waitForEvent("download"), (await locate(page, selector)).click()]);
        const path = `/tmp/${download.suggestedFilename()}`;
        await download.saveAs(path);
        result.path = path;
        result.filename = download.suggestedFilename();
        break;
      }
      case "handle_dialog": {
        page.once("dialog", async (dialog) => {
          if (options.accept) await dialog.accept(value || "");
          else await dialog.dismiss();
        });
        break;
      }

      // --- Tabs ---
      case "new_tab": {
        const newPage = await s.context.newPage();
        s.page = newPage;
        s.tabs = s.tabs || [];
        s.tabs.push(newPage);
        result.tabIndex = s.tabs.length - 1;
        break;
      }
      case "switch_tab": {
        const idx = parseInt(value, 10) || 0;
        if (s.tabs && s.tabs[idx]) { s.page = s.tabs[idx]; s.url = s.page.url(); result.url = s.url; }
        break;
      }
      case "close_tab": {
        const idx = parseInt(value, 10) || 0;
        if (s.tabs && s.tabs[idx]) { await s.tabs[idx].close(); s.tabs.splice(idx, 1); }
        break;
      }

      // --- Extraction ---
      case "extract_text": { result.data = await (await locate(page, selector)).innerText(); break; }
      case "extract_html": { result.data = await (await locate(page, selector)).innerHTML(); break; }
      case "extract_attribute": { result.data = await (await locate(page, selector)).getAttribute(options.attribute || "href"); break; }
      case "extract_table": {
        result.data = await page.evaluate((sel) => {
          const table = document.querySelector(sel);
          if (!table) return [];
          const rows = [...table.querySelectorAll("tr")];
          return rows.map((row) => [...row.querySelectorAll("th,td")].map((cell) => cell.innerText.trim()));
        }, selector);
        break;
      }
      case "extract_json": {
        result.data = await page.evaluate(options.evaluateFn || `(selector) => document.querySelector(selector)?.innerText`, selector);
        try { result.data = JSON.parse(result.data); } catch (e) {}
        break;
      }
      case "ai_extract": {
        // Return page text content for the backend function to pass to InvokeLLM
        result.data = await page.evaluate(() => document.body.innerText.slice(0, 50000));
        result.url = s.url;
        result.title = s.title;
        break;
      }

      // --- Screenshot / PDF ---
      case "screenshot": {
        const buf = await page.screenshot({ fullPage: options.fullPage || false, type: "png" });
        result.base64 = buf.toString("base64");
        result.mimeType = "image/png";
        break;
      }
      case "pdf": {
        const buf = await page.pdf({ format: options.format || "A4", printBackground: options.printBackground !== false });
        result.base64 = buf.toString("base64");
        result.mimeType = "application/pdf";
        break;
      }

      // --- State ---
      case "set_cookies": { await s.context.addCookies(options.cookies || []); break; }
      case "set_headers": { await s.context.setExtraHTTPHeaders(options.headers || {}); break; }
      case "set_local_storage": { await page.evaluate(([k, v]) => localStorage.setItem(k, v), [options.key, options.value]); break; }
      case "capture_response": {
        result.data = await page.evaluate(() => performance.getEntriesByType("navigation")[0]?.responseStatus || 200);
        break;
      }

      default:
        return res.status(400).json({ error: `Unknown action_type: ${action_type}` });
    }

    s.status = "idle";
    s.url = page.url();
    s.title = await page.title().catch(() => s.title);
    result.url = s.url;
    result.title = s.title;
    res.json(result);
  } catch (err) {
    s.status = "errored";
    s.error = err.message;
    res.status(500).json({ ok: false, action_type, error: err.message });
  }
});

// ---- Close session ----
app.delete("/sessions/:id", async (req, res) => {
  await closeSession(req.params.id, "ended");
  res.json({ ok: true });
});

// ---- List sessions ----
app.get("/sessions", (req, res) => {
  const list = [...sessions.values()].map((s) => ({
    sessionId: s.id, status: s.status, url: s.url, title: s.title, createdAt: s.createdAt, lastActivity: s.lastActivity,
  }));
  res.json({ sessions: list, count: list.length });
});

app.listen(PORT, () => {
  console.log(`Browser engine running on port ${PORT}`);
  console.log(`Max sessions: ${MAX_SESSIONS}`);
});