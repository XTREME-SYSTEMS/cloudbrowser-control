import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { engineGet, isEngineConfigured, setEngineClient } from "../../shared/engineClient.ts";

export default async function (req) {
  const base44 = createClientFromRequest(req);
  setEngineClient(base44);
  try {
    if (!await isEngineConfigured()) {
      return Response.json({ ok: false, configured: false, error: "Browser engine not configured" }, { status: 200 });
    }

    try {
      const health = await engineGet("/health");
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
      });
      return Response.json({ ok: true, configured: true, ...health });
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
    return Response.json({ error: error.message }, { status: 500 });
  }
}