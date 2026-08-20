import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { enginePost, engineGet, engineDelete, isEngineConfigured, setEngineClient } from "../../shared/engineClient.ts";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";

export default async function (req) {
  const base44 = createClientFromRequest(req);
  setEngineClient(base44);
  try {
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized", __v: DEPLOYMENT_VERSION }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Admin role required", __v: DEPLOYMENT_VERSION }, { status: 403 });

    const settings = await base44.asServiceRole.entities.SystemSettings.list("-created_date", 1);
    const sys = settings[0] || {};
    const poolSize = sys.pool_size || 3;
    const warmCount = sys.pool_warm_count || 2;

    let enginePool = { poolSize: 0, poolCapacity: 3, warmCount: 0, activeSessions: 0, maxSessions: 10, workerId: null, region: null };
    if (await isEngineConfigured()) {
      try { enginePool = await engineGet("/pool"); } catch {}
    }

    const pooled = await base44.asServiceRole.entities.Session.filter({ status: "pooled" });
    let created = 0;
    let recycled = 0;
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;

    for (const session of pooled) {
      if (session.started_at && new Date(session.started_at).getTime() < fiveMinAgo) {
        if (session.session_id && await isEngineConfigured()) {
          try { await engineDelete(`/sessions/${session.session_id}`); } catch {}
        }
        await base44.asServiceRole.entities.Session.update(session.id, { status: "ended", ended_at: new Date().toISOString() });
        recycled++;
      }
    }

    if (await isEngineConfigured() && enginePool.warmCount < warmCount) {
      const needed = warmCount - enginePool.warmCount;
      for (let i = 0; i < needed && i < 3; i++) {
        try {
          const engineResp = await enginePost("/sessions", {
            pooled: true,
            viewport: { width: sys.default_viewport_width || 1920, height: sys.default_viewport_height || 1080 },
            usePool: false,
          });
          if (engineResp.sessionId) {
            await base44.asServiceRole.entities.Session.create({
              session_id: engineResp.sessionId,
              status: "pooled",
              pool_id: "default",
              started_at: new Date().toISOString(),
              viewport: { width: sys.default_viewport_width || 1920, height: sys.default_viewport_height || 1080 },
              metadata: { worker_id: engineResp.workerId, region: engineResp.region, engine_version: engineResp.engineVersion },
            });
            created++;
          }
        } catch {}
      }
    }

    if (pooled.length > poolSize) {
      for (const session of pooled.slice(poolSize)) {
        if (session.session_id && await isEngineConfigured()) {
          try { await engineDelete(`/sessions/${session.session_id}`); } catch {}
        }
        await base44.asServiceRole.entities.Session.update(session.id, { status: "ended", ended_at: new Date().toISOString() });
        recycled++;
      }
    }

    await base44.asServiceRole.entities.AuditLog.create({
      action: "update",
      entity_type: "browser_pool",
      entity_id: "default",
      description: "Admin pool maintenance",
      metadata: { created, recycled, worker_id: enginePool.workerId || null },
      timestamp: new Date().toISOString(),
    }).catch(() => {});

    return Response.json({
      pool_size: poolSize, warm_count: warmCount, active_pooled: pooled.length,
      engine_pool_size: enginePool.poolSize ?? 0, engine_pool_capacity: enginePool.poolCapacity ?? 3,
      engine_warm_count: enginePool.warmCount ?? 0, engine_active_sessions: enginePool.activeSessions ?? 0,
      engine_max_sessions: enginePool.maxSessions ?? 10, worker_id: enginePool.workerId ?? null,
      region: enginePool.region ?? null, created, recycled, __v: DEPLOYMENT_VERSION,
    });
  } catch (error) {
    return Response.json({ error: error.message, __v: DEPLOYMENT_VERSION }, { status: 500 });
  }
}
