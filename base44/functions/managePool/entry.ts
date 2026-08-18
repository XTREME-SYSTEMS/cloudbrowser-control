import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { engineFetch, isEngineConfigured } from "../../shared/engineClient.ts";

export default async function (req) {
  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const settings = await base44.entities.SystemSettings.list("-created_date", 1);
    const sys = settings[0] || {};
    const poolSize = sys.pool_size || 3;
    const warmCount = sys.pool_warm_count || 2;

    // Get current pooled sessions
    const pooled = await base44.entities.Session.filter({ status: "pooled" });
    const activePooled = pooled.length;

    let created = 0;
    let recycled = 0;

    // Recycle idle pooled sessions older than 5 minutes
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    for (const s of pooled) {
      if (s.started_at && new Date(s.started_at).getTime() < fiveMinAgo) {
        await base44.entities.Session.update(s.id, { status: "ended", ended_at: new Date().toISOString() });
        recycled++;
      }
    }

    // Warm up new sessions if below warm count
    if (isEngineConfigured() && activePooled < warmCount) {
      const needed = warmCount - activePooled;
      for (let i = 0; i < needed && i < 3; i++) {
        try {
          const engineResp = await engineFetch("/sessions", {
            pooled: true,
            viewport: { width: sys.default_viewport_width || 1920, height: sys.default_viewport_height || 1080 },
          });
          await base44.entities.Session.create({
            session_id: engineResp.session_id || engineResp.id,
            status: "pooled",
            pool_id: "default",
            started_at: new Date().toISOString(),
            viewport: { width: sys.default_viewport_width || 1920, height: sys.default_viewport_height || 1080 },
          });
          created++;
        } catch (e) { /* engine may be down, skip */ }
      }
    }

    // Trim excess pooled sessions
    if (activePooled > poolSize) {
      const excess = pooled.slice(poolSize);
      for (const s of excess) {
        await base44.entities.Session.update(s.id, { status: "ended", ended_at: new Date().toISOString() });
        recycled++;
      }
    }

    return Response.json({
      pool_size: poolSize,
      warm_count: warmCount,
      active_pooled: activePooled,
      created,
      recycled,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}