import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { engineFetch, isEngineConfigured, setEngineClient } from "../../shared/engineClient.ts";
import { calculateJobCost } from "../../shared/costCalculator.ts";
import { logAudit } from "../../shared/auditLogger.ts";
import { secrets } from "base44:runtime";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    setEngineClient(base44);
    const user = await base44.auth.me().catch(() => null);

    const body = await req.json();
    const { jobId } = body;

    if (!await isEngineConfigured()) {
      return Response.json({ error: "Browser engine not configured. Set BROWSER_ENGINE_URL and BROWSER_ENGINE_API_KEY in Settings → Secrets." }, { status: 503 });
    }

    // Load job and steps
    const job = await base44.asServiceRole.entities.Job.get(jobId);
    if (!job) return Response.json({ error: "Job not found", __v: DEPLOYMENT_VERSION }, { status: 404 });

    const steps = await base44.asServiceRole.entities.Step.filter({ job_id: jobId });
    steps.sort((a, b) => a.order - b.order);

    // Mark job running
    await base44.asServiceRole.entities.Job.update(jobId, {
      status: "running",
      started_at: new Date().toISOString(),
      steps_count: steps.length,
    });

    // Create session on engine
    let sessionEntity;
    let sessionId;
    try {
      const sessionConfig = job.session_config || {};
      const engineRes = await engineFetch("/sessions", {
        method: "POST",
        body: JSON.stringify({
          viewport: sessionConfig.viewport,
          userAgent: sessionConfig.userAgent,
          locale: sessionConfig.locale,
          timezone: sessionConfig.timezone,
          geolocation: sessionConfig.geolocation,
          proxy: sessionConfig.proxy,
          headers: sessionConfig.headers,
          blockedResources: sessionConfig.blockedResources,
          recordVideo: sessionConfig.recordVideo,
          enableCDP: sessionConfig.enableCDP,
          extensions: sessionConfig.extensions,
          userDataDir: sessionConfig.userDataDir,
          networkMocks: sessionConfig.networkMocks,
          usePool: sessionConfig.usePool,
        }),
      });
      sessionId = engineRes.sessionId;

      sessionEntity = await base44.asServiceRole.entities.Session.create({
        session_id: sessionId,
        status: "running",
        target_url: job.start_url,
        viewport: sessionConfig.viewport,
        user_agent: sessionConfig.userAgent,
        locale: sessionConfig.locale,
        timezone: sessionConfig.timezone,
        geolocation: sessionConfig.geolocation,
        proxy_id: sessionConfig.proxyId,
        headers: sessionConfig.headers,
        blocked_resources: sessionConfig.blockedResources,
        started_at: new Date().toISOString(),
        timeout_ms: sessionConfig.timeoutMs || 30000,
        record_video: !!sessionConfig.recordVideo,
        enable_cdp: !!sessionConfig.enableCDP,
        cdp_url: engineRes.cdpUrl,
        profile_id: sessionConfig.profileId,
        extension_ids: sessionConfig.extensionIds,
      });

      await base44.asServiceRole.entities.Job.update(jobId, { session_id: sessionEntity.id });
    } catch (err) {
      await base44.asServiceRole.entities.Job.update(jobId, {
        status: "failed",
        error_message: `Session creation failed: ${err.message}`,
        completed_at: new Date().toISOString(),
      });
      return Response.json({ error: err.message }, { status: 500 });
    }

    let stepResults = [];
    let failed = false;
    let errorMsg = "";

    // Execute each step
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      try {
        // Handle screenshot/PDF specially (upload + store)
        if (step.action_type === "screenshot") {
          const engineRes = await engineFetch(`/sessions/${sessionId}/execute`, {
            method: "POST",
            body: JSON.stringify({ action_type: "screenshot", options: { fullPage: step.options?.fullPage } }),
          });
          if (engineRes.base64) {
            const blob = new Blob([Uint8Array.from(atob(engineRes.base64), (c) => c.charCodeAt(0))], { type: "image/png" });
            const uploadRes = await base44.integrations.Core.UploadFile({ file: blob });
            await base44.asServiceRole.entities.Screenshot.create({
              session_id: sessionEntity.id,
              job_id: jobId,
              step_id: step.id,
              file_url: uploadRes.file_url,
              caption: step.name || "",
              full_page: !!step.options?.fullPage,
              taken_at: new Date().toISOString(),
            });
          }
        } else if (step.action_type === "pdf") {
          const engineRes = await engineFetch(`/sessions/${sessionId}/execute`, {
            method: "POST",
            body: JSON.stringify({ action_type: "pdf" }),
          });
          if (engineRes.base64) {
            const blob = new Blob([Uint8Array.from(atob(engineRes.base64), (c) => c.charCodeAt(0))], { type: "application/pdf" });
            const uploadRes = await base44.integrations.Core.UploadFile({ file: blob });
            await base44.asServiceRole.entities.Result.create({
              job_id: jobId, session_id: sessionEntity.id, step_id: step.id,
              step_order: step.order, action_type: "pdf", data_type: "pdf_url",
              data: { file_url: uploadRes.file_url }, extracted_at: new Date().toISOString(),
            });
          }
        } else if (step.action_type === "ai_extract") {
          const engineRes = await engineFetch(`/sessions/${sessionId}/execute`, {
            method: "POST",
            body: JSON.stringify({ action_type: "ai_extract" }),
          });
          const llmRes = await base44.integrations.Core.InvokeLLM({
            prompt: `${step.options?.prompt || "Extract data from this page."}\n\nPage content:\n${engineRes.data}`,
            response_json_schema: step.options?.schema,
          });
          const result = await base44.asServiceRole.entities.Result.create({
            job_id: jobId, session_id: sessionEntity.id, step_id: step.id,
            step_order: step.order, action_type: "ai_extract", data_type: "ai_extract",
            data: llmRes, extracted_at: new Date().toISOString(),
          });
          stepResults.push(result);
        } else if (step.action_type === "solve_captcha") {
          const captchaKey = secrets.get("CAPTCHA_SOLVER_API_KEY") || "";
          const engineRes = await engineFetch(`/sessions/${sessionId}/execute`, {
            method: "POST",
            body: JSON.stringify({ action_type: "solve_captcha", options: { ...step.options, apiKey: captchaKey } }),
          });
          const result = await base44.asServiceRole.entities.Result.create({
            job_id: jobId, session_id: sessionEntity.id, step_id: step.id,
            step_order: step.order, action_type: "solve_captcha", data_type: "text",
            data: { value: engineRes.data }, extracted_at: new Date().toISOString(),
          });
          stepResults.push(result);
        } else {
          const engineRes = await engineFetch(`/sessions/${sessionId}/execute`, {
            method: "POST",
            body: JSON.stringify({
              action_type: step.action_type,
              selector: step.selector,
              value: step.value,
              options: step.options || {},
            }),
          });

          // Store extraction results
          if (["extract_text", "extract_html", "extract_attribute", "extract_table", "extract_json"].includes(step.action_type) && engineRes.data !== undefined) {
            const dataType = step.action_type.replace("extract_", "");
            const result = await base44.asServiceRole.entities.Result.create({
              job_id: jobId, session_id: sessionEntity.id, step_id: step.id,
              step_order: step.order, action_type: step.action_type,
              data_type: dataType, data: { value: engineRes.data },
              extracted_at: new Date().toISOString(),
            });
            stepResults.push(result);
          }
        }

        // Log success
        await base44.asServiceRole.entities.LogEntry.create({
          session_id: sessionEntity.id, job_id: jobId, step_id: step.id,
          level: "info", category: "action",
          message: `Step ${i + 1}/${steps.length}: ${step.action_type} — ${step.name || ""}`,
          timestamp: new Date().toISOString(),
        });

        // Update session URL
        await base44.asServiceRole.entities.Session.update(sessionEntity.id, {
          current_url: step.action_type === "goto" ? step.value : undefined,
          status: "running",
        });
      } catch (err) {
        failed = true;
        errorMsg = `Step ${i + 1} (${step.action_type}) failed: ${err.message}`;
        await base44.asServiceRole.entities.LogEntry.create({
          session_id: sessionEntity.id, job_id: jobId, step_id: step.id,
          level: "error", category: "error",
          message: errorMsg, details: { error: err.message },
          timestamp: new Date().toISOString(),
        });
        break;
      }
    }

    // Close engine session (and upload video if recorded)
    try {
      const closeRes = await engineFetch(`/sessions/${sessionId}`, { method: "DELETE" });
      if (closeRes.videoBase64) {
        try {
          const blob = new Blob([Uint8Array.from(atob(closeRes.videoBase64), (c) => c.charCodeAt(0))], { type: "video/webm" });
          const uploadRes = await base44.integrations.Core.UploadFile({ file: blob });
          await base44.asServiceRole.entities.Session.update(sessionEntity.id, { video_url: uploadRes.file_url });
        } catch (e) { console.error("Video upload failed:", e.message); }
      }
    } catch (e) {}

    // Update session + job
    await base44.asServiceRole.entities.Session.update(sessionEntity.id, {
      status: failed ? "errored" : "ended",
      ended_at: new Date().toISOString(),
      error_message: failed ? errorMsg : undefined,
    });

    await base44.asServiceRole.entities.Job.update(jobId, {
      status: failed ? "failed" : "completed",
      completed_at: new Date().toISOString(),
      error_message: failed ? errorMsg : undefined,
      results_summary: { count: stepResults.length, types: stepResults.map((r) => r.data_type) },
    });

    // Calculate and store cost
    try {
      await calculateJobCost(base44, jobId);
    } catch (e) {
      console.error("Cost calculation failed:", e.message);
    }

    // Trigger webhooks
    try {
      await base44.functions.invoke("triggerWebhook", {
        event: failed ? "job.failed" : "job.completed",
        payload: { jobId, jobName: job.name, status: failed ? "failed" : "completed", error: failed ? errorMsg : null },
      });
    } catch (e) { console.error("Webhook trigger failed:", e.message); }

    // Audit log
    await logAudit(base44, user || { id: "system", full_name: "System" }, "run", "job", jobId, `Job "${job.name}" ${failed ? "failed" : "completed"}`);

    return Response.json({ ok: !failed, jobId, error: failed ? errorMsg : undefined, results: stepResults.length, __v: DEPLOYMENT_VERSION });
  } catch (error) {
    return Response.json({ error: error.message, __v: DEPLOYMENT_VERSION }, { status: 500 });
  }
}