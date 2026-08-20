import fs from "fs";
import os from "os";
import { chromium } from "playwright";
import {
  ALLOW_CDP, DEFAULT_EGRESS_POLICY, DEFAULT_TIMEOUT, EXTENSION_BASE,
  MAX_SESSIONS, POOL_SIZE, SESSION_TTL_MS, VIDEO_DIR, WARM_POOL_INSTANCE_BUDGET,
} from "./config.js";
import { installEgressGuard, validateEgressUrl } from "../ssrf.js";
import { createPinnedEgressProxy } from "../egress-proxy.js";

export const sessions = new Map();
export const pool = [];
export const savedStates = new Map();
let cdpPortCounter = 9222;
let shuttingDown = false;
let lastPoolError = null;
let warmPoolPromise = null;
let warmPoolTimer = null;
let warmPoolLaunchFailures = 0;
let browserLaunchTail = Promise.resolve();
let browserLaunchQueued = 0;
let browserLaunchActive = 0;

const stealthScript = `
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
window.chrome = { runtime: {} };
const originalQuery = window.navigator.permissions.query;
window.navigator.permissions.query = (parameters) =>
  parameters.name === 'notifications' ? Promise.resolve({ state: Notification.permission }) : originalQuery(parameters);
`;

export function uid() { return `sess_${crypto.randomUUID().replaceAll("-", "")}`; }
export function sessionPolicy(opts = {}) {
  return { ...DEFAULT_EGRESS_POLICY, ...(opts.egressPolicy || {}), private_network_access: false, metadata_access: false };
}
export function normalizeCookies(cookies) {
  return (cookies || []).map((cookie) => { const next = { ...cookie }; if (!next.url && next.domain && !next.path) next.path = "/"; return next; });
}
export async function locate(page, selector) {
  if (!selector) return page;
  if (selector.startsWith("//") || selector.startsWith("xpath=")) return page.locator(`xpath=${selector.replace(/^xpath=/, "")}`).first();
  return page.locator(selector).first();
}

async function launchChromium(options) {
  browserLaunchQueued++;
  let release;
  const turn = new Promise((resolve) => { release = resolve; });
  const previous = browserLaunchTail;
  browserLaunchTail = browserLaunchTail.then(() => turn);
  await previous;
  browserLaunchQueued--;
  browserLaunchActive++;
  try { return await chromium.launch(options); }
  finally { browserLaunchActive--; release(); }
}

export async function createBrowserContext(opts = {}) {
  const policy = sessionPolicy(opts);
  const egressProxy = await createPinnedEgressProxy({ policy, upstreamProxy: opts.proxy });
  const launchArgs = ["--disable-dev-shm-usage", "--proxy-bypass-list=<-loopback>"];
  if (opts.blockedResources?.includes("images")) launchArgs.push("--blink-settings=imagesEnabled=false");
  if (opts.userDataDir !== undefined && opts.userDataDir !== null) { await egressProxy.close().catch(() => {}); throw new Error("userDataDir is prohibited; only ephemeral profiles are allowed"); }
  if (opts.extensions?.length) {
    for (const extensionId of opts.extensions) {
      if (typeof extensionId !== "string" || !/^[a-zA-Z0-9_-]+$/.test(extensionId)) { await egressProxy.close().catch(() => {}); throw new Error("Invalid extension identifier; filesystem paths are prohibited"); }
      const safePath = `${EXTENSION_BASE}/${extensionId}`;
      if (!fs.existsSync(safePath)) { await egressProxy.close().catch(() => {}); throw new Error(`Extension not installed: ${extensionId}`); }
      launchArgs.push(`--load-extension=${safePath}`, `--disable-extensions-except=${safePath}`);
    }
  }
  let cdpUrl = null;
  if (opts.enableCDP) {
    if (!ALLOW_CDP) { await egressProxy.close().catch(() => {}); throw new Error("CDP disabled by engine policy"); }
    const cdpPort = cdpPortCounter++;
    launchArgs.push(`--remote-debugging-port=${cdpPort}`);
    cdpUrl = `http://127.0.0.1:${cdpPort}`;
  }
  fs.mkdirSync(VIDEO_DIR, { recursive: true });
  let browser;
  let context;
  try {
    browser = await launchChromium({ headless: true, args: launchArgs, proxy: { server: egressProxy.url } });
    browser.on("disconnected", () => { egressProxy.close().catch(() => {}); });
    const contextOptions = {
      viewport: opts.viewport || { width: 1280, height: 720 }, userAgent: opts.userAgent, locale: opts.locale,
      timezoneId: opts.timezone, geolocation: opts.geolocation, extraHTTPHeaders: opts.headers, serviceWorkers: "block",
    };
    if (opts.recordVideo) contextOptions.recordVideo = { dir: VIDEO_DIR };
    context = await browser.newContext(contextOptions);
    await context.addInitScript(stealthScript);
    await installEgressGuard(context, policy, opts.blockedResources || [], opts.networkMocks || []);
    const page = await context.newPage();
    if (opts.cookies?.length) await context.addCookies(normalizeCookies(opts.cookies));
    if (opts.storageState?.origins) {
      for (const origin of opts.storageState.origins) {
        const verdict = await validateEgressUrl(origin.origin, policy);
        if (!verdict.ok) throw new Error(`Storage origin rejected: ${verdict.error}`);
        await page.goto(origin.origin, { waitUntil: "domcontentloaded", timeout: DEFAULT_TIMEOUT });
        for (const { name, key, value } of origin.localStorage || []) await page.evaluate(({ k, v }) => localStorage.setItem(k, v), { k: name ?? key, v: value });
      }
    }
    return { browser, context, page, cdpUrl, egressProxy };
  } catch (error) {
    try { await context?.close(); } catch {}
    try { await browser?.close(); } catch {}
    try { await egressProxy.close(); } catch {}
    throw error;
  }
}

export async function createSession(opts = {}, status = "idle") {
  const { browser, context, page, cdpUrl, egressProxy } = await createBrowserContext(opts);
  const id = uid();
  const session = { id, browser, context, page, status, url: "", title: "", lastActivity: Date.now(), createdAt: Date.now(), consoleLogs: [], networkLogs: [], recordVideo: Boolean(opts.recordVideo), cdpUrl, egressPolicy: sessionPolicy(opts), tabs: [page], isPooled: status === "pooled", egressProxy };
  page.on("console", (msg) => session.consoleLogs.push({ type: msg.type(), text: msg.text(), time: Date.now() }));
  page.on("pageerror", (error) => session.consoleLogs.push({ type: "error", text: error.message, time: Date.now() }));
  page.on("request", (request) => session.networkLogs.push({ method: request.method(), url: request.url(), type: request.resourceType(), time: Date.now() }));
  page.on("response", (response) => { const entry = session.networkLogs.find((item) => item.url === response.url() && !item.status); if (entry) entry.status = response.status(); });
  sessions.set(id, session);
  if (status !== "pooled") scheduleWarmPool();
  return session;
}

export async function closeSession(id, reason = "ended") {
  const session = sessions.get(id);
  if (!session) return false;
  session.status = reason;
  try { await session.context?.close(); } catch {}
  try { await session.browser?.close(); } catch {}
  try { await session.egressProxy?.close(); } catch {}
  sessions.delete(id);
  const index = pool.indexOf(id);
  if (index >= 0) pool.splice(index, 1);
  return true;
}

export function activeSessionCount() { let active = 0; for (const session of sessions.values()) if (session.status !== "pooled") active++; return active; }
export function desiredWarmCount() {
  const active = activeSessionCount();
  return Math.min(POOL_SIZE, Math.max(0, WARM_POOL_INSTANCE_BUDGET - active), Math.max(0, MAX_SESSIONS - active));
}
async function rebalanceWarmPool() {
  while (!shuttingDown) {
    const desired = desiredWarmCount();
    if (pool.length <= desired) break;
    await closeSession(pool[pool.length - 1], "pool_rebalanced");
  }
  while (!shuttingDown) {
    const desired = desiredWarmCount();
    if (pool.length >= desired || sessions.size >= MAX_SESSIONS) break;
    if (browserLaunchActive > 0 || browserLaunchQueued > 0) { scheduleWarmPool(250); break; }
    try {
      const session = await createSession({ usePool: false }, "pooled");
      pool.push(session.id);
      lastPoolError = null;
    } catch (error) {
      warmPoolLaunchFailures++;
      lastPoolError = error.message;
      console.error("Warm pool launch failed:", error.message);
      break;
    }
  }
}
export function warmPool() {
  if (shuttingDown) return Promise.resolve();
  if (warmPoolPromise) return warmPoolPromise;
  warmPoolPromise = rebalanceWarmPool().finally(() => { warmPoolPromise = null; });
  return warmPoolPromise;
}
export function scheduleWarmPool(delayMs = 250) {
  if (shuttingDown) return;
  if (warmPoolTimer) clearTimeout(warmPoolTimer);
  warmPoolTimer = setTimeout(() => { warmPoolTimer = null; warmPool().catch(() => {}); }, Math.max(0, Number(delayMs) || 0));
  warmPoolTimer.unref?.();
}
export function checkoutPooledSession() {
  while (pool.length) {
    const id = pool.shift(); const session = sessions.get(id); if (!session) continue;
    session.status = "idle"; session.isPooled = false; session.lastActivity = Date.now(); return session;
  }
  return null;
}
export function poolError() { return lastPoolError; }
export function poolMetrics() { return { warm_count: pool.length, warm_target: desiredWarmCount(), warm_budget: WARM_POOL_INSTANCE_BUDGET, active_sessions: activeSessionCount(), total_sessions: sessions.size, launch_failures: warmPoolLaunchFailures, replenishing: Boolean(warmPoolPromise), replenish_scheduled: Boolean(warmPoolTimer), launch_active: browserLaunchActive, launch_queued: browserLaunchQueued }; }
export function setShuttingDown(value) { shuttingDown = Boolean(value); if (shuttingDown && warmPoolTimer) { clearTimeout(warmPoolTimer); warmPoolTimer = null; } }
export function isShuttingDown() { return shuttingDown; }
export function runtimeIdentity() { return { uid: process.getuid?.(), gid: process.getgid?.(), home: os.homedir() }; }
export function healthStatus() { const target = desiredWarmCount(); return process.uptime() > 30 && pool.length < target ? "degraded" : "healthy"; }
export function startMaintenance() {
  setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (session.status === "pooled") continue;
      if (now - session.lastActivity > SESSION_TTL_MS) closeSession(id, "timed_out").then(() => scheduleWarmPool()).catch(() => {});
    }
  }, 60000).unref();
  setInterval(() => warmPool().catch(() => {}), 30000).unref();
  warmPool().catch(() => {});
}
