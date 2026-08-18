import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { enginePost, engineDelete, engineGet, isEngineConfigured, setEngineClient } from "../../shared/engineClient.ts";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";

// ═══════════════════════════════════════════════
// API Gateway v1 — secure, canonical, real runtime
// ═══════════════════════════════════════════════

async function hashKey(key) {
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

// CIDR matching
function ipInCidr(ip, cidr) {
  const [range, bits] = cidr.split("/");
  const mask = bits ? parseInt(bits, 10) : 32;
  if (mask === 0) return true;
  const ipParts = ip.split(".").map(Number);
  const rangeParts = range.split(".").map(Number);
  if (ipParts.length !== 4 || rangeParts.length !== 4) return false;
  const ipNum = (ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3];
  const rangeNum = (rangeParts[0] << 24) | (rangeParts[1] << 16) | (rangeParts[2] << 8) | rangeParts[3];
  const shift = 32 - mask;
  return (ipNum >>> shift) === (rangeNum >>> shift);
}

function ipAllowed(ip, allowlist) {
  if (!allowlist?.length) return true; // no allowlist = open
  for (const entry of allowlist) {
    if (entry.includes("/")) { if (ipInCidr(ip, entry)) return true; }
    else if (ip === entry) return true;
  }
  return false;
}

// Derive real client IP from request — never trust caller-supplied value
function deriveClientIP(req) {
  const fwd = req.headers.get("x-forwarded-for") || "";
  const first = fwd.split(",")[0].trim();
  if (first) return first;
  return req.headers.get("x-real-ip") || "";
}

// Database-backed rate limit — persists across function invocations.
// Fixed-window approach: one RateLimitEntry per (key_hash, minute window).
// ATOMIC: increment-first via updateMany $inc, then check. Eliminates race condition.
// For distributed production with Redis, swap this function for a Redis adapter.
async function checkRateLimit(base44, keyHash, limitPerMinute) {
  const now = Date.now();
  const windowStart = Math.floor(now / 60000) * 60000;

  // Step 1: Atomically increment if entry exists (MongoDB $inc is atomic)
  const updateResult = await base44.asServiceRole.entities.RateLimitEntry.updateMany(
    { key_hash: keyHash, window_start: windowStart },
    { $inc: { count: 1 } }
  );

  // Step 2: If no entry existed, create one (first request in window)
  if (updateResult.modified_count === 0) {
    try {
      await base44.asServiceRole.entities.RateLimitEntry.create({
        key_hash: keyHash,
        window_start: windowStart,
        count: 1,
      });
      return true;
    } catch (e) {
      // Race: another request created it — fall through to read
    }
  }

  // Step 3: Read all entries (handles duplicate entries from creation race)
  const entries = await base44.asServiceRole.entities.RateLimitEntry.filter({
    key_hash: keyHash,
    window_start: windowStart,
  });

  if (entries.length === 0) return true; // safe default

  // Step 4: If duplicates exist (from creation race), merge them
  if (entries.length > 1) {
    const totalCount = entries.reduce((sum, e) => sum + e.count, 0);
    await base44.asServiceRole.entities.RateLimitEntry.update(entries[0].id, { count: totalCount });
    for (let i = 1; i < entries.length; i++) {
      await base44.asServiceRole.entities.RateLimitEntry.delete(entries[i].id).catch(() => {});
    }
    return totalCount <= limitPerMinute;
  }

  // Step 5: Single entry — check count
  return entries[0].count <= limitPerMinute;
}

// Route → required scope
const ROUTE_SCOPES = {
  "GET:/health": null,
  "GET:/sessions": "sessions:read",
  "POST:/sessions": "sessions:write",
  "GET:/sessions/:id": "sessions:read",
  "POST:/sessions/:id/action": "sessions:write",
  "DELETE:/sessions/:id": "sessions:write",
  "GET:/jobs": "jobs:read",
  "POST:/jobs": "jobs:write",
  "POST:/jobs/:id/run": "jobs:write",
  "GET:/jobs/:id/results": "jobs:read",
  "GET:/projects": "projects:read",
};

function matchRoute(method, rawPath) {
  const parts = (rawPath || "").split("/").filter(Boolean);
  const m = method.toUpperCase();
  if (m === "GET" && parts.join("/") === "health") return { route: "GET:/health", params: {} };
  if (m === "GET" && parts[0] === "sessions" && parts.length === 1) return { route: "GET:/sessions", params: {} };
  if (m === "POST" && parts[0] === "sessions" && parts.length === 1) return { route: "POST:/sessions", params: {} };
  if (m === "GET" && parts[0] === "sessions" && parts.length === 2) return { route: "GET:/sessions/:id", params: { id: parts[1] } };
  if (m === "POST" && parts[0] === "sessions" && parts.length === 3 && parts[2] === "action") return { route: "POST:/sessions/:id/action", params: { id: parts[1] } };
  if (m === "DELETE" && parts[0] === "sessions" && parts.length === 2) return { route: "DELETE:/sessions/:id", params: { id: parts[1] } };
  if (m === "GET" && parts[0] === "jobs" && parts.length === 1) return { route: "GET:/jobs", params: {} };
  if (m === "POST" && parts[0] === "jobs" && parts.length === 1) return { route: "POST:/jobs", params: {} };
  if (m === "POST" && parts[0] === "jobs" && parts.length === 3 && parts[2] === "run") return { route: "POST:/jobs/:id/run", params: { id: parts[1] } };
  if (m === "GET" && parts[0] === "jobs" && parts.length === 3 && parts[2] === "results") return { route: "GET:/jobs/:id/results", params: { id: parts[1] } };
  if (m === "GET" && parts[0] === "projects" && parts.length === 1) return { route: "GET:/projects", params: {} };
  return null;
}

function errorResponse(status, error, requestId) {
  return Response.json({ error, request_id: requestId, __v: DEPLOYMENT_VERSION }, { status });
}

export default async function (req) {
  const base44 = createClientFromRequest(req);
  setEngineClient(base44);
  const requestId = req.headers.get("x-request-id") || "req_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);

  try {
    const body = await req.json();
    const { path: requestPath, method: requestMethod = "GET", data = {} } = body;

    // ── Authenticate via body api_key (preferred) or Authorization header ──
    // The Authorization header in internal function calls carries a platform JWT,
    // not an API key. Only use it if it matches the API key prefix.
    const authHeader = req.headers.get("authorization") || "";
    const headerKey = authHeader.replace(/^Bearer\s+/i, "");
    const headerIsApiKey = headerKey.startsWith("cb_live_") || headerKey.startsWith("cb_test_");
    const apiKey = (headerIsApiKey ? headerKey : "") || body.api_key || "";

    if (!apiKey) return errorResponse(401, "Missing API key. Provide Authorization: Bearer <key> header.", requestId);

    const keyHash = await hashKey(apiKey);
    const keys = await base44.asServiceRole.entities.ApiKey.filter({ key_hash: keyHash, active: true });
    if (!keys.length) return errorResponse(401, "Invalid or revoked API key", requestId);
    const keyRecord = keys[0];

    // Check expiration
    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
      return errorResponse(401, "API key expired", requestId);
    }

    base44.asServiceRole.entities.ApiKey.update(keyRecord.id, { last_used: new Date().toISOString() }).catch(() => {});

    // ── System settings ──
    const settings = await base44.asServiceRole.entities.SystemSettings.list("-created_date", 1);
    const sysSettings = settings[0] || {};

    // ── IP allowlist — derive from request, fail-closed ──
    if (sysSettings.ip_allowlist?.length) {
      const ip = deriveClientIP(req);
      if (!ip) return errorResponse(403, "Unable to determine client IP — allowlist requires transparent proxy header", requestId);
      if (!ipAllowed(ip, sysSettings.ip_allowlist)) {
        return errorResponse(403, `IP ${ip} is not allowlisted`, requestId);
      }
    }

    // ── Rate limit (database-backed, persists across invocations) ──
    const rateLimit = sysSettings.rate_limit_per_minute || 60;
    if (!await checkRateLimit(base44, keyHash, rateLimit)) {
      return errorResponse(429, "Rate limit exceeded", requestId);
    }

    // ── Route match ──
    const matched = matchRoute(requestMethod, requestPath);
    if (!matched) return errorResponse(404, `Unknown route: ${requestMethod} ${requestPath}`, requestId);

    // ── Scope check ──
    const requiredScope = ROUTE_SCOPES[matched.route];
    if (requiredScope && !(keyRecord.scopes || []).includes(requiredScope)) {
      return errorResponse(403, `Insufficient scope. Required: ${requiredScope}`, requestId);
    }

    // ── Dispatch ──
    const result = await dispatch(base44, matched.route, matched.params, data, keyRecord, requestId);
    return result;
  } catch (error) {
    return errorResponse(500, error.message, requestId);
  }
}

async function dispatch(base44, route, params, data, keyRecord, requestId) {
  switch (route) {
    case "GET:/health":
      return Response.json({ status: "ok", timestamp: new Date().toISOString(), request_id: requestId, __v: DEPLOYMENT_VERSION });

    case "GET:/sessions": {
      const sessions = await base44.asServiceRole.entities.Session.list("-created_date", 50);
      return Response.json({ sessions, request_id: requestId });
    }

    case "POST:/sessions": {
      // Create REAL browser session on the engine
      if (!await isEngineConfigured()) {
        return errorResponse(503, "Browser engine not configured", requestId);
      }
      let engineRes;
      try {
        engineRes = await enginePost("/sessions", {
          viewport: data.viewport,
          userAgent: data.user_agent,
          locale: data.locale,
          timezone: data.timezone,
          geolocation: data.geolocation,
          proxy: data.proxy,
          headers: data.headers,
          blockedResources: data.blocked_resources,
          recordVideo: data.record_video,
          enableCDP: data.enable_cdp,
          extensions: data.extensions,
          userDataDir: data.user_data_dir,
          networkMocks: data.network_mocks,
          usePool: data.use_pool !== false,
          cookies: data.cookies,
          storageState: data.storage_state,
        });
      } catch (err) {
        return errorResponse(502, `Engine session creation failed: ${err.message}`, requestId);
      }

      const runtimeSessionId = engineRes.sessionId;
      if (!runtimeSessionId) {
        return errorResponse(502, "Engine returned no runtime session ID", requestId);
      }

      // Persist control-plane record with BOTH IDs
      const session = await base44.asServiceRole.entities.Session.create({
        session_id: runtimeSessionId,
        status: "idle",
        target_url: data.target_url || "",
        viewport: data.viewport,
        user_agent: data.user_agent,
        locale: data.locale,
        timezone: data.timezone,
        geolocation: data.geolocation,
        proxy_id: data.proxy_id,
        headers: data.headers,
        blocked_resources: data.blocked_resources,
        tags: data.tags,
        timeout_ms: data.timeout_ms || 30000,
        record_video: data.record_video || false,
        enable_cdp: data.enable_cdp || false,
        metadata: {
          ...data.metadata,
          worker_id: engineRes.workerId,
          region: engineRes.region,
          engine_version: engineRes.engineVersion,
          created_at: engineRes.createdAt,
          expires_at: engineRes.expiresAt,
          config_version: engineRes.configVersion,
          project_id: keyRecord.project_id || data.project_id,
        },
        started_at: new Date().toISOString(),
        project_id: keyRecord.project_id || data.project_id,
      });

      return Response.json({
        session,
        runtime_session_id: runtimeSessionId,
        control_plane_session_id: session.id,
        worker_id: engineRes.workerId,
        region: engineRes.region,
        engine_version: engineRes.engineVersion,
        request_id: requestId,
      }, { status: 201 });
    }

    case "GET:/sessions/:id": {
      const session = await base44.asServiceRole.entities.Session.get(params.id);
      if (!session) return errorResponse(404, "Session not found", requestId);
      return Response.json({ session, request_id: requestId });
    }

    case "POST:/sessions/:id/action": {
      // Resolve Base44 control-plane ID → runtime session ID
      const session = await base44.asServiceRole.entities.Session.get(params.id);
      if (!session) return errorResponse(404, "Session not found", requestId);
      if (!session.session_id) return errorResponse(409, "Session has no runtime ID — cannot execute action", requestId);

      if (!await isEngineConfigured()) return errorResponse(503, "Browser engine not configured", requestId);

      // Canonical action contract
      let engineRes;
      try {
        engineRes = await enginePost(`/sessions/${session.session_id}/execute`, {
          action_type: data.action_type,
          selector: data.selector,
          value: data.value,
          options: data.options || {},
        });
      } catch (err) {
        return errorResponse(502, `Engine action failed: ${err.message}`, requestId);
      }

      // Update session URL/title from result
      if (engineRes.url) {
        await base44.asServiceRole.entities.Session.update(params.id, {
          current_url: engineRes.url,
          current_title: engineRes.title,
          status: "idle",
        }).catch(() => {});
      }

      return Response.json({ result: engineRes, request_id: requestId });
    }

    case "DELETE:/sessions/:id": {
      // Terminate REAL browser first, then reconcile
      const session = await base44.asServiceRole.entities.Session.get(params.id);
      if (!session) return errorResponse(404, "Session not found", requestId);

      let runtimeClosed = false;
      let closeError = null;

      if (session.session_id && await isEngineConfigured()) {
        try {
          await engineDelete(`/sessions/${session.session_id}`);
          runtimeClosed = true;
        } catch (err) {
          // Tolerate already-dead runtime — still reconcile control plane
          closeError = err.message;
          runtimeClosed = true; // idempotent: assume it's gone
        }
      } else {
        // Orphan control-plane record (no runtime ID) — just reconcile
        runtimeClosed = true;
      }

      await base44.asServiceRole.entities.Session.update(params.id, {
        status: "ended",
        ended_at: new Date().toISOString(),
        metadata: { ...session.metadata, termination_reason: closeError || "closed", runtime_closed: runtimeClosed },
      });

      return Response.json({
        success: true,
        runtime_closed: runtimeClosed,
        close_error: closeError,
        request_id: requestId,
      });
    }

    case "GET:/jobs": {
      const jobs = await base44.asServiceRole.entities.Job.list("-created_date", 50);
      return Response.json({ jobs, request_id: requestId });
    }

    case "POST:/jobs": {
      const job = await base44.asServiceRole.entities.Job.create({
        name: data.name,
        status: "queued",
        start_url: data.start_url || "",
        session_config: data.session_config || {},
        tags: data.tags || [],
        steps_count: data.steps?.length || 0,
        project_id: keyRecord.project_id || data.project_id,
      });
      if (data.steps?.length) {
        await base44.asServiceRole.entities.Step.bulkCreate(
          data.steps.map((s, i) => ({
            job_id: job.id,
            order: i,
            name: s.name || `Step ${i + 1}`,
            action_type: s.action_type,
            selector: s.selector,
            value: s.value,
            options: s.options,
            description: s.description,
          }))
        );
      }
      return Response.json({ job, request_id: requestId }, { status: 201 });
    }

    case "POST:/jobs/:id/run": {
      // Canonical contract: jobId (not job_id)
      const result = await base44.asServiceRole.functions.invoke("runJob", { jobId: params.id });
      return Response.json({ ...(result.data || result), request_id: requestId });
    }

    case "GET:/jobs/:id/results": {
      const results = await base44.asServiceRole.entities.Result.filter({ job_id: params.id });
      return Response.json({ results, request_id: requestId });
    }

    case "GET:/projects": {
      const projects = await base44.asServiceRole.entities.Project.list("-created_date", 50);
      return Response.json({ projects, request_id: requestId });
    }

    default:
      return errorResponse(501, `Route not implemented: ${route}`, requestId);
  }
}