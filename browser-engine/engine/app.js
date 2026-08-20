import express from "express";
import cors from "cors";
import fs from "fs";
import {
  ALLOW_CDP, CONFIG_VERSION, CORS_ALLOWLIST, ENGINE_API_KEY, ENGINE_VERSION,
  MAX_SESSIONS, POOL_SIZE, PORT, REGION, SCHEMA_VERSION, SESSION_TTL_MS,
  UPLOAD_MAX_BYTES, WORKER_ID, assertEngineConfig,
} from "./config.js";
import {
  checkoutPooledSession, closeSession, createBrowserContext, createSession,
  healthStatus, isShuttingDown, pool, poolError, runtimeIdentity, sessions,
  scheduleWarmPool, setShuttingDown, startMaintenance,
} from "./runtime.js";
import { executeAction } from "./actions.js";
import { SSRF_LIMITATION } from "../ssrf.js";

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function hasCallerOptions(opts) {
  return Boolean(
    opts.proxy || opts.headers || opts.blockedResources?.length || opts.networkMocks?.length ||
    opts.cookies?.length || opts.storageState || opts.extensions?.length || opts.enableCDP ||
    opts.recordVideo || (opts.egressPolicy && Object.keys(opts.egressPolicy).length > 0)
  );
}

export function createApp() {
  assertEngineConfig();
  const app = express();
  const corsOptions = {
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (CORS_ALLOWLIST.length === 0) return callback(new Error("CORS disabled: no origins configured"));
      if (CORS_ALLOWLIST.includes(origin)) return callback(null, true);
      return callback(new Error("Origin not allowed"));
    },
    credentials: true,
  };
  app.use(cors(corsOptions));
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: false, limit: "2mb" }));

  app.use((req, res, next) => {
    if (["/health", "/liveness", "/readiness"].includes(req.path)) return next();
    const key = req.headers["x-api-key"] || "";
    if (!key || !timingSafeEqual(String(key), ENGINE_API_KEY)) return res.status(401).json({ error: "Unauthorized" });
    return next();
  });

  let heartbeatSeq = 0;
  app.get("/health", (req, res) => {
    const status = healthStatus();
    res.status(status === "healthy" ? 200 : 503).json({
      status, worker_id: WORKER_ID, region: REGION, engine_version: ENGINE_VERSION, schema_version: SCHEMA_VERSION,
      config_version: CONFIG_VERSION, runtime_user: runtimeIdentity(), active_sessions: sessions.size,
      max_sessions: MAX_SESSIONS, pool_size: pool.length, pool_capacity: POOL_SIZE,
      pool_error: poolError(), ssrf_limitation: SSRF_LIMITATION, timestamp: new Date().toISOString(),
    });
  });
  app.get("/liveness", (req, res) => res.json({ ok: true, worker_id: WORKER_ID }));
  app.get("/readiness", async (req, res) => {
    try {
      const { browser, context } = await createBrowserContext({ usePool: false });
      await context.close();
      await browser.close();
      res.json({ ok: true, browser_launch: "verified", runtime_user: runtimeIdentity(), worker_id: WORKER_ID });
    } catch (error) {
      res.status(503).json({ ok: false, error: error.message, runtime_user: runtimeIdentity(), worker_id: WORKER_ID });
    }
  });
  app.get("/heartbeat", (req, res) => {
    heartbeatSeq++;
    res.json({ ok: true, worker_id: WORKER_ID, region: REGION, seq: heartbeatSeq, active_sessions: sessions.size, pool_size: pool.length, max_sessions: MAX_SESSIONS, uptime: process.uptime(), timestamp: new Date().toISOString() });
  });
  app.get("/config", (req, res) => res.json({
    maxSessions: MAX_SESSIONS, activeSessions: sessions.size, poolSize: pool.length,
    poolCapacity: POOL_SIZE, workerId: WORKER_ID, region: REGION, engineVersion: ENGINE_VERSION,
    schemaVersion: SCHEMA_VERSION,
    features: { videoRecording: true, cdpDebugging: ALLOW_CDP, sessionPooling: true, sessionResume: true, extensions: true, captchaSolving: true, networkMocking: true, sessionSharing: true, boundedCrawl: true, pagination: true, evaluate: true, frameSwitch: true, cookieImportExport: true },
  }));

  app.post("/sessions", async (req, res) => {
    try {
      const opts = req.body || {};
      if (opts.userDataDir !== undefined && opts.userDataDir !== null) return res.status(400).json({ error: "userDataDir is prohibited" });
      if (opts.extensions?.some((id) => typeof id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(id))) return res.status(400).json({ error: "Invalid extension identifier" });

      if (opts.usePool && !hasCallerOptions(opts)) {
        const pooled = checkoutPooledSession();
        if (pooled) {
          scheduleWarmPool();
          return res.json({ sessionId: pooled.id, status: "idle", fromPool: true, workerId: WORKER_ID, region: REGION, engineVersion: ENGINE_VERSION, createdAt: new Date(pooled.createdAt).toISOString(), expiresAt: new Date(pooled.createdAt + SESSION_TTL_MS).toISOString() });
        }
      }
      if (sessions.size >= MAX_SESSIONS) return res.status(503).json({ error: "Max concurrent sessions reached" });

      const session = await createSession(opts, "idle");
      return res.json({ sessionId: session.id, status: "idle", cdpUrl: null, workerId: WORKER_ID, region: REGION, engineVersion: ENGINE_VERSION, createdAt: new Date(session.createdAt).toISOString(), expiresAt: new Date(session.createdAt + SESSION_TTL_MS).toISOString() });
    } catch (error) { return res.status(400).json({ error: error.message }); }
  });

  app.get("/sessions/:id", (req, res) => {
    const session = sessions.get(req.params.id);
    if (!session) return res.status(404).json({ error: "Session not found" });
    return res.json({ sessionId: session.id, status: session.status, url: session.url, title: session.title, createdAt: session.createdAt, lastActivity: session.lastActivity, consoleLogs: session.consoleLogs.slice(-50), networkLogs: session.networkLogs.slice(-50), workerId: WORKER_ID, region: REGION });
  });

  app.post("/sessions/:id/execute", async (req, res) => {
    const session = sessions.get(req.params.id);
    if (!session) return res.status(404).json({ error: "Session not found" });
    try { return res.json(await executeAction(session, req.body || {}, WORKER_ID)); }
    catch (error) {
      session.status = "errored";
      session.error = error.message;
      return res.status(error.status || 500).json({ ok: false, action_type: req.body?.action_type, error: error.message, worker_id: WORKER_ID });
    }
  });

  app.delete("/sessions/:id", async (req, res) => {
    const session = sessions.get(req.params.id);
    let videoBase64 = null;
    if (session?.recordVideo) {
      try {
        const video = session.page.video?.();
        if (video) { const path = await video.path(); if (fs.existsSync(path)) videoBase64 = fs.readFileSync(path).toString("base64"); }
      } catch {}
    }
    const closed = await closeSession(req.params.id, "ended");
    scheduleWarmPool();
    return res.json({ ok: true, closed, videoBase64, worker_id: WORKER_ID });
  });

  app.get("/sessions", (req, res) => {
    const list = [...sessions.values()].map((session) => ({ sessionId: session.id, status: session.status, url: session.url, title: session.title, createdAt: session.createdAt, lastActivity: session.lastActivity, recordVideo: session.recordVideo, workerId: WORKER_ID, region: REGION }));
    res.json({ sessions: list });
  });

  app.get("/pool", (req, res) => res.json({ warmCount: pool.length, capacity: POOL_SIZE, activeSessions: sessions.size, workerId: WORKER_ID }));
  app.post("/pool/warm", async (req, res) => { scheduleWarmPool(0); res.json({ ok: true, warmCount: pool.length, capacity: POOL_SIZE, workerId: WORKER_ID }); });
  app.post("/pool/clear", async (req, res) => {
    for (const id of [...pool]) await closeSession(id, "pool_cleared");
    res.json({ ok: true, warmCount: pool.length, workerId: WORKER_ID });
  });

  app.get("/config/limits", (req, res) => res.json({ uploadMaxBytes: UPLOAD_MAX_BYTES, maxSessions: MAX_SESSIONS, sessionTtlMs: SESSION_TTL_MS, poolCapacity: POOL_SIZE, workerId: WORKER_ID }));
  app.get("/shutdown-status", (req, res) => res.json({ shutting_down: isShuttingDown(), active_sessions: sessions.size, pool_size: pool.length, worker_id: WORKER_ID }));

  return app;
}

export async function shutdown() {
  if (isShuttingDown()) return;
  setShuttingDown(true);
  const ids = [...sessions.keys()];
  await Promise.all(ids.map((id) => closeSession(id, "shutdown")));
}
