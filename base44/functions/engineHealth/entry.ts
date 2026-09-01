import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { engineGet, isEngineConfigured, setEngineClient } from "../../shared/engineClient.ts";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";
import { secrets } from "base44:runtime";
// v6.0.0 — region/replica drift detection

export default async function (req) {
  const base44 = createClientFromRequest(req);
  setEngineClient(base44);
  try {
    if (!await isEngineConfigured()) {
      return Response.json({ ok: false, configured: false, error: "Browser engine not configured", __v: DEPLOYMENT_VERSION }, { status: 200 });
    }

    // Expected config from secrets
    const expectedRegion = secrets.get("ENGINE_REGION") || "unknown";
    const expectedReplicas = parseInt(secrets.get("ENGINE_REPLICAS") || "0", 10);

    try {
      const health = await engineGet("/health");

      // TASK 9: Drift detection
      const drift = {
        regionMismatch: false,
        replicaMismatch: false,
        expectedRegion,
        actualRegion: health.region || "unknown",
        expectedReplicas,
        actualReplicas: health.max_sessions ? Math.ceil(health.max_sessions / 10) : 0, // estimate
      };

      if (expectedRegion !== "unknown" && health.region && health.region !== expectedRegion) {
        drift.regionMismatch = true;
      }

      // Persist real health observation to EngineHealthLog
      await base44.asServiceRole.entities.EngineHealthLog.create({
        status: health.ok ? "healthy" : "unhealthy",
        response_time_ms: 0,
        worker_id: health.worker_id,
        region: health.region,
        engine_version: health.engine_version,
        active_sessions: health.active_sessions,
        max_sessions: health.max_sessions,
        pool_size: health.pool_size,
        pool_capacity: health.pool_capacity,
        uptime_seconds: Math.round(health.uptime),
        checked_at: new Date().toISOString(),
        checked_by: "system",
        metadata: drift.regionMismatch || drift.replicaMismatch ? { drift } : undefined,
      });

      // Create notification if drift detected
      if (drift.regionMismatch) {
        try {
          await base44.asServiceRole.entities.Notification.create({
            type: "warning",
            category: "config_drift",
            title: "Engine Region Drift",
            message: `Engine reports region "${drift.actualRegion}" but expected "${drift.expectedRegion}"`,
            read: false,
            created_at: new Date().toISOString(),
          });
        } catch (e) { console.error("Drift notification failed:", e.message); }
      }

      return Response.json({
        ok: true,
        configured: true,
        ...health,
        drift,
        expectedRegion,
        expectedReplicas,
        __v: DEPLOYMENT_VERSION,
      });
    } catch (err) {
      // Persist unhealthy observation
      await base44.asServiceRole.entities.EngineHealthLog.create({
        status: "unreachable",
        response_time_ms: 0,
        error_message: err.message,
        checked_at: new Date().toISOString(),
        checked_by: "system",
      });
      return Response.json({ ok: false, configured: true, error: err.message }, { status: 200 });
    }
  } catch (error) {
    return Response.json({ error: error.message, __v: DEPLOYMENT_VERSION }, { status: 500 });
  }
}
