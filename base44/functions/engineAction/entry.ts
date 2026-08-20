import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { engineFetch, isEngineConfigured, setEngineClient } from "../../shared/engineClient.ts";
import { secrets } from "base44:runtime";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    setEngineClient(base44);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized", __v: DEPLOYMENT_VERSION }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Admin role required", __v: DEPLOYMENT_VERSION }, { status: 403 });

    const body = await req.json();
    const { action } = body;
    if (!await isEngineConfigured()) return Response.json({ error: "Browser engine not configured", __v: DEPLOYMENT_VERSION }, { status: 503 });

    if (action === "create_session") {
      const { sessionConfig = {}, targetUrl, tags } = body;
      if (sessionConfig.userDataDir !== undefined) return Response.json({ error: "userDataDir prohibited" }, { status: 400 });
      const engineRes = await engineFetch("/sessions", { method: "POST", body: JSON.stringify({
        viewport: sessionConfig.viewport, userAgent: sessionConfig.userAgent, locale: sessionConfig.locale,
        timezone: sessionConfig.timezone, geolocation: sessionConfig.geolocation, proxy: sessionConfig.proxy,
        headers: sessionConfig.headers, blockedResources: sessionConfig.blockedResources, recordVideo: sessionConfig.recordVideo,
        enableCDP: sessionConfig.enableCDP, extensions: sessionConfig.extensions, networkMocks: sessionConfig.networkMocks,
        usePool: sessionConfig.usePool, egressPolicy: sessionConfig.egressPolicy,
      }) });
      const session = await base44.entities.Session.create({
        session_id: engineRes.sessionId, project_id: sessionConfig.project_id || null, status: "idle",
        target_url: targetUrl || "", viewport: sessionConfig.viewport, user_agent: sessionConfig.userAgent,
        locale: sessionConfig.locale, timezone: sessionConfig.timezone, geolocation: sessionConfig.geolocation,
        proxy_id: sessionConfig.proxyId, headers: sessionConfig.headers, blocked_resources: sessionConfig.blockedResources,
        tags: tags || [], started_at: new Date().toISOString(), timeout_ms: sessionConfig.timeoutMs || 30000,
        record_video: Boolean(sessionConfig.recordVideo), enable_cdp: Boolean(sessionConfig.enableCDP),
        profile_id: sessionConfig.profileId, extension_ids: sessionConfig.extensionIds,
        metadata: { worker_id: engineRes.workerId, region: engineRes.region, project_id: sessionConfig.project_id || null },
      });
      return Response.json({ session, __v: DEPLOYMENT_VERSION });
    }

    if (action === "execute") {
      const { sessionId, sessionEntityId, step } = body;
      const entity = sessionEntityId ? await base44.entities.Session.get(sessionEntityId) : null;
      if (!entity || entity.session_id !== sessionId) return Response.json({ error: "Session identity mismatch" }, { status: 404 });
      const engineRes = await engineFetch(`/sessions/${sessionId}/execute`, { method: "POST", body: JSON.stringify({ action_type: step.action_type, selector: step.selector, value: step.value, options: step.options || {} }) });
      await base44.entities.LogEntry.create({ session_id: sessionEntityId, level: engineRes.ok ? "info" : "error", category: "action", message: `${step.action_type}${step.selector ? ` → ${step.selector}` : ""}`, details: { result: engineRes, step }, timestamp: new Date().toISOString() });
      if (engineRes.url) await base44.entities.Session.update(sessionEntityId, { current_url: engineRes.url, current_title: engineRes.title, status: "idle" });
      return Response.json({ result: engineRes, __v: DEPLOYMENT_VERSION });
    }

    if (action === "screenshot") {
      const { sessionId, sessionEntityId, fullPage, caption, stepId, jobId } = body;
      const entity = sessionEntityId ? await base44.entities.Session.get(sessionEntityId) : null;
      if (!entity || entity.session_id !== sessionId) return Response.json({ error: "Session identity mismatch" }, { status: 404 });
      const engineRes = await engineFetch(`/sessions/${sessionId}/execute`, { method: "POST", body: JSON.stringify({ action_type: "screenshot", options: { fullPage: Boolean(fullPage) } }) });
      if (!engineRes.base64) return Response.json({ error: "No screenshot returned" }, { status: 500 });
      const file = new File([Uint8Array.from(atob(engineRes.base64), (c) => c.charCodeAt(0))], "screenshot.png", { type: "image/png" });
      const uploadRes = await base44.integrations.Core.UploadFile({ file });
      const screenshot = await base44.entities.Screenshot.create({ session_id: sessionEntityId, job_id: jobId, step_id: stepId, file_url: uploadRes.file_url, caption: caption || "", full_page: Boolean(fullPage), taken_at: new Date().toISOString() });
      return Response.json({ screenshot, __v: DEPLOYMENT_VERSION });
    }

    if (action === "pdf") {
      const { sessionId, sessionEntityId, jobId, stepId } = body;
      const entity = sessionEntityId ? await base44.entities.Session.get(sessionEntityId) : null;
      if (!entity || entity.session_id !== sessionId) return Response.json({ error: "Session identity mismatch" }, { status: 404 });
      const engineRes = await engineFetch(`/sessions/${sessionId}/execute`, { method: "POST", body: JSON.stringify({ action_type: "pdf", options: {} }) });
      if (!engineRes.base64) return Response.json({ error: "No PDF returned" }, { status: 500 });
      const file = new File([Uint8Array.from(atob(engineRes.base64), (c) => c.charCodeAt(0))], "document.pdf", { type: "application/pdf" });
      const uploadRes = await base44.integrations.Core.UploadFile({ file });
      const result = await base44.entities.Result.create({ job_id: jobId, session_id: sessionEntityId, step_id: stepId, data_type: "pdf_url", data: { file_url: uploadRes.file_url }, extracted_at: new Date().toISOString() });
      return Response.json({ result, __v: DEPLOYMENT_VERSION });
    }

    if (action === "close_session") {
      const { sessionId, sessionEntityId } = body;
      const entity = sessionEntityId ? await base44.entities.Session.get(sessionEntityId) : null;
      if (!entity || entity.session_id !== sessionId) return Response.json({ error: "Session identity mismatch" }, { status: 404 });
      await engineFetch(`/sessions/${sessionId}`, { method: "DELETE" });
      await base44.entities.Session.update(sessionEntityId, { status: "ended", ended_at: new Date().toISOString() });
      return Response.json({ ok: true, __v: DEPLOYMENT_VERSION });
    }

    if (action === "ai_extract") {
      const { sessionId, sessionEntityId, schema, prompt } = body;
      const entity = sessionEntityId ? await base44.entities.Session.get(sessionEntityId) : null;
      if (!entity || entity.session_id !== sessionId) return Response.json({ error: "Session identity mismatch" }, { status: 404 });
      const engineRes = await engineFetch(`/sessions/${sessionId}/execute`, { method: "POST", body: JSON.stringify({ action_type: "ai_extract" }) });
      const data = await base44.integrations.Core.InvokeLLM({ prompt: `${prompt || "Extract data from this page."}\n\nPage content:\n${engineRes.data}`, response_json_schema: schema });
      return Response.json({ data, __v: DEPLOYMENT_VERSION });
    }

    if (["share_session", "save_state", "restore_state", "solve_captcha", "get_screenshot"].includes(action)) {
      const { sessionId, sessionEntityId } = body;
      const entity = sessionEntityId ? await base44.entities.Session.get(sessionEntityId) : null;
      if (!entity || entity.session_id !== sessionId) return Response.json({ error: "Session identity mismatch" }, { status: 404 });
      if (action === "share_session") {
        const engineRes = await engineFetch(`/sessions/${sessionId}/share`, { method: "POST" });
        await base44.entities.Session.update(sessionEntityId, { share_token: engineRes.shareToken });
        return Response.json({ shareToken: engineRes.shareToken, __v: DEPLOYMENT_VERSION });
      }
      if (action === "save_state") {
        const engineRes = await engineFetch(`/sessions/${sessionId}/execute`, { method: "POST", body: JSON.stringify({ action_type: "save_state" }) });
        await base44.entities.Session.update(sessionEntityId, { resume_token: engineRes.data?.stateToken });
        return Response.json({ state: engineRes.data, __v: DEPLOYMENT_VERSION });
      }
      if (action === "restore_state") {
        const engineRes = await engineFetch(`/sessions/${sessionId}/execute`, { method: "POST", body: JSON.stringify({ action_type: "restore_state", options: { stateToken: body.stateToken } }) });
        return Response.json({ result: engineRes.data, __v: DEPLOYMENT_VERSION });
      }
      if (action === "solve_captcha") {
        const captchaKey = secrets.get("CAPTCHA_SOLVER_API_KEY") || "";
        const engineRes = await engineFetch(`/sessions/${sessionId}/execute`, { method: "POST", body: JSON.stringify({ action_type: "solve_captcha", options: { type: body.captchaType, siteKey: body.siteKey, apiKey: captchaKey } }) });
        return Response.json({ result: engineRes.data, __v: DEPLOYMENT_VERSION });
      }
      const engineRes = await engineFetch(`/sessions/${sessionId}/screenshot`);
      return Response.json({ base64: engineRes.base64, url: engineRes.url, title: engineRes.title, __v: DEPLOYMENT_VERSION });
    }

    return Response.json({ error: `Unknown action: ${action}`, __v: DEPLOYMENT_VERSION }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message, __v: DEPLOYMENT_VERSION }, { status: 500 });
  }
}
