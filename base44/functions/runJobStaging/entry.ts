import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { stagingEngineFetch, isStagingEngineConfigured, requireIsolatedFortressTestEnvironment, STAGING_ENGINE_CONFIGURATION_REQUIRED } from "../../shared/stagingEngineClient.ts";
import { calculateJobCost } from "../../shared/costCalculator.ts";
import { logAudit } from "../../shared/auditLogger.ts";
import { secrets } from "base44:runtime";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";

// ═══════════════════════════════════════════════
// runJobStaging — STAGING job executor (Fortress v1.1)
// ADDITIVE: copy of runJob but uses STAGING engine client only.
// Fail-closed: refuses unless requireIsolatedFortressTestEnvironment().
// Production runJob is unchanged (diff=0).
// ═══════════════════════════════════════════════

async function computeContentHash(base64Data) {
  const bytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function createArtifact(base44, type, storageKey, storageBackend, sessionEntity, jobId, step, base64Data, mimeType) {
  const contentHash = await computeContentHash(base64Data);
  const sizeBytes = Math.floor(base64Data.length * 0.75);
  const retentionDays = 30;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000).toISOString();
  return base44.asServiceRole.entities.Artifact.create({
    artifact_id: "stg_art_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
    type, project_id: sessionEntity.project_id || null, session_id: sessionEntity.id, job_id: jobId,
    step_id: step?.id || null, storage_key: storageKey, storage_backend: storageBackend,
    mime_type: mimeType, size_bytes: sizeBytes, content_hash: contentHash,
    created_at: now.toISOString(), expires_at: expiresAt, retention_days: retentionDays,
    access_policy: "private", metadata: { action_type: step?.action_type, environment: "staging" },
  });
}

export default async function (req) {
  if (!requireIsolatedFortressTestEnvironment()) {
    return Response.json({ error: STAGING_ENGINE_CONFIGURATION_REQUIRED, environment: "staging" }, { status: 503 });
  }
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    const body = await req.json();
    const { jobId } = body;

    if (!await isStagingEngineConfigured()) {
      return Response.json({ error: "Staging engine not configured. Set STAGING_ENGINE_URL and STAGING_ENGINE_API_KEY in Settings → Secrets." }, { status: 503 });
    }

    const job = await base44.asServiceRole.entities.Job.get(jobId);
    if (!job) return Response.json({ error: "Job not found", __v: DEPLOYMENT_VERSION }, { status: 404 });

    const steps = await base44.asServiceRole.entities.Step.filter({ job_id: jobId });
    steps.sort((a, b) => a.order - b.order);

    await base44.asServiceRole.entities.Job.update(jobId, {
      status: "running", started_at: new Date().toISOString(), steps_count: steps.length,
    });

    let sessionEntity, sessionId;
    try {
      const sessionConfig = job.session_config || {};
      const engineRes = await stagingEngineFetch("/sessions", {
        method: "POST",
        body: JSON.stringify({
          viewport: sessionConfig.viewport, userAgent: sessionConfig.userAgent,
          locale: sessionConfig.locale, timezone: sessionConfig.timezone,
          geolocation: sessionConfig.geolocation, proxy: sessionConfig.proxy,
          headers: sessionConfig.headers, blockedResources: sessionConfig.blockedResources,
          recordVideo: sessionConfig.recordVideo, enableCDP: sessionConfig.enableCDP,
          extensions: sessionConfig.extensions, userDataDir: sessionConfig.userDataDir,
          networkMocks: sessionConfig.networkMocks, usePool: sessionConfig.usePool,
        }),
      });
      sessionId = engineRes.sessionId;
      sessionEntity = await base44.asServiceRole.entities.Session.create({
        session_id: sessionId, status: "running", target_url: job.start_url,
        viewport: sessionConfig.viewport, user_agent: sessionConfig.userAgent,
        locale: sessionConfig.locale, timezone: sessionConfig.timezone,
        geolocation: sessionConfig.geolocation, proxy_id: sessionConfig.proxyId,
        headers: sessionConfig.headers, blocked_resources: sessionConfig.blockedResources,
        started_at: new Date().toISOString(), timeout_ms: sessionConfig.timeoutMs || 30000,
        record_video: !!sessionConfig.recordVideo, enable_cdp: !!sessionConfig.enableCDP,
        cdp_url: engineRes.cdpUrl, profile_id: sessionConfig.profileId, extension_ids: sessionConfig.extensionIds,
        metadata: { environment: "staging" },
      });
      await base44.asServiceRole.entities.Job.update(jobId, { session_id: sessionEntity.id });
    } catch (err) {
      await base44.asServiceRole.entities.Job.update(jobId, {
        status: "failed", error_message: `Staging session creation failed: ${err.message}`,
        completed_at: new Date().toISOString(),
      });
      return Response.json({ error: err.message, environment: "staging" }, { status: 500 });
    }

    let stepResults = [];
    let failed = false;
    let errorMsg = "";

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      try {
        if (step.action_type === "screenshot") {
          const engineRes = await stagingEngineFetch(`/sessions/${sessionId}/execute`, {
            method: "POST", body: JSON.stringify({ action_type: "screenshot", options: { fullPage: step.options?.fullPage } }),
          });
          if (engineRes.base64) {
            const file = new File([Uint8Array.from(atob(engineRes.base64), (c) => c.charCodeAt(0))], `stg_screenshot_${step.order}.png`, { type: "image/png" });
            const uploadRes = await base44.integrations.Core.UploadFile({ file });
            await base44.asServiceRole.entities.Screenshot.create({
              session_id: sessionEntity.id, job_id: jobId, step_id: step.id,
              file_url: uploadRes.file_url, caption: step.name || "", full_page: !!step.options?.fullPage,
              taken_at: new Date().toISOString(),
            });
            await createArtifact(base44, "screenshot", uploadRes.file_url, "base44_files", sessionEntity, jobId, step, engineRes.base64, "image/png");
          }
        } else if (step.action_type === "pdf") {
          const engineRes = await stagingEngineFetch(`/sessions/${sessionId}/execute`, { method: "POST", body: JSON.stringify({ action_type: "pdf" }) });
          if (engineRes.base64) {
            const file = new File([Uint8Array.from(atob(engineRes.base64), (c) => c.charCodeAt(0))], `stg_document_${step.order}.pdf`, { type: "application/pdf" });
            const uploadRes = await base44.integrations.Core.UploadFile({ file });
            await base44.asServiceRole.entities.Result.create({
              job_id: jobId, session_id: sessionEntity.id, step_id: step.id, step_order: step.order,
              action_type: "pdf", data_type: "pdf_url", data: { file_url: uploadRes.file_url }, extracted_at: new Date().toISOString(),
            });
            await createArtifact(base44, "pdf", uploadRes.file_url, "base44_files", sessionEntity, jobId, step, engineRes.base64, "application/pdf");
          }
        } else if (step.action_type === "ai_extract") {
          const engineRes = await stagingEngineFetch(`/sessions/${sessionId}/execute`, { method: "POST", body: JSON.stringify({ action_type: "ai_extract" }) });
          const llmRes = await base44.integrations.Core.InvokeLLM({
            prompt: `${step.options?.prompt || "Extract data from this page."}\n\nPage content:\n${engineRes.data}`,
            response_json_schema: step.options?.schema,
          });
          const result = await base44.asServiceRole.entities.Result.create({
            job_id: jobId, session_id: sessionEntity.id, step_id: step.id, step_order: step.order,
            action_type: "ai_extract", data_type: "ai_extract", data: llmRes, extracted_at: new Date().toISOString(),
          });
          stepResults.push(result);
        } else if (step.action_type === "solve_captcha") {
          const captchaKey = secrets.get("CAPTCHA_SOLVER_API_KEY") || "";
          const engineRes = await stagingEngineFetch(`/sessions/${sessionId}/execute`, {
            method: "POST", body: JSON.stringify({ action_type: "solve_captcha", options: { ...step.options, apiKey: captchaKey } }),
          });
          const result = await base44.asServiceRole.entities.Result.create({
            job_id: jobId, session_id: sessionEntity.id, step_id: step.id, step_order: step.order,
            action_type: "solve_captcha", data_type: "text", data: { value: engineRes.data }, extracted_at: new Date().toISOString(),
          });
          stepResults.push(result);
        } else {
          const engineRes = await stagingEngineFetch(`/sessions/${sessionId}/execute`, {
            method: "POST", body: JSON.stringify({
              action_type: step.action_type, selector: step.selector, value: step.value, options: step.options || {},
            }),
          });
          if (["extract_text", "extract_html", "extract_attribute", "extract_table", "extract_json"].includes(step.action_type) && engineRes.data !== undefined) {
            const dataType = step.action_type.replace("extract_", "");
            const result = await base44.asServiceRole.entities.Result.create({
              job_id: jobId, session_id: sessionEntity.id, step_id: step.id, step_order: step.order,
              action_type: step.action_type, data_type: dataType, data: { value: engineRes.data }, extracted_at: new Date().toISOString(),
            });
            stepResults.push(result);
          }
        }

        await base44.asServiceRole.entities.LogEntry.create({
          session_id: sessionEntity.id, job_id: jobId, step_id: step.id, level: "info", category: "action",
          message: `Staging step ${i + 1}/${steps.length}: ${step.action_type} — ${step.name || ""}`, timestamp: new Date().toISOString(),
        });
        await base44.asServiceRole.entities.Session.update(sessionEntity.id, {
          current_url: step.action_type === "goto" ? step.value : undefined, status: "running",
        });
      } catch (err) {
        failed = true;
        errorMsg = `Staging step ${i + 1} (${step.action_type}) failed: ${err.message}`;
        await base44.asServiceRole.entities.LogEntry.create({
          session_id: sessionEntity.id, job_id: jobId, step_id: step.id, level: "error", category: "error",
          message: errorMsg, details: { error: err.message }, timestamp: new Date().toISOString(),
        });
        break;
      }
    }

    try {
      const closeRes = await stagingEngineFetch(`/sessions/${sessionId}`, { method: "DELETE" });
      if (closeRes.videoBase64) {
        try {
          const file = new File([Uint8Array.from(atob(closeRes.videoBase64), (c) => c.charCodeAt(0))], `stg_video_${sessionId}.webm`, { type: "video/webm" });
          const uploadRes = await base44.integrations.Core.UploadFile({ file });
          await base44.asServiceRole.entities.Session.update(sessionEntity.id, { video_url: uploadRes.file_url });
        } catch (e) {}
      }
    } catch (e) {}

    await base44.asServiceRole.entities.Session.update(sessionEntity.id, {
      status: failed ? "errored" : "ended", ended_at: new Date().toISOString(), error_message: failed ? errorMsg : undefined,
    });
    await base44.asServiceRole.entities.Job.update(jobId, {
      status: failed ? "failed" : "completed", completed_at: new Date().toISOString(),
      error_message: failed ? errorMsg : undefined,
      results_summary: { count: stepResults.length, types: stepResults.map((r) => r.data_type), environment: "staging" },
    });

    try { await calculateJobCost(base44, jobId); } catch (e) {}
    try {
      await base44.functions.invoke("triggerWebhook", {
        event: failed ? "job.failed" : "job.completed",
        payload: { jobId, jobName: job.name, status: failed ? "failed" : "completed", error: failed ? errorMsg : null, environment: "staging" },
      });
    } catch (e) {}
    await logAudit(base44, user || { id: "system", full_name: "System" }, "run", "job", jobId, `Staging job "${job.name}" ${failed ? "failed" : "completed"}`);

    return Response.json({ ok: !failed, jobId, environment: "staging", error: failed ? errorMsg : undefined, results: stepResults.length, __v: DEPLOYMENT_VERSION });
  } catch (error) {
    return Response.json({ error: error.message, __v: DEPLOYMENT_VERSION }, { status: 500 });
  }
}