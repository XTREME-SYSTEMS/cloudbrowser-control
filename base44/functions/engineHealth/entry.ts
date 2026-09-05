import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { getEngineUrls, isEngineConfigured, setEngineClient } from "../../shared/engineClient.ts";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";
import { secrets } from "base44:runtime";
// v7.0.0 — multi-engine swarm health probe

const PROBE_TIMEOUT_MS = 8000;

/** Probe a single engine URL directly (no failover), with a hard timeout. */
async function probeEngine(baseUrl, key) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const started = Date.now();
  try {
    const res = await fetch(`${baseUrl}/health`, {
      headers: { "x-api-key": key, "Content-Type": "application/json" },
      signal: controller.signal,
    });
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { body = { raw: text }; }
    const responseTime = Date.now() - started;

    if (!res.ok) {
      return {
        ok: false,
        status: res.status >= 500 ? "unhealthy" : "degraded",
        engine_url: baseUrl,
        response_time_ms: responseTime,
        error_message: `HTTP ${res.status}: ${typeof body === "object" && body?.error ? body.error : text.slice(0, 200)}`,
        raw: body,
      };
    }
    return {
      ok: true,
      status: body.ok ? "healthy" : "degraded",
      engine_url: baseUrl,
      response_time_ms: responseTime,
      worker_id: body.worker_id,
      region: body.region,
      engine_version: body.engine_version,
      active_sessions: body.active_sessions,
      max_sessions: body.max_sessions,
      pool_size: body.pool_size,
      pool_capacity: body.pool_capacity,
      uptime_seconds: Math.round(body.uptime),
      raw: body,
    };
  } catch (err) {
    return {
      ok: false,
      status: "unreachable",
      engine_url: baseUrl,
      response_time_ms: Date.now() - started,
      error_message: err.name === "AbortError" ? `Timeout after ${PROBE_TIMEOUT_MS}ms` : err.message,
    };
  } finally {
    clearTimeout(timer);
  }
}

function deriveLabel(url, index, total) {
  // Try to infer engine-N from hostname, else fall back to ordinal
  const match = url.match(/engine-(\d+)/i);
  if (match) return `engine-${match[1]}`;
  return `engine-${index + 1}`;
}

export default async function (req) {
  const base44 = createClientFromRequest(req);
  setEngineClient(base44);
  try {
    if (!await isEngineConfigured()) {
      return Response.json({ ok: false, configured: false, error: "Browser engine not configured", __v: DEPLOYMENT_VERSION }, { status: 200 });
    }

    const urls = await getEngineUrls();
    const key = secrets.get("ENGINE_API_KEY");
    const expectedRegion = secrets.get("ENGINE_REGION") || "unknown";

    // Probe every engine in parallel
    const probes = await Promise.all(urls.map((url, i) => probeEngine(url, key)));

    // Attach labels + persist each probe
    const engines = probes.map((p, i) => {
      p.engine_label = deriveLabel(p.engine_url, i, urls.length);
      return p;
    });

    for (const p of engines) {
      try {
        await base44.asServiceRole.entities.EngineHealthLog.create({
          status: p.status,
          response_time_ms: p.response_time_ms || 0,
          worker_id: p.worker_id,
          engine_url: p.engine_url,
          engine_label: p.engine_label,
          region: p.region,
          engine_version: p.engine_version,
          active_sessions: p.active_sessions,
          max_sessions: p.max_sessions,
          pool_size: p.pool_size,
          pool_capacity: p.pool_capacity,
          uptime_seconds: p.uptime_seconds,
          error_message: p.error_message,
          checked_at: new Date().toISOString(),
          checked_by: "system",
        });
      } catch (e) { console.error(`Health log persist failed for ${p.engine_label}:`, e.message); }
    }

    // Swarm-level summary
    const healthy = engines.filter((e) => e.ok);
    const unhealthy = engines.filter((e) => !e.ok);
    const totalActiveSessions = engines.reduce((sum, e) => sum + (e.active_sessions || 0), 0);
    const totalMaxSessions = engines.reduce((sum, e) => sum + (e.max_sessions || 0), 0);
    const totalPoolSize = engines.reduce((sum, e) => sum + (e.pool_size || 0), 0);

    // Region drift detection (against expected, if set)
    let regionDrift = null;
    if (expectedRegion !== "unknown") {
      const drifted = engines.filter((e) => e.ok && e.region && e.region !== expectedRegion);
      if (drifted.length > 0) {
        regionDrift = {
          expected: expectedRegion,
          actual: [...new Set(engines.filter((e) => e.ok && e.region).map((e) => e.region))],
          driftedEngines: drifted.map((e) => e.engine_label),
        };
        try {
          await base44.asServiceRole.entities.Notification.create({
            type: "warning",
            category: "config_drift",
            title: "Engine Region Drift",
            message: `${drifted.length} engine(s) report a region other than "${expectedRegion}": ${drifted.map((e) => e.engine_label).join(", ")}`,
            read: false,
            created_at: new Date().toISOString(),
          });
        } catch (e) { console.error("Drift notification failed:", e.message); }
      }
    }

    // Alert on any newly-unreachable engine
    if (unhealthy.length > 0) {
      try {
        await base44.asServiceRole.entities.Notification.create({
          type: "error",
          category: "engine_health",
          title: `${unhealthy.length}/${engines.length} Engine(s) Unhealthy`,
          message: unhealthy.map((e) => `${e.engine_label}: ${e.error_message || e.status}`).join(" | "),
          read: false,
          created_at: new Date().toISOString(),
        });
      } catch (e) { console.error("Health notification failed:", e.message); }
    }

    const swarmOk = unhealthy.length === 0;
    const swarmStatus = unhealthy.length === engines.length ? "down"
      : unhealthy.length > 0 ? "degraded"
      : "healthy";

    return Response.json({
      ok: swarmOk,
      configured: true,
      swarm: {
        status: swarmStatus,
        total_engines: engines.length,
        healthy_count: healthy.length,
        unhealthy_count: unhealthy.length,
        total_active_sessions: totalActiveSessions,
        total_max_sessions: totalMaxSessions,
        total_pool_size: totalPoolSize,
        region_drift: regionDrift,
      },
      engines,
      expectedRegion,
      checked_at: new Date().toISOString(),
      __v: DEPLOYMENT_VERSION,
    }, { status: 200 });
  } catch (error) {
    return Response.json({ error: error.message, __v: DEPLOYMENT_VERSION }, { status: 500 });
  }
}