import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { getEngineUrls, isEngineConfigured, setEngineClient } from "../../shared/engineClient.ts";
import { probeEngine, deriveLabel } from "../../shared/engineProbe.ts";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";
import { secrets } from "base44:runtime";
// v7.1.0 — every engine is probed through the shared capability-aware probe, so this
// check and the auto-healer can never disagree about whether an engine can serve.
// `ok` means a browser actually launched here, not merely that /health answered.
//
// This file used to carry its own second copy of the probe, while the auto-healer
// imported the shared one. The copies drifted: only this one checked readiness, so
// the healer was blind to an engine whose container could no longer start a browser.

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
      p.engine_label = deriveLabel(p.engine_url, i);
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
      const drifted = engines.filter((e) => e.ok && e.region && e.region !== "unknown" && e.region !== expectedRegion);
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

    // EngineHealthLog already persists per-engine status — no per-user Notification needed
    // (Notification entity requires user_id; system alerts are tracked via EngineHealthLog)

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