import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { enginePost, isEngineConfigured, setEngineClient } from "../../shared/engineClient.ts";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";

export default async function (req) {
  const base44 = createClientFromRequest(req);
  setEngineClient(base44);
  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized", __v: DEPLOYMENT_VERSION }, { status: 401 });

    const body = await req.json();
    const { resume_token, profile_id } = body;
    if (!resume_token) return Response.json({ error: "resume_token required" }, { status: 400 });

    // Find the original session by resume_token
    const sessions = await base44.entities.Session.filter({ resume_token });
    if (!sessions.length) return Response.json({ error: "Invalid or expired resume token", __v: DEPLOYMENT_VERSION }, { status: 404 });
    const original = sessions[0];

    if (!await isEngineConfigured()) return Response.json({ error: "Engine not configured" }, { status: 503 });

    // Load context state from profile if available
    const profile = profile_id || original.profile_id;
    let cookies = null, storageState = null;
    if (profile) {
      const profiles = await base44.entities.Profile.filter({ id: profile });
      if (profiles[0]) { cookies = profiles[0].cookies; storageState = profiles[0].storage_state; }
    }

    // Create a new session on the engine with state restoration (proper POST)
    const engineResp = await enginePost("/sessions", {
      target_url: original.current_url || original.target_url,
      viewport: original.viewport,
      userAgent: original.user_agent,
      locale: original.locale,
      timezone: original.timezone,
      proxy: original.proxy_id ? { server: original.proxy_id } : undefined,
      headers: original.headers,
      cookies,
      storageState,
      resume: true,
      usePool: false,
    });

    const runtimeSessionId = engineResp.sessionId;
    if (!runtimeSessionId) return Response.json({ error: "Engine returned no runtime session ID" }, { status: 502 });

    const newSession = await base44.entities.Session.create({
      session_id: runtimeSessionId,
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
        resumed_from: original.id,
        ...original.metadata,
        worker_id: engineResp.workerId,
        region: engineResp.region,
        engine_version: engineResp.engineVersion,
      },
    });

    return Response.json({
      session: newSession,
      resumed_from: original.id,
      runtime_session_id: runtimeSessionId,
      context_restored: !!(cookies || storageState),
    });
  } catch (error) {
    return Response.json({ error: error.message, __v: DEPLOYMENT_VERSION }, { status: 500 });
  }
}