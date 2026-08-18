import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

// In-memory rate limit store (per-instance sliding window)
const rateLimitMap = new Map();

async function hashKey(key) {
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function checkRateLimit(keyHash, limitPerMinute) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const entries = rateLimitMap.get(keyHash) || [];
  const recent = entries.filter((t) => now - t < windowMs);
  if (recent.length >= limitPerMinute) return false;
  recent.push(now);
  rateLimitMap.set(keyHash, recent);
  return true;
}

// Route → required scope mapping
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

export default async function (req) {
  const base44 = createClientFromRequest(req);

  try {
    const body = await req.json();
    const { path: requestPath, method: requestMethod = "GET", data = {}, api_key, client_ip } = body;

    // ── Authenticate ──
    if (!api_key) return Response.json({ error: "Missing API key. Provide api_key in the request body." }, { status: 401 });

    const keyHash = await hashKey(api_key);
    const keys = await base44.asServiceRole.entities.ApiKey.filter({ key_hash: keyHash, active: true });
    if (!keys.length) return Response.json({ error: "Invalid or revoked API key" }, { status: 401 });
    const keyRecord = keys[0];

    // Update last_used (fire-and-forget)
    base44.asServiceRole.entities.ApiKey.update(keyRecord.id, { last_used: new Date().toISOString() }).catch(() => {});

    // ── System settings ──
    const settings = await base44.asServiceRole.entities.SystemSettings.list("-created_date", 1);
    const sysSettings = settings[0] || {};

    // ── IP allowlist ──
    if (sysSettings.ip_allowlist?.length) {
      const ip = (client_ip || "").trim();
      if (ip && !sysSettings.ip_allowlist.includes(ip)) {
        return Response.json({ error: `IP ${ip} is not allowlisted` }, { status: 403 });
      }
    }

    // ── Rate limit ──
    const rateLimit = sysSettings.rate_limit_per_minute || 60;
    if (!checkRateLimit(keyHash, rateLimit)) {
      return Response.json({ error: "Rate limit exceeded", limit_per_minute: rateLimit }, { status: 429 });
    }

    // ── Route match ──
    const matched = matchRoute(requestMethod, requestPath);
    if (!matched) return Response.json({ error: `Unknown route: ${requestMethod} ${requestPath}` }, { status: 404 });

    // ── Scope check ──
    const requiredScope = ROUTE_SCOPES[matched.route];
    if (requiredScope && !(keyRecord.scopes || []).includes(requiredScope)) {
      return Response.json({ error: `Insufficient scope. Required: ${requiredScope}`, granted: keyRecord.scopes }, { status: 403 });
    }

    // ── Dispatch ──
    return await dispatch(base44, matched.route, matched.params, data);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

async function dispatch(base44, route, params, data) {
  switch (route) {
    case "GET:/health":
      return Response.json({ status: "ok", timestamp: new Date().toISOString() });

    case "GET:/sessions": {
      const sessions = await base44.asServiceRole.entities.Session.list("-created_date", 50);
      return Response.json({ sessions });
    }

    case "POST:/sessions": {
      const session = await base44.asServiceRole.entities.Session.create({
        status: "pending",
        target_url: data.target_url || "",
        viewport: data.viewport,
        user_agent: data.user_agent,
        locale: data.locale,
        timezone: data.timezone,
        proxy_id: data.proxy_id,
        headers: data.headers,
        blocked_resources: data.blocked_resources,
        tags: data.tags,
        timeout_ms: data.timeout_ms || 30000,
        record_video: data.record_video || false,
        enable_cdp: data.enable_cdp || false,
        metadata: data.metadata,
      });
      return Response.json({ session }, { status: 201 });
    }

    case "GET:/sessions/:id": {
      const session = await base44.asServiceRole.entities.Session.get(params.id);
      if (!session) return Response.json({ error: "Session not found" }, { status: 404 });
      return Response.json({ session });
    }

    case "POST:/sessions/:id/action": {
      const result = await base44.asServiceRole.functions.invoke("engineAction", {
        session_id: params.id,
        ...data,
      });
      return Response.json(result);
    }

    case "DELETE:/sessions/:id": {
      await base44.asServiceRole.entities.Session.update(params.id, { status: "ended", ended_at: new Date().toISOString() });
      return Response.json({ success: true });
    }

    case "GET:/jobs": {
      const jobs = await base44.asServiceRole.entities.Job.list("-created_date", 50);
      return Response.json({ jobs });
    }

    case "POST:/jobs": {
      const job = await base44.asServiceRole.entities.Job.create({
        name: data.name,
        status: "queued",
        start_url: data.start_url || "",
        session_config: data.session_config || {},
        tags: data.tags || [],
        steps_count: data.steps?.length || 0,
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
      return Response.json({ job }, { status: 201 });
    }

    case "POST:/jobs/:id/run": {
      const result = await base44.asServiceRole.functions.invoke("runJob", { job_id: params.id });
      return Response.json(result);
    }

    case "GET:/jobs/:id/results": {
      const results = await base44.asServiceRole.entities.Result.filter({ job_id: params.id });
      return Response.json({ results });
    }

    case "GET:/projects": {
      const projects = await base44.asServiceRole.entities.Project.list("-created_date", 50);
      return Response.json({ projects });
    }

    default:
      return Response.json({ error: `Route not implemented: ${route}` }, { status: 501 });
  }
}