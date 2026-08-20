// ═══════════════════════════════════════════════
// Gateway Core — shared gateway logic for all gateway identities
// Extracted to avoid duplication between apiGateway and cloudBrowserGatewayV6.
// Plain module — no Deno.serve, just exports.
// ═══════════════════════════════════════════════

export async function hashKey(key) {
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

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

export async function checkRateLimit(base44, keyHash, limitPerMinute) {
  const now = Date.now();
  const windowStart = Math.floor(now / 60000) * 60000;

  const updateResult = await base44.asServiceRole.entities.RateLimitEntry.updateMany(
    { key_hash: keyHash, window_start: windowStart },
    { $inc: { count: 1 } }
  );

  const updatedCount = updateResult.updated ?? updateResult.modified_count ?? 0;

  if (updatedCount === 0) {
    try {
      await base44.asServiceRole.entities.RateLimitEntry.create({
        key_hash: keyHash,
        window_start: windowStart,
        count: 1,
      });
      return true;
    } catch (e) { /* race — fall through */ }
  }

  const entries = await base44.asServiceRole.entities.RateLimitEntry.filter({
    key_hash: keyHash,
    window_start: windowStart,
  });

  if (entries.length === 0) return true;

  const totalCount = entries.reduce((sum, e) => sum + (e.count || 0), 0);

  if (entries.length > 1) {
    await base44.asServiceRole.entities.RateLimitEntry.update(entries[0].id, { count: totalCount });
    for (let i = 1; i < entries.length; i++) {
      await base44.asServiceRole.entities.RateLimitEntry.delete(entries[i].id).catch(() => {});
    }
  }

  return totalCount <= limitPerMinute;
}

export const ROUTE_SCOPES = {
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

export function matchRoute(method, rawPath) {
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
      const allSessions = await base44.asServiceRole.entities.Session.list("-created_date", 50);
      const sessions = keyRecord.project_id
        ? allSessions.filter((s) => s.project_id === keyRecord.project_id)
        : allSessions;
      return Response.json({ sessions, request_id: requestId, gateway: gatewayIdentity });
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
        });
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
        });
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
          await engineDelete(`/sessions/${session.session_id}`);
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

      return Response.json({
        success: true,
        runtime_closed: runtimeClosed,
        close_error: closeError,
        request_id: requestId,
        gateway: gatewayIdentity,
      });
    }

    case "GET:/jobs": {
      const allJobs = await base44.asServiceRole.entities.Job.list("-created_date", 50);
      const jobs = keyRecord.project_id
        ? allJobs.filter((j) => j.project_id === keyRecord.project_id)
        : allJobs;
      return Response.json({ jobs, request_id: requestId, gateway: gatewayIdentity });
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
      const result = await base44.asServiceRole.functions.invoke("runJob", { jobId: params.id });
      return Response.json({ ...(result.data || result), request_id: requestId, gateway: gatewayIdentity });
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
      const allProjects = await base44.asServiceRole.entities.Project.list("-created_date", 50);
      const projects = keyRecord.project_id
        ? allProjects.filter((p) => p.id === keyRecord.project_id)
        : allProjects;
      return Response.json({ projects, request_id: requestId, gateway: gatewayIdentity });
    }

    default:
      return errResp(501, `Route not implemented: ${route}`);
  }
}