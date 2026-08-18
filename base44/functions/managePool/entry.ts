import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { enginePost, engineGet, engineDelete, isEngineConfigured } from "../../shared/engineClient.ts";

export default async function (req) {
  const base44 = createClientFromRequest(req);
  try {
    const settings = await base44.asServiceRole.entities.SystemSettings.list("-created_date", 1);
    const sys = settings[0] || {};
    const poolSize = sys.pool_size || 3;
    const warmCount = sys.pool_warm_count || 2;

    // Get real pool state from the engine
    let enginePool = { poolSize: 0, poolCapacity: 3, warmCount: 0, activeSessions: 0, maxSessions: 10, workerId: null, region: null };
    if (isEngineConfigured()) {
      try { enginePool = await engineGet("/pool"); } catch (e) { /* engine down */ }
    }

    // Get control-plane pooled sessions
    const pooled = await base44.entities.Session.filter({ status: "pooled" });
    let created = 0;
    let recycled = 0;

    // Recycle idle pooled sessions older than 5 minutes
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    for (const s of pooled) {
      if (s.started_at && new Date(s.started_at).getTime() < fiveMinAgo) {
        // Close the real runtime session if it exists
        if (s.session_id && isEngineConfigured()) {
          try { await engineDelete(`/sessions/${s.session_id}`); } catch (e) {}
        }
        await base44.entities.Session.update(s.id, { status: "ended", ended_at: new Date().toISOString() });
        recycled++;
      }
    }

    // Warm up new sessions if below warm count — creates REAL browsers
    if (isEngineConfigured() && enginePool.warmCount < warmCount) {
      const needed = warmCount - enginePool.warmCount;
      for (let i = 0; i < needed && i < 3; i++) {
        try {
          const engineResp = await enginePost("/sessions", {
            pooled: true,
            viewport: { width: sys.default_viewport_width || 1920, height: sys.default_viewport_height || 1080 },
            usePool: false, // don't pull from pool, create fresh
          });
          const runtimeId = engineResp.sessionId;
          if (runtimeId) {
            await base44.entities.Session.create({
              session_id: runtimeId,
              status: "pooled",
              pool_id: "default",
              started_at: new Date().toISOString(),
              viewport: { width: sys.default_viewport_width || 1920, height: sys.default_viewport_height || 1080 },
              metadata: { worker_id: engineResp.workerId, region: engineResp.region, engine_version: engineResp.engineVersion },
            });
            created++;
          }
        } catch (e) { /* engine may be down, skip */ }
      }
    }

    // Trim excess pooled sessions
    if (pooled.length > poolSize) {
      const excess = pooled.slice(poolSize);
      for (const s of excess) {
        if (s.session_id && isEngineConfigured()) {
          try { await engineDelete(`/sessions/${s.session_id}`); } catch (e) {}
        }
        await base44.entities.Session.update(s.id, { status: "ended", ended_at: new Date().toISOString() });
        recycled++;
      }
    }

    return Response.json({
      pool_size: poolSize,
      warm_count: warmCount,
      active_pooled: pooled.length,
      engine_pool_size: enginePool.poolSize,
      engine_pool_capacity: enginePool.poolCapacity,
      engine_warm_count: enginePool.warmCount,
      engine_active_sessions: enginePool.activeSessions,
      engine_max_sessions: enginePool.maxSessions,
      worker_id: enginePool.workerId,
      region: enginePool.region,
      created,
      recycled,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}