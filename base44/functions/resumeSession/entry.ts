import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { enginePost, isEngineConfigured, setEngineClient } from "../../shared/engineClient.ts";
import { decrypt } from "../../shared/crypto.ts";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";

export default async function (req) {
  const base44 = createClientFromRequest(req);
  setEngineClient(base44);
  try {
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized", __v: DEPLOYMENT_VERSION }, { status: 401 });

    const body = await req.json();
    const { resume_token, profile_id } = body || {};
    if (!resume_token) return Response.json({ error: "resume_token required", __v: DEPLOYMENT_VERSION }, { status: 400 });

    const visibleSessions = await base44.entities.Session.filter({ resume_token });
    if (!visibleSessions.length) return Response.json({ error: "Invalid or expired resume token", __v: DEPLOYMENT_VERSION }, { status: 404 });
    const original = visibleSessions[0];
    if (!original.project_id && user.role !== "admin") return Response.json({ error: "Project-scoped Session required", __v: DEPLOYMENT_VERSION }, { status: 403 });
    if (!await isEngineConfigured()) return Response.json({ error: "Engine not configured", __v: DEPLOYMENT_VERSION }, { status: 503 });

    const profile = profile_id || original.profile_id;
    let cookies = null;
    let storageState = null;
    if (profile) {
      const profiles = await base44.entities.Profile.filter({ id: profile });
      if (profiles[0]) {
        if (profiles[0].cookies_encrypted) {
          const value = await decrypt(profiles[0].cookies_encrypted);
          if (value) cookies = JSON.parse(value);
        }
        if (profiles[0].storage_state_encrypted) {
          const value = await decrypt(profiles[0].storage_state_encrypted);
          if (value) storageState = JSON.parse(value);
        }
      }
    }

    const engineResp = await enginePost("/sessions", {
      viewport: original.viewport,
      userAgent: original.user_agent,
      locale: original.locale,
      timezone: original.timezone,
      headers: original.headers,
      cookies,
      storageState,
      usePool: false,
    });
    if (!engineResp.sessionId) return Response.json({ error: "Engine returned no runtime session ID", __v: DEPLOYMENT_VERSION }, { status: 502 });

    const newSession = await base44.entities.Session.create({
      session_id: engineResp.sessionId,
      project_id: original.project_id || null,
      status: "running",
      target_url: original.current_url || original.target_url,
      viewport: original.viewport,
      user_agent: original.user_agent,
      locale: original.locale,
      timezone: original.timezone,
      proxy_id: original.proxy_id,
      headers: original.headers,
      profile_id: profile,
      started_at: new Date().toISOString(),
      metadata: {
        ...original.metadata,
        resumed_from: original.id,
        project_id: original.project_id || null,
        worker_id: engineResp.workerId,
        region: engineResp.region,
        engine_version: engineResp.engineVersion,
      },
    });

    return Response.json({
      session: newSession,
      resumed_from: original.id,
      runtime_session_id: engineResp.sessionId,
      context_restored: Boolean(cookies || storageState),
      __v: DEPLOYMENT_VERSION,
    });
  } catch (error) {
    return Response.json({ error: error.message, __v: DEPLOYMENT_VERSION }, { status: 500 });
  }
}
