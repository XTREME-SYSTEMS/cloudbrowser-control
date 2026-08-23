// ═══════════════════════════════════════════════
// Gateway Core — shared gateway logic for all gateway identities
// Extracted to avoid duplication between apiGateway and cloudBrowserGatewayV6.
// Plain module — no Deno.serve, just exports.
// ═══════════════════════════════════════════════

import { hashKey, timingSafeEqual } from "./crypto.ts";

export { hashKey, timingSafeEqual };

export function ipInCidr(ip, cidr) {
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

export function ipAllowed(ip, allowlist) {
  if (!allowlist?.length) return true;
  for (const entry of allowlist) {
    if (entry.includes("/")) { if (ipInCidr(ip, entry)) return true; }
    else if (ip === entry) return true;
  }
  return false;
}

export function deriveClientIP(req) {
  const fwd = req.headers.get("x-forwarded-for") || "";
  const first = fwd.split(",")[0].trim();
  if (first) return first;
  return req.headers.get("x-real-ip") || "";
}

// Rate limit check — race-free via deterministic create-or-increment.
// Uses a composite key (key_hash + window_start) to avoid duplicate creates.
export async function checkRateLimit(base44, keyHash, limitPerMinute) {
  const now = Date.now();
  const windowStart = Math.floor(now / 60000) * 60000;

  // Try to create the window entry first (idempotent on composite key).
  // If it already exists, the create may succeed as a duplicate — we reconcile below.
  let entries = await base44.asServiceRole.entities.RateLimitEntry.filter({
    key_hash: keyHash,
    window_start: windowStart,
  });

  if (entries.length === 0) {
    // No entry yet — create one with count=1
    try {
      await base44.asServiceRole.entities.RateLimitEntry.create({
        key_hash: keyHash,
        window_start: windowStart,
        count: 1,
      });
      return 1 <= limitPerMinute;
    } catch (_e) { /* race — another worker created it; fall through to increment */ }
    // Re-read after race
    entries = await base44.asServiceRole.entities.RateLimitEntry.filter({
      key_hash: keyHash,
      window_start: windowStart,
    });
  }

  // Increment the first entry atomically
  if (entries.length > 0) {
    await base44.asServiceRole.entities.RateLimitEntry.updateMany(
      { _id: entries[0].id },
      { $inc: { count: 1 } }
    );
    // Re-read to get the updated count
    const updated = await base44.asServiceRole.entities.RateLimitEntry.filter({
      key_hash: keyHash,
      window_start: windowStart,
    });
    const totalCount = updated.reduce((sum, e) => sum + (e.count || 0), 0);

    // Deduplicate any race-created entries
    if (updated.length > 1) {
      const total = updated.reduce((sum, e) => sum + (e.count || 0), 0);
      await base44.asServiceRole.entities.RateLimitEntry.update(updated[0].id, { count: total });
      for (let i = 1; i < updated.length; i++) {
        await base44.asServiceRole.entities.RateLimitEntry.delete(updated[i].id).catch(() => {});
      }
      return total <= limitPerMinute;
    }
    return totalCount <= limitPerMinute;
  }

  return true;
}

export const ROUTE_SCOPES = {
  "GET:/health": null,
  "GET:/sessions": "sessions:read",
  "POST:/sessions": "sessions:write",
  "POST:/sessions/batch": "sessions:write",
  "GET:/sessions/:id": "sessions:read",
  "POST:/sessions/:id/action": "sessions:write",
  "POST:/sessions/:id/keepalive": "sessions:write",
  "GET:/sessions/:id/cookies": "sessions:read",
  "POST:/sessions/:id/cookies": "sessions:write",
  "GET:/sessions/:id/screenshot": "sessions:read",
  "DELETE:/sessions/:id": "sessions:write",
  "GET:/jobs": "jobs:read",
  "POST:/jobs": "jobs:write",
  "POST:/jobs/:id/run": "jobs:write",
  "GET:/jobs/:id": "jobs:read",
  "GET:/jobs/:id/results": "jobs:read",
  "GET:/projects": "projects:read",
};

export function matchRoute(method, rawPath) {
  const parts = (rawPath || "").split("/").filter(Boolean);
  const m = method.toUpperCase();
  if (m === "GET" && parts.join("/") === "health") return { route: "GET:/health", params: {} };
  if (m === "GET" && parts[0] === "sessions" && parts.length === 1) return { route: "GET:/sessions", params: {} };
  if (m === "POST" && parts[0] === "sessions" && parts.length === 1) return { route: "POST:/sessions", params: {} };
  if (m === "POST" && parts[0] === "sessions" && parts.length === 2 && parts[1] === "batch") return { route: "POST:/sessions/batch", params: {} };
  if (m === "GET" && parts[0] === "sessions" && parts.length === 2) return { route: "GET:/sessions/:id", params: { id: parts[1] } };
  if (m === "POST" && parts[0] === "sessions" && parts.length === 3 && parts[2] === "action") return { route: "POST:/sessions/:id/action", params: { id: parts[1] } };
  if (m === "POST" && parts[0] === "sessions" && parts.length === 3 && parts[2] === "keepalive") return { route: "POST:/sessions/:id/keepalive", params: { id: parts[1] } };
  if (m === "GET" && parts[0] === "sessions" && parts.length === 3 && parts[2] === "cookies") return { route: "GET:/sessions/:id/cookies", params: { id: parts[1] } };
  if (m === "POST" && parts[0] === "sessions" && parts.length === 3 && parts[2] === "cookies") return { route: "POST:/sessions/:id/cookies", params: { id: parts[1] } };
  if (m === "GET" && parts[0] === "sessions" && parts.length === 3 && parts[2] === "screenshot") return { route: "GET:/sessions/:id/screenshot", params: { id: parts[1] } };
  if (m === "DELETE" && parts[0] === "sessions" && parts.length === 2) return { route: "DELETE:/sessions/:id", params: { id: parts[1] } };
  if (m === "GET" && parts[0] === "jobs" && parts.length === 1) return { route: "GET:/jobs", params: {} };
  if (m === "POST" && parts[0] === "jobs" && parts.length === 1) return { route: "POST:/jobs", params: {} };
  if (m === "POST" && parts[0] === "jobs" && parts.length === 3 && parts[2] === "run") return { route: "POST:/jobs/:id/run", params: { id: parts[1] } };
  if (m === "GET" && parts[0] === "jobs" && parts.length === 2) return { route: "GET:/jobs/:id", params: { id: parts[1] } };
  if (m === "GET" && parts[0] === "jobs" && parts.length === 3 && parts[2] === "results") return { route: "GET:/jobs/:id/results", params: { id: parts[1] } };
  if (m === "GET" && parts[0] === "projects" && parts.length === 1) return { route: "GET:/projects", params: {} };
  return null;
}

// Shared dispatch — used by all gateway identities.
// `gatewayIdentity` is injected into every response for propagation proof.
export async function dispatch(base44, route, params, data, keyRecord, requestId, gatewayIdentity, enginePost, engineDelete, isEngineConfigured) {
  function errResp(status, error) {
    return Response.json({ error, request_id: requestId, gateway: gatewayIdentity }, { status });
  }

  switch (route) {
    case "GET:/health":
      return Response.json({ status: "ok", timestamp: new Date().toISOString(), request_id: requestId, gateway: gatewayIdentity });

    case "GET:/sessions": {
      // Entity-level filter — no in-memory filtering, no cross-tenant leak
      const sessions = keyRecord.project_id
        ? await base44.asServiceRole.entities.Session.filter({ project_id: keyRecord.project_id }, "-created_date", 50)
        : await base44.asServiceRole.entities.Session.list("-created_date", 50);
      return Response.json({ sessions, count: sessions.length, request_id: requestId, gateway: gatewayIdentity });
    }

    case "POST:/sessions": {
      if (!await isEngineConfigured()) {
        return errResp(503, "Browser engine not configured");
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
        }, requestId);
      } catch (err) {
        return errResp(502, `Engine session creation failed: ${err.message}`);
      }

      const runtimeSessionId = engineRes.sessionId;
      if (!runtimeSessionId) {
        return errResp(502, "Engine returned no runtime session ID");
      }

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
          store_id: data.store_id || data.metadata?.store_id || null,
        },
        started_at: new Date().toISOString(),
        project_id: keyRecord.project_id || data.project_id,
      });

      // Denormalize: increment Store.active_sessions for O(1) quota checks
      const storeId = data.store_id || data.metadata?.store_id;
      if (storeId) {
        const stores = await base44.asServiceRole.entities.Store.filter({ store_code: storeId, status: "active" });
        if (stores[0]) {
          await base44.asServiceRole.entities.Store.update(stores[0].id, {
            active_sessions: (stores[0].active_sessions || 0) + 1,
          }).catch(() => {});
        }
      }

      return Response.json({
        session,
        runtime_session_id: runtimeSessionId,
        control_plane_session_id: session.id,
        worker_id: engineRes.workerId,
        region: engineRes.region,
        engine_version: engineRes.engineVersion,
        request_id: requestId,
        gateway: gatewayIdentity,
      }, { status: 201 });
    }

    case "GET:/sessions/:id": {
      const session = await base44.asServiceRole.entities.Session.get(params.id);
      if (!session) return errResp(404, "Session not found");
      if (keyRecord.project_id && session.project_id !== keyRecord.project_id)
        return errResp(404, "Session not found");
      return Response.json({ session, request_id: requestId, gateway: gatewayIdentity });
    }

    case "POST:/sessions/:id/action": {
      const session = await base44.asServiceRole.entities.Session.get(params.id);
      if (!session) return errResp(404, "Session not found");
      if (keyRecord.project_id && session.project_id !== keyRecord.project_id)
        return errResp(404, "Session not found");
      if (!session.session_id) return errResp(409, "Session has no runtime ID — cannot execute action");

      if (!await isEngineConfigured()) return errResp(503, "Browser engine not configured");

      let engineRes;
      try {
        engineRes = await enginePost(`/sessions/${session.session_id}/execute`, {
          action_type: data.action_type,
          selector: data.selector,
          value: data.value,
          options: data.options || {},
        }, requestId);
      } catch (err) {
        return errResp(502, `Engine action failed: ${err.message}`);
      }

      if (engineRes.url) {
        await base44.asServiceRole.entities.Session.update(params.id, {
          current_url: engineRes.url,
          current_title: engineRes.title,
          status: "idle",
        }).catch(() => {});
      }

      return Response.json({ result: engineRes, request_id: requestId, gateway: gatewayIdentity });
    }

    case "DELETE:/sessions/:id": {
      const session = await base44.asServiceRole.entities.Session.get(params.id);
      if (!session) return errResp(404, "Session not found");
      if (keyRecord.project_id && session.project_id !== keyRecord.project_id)
        return errResp(404, "Session not found");

      let runtimeClosed = false;
      let closeError = null;

      if (session.session_id && await isEngineConfigured()) {
        try {
          await engineDelete(`/sessions/${session.session_id}`, requestId);
          runtimeClosed = true;
        } catch (err) {
          closeError = err.message;
          runtimeClosed = true;
        }
      } else {
        runtimeClosed = true;
      }

      await base44.asServiceRole.entities.Session.update(params.id, {
        status: "ended",
        ended_at: new Date().toISOString(),
        metadata: { ...session.metadata, termination_reason: closeError || "closed", runtime_closed: runtimeClosed },
      });

      // Denormalize: decrement Store.active_sessions
      const storeId = session.metadata?.store_id;
      if (storeId) {
        const stores = await base44.asServiceRole.entities.Store.filter({ store_code: storeId });
        if (stores[0] && stores[0].active_sessions > 0) {
          await base44.asServiceRole.entities.Store.update(stores[0].id, {
            active_sessions: stores[0].active_sessions - 1,
          }).catch(() => {});
        }
      }

      return Response.json({
        success: true,
        runtime_closed: runtimeClosed,
        close_error: closeError,
        request_id: requestId,
        gateway: gatewayIdentity,
      });
    }

    case "GET:/jobs": {
      const jobs = keyRecord.project_id
        ? await base44.asServiceRole.entities.Job.filter({ project_id: keyRecord.project_id }, "-created_date", 50)
        : await base44.asServiceRole.entities.Job.list("-created_date", 50);
      return Response.json({ jobs, count: jobs.length, request_id: requestId, gateway: gatewayIdentity });
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
      return Response.json({ job, request_id: requestId, gateway: gatewayIdentity }, { status: 201 });
    }

    case "POST:/jobs/:id/run": {
      const job = await base44.asServiceRole.entities.Job.get(params.id);
      if (!job) return errResp(404, "Job not found");
      if (keyRecord.project_id && job.project_id !== keyRecord.project_id)
        return errResp(404, "Job not found");

      // Idempotency: if an idempotency_key is provided, check for prior run
      const idempotencyKey = data?.idempotency_key;
      if (idempotencyKey) {
        const idemHash = await hashKey(idempotencyKey + ":" + params.id);
        const prior = await base44.asServiceRole.entities.Setting.filter({ setting_key: `idem:${idemHash}` });
        if (prior.length > 0 && prior[0].effective_value) {
          // Return cached result
          try {
            const cached = JSON.parse(prior[0].effective_value);
            return Response.json({ ...cached, idempotent_replay: true, request_id: requestId, gateway: gatewayIdentity });
          } catch (_e) { /* fall through */ }
        }
        // Mark the idempotency key as pending
        await base44.asServiceRole.entities.Setting.create({
          setting_key: `idem:${idemHash}`,
          category: "system",
          scope_type: "platform",
          desired_value: "pending",
          effective_value: "pending",
        }).catch(() => {});
      }

      // If job is already running, reject
      if (job.status === "running") {
        return errResp(409, "Job is already running");
      }

      // Async execution: return 202 immediately, execute in background
      // The platform function invoke is fire-and-forget when we don't await
      (async () => {
        try {
          const result = await base44.asServiceRole.functions.invoke("runJob", { jobId: params.id });
          // Cache result for idempotency replay
          if (idempotencyKey) {
            const idemHash = await hashKey(idempotencyKey + ":" + params.id);
            const resultData = result.data || result;
            await base44.asServiceRole.entities.Setting.updateMany(
              { setting_key: `idem:${idemHash}` },
              { $set: { effective_value: JSON.stringify({ ok: resultData.ok, jobId: params.id, status: resultData.ok ? "completed" : "failed" }), desired_value: "completed" } }
            ).catch(() => {});
          }
        } catch (e) {
          // Cache error for idempotency
          if (idempotencyKey) {
            const idemHash = await hashKey(idempotencyKey + ":" + params.id);
            await base44.asServiceRole.entities.Setting.updateMany(
              { setting_key: `idem:${idemHash}` },
              { $set: { effective_value: JSON.stringify({ ok: false, jobId: params.id, error: e.message }), desired_value: "failed" } }
            ).catch(() => {});
          }
        }
      })().catch(() => {});

      return Response.json({
        ok: true,
        job_id: params.id,
        status: "accepted",
        message: "Job execution started. Poll GET /jobs/" + params.id + " for status.",
        request_id: requestId,
        gateway: gatewayIdentity,
      }, { status: 202 });
    }

    case "GET:/jobs/:id": {
      const job = await base44.asServiceRole.entities.Job.get(params.id);
      if (!job) return errResp(404, "Job not found");
      if (keyRecord.project_id && job.project_id !== keyRecord.project_id)
        return errResp(404, "Job not found");
      return Response.json({ job, request_id: requestId, gateway: gatewayIdentity });
    }

    case "GET:/jobs/:id/results": {
      const job = await base44.asServiceRole.entities.Job.get(params.id);
      if (!job) return errResp(404, "Job not found");
      if (keyRecord.project_id && job.project_id !== keyRecord.project_id)
        return errResp(404, "Job not found");
      const results = await base44.asServiceRole.entities.Result.filter({ job_id: params.id });
      return Response.json({ results, request_id: requestId, gateway: gatewayIdentity });
    }

    case "GET:/projects": {
      const projects = keyRecord.project_id
        ? await base44.asServiceRole.entities.Project.filter({ id: keyRecord.project_id }, "-created_date", 50)
        : await base44.asServiceRole.entities.Project.list("-created_date", 50);
      return Response.json({ projects, count: projects.length, request_id: requestId, gateway: gatewayIdentity });
    }

    // ── Session keep-alive: extend TTL ──
    case "POST:/sessions/:id/keepalive": {
      const session = await base44.asServiceRole.entities.Session.get(params.id);
      if (!session) return errResp(404, "Session not found");
      if (keyRecord.project_id && session.project_id !== keyRecord.project_id)
        return errResp(404, "Session not found");
      if (!session.session_id || !await isEngineConfigured())
        return errResp(503, "Engine not configured");
      try {
        // Engine heartbeat resets the TTL timer
        await enginePost(`/sessions/${session.session_id}/keepalive`, {});
      } catch (err) {
        return errResp(502, `Keep-alive failed: ${err.message}`);
      }
      await base44.asServiceRole.entities.Session.update(params.id, {
        metadata: { ...session.metadata, last_keepalive: new Date().toISOString() },
      }).catch(() => {});
      return Response.json({ success: true, session_id: params.id, kept_alive: true, request_id: requestId, gateway: gatewayIdentity });
    }

    // ── Get session cookies ──
    case "GET:/sessions/:id/cookies": {
      const session = await base44.asServiceRole.entities.Session.get(params.id);
      if (!session) return errResp(404, "Session not found");
      if (keyRecord.project_id && session.project_id !== keyRecord.project_id)
        return errResp(404, "Session not found");
      if (!session.session_id || !await isEngineConfigured())
        return errResp(503, "Engine not configured");
      try {
        const engineRes = await enginePost(`/sessions/${session.session_id}/execute`, {
          action_type: "export_cookies", options: {},
        });
        return Response.json({ cookies: engineRes.data || [], exported: engineRes.exported || 0, request_id: requestId, gateway: gatewayIdentity });
      } catch (err) {
        return errResp(502, `Cookie export failed: ${err.message}`);
      }
    }

    // ── Set session cookies ──
    case "POST:/sessions/:id/cookies": {
      const session = await base44.asServiceRole.entities.Session.get(params.id);
      if (!session) return errResp(404, "Session not found");
      if (keyRecord.project_id && session.project_id !== keyRecord.project_id)
        return errResp(404, "Session not found");
      if (!session.session_id || !await isEngineConfigured())
        return errResp(503, "Engine not configured");
      try {
        const engineRes = await enginePost(`/sessions/${session.session_id}/execute`, {
          action_type: "import_cookies", options: { cookies: data.cookies || [] },
        });
        return Response.json({ imported: engineRes.imported || (data.cookies || []).length, request_id: requestId, gateway: gatewayIdentity });
      } catch (err) {
        return errResp(502, `Cookie import failed: ${err.message}`);
      }
    }

    // ── Get session screenshot (live view) ──
    case "GET:/sessions/:id/screenshot": {
      const session = await base44.asServiceRole.entities.Session.get(params.id);
      if (!session) return errResp(404, "Session not found");
      if (keyRecord.project_id && session.project_id !== keyRecord.project_id)
        return errResp(404, "Session not found");
      if (!session.session_id || !await isEngineConfigured())
        return errResp(503, "Engine not configured");
      try {
        const engineRes = await enginePost(`/sessions/${session.session_id}/execute`, {
          action_type: "screenshot", options: { fullPage: data.full_page || false },
        });
        return Response.json({
          base64: engineRes.base64, mime_type: engineRes.mimeType || "image/png",
          url: engineRes.url, title: engineRes.title, size: engineRes.size,
          request_id: requestId, gateway: gatewayIdentity,
        });
      } catch (err) {
        return errResp(502, `Screenshot failed: ${err.message}`);
      }
    }

    // ── Batch session creation ──
    case "POST:/sessions/batch": {
      if (!await isEngineConfigured()) return errResp(503, "Browser engine not configured");
      const sessionConfigs = Array.isArray(data.sessions) ? data.sessions : [];
      if (sessionConfigs.length === 0) return errResp(400, "sessions array required");
      if (sessionConfigs.length > 20) return errResp(400, "Max 20 sessions per batch");
      const results = [];
      for (const cfg of sessionConfigs) {
        try {
          const engineRes = await enginePost("/sessions", {
            viewport: cfg.viewport,
            userAgent: cfg.user_agent,
            locale: cfg.locale,
            timezone: cfg.timezone,
            geolocation: cfg.geolocation,
            proxy: cfg.proxy,
            headers: cfg.headers,
            blockedResources: cfg.blocked_resources,
            recordVideo: cfg.record_video,
            usePool: cfg.use_pool !== false,
          });
          const session = await base44.asServiceRole.entities.Session.create({
            session_id: engineRes.sessionId,
            status: "idle",
            target_url: cfg.target_url || "",
            viewport: cfg.viewport,
            user_agent: cfg.user_agent,
            locale: cfg.locale,
            timezone: cfg.timezone,
            geolocation: cfg.geolocation,
            headers: cfg.headers,
            blocked_resources: cfg.blocked_resources,
            tags: cfg.tags,
            timeout_ms: cfg.timeout_ms || 30000,
            record_video: cfg.record_video || false,
            metadata: {
              worker_id: engineRes.workerId,
              region: engineRes.region,
              engine_version: engineRes.engineVersion,
              store_id: cfg.store_id || cfg.metadata?.store_id || null,
            },
            started_at: new Date().toISOString(),
            project_id: keyRecord.project_id || cfg.project_id,
          });
          results.push({ success: true, session_id: session.id, runtime_session_id: engineRes.sessionId });
        } catch (err) {
          results.push({ success: false, error: err.message });
        }
      }
      return Response.json({ results, count: results.length, request_id: requestId, gateway: gatewayIdentity }, { status: 201 });
    }

    default:
      return errResp(501, `Route not implemented: ${route}`);
  }
}