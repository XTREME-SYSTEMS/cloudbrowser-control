import { engineFetch, isEngineConfigured, setEngineClient } from "./engineClient.ts";
import { calculateJobCost } from "./costCalculator.ts";
import { logAudit } from "./auditLogger.ts";
import { dispatchWebhooks } from "./webhookDispatcher.ts";
import { hasScope, missingActionCapabilities, missingSessionCapabilities } from "./capabilities.ts";
import { secrets } from "base44:runtime";
import { DEPLOYMENT_VERSION } from "./deploymentVersion.ts";

export class JobRunnerError extends Error {
  constructor(status, message, details = {}) {
    super(message);
    this.name = "JobRunnerError";
    this.status = status;
    this.details = details;
  }
}

async function sha256(value) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value)));
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

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
  const expiresAt = new Date(now.getTime() + retentionDays * 86400000).toISOString();
  return base44.asServiceRole.entities.Artifact.create({
    artifact_id: "art_" + crypto.randomUUID(),
    type,
    project_id: sessionEntity.project_id || null,
    session_id: sessionEntity.id,
    job_id: jobId,
    step_id: step?.id || null,
    storage_key: storageKey,
    storage_backend: storageBackend,
    mime_type: mimeType,
    size_bytes: sizeBytes,
    content_hash: contentHash,
    created_at: now.toISOString(),
    expires_at: expiresAt,
    retention_days: retentionDays,
    access_policy: "private",
    metadata: { action_type: step?.action_type },
  });
}

function previousIdempotency(job) {
  return job?.results_summary?.idempotency || null;
}

function duplicateResult(job, fingerprint) {
  const prior = previousIdempotency(job);
  if (!prior || prior.key_hash !== fingerprint) return null;
  return {
    ok: job.status === "completed",
    duplicate: true,
    idempotency_state: prior.state || job.status,
    jobId: job.id,
    error: job.status === "failed" ? job.error_message || "Previous execution failed" : undefined,
    results: job.results_summary?.count || 0,
    __v: DEPLOYMENT_VERSION,
  };
}

async function claimExecution(base44, job, idempotencyKey) {
  const fingerprint = await sha256(idempotencyKey || `job:${job.id}`);
  const duplicate = duplicateResult(job, fingerprint);
  if (duplicate) return { duplicate, fingerprint };

  const priorSummary = job.results_summary && typeof job.results_summary === "object" ? job.results_summary : {};
  const claimSummary = {
    ...priorSummary,
    idempotency: { key_hash: fingerprint, state: "running", claimed_at: new Date().toISOString() },
  };
  const claim = await base44.asServiceRole.entities.Job.updateMany(
    { id: job.id, status: { $in: ["queued", "retrying", "failed", "completed"] } },
    { $set: { status: "running", started_at: new Date().toISOString(), error_message: null, results_summary: claimSummary } },
  );
  const updated = claim?.updated ?? claim?.modified_count ?? 0;
  if (updated > 0) return { fingerprint, duplicate: null };

  const current = await base44.asServiceRole.entities.Job.get(job.id);
  const currentDuplicate = duplicateResult(current, fingerprint);
  if (currentDuplicate) return { duplicate: currentDuplicate, fingerprint };
  throw new JobRunnerError(409, "Job execution already claimed by another request", { job_id: job.id, current_status: current?.status });
}

async function finishExecution(base44, jobId, fingerprint, state, patch = {}) {
  const current = await base44.asServiceRole.entities.Job.get(jobId).catch(() => null);
  const summary = current?.results_summary && typeof current.results_summary === "object" ? current.results_summary : {};
  await base44.asServiceRole.entities.Job.update(jobId, {
    ...patch,
    results_summary: {
      ...summary,
      ...(patch.results_summary || {}),
      idempotency: { key_hash: fingerprint, state, completed_at: new Date().toISOString() },
    },
  });
}

async function effectiveScopes(base44, job, options) {
  if (options.trustedCapabilities === true) return ["*"];
  if (Array.isArray(options.allowedScopes)) return [...new Set(options.allowedScopes)];

  const authKeyId = job?.session_config?.authorization_key_id;
  const authProof = job?.session_config?.authorization_proof;
  if (!authKeyId || !authProof) return [];

  const keyRecord = await base44.asServiceRole.entities.ApiKey.get(authKeyId).catch(() => null);
  if (!keyRecord || !keyRecord.active || keyRecord.project_id !== job.project_id) return [];
  if (keyRecord.expires_at && new Date(keyRecord.expires_at) <= new Date()) return [];
  const expected = await sha256(`${keyRecord.key_hash}:${job.id}`);
  if (expected !== authProof) return [];
  return Array.isArray(keyRecord.scopes) ? [...new Set(keyRecord.scopes)] : [];
}

function assertCapabilityCeiling(job, steps, scopes) {
  const actionMissing = missingActionCapabilities(steps, scopes);
  const sessionMissing = missingSessionCapabilities(job.session_config || {}, scopes);
  if (actionMissing.length || sessionMissing.length) {
    throw new JobRunnerError(403, "Job requires capabilities not authorized at creation/execution", {
      missing_actions: actionMissing,
      missing_session_options: sessionMissing,
    });
  }
}

export async function executeJob(base44, options = {}) {
  const {
    jobId,
    authorizedProjectId,
    actor = { id: "system", full_name: "System", role: "system" },
    idempotencyKey,
    allowPlatformJob = false,
  } = options;
  if (!jobId) throw new JobRunnerError(400, "jobId required");

  setEngineClient(base44);
  if (!await isEngineConfigured()) throw new JobRunnerError(503, "Browser engine not configured");

  const job = await base44.asServiceRole.entities.Job.get(jobId);
  if (!job) throw new JobRunnerError(404, "Job not found");
  if (!job.project_id) {
    if (!allowPlatformJob) throw new JobRunnerError(403, "Project-scoped Job required");
  } else if (!authorizedProjectId || authorizedProjectId !== job.project_id) {
    throw new JobRunnerError(403, "Forbidden: Job belongs to a different project");
  }

  const steps = await base44.asServiceRole.entities.Step.filter({ job_id: jobId });
  steps.sort((a, b) => a.order - b.order);
  const scopes = await effectiveScopes(base44, job, options);
  assertCapabilityCeiling(job, steps, scopes);

  const claim = await claimExecution(base44, job, idempotencyKey || `job:${jobId}`);
  if (claim.duplicate) return claim.duplicate;
  const fingerprint = claim.fingerprint;

  const settings = await base44.asServiceRole.entities.SystemSettings.list("-created_date", 1).catch(() => []);
  const sysSet = settings[0] || {};
  const maxSteps = sysSet.max_steps_per_job || 100;
  const maxDurationMin = sysSet.max_job_duration_min || 30;
  if (steps.length > maxSteps) {
    await finishExecution(base44, jobId, fingerprint, "failed", { status: "failed", error_message: `Step count ${steps.length} exceeds max ${maxSteps}`, completed_at: new Date().toISOString() });
    throw new JobRunnerError(400, `Step count exceeds max (${maxSteps})`);
  }
  const jobDeadline = Date.now() + maxDurationMin * 60000;
  await base44.asServiceRole.entities.Job.update(jobId, { steps_count: steps.length });

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
        networkMocks: sessionConfig.networkMocks,
        egressPolicy: sessionConfig.egress,
        usePool: sessionConfig.usePool,
      }),
    });
    sessionId = engineRes.sessionId;
    if (!sessionId) throw new Error("Engine returned no runtime session ID");

    sessionEntity = await base44.asServiceRole.entities.Session.create({
      session_id: sessionId,
      project_id: job.project_id || null,
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
      record_video: Boolean(sessionConfig.recordVideo),
      enable_cdp: Boolean(sessionConfig.enableCDP),
      cdp_url: engineRes.cdpUrl,
      profile_id: sessionConfig.profileId,
      extension_ids: sessionConfig.extensionIds,
      metadata: { job_id: jobId, project_id: job.project_id || null, authorized_scopes: scopes.filter((scope) => scope !== "*") },
    });
    await base44.asServiceRole.entities.Job.update(jobId, { session_id: sessionEntity.id });
  } catch (error) {
    await finishExecution(base44, jobId, fingerprint, "failed", { status: "failed", error_message: `Session creation failed: ${error.message}`, completed_at: new Date().toISOString() });
    throw new JobRunnerError(500, `Session creation failed: ${error.message}`);
  }

  const stepResults = [];
  let failed = false;
  let errorMsg = "";

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (Date.now() > jobDeadline) {
      failed = true;
      errorMsg = `Job exceeded max duration (${maxDurationMin} min)`;
      break;
    }
    try {
      let engineRes;
      if (step.action_type === "screenshot") {
        engineRes = await engineFetch(`/sessions/${sessionId}/execute`, { method: "POST", body: JSON.stringify({ action_type: "screenshot", options: { fullPage: step.options?.fullPage } }) });
        if (engineRes.base64) {
          const file = new File([Uint8Array.from(atob(engineRes.base64), (c) => c.charCodeAt(0))], `screenshot_${step.order}.png`, { type: "image/png" });
          const uploadRes = await base44.integrations.Core.UploadFile({ file });
          await base44.asServiceRole.entities.Screenshot.create({ session_id: sessionEntity.id, job_id: jobId, step_id: step.id, file_url: uploadRes.file_url, caption: step.name || "", full_page: Boolean(step.options?.fullPage), taken_at: new Date().toISOString() });
          await createArtifact(base44, "screenshot", uploadRes.file_url, "base44_files", sessionEntity, jobId, step, engineRes.base64, "image/png");
        }
      } else if (step.action_type === "pdf") {
        engineRes = await engineFetch(`/sessions/${sessionId}/execute`, { method: "POST", body: JSON.stringify({ action_type: "pdf" }) });
        if (engineRes.base64) {
          const file = new File([Uint8Array.from(atob(engineRes.base64), (c) => c.charCodeAt(0))], `document_${step.order}.pdf`, { type: "application/pdf" });
          const uploadRes = await base44.integrations.Core.UploadFile({ file });
          await base44.asServiceRole.entities.Result.create({ job_id: jobId, session_id: sessionEntity.id, step_id: step.id, step_order: step.order, action_type: "pdf", data_type: "pdf_url", data: { file_url: uploadRes.file_url }, extracted_at: new Date().toISOString() });
          await createArtifact(base44, "pdf", uploadRes.file_url, "base44_files", sessionEntity, jobId, step, engineRes.base64, "application/pdf");
        }
      } else if (step.action_type === "ai_extract") {
        engineRes = await engineFetch(`/sessions/${sessionId}/execute`, { method: "POST", body: JSON.stringify({ action_type: "ai_extract" }) });
        const llmRes = await base44.integrations.Core.InvokeLLM({ prompt: `${step.options?.prompt || "Extract data from this page."}\n\nPage content:\n${engineRes.data}`, response_json_schema: step.options?.schema });
        stepResults.push(await base44.asServiceRole.entities.Result.create({ job_id: jobId, session_id: sessionEntity.id, step_id: step.id, step_order: step.order, action_type: "ai_extract", data_type: "ai_extract", data: llmRes, extracted_at: new Date().toISOString() }));
      } else if (step.action_type === "solve_captcha") {
        if (!hasScope(scopes, "sessions:captcha")) throw new Error("sessions:captcha capability required");
        const captchaKey = secrets.get("CAPTCHA_SOLVER_API_KEY") || "";
        engineRes = await engineFetch(`/sessions/${sessionId}/execute`, { method: "POST", body: JSON.stringify({ action_type: "solve_captcha", options: { ...step.options, apiKey: captchaKey } }) });
        stepResults.push(await base44.asServiceRole.entities.Result.create({ job_id: jobId, session_id: sessionEntity.id, step_id: step.id, step_order: step.order, action_type: "solve_captcha", data_type: "text", data: { value: engineRes.data }, extracted_at: new Date().toISOString() }));
      } else {
        engineRes = await engineFetch(`/sessions/${sessionId}/execute`, { method: "POST", body: JSON.stringify({ action_type: step.action_type, selector: step.selector, value: step.value, options: step.options || {} }) });
        if (["extract_text", "extract_html", "extract_attribute", "extract_table", "extract_json"].includes(step.action_type) && engineRes.data !== undefined) {
          const dataType = step.action_type.replace("extract_", "");
          stepResults.push(await base44.asServiceRole.entities.Result.create({ job_id: jobId, session_id: sessionEntity.id, step_id: step.id, step_order: step.order, action_type: step.action_type, data_type: dataType, data: { value: engineRes.data }, extracted_at: new Date().toISOString() }));
        }
      }

      await base44.asServiceRole.entities.LogEntry.create({ session_id: sessionEntity.id, job_id: jobId, step_id: step.id, level: "info", category: "action", message: `Step ${i + 1}/${steps.length}: ${step.action_type} — ${step.name || ""}`, timestamp: new Date().toISOString() });
      await base44.asServiceRole.entities.Session.update(sessionEntity.id, { current_url: step.action_type === "goto" ? step.value : undefined, status: "running" });
    } catch (error) {
      failed = true;
      errorMsg = `Step ${i + 1} (${step.action_type}) failed: ${error.message}`;
      await base44.asServiceRole.entities.LogEntry.create({ session_id: sessionEntity.id, job_id: jobId, step_id: step.id, level: "error", category: "error", message: errorMsg, details: { error: error.message }, timestamp: new Date().toISOString() });
      break;
    }
  }

  try {
    const closeRes = await engineFetch(`/sessions/${sessionId}`, { method: "DELETE" });
    if (closeRes.videoBase64) {
      try {
        const file = new File([Uint8Array.from(atob(closeRes.videoBase64), (c) => c.charCodeAt(0))], `video_${sessionId}.webm`, { type: "video/webm" });
        const uploadRes = await base44.integrations.Core.UploadFile({ file });
        await base44.asServiceRole.entities.Session.update(sessionEntity.id, { video_url: uploadRes.file_url });
      } catch (error) { console.error("Video upload failed:", error.message); }
    }
  } catch {}

  await base44.asServiceRole.entities.Session.update(sessionEntity.id, { status: failed ? "errored" : "ended", ended_at: new Date().toISOString(), error_message: failed ? errorMsg : undefined });
  await finishExecution(base44, jobId, fingerprint, failed ? "failed" : "completed", { status: failed ? "failed" : "completed", completed_at: new Date().toISOString(), error_message: failed ? errorMsg : undefined, results_summary: { count: stepResults.length, types: stepResults.map((r) => r.data_type) } });

  try { await calculateJobCost(base44, jobId); } catch (error) { console.error("Cost calculation failed:", error.message); }
  try {
    await dispatchWebhooks(base44, {
      event: failed ? "job.failed" : "job.completed",
      payload: { jobId, jobName: job.name, status: failed ? "failed" : "completed", error: failed ? errorMsg : null, project_id: job.project_id || null },
      projectId: job.project_id || null,
    });
  } catch (error) { console.error("Webhook trigger failed:", error.message); }

  await logAudit(base44, actor, "run", "job", jobId, `Job "${job.name}" ${failed ? "failed" : "completed"}`);
  return { ok: !failed, duplicate: false, jobId, error: failed ? errorMsg : undefined, results: stepResults.length, idempotency_state: failed ? "failed" : "completed", __v: DEPLOYMENT_VERSION };
}
