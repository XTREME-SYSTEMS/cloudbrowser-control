import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { engineFetch, isEngineConfigured, setEngineClient } from "../../shared/engineClient.ts";
import { secrets } from "base44:runtime";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    setEngineClient(base44);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized", __v: DEPLOYMENT_VERSION }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    if (!await isEngineConfigured()) {
      return Response.json({ error: "Browser engine not configured. Set BROWSER_ENGINE_URL and BROWSER_ENGINE_API_KEY in Settings → Secrets." }, { status: 503 });
    }

    // ---- Create session ----
    if (action === "create_session") {
      const { sessionConfig, targetUrl, tags } = body;
      const engineRes = await engineFetch("/sessions", {
        method: "POST",
        body: JSON.stringify({
          viewport: sessionConfig?.viewport,
          userAgent: sessionConfig?.userAgent,
          locale: sessionConfig?.locale,
          timezone: sessionConfig?.timezone,
          geolocation: sessionConfig?.geolocation,
          proxy: sessionConfig?.proxy,
          headers: sessionConfig?.headers,
          blockedResources: sessionConfig?.blockedResources,
          recordVideo: sessionConfig?.recordVideo,
          enableCDP: sessionConfig?.enableCDP,
          extensions: sessionConfig?.extensions,
          userDataDir: sessionConfig?.userDataDir,
          networkMocks: sessionConfig?.networkMocks,
          usePool: sessionConfig?.usePool,
        }),
      });

      const session = await base44.entities.Session.create({
        session_id: engineRes.sessionId,
        status: "idle",
        target_url: targetUrl || "",
        viewport: sessionConfig?.viewport,
        user_agent: sessionConfig?.userAgent,
        locale: sessionConfig?.locale,
        timezone: sessionConfig?.timezone,
        geolocation: sessionConfig?.geolocation,
        proxy_id: sessionConfig?.proxyId,
        headers: sessionConfig?.headers,
        blocked_resources: sessionConfig?.blockedResources,
        tags: tags || [],
        started_at: new Date().toISOString(),
        timeout_ms: sessionConfig?.timeoutMs || 30000,
        record_video: !!sessionConfig?.recordVideo,
        enable_cdp: !!sessionConfig?.enableCDP,
        cdp_url: engineRes.cdpUrl,
        profile_id: sessionConfig?.profileId,
        extension_ids: sessionConfig?.extensionIds,
      });

      return Response.json({ session });
    }

    // ---- Execute action on a session ----
    if (action === "execute") {
      const { sessionId, step } = body;
      const engineRes = await engineFetch(`/sessions/${sessionId}/execute`, {
        method: "POST",
        body: JSON.stringify({
          action_type: step.action_type,
          selector: step.selector,
          value: step.value,
          options: step.options || {},
        }),
      });

      // Log the action
      await base44.entities.LogEntry.create({
        session_id: sessionId,
        level: engineRes.ok ? "info" : "error",
        category: "action",
        message: `${step.action_type}${step.selector ? ` → ${step.selector}` : ""}${step.value ? ` (${step.value})` : ""}`,
        details: { result: engineRes, step },
        timestamp: new Date().toISOString(),
      });

      // Update session URL/title
      if (engineRes.url) {
        await base44.entities.Session.update(body.sessionEntityId, {
          current_url: engineRes.url,
          current_title: engineRes.title,
          status: "idle",
        });
      }

      return Response.json({ result: engineRes });
    }

    // ---- Screenshot ----
    if (action === "screenshot") {
      const { sessionId, sessionEntityId, fullPage, caption, stepId, jobId } = body;
      const engineRes = await engineFetch(`/sessions/${sessionId}/execute`, {
        method: "POST",
        body: JSON.stringify({
          action_type: "screenshot",
          options: { fullPage: !!fullPage },
        }),
      });

      if (!engineRes.base64) return Response.json({ error: "No screenshot returned" }, { status: 500 });

      // Upload to Base44 file storage
      const blob = new Blob([Uint8Array.from(atob(engineRes.base64), (c) => c.charCodeAt(0))], { type: "image/png" });
      const uploadRes = await base44.integrations.Core.UploadFile({ file: blob });
      const file_url = uploadRes.file_url;

      const screenshot = await base44.entities.Screenshot.create({
        session_id: sessionId,
        job_id: jobId,
        step_id: stepId,
        file_url,
        caption: caption || "",
        full_page: !!fullPage,
        taken_at: new Date().toISOString(),
      });

      return Response.json({ screenshot });
    }

    // ---- PDF ----
    if (action === "pdf") {
      const { sessionId, jobId, stepId } = body;
      const engineRes = await engineFetch(`/sessions/${sessionId}/execute`, {
        method: "POST",
        body: JSON.stringify({ action_type: "pdf", options: {} }),
      });

      if (!engineRes.base64) return Response.json({ error: "No PDF returned" }, { status: 500 });

      const blob = new Blob([Uint8Array.from(atob(engineRes.base64), (c) => c.charCodeAt(0))], { type: "application/pdf" });
      const uploadRes = await base44.integrations.Core.UploadFile({ file: blob });
      const file_url = uploadRes.file_url;

      const result = await base44.entities.Result.create({
        job_id: jobId,
        session_id: sessionId,
        step_id: stepId,
        data_type: "pdf_url",
        data: { file_url },
        extracted_at: new Date().toISOString(),
      });

      return Response.json({ result });
    }

    // ---- Close session ----
    if (action === "close_session") {
      const { sessionId, sessionEntityId } = body;
      await engineFetch(`/sessions/${sessionId}`, { method: "DELETE" });
      await base44.entities.Session.update(sessionEntityId, {
        status: "ended",
        ended_at: new Date().toISOString(),
      });
      return Response.json({ ok: true });
    }

    // ---- AI Extract ----
    if (action === "ai_extract") {
      const { sessionId, schema, prompt } = body;
      const engineRes = await engineFetch(`/sessions/${sessionId}/execute`, {
        method: "POST",
        body: JSON.stringify({ action_type: "ai_extract" }),
      });

      const llmRes = await base44.integrations.Core.InvokeLLM({
        prompt: `${prompt || "Extract the following data from this page content."}\n\nPage content:\n${engineRes.data}`,
        response_json_schema: schema,
      });

      return Response.json({ data: llmRes });
    }

    // ---- Share session ----
    if (action === "share_session") {
      const { sessionId, sessionEntityId } = body;
      const engineRes = await engineFetch(`/sessions/${sessionId}/share`, { method: "POST" });
      await base44.entities.Session.update(sessionEntityId, { share_token: engineRes.shareToken });
      return Response.json({ shareToken: engineRes.shareToken });
    }

    // ---- Save state ----
    if (action === "save_state") {
      const { sessionId, sessionEntityId } = body;
      const engineRes = await engineFetch(`/sessions/${sessionId}/execute`, {
        method: "POST",
        body: JSON.stringify({ action_type: "save_state" }),
      });
      await base44.entities.Session.update(sessionEntityId, { resume_token: engineRes.data?.stateToken });
      return Response.json({ state: engineRes.data });
    }

    // ---- Restore state ----
    if (action === "restore_state") {
      const { sessionId, stateToken } = body;
      const engineRes = await engineFetch(`/sessions/${sessionId}/execute`, {
        method: "POST",
        body: JSON.stringify({ action_type: "restore_state", options: { stateToken } }),
      });
      return Response.json({ result: engineRes.data });
    }

    // ---- Solve CAPTCHA ----
    if (action === "solve_captcha") {
      const { sessionId, captchaType, siteKey } = body;
      const captchaKey = secrets.get("CAPTCHA_SOLVER_API_KEY") || "";
      const engineRes = await engineFetch(`/sessions/${sessionId}/execute`, {
        method: "POST",
        body: JSON.stringify({ action_type: "solve_captcha", options: { type: captchaType, siteKey, apiKey: captchaKey } }),
      });
      return Response.json({ result: engineRes.data });
    }

    // ---- Get screenshot (for live view) ----
    if (action === "get_screenshot") {
      const { sessionId } = body;
      const engineRes = await engineFetch(`/sessions/${sessionId}/screenshot`);
      return Response.json({ base64: engineRes.base64, url: engineRes.url, title: engineRes.title });
    }

    return Response.json({ error: `Unknown action: ${action}`, __v: DEPLOYMENT_VERSION }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message, __v: DEPLOYMENT_VERSION }, { status: 500 });
  }
}