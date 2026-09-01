import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { engineFetch, isEngineConfigured, setEngineClient } from "../../shared/engineClient.ts";
import { calculateJobCost } from "../../shared/costCalculator.ts";
import { logAudit } from "../../shared/auditLogger.ts";
import { secrets } from "base44:runtime";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";
// TASK 3: Anti-bot bypass wiring
import { getBypassStrategy } from "../../shared/antiBotBypass.ts";
// TASK 3: TLS fingerprint matching
import { matchFingerprintToUA } from "../../shared/tlsFingerprint.ts";
// v6.0.0 — anti-bot, proxy rotation, shadow mode, auto-scaler wired

// H2 fix: Retry with exponential backoff for transient engine failures
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000;

function isTransientError(err) {
  const msg = (err?.message || "").toLowerCase();
  return msg.includes("timeout") || msg.includes("econnreset") || msg.includes("socket hang up") ||
    msg.includes("502") || msg.includes("503") || msg.includes("504") || msg.includes("network");
}

async function withRetry(fn, stepName) {
  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES && isTransientError(err)) {
        const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt) + Math.random() * 500;
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

// Compute SHA-256 content hash for artifact integrity
async function computeContentHash(base64Data) {
  const bytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Create an Artifact record with full metadata
async function createArtifact(base44, type, storageKey, storageBackend, sessionEntity, jobId, step, base64Data, mimeType) {
  const contentHash = await computeContentHash(base64Data);
  const sizeBytes = Math.floor(base64Data.length * 0.75);
  const retentionDays = 30;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000).toISOString();
  return base44.asServiceRole.entities.Artifact.create({
    artifact_id: "art_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
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

// ═══════════════════════════════════════════════════
// TASK 4: Proxy Rotation — select a proxy from entity
// ═══════════════════════════════════════════════════
async function selectProxy(base44, sessionConfig) {
  // Direct proxy ID — fetch specific proxy
  if (sessionConfig.proxyId) {
    const proxies = await base44.asServiceRole.entities.Proxy.filter({ id: sessionConfig.proxyId, active: true });
    if (proxies.length > 0) {
      const p = proxies[0];
      return {
        server: p.server,
        username: p.username || undefined,
        password: p.has_password ? secrets.get(`PROXY_PASS_${p.id}`) || undefined : undefined,
        protocol: p.protocol || "http",
        _proxyId: p.id,
      };
    }
    return null;
  }

  // Rotation group — round-robin select from group
  if (sessionConfig.proxyRotationGroup) {
    const proxies = await base44.asServiceRole.entities.Proxy.filter({
      rotation_group: sessionConfig.proxyRotationGroup,
      active: true,
    });
    if (proxies.length === 0) return null;

    // Simple round-robin: pick based on current time modulo count
    const idx = Math.floor(Date.now() / 1000) % proxies.length;
    const p = proxies[idx];
    return {
      server: p.server,
      username: p.username || undefined,
      password: p.has_password ? secrets.get(`PROXY_PASS_${p.id}`) || undefined : undefined,
      protocol: p.protocol || "http",
      _proxyId: p.id,
    };
  }

  return null;
}

// ═══════════════════════════════════════════════════
// TASK 6: Shadow Mode — scan for bot defenses (read-only)
// ═══════════════════════════════════════════════════
async function runShadowScan(base44, sessionId, sessionEntity, jobId) {
  try {
    const engineRes = await engineFetch(`/sessions/${sessionId}/execute`, {
      method: "POST",
      body: JSON.stringify({
        action_type: "evaluate",
        value: `(() => {
          const results = {
            recaptcha: false,
            hcaptcha: false,
            cloudflare: false,
            datadome: false,
            perimeterx: false,
            akamai: false,
            kasada: false,
            arkose: false,
            rate_limit_headers: false,
            honeypots: false,
            scripts_detected: [],
            iframes_detected: [],
          };

          // Check for reCAPTCHA
          if (document.querySelector('iframe[src*="recaptcha"]')) results.recaptcha = true;
          if (document.querySelector('.g-recaptcha')) results.recaptcha = true;

          // Check for hCaptcha
          if (document.querySelector('iframe[src*="hcaptcha"]')) results.hcaptcha = true;
          if (document.querySelector('.h-captcha')) results.hcaptcha = true;

          // Check for Cloudflare challenge
          if (document.querySelector('#cf-challenge-running, .cf-turnstile, #challenge-form')) results.cloudflare = true;
          if (document.title.toLowerCase().includes('just a moment')) results.cloudflare = true;

          // Check for DataDome
          if (document.querySelector('iframe[src*="datadome"]')) results.datadome = true;
          if (document.cookie.includes('datadome')) results.datadome = true;

          // Check for PerimeterX
          if (document.querySelector('script[src*="px-cdn"]')) results.perimeterx = true;
          if (document.cookie.includes('_px')) results.perimeterx = true;

          // Check for Akamai
          if (document.querySelector('script[src*="_abck"]')) results.akamai = true;
          if (document.cookie.includes('_abck')) results.akamai = true;

          // Check for Kasada
          if (document.querySelector('script[src*="kasada"]')) results.kasada = true;

          // Check for Arkose
          if (document.querySelector('iframe[src*="arkose"]')) results.arkose = true;
          if (document.querySelector('#arkoseFrame')) results.arkose = true;

          // Detect bot detection scripts
          const allScripts = [...document.querySelectorAll('script[src]')];
          for (const s of allScripts) {
            const src = s.src.toLowerCase();
            if (src.includes('recaptcha')) results.scripts_detected.push('recaptcha');
            if (src.includes('hcaptcha')) results.scripts_detected.push('hcaptcha');
            if (src.includes('datadome')) results.scripts_detected.push('datadome');
            if (src.includes('px-cdn') || src.includes('perimeterx')) results.scripts_detected.push('perimeterx');
            if (src.includes('kasada')) results.scripts_detected.push('kasada');
            if (src.includes('arkose')) results.scripts_detected.push('arkose');
            if (src.includes('geetest')) results.scripts_detected.push('geetest');
          }

          // Detect iframes
          const allIframes = [...document.querySelectorAll('iframe')];
          for (const f of allIframes) {
            const src = (f.src || '').toLowerCase();
            if (src.includes('recaptcha')) results.iframes_detected.push('recaptcha');
            if (src.includes('hcaptcha')) results.iframes_detected.push('hcaptcha');
            if (src.includes('cloudflare')) results.iframes_detected.push('cloudflare');
            if (src.includes('arkose')) results.iframes_detected.push('arkose');
          }

          // Check for honeypot fields (hidden inputs)
          const hiddenInputs = [...document.querySelectorAll('input[type="hidden"]')];
          for (const input of hiddenInputs) {
            const name = (input.name || '').toLowerCase();
            if (name.includes('honeypot') || name.includes('trap') || name.includes('company_url')) {
              results.honeypots = true;
            }
          }

          // Check response headers (if available via performance API)
          const entries = performance.getEntriesByType('navigation');
          if (entries.length > 0) {
            const nav = entries[0];
            // Check for 429 transfer size (blocked)
            if (nav.transferSize === 0 && nav decodedBodySize === 0) {
              results.rate_limit_headers = true;
            }
          }

          return JSON.stringify(results);
        })()`,
      }),
    });

    const shadowReport = typeof engineRes.data === "string" ? JSON.parse(engineRes.data) : engineRes.data;

    // Store shadow report on Job entity
    await base44.asServiceRole.entities.Job.update(jobId, {
      shadow_report: shadowReport,
    });

    // Log findings
    const detectedSystems = Object.entries(shadowReport)
      .filter(([k, v]) => v === true && k !== 'scripts_detected' && k !== 'iframes_detected')
      .map(([k]) => k);

    await base44.asServiceRole.entities.LogEntry.create({
      session_id: sessionEntity.id,
      job_id: jobId,
      level: "info",
      category: "shadow_scan",
      message: `Shadow scan complete: ${detectedSystems.length} defense(s) detected${detectedSystems.length > 0 ? ` — ${detectedSystems.join(', ')}` : ''}`,
      details: shadowReport,
      timestamp: new Date().toISOString(),
    });

    return shadowReport;
  } catch (e) {
    console.error("Shadow scan failed:", e.message);
    return { error: e.message };
  }
}

// ═══════════════════════════════════════════════════
// TASK 5: LLM Vision CAPTCHA solver fallback
// ═══════════════════════════════════════════════════
async function solveCaptchaWithVision(base44, sessionId, sessionEntity, jobId, step) {
  try {
    // Take a screenshot of the current page
    const screenshotRes = await engineFetch(`/sessions/${sessionId}/execute`, {
      method: "POST",
      body: JSON.stringify({ action_type: "screenshot", options: { fullPage: false } }),
    });

    if (!screenshotRes.base64) {
      return { solved: false, error: "No screenshot captured for vision solver" };
    }

    // Upload screenshot
    const file = new File(
      [Uint8Array.from(atob(screenshotRes.base64), (c) => c.charCodeAt(0))],
      `captcha_${Date.now()}.png`,
      { type: "image/png" }
    );
    const uploadRes = await base44.integrations.Core.UploadFile({ file });

    // Call LLM with vision to solve the captcha
    const llmRes = await base44.integrations.Core.InvokeLLM({
      model: "claude_sonnet_4_6",
      file_urls: [uploadRes.file_url],
      prompt: "Analyze this CAPTCHA challenge image. Identify the challenge type and provide the solution. For image grid challenges, return the labels/coordinates of correct selections. For slider challenges, return the drag distance. Return JSON with {solution, confidence, type}.",
      response_json_schema: {
        type: "object",
        properties: {
          solution: { type: "string" },
          confidence: { type: "number" },
          type: { type: "string" },
        },
      },
    });

    // Log the solve attempt
    await base44.asServiceRole.entities.CaptchaSolveLog.create({
      session_id: sessionId,
      url: sessionEntity.target_url || "",
      captcha_type: llmRes?.type || step.options?.type || "unknown",
      provider: "llm_vision",
      solved: llmRes?.confidence > 0.5,
      solve_time_ms: 0,
      cost_cents: 0,
      error_message: llmRes?.confidence <= 0.5 ? "Low confidence from vision solver" : null,
      created_at: new Date().toISOString(),
    });

    return { solved: llmRes?.confidence > 0.5, solution: llmRes?.solution, confidence: llmRes?.confidence, type: llmRes?.type };
  } catch (e) {
    // Log the failure
    await base44.asServiceRole.entities.CaptchaSolveLog.create({
      session_id: sessionId,
      url: sessionEntity.target_url || "",
      captcha_type: step.options?.type || "unknown",
      provider: "llm_vision",
      solved: false,
      solve_time_ms: 0,
      cost_cents: 0,
      error_message: e.message,
      created_at: new Date().toISOString(),
    });
    return { solved: false, error: e.message };
  }
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    setEngineClient(base44);
    const user = await base44.auth.me().catch(() => null);

    const body = await req.json();
    const { jobId } = body;

    if (!await isEngineConfigured()) {
      return Response.json({ error: "Browser engine not configured. Set ENGINE_URL and ENGINE_API_KEY in Settings → Secrets." }, { status: 503 });
    }

    // Load job and steps
    const job = await base44.asServiceRole.entities.Job.get(jobId);
    if (!job) return Response.json({ error: "Job not found", __v: DEPLOYMENT_VERSION }, { status: 404 });

    const steps = await base44.asServiceRole.entities.Step.filter({ job_id: jobId });
    steps.sort((a, b) => a.order - b.order);

    // ═══════════════════════════════════════════════════
    // TASK 7: Auto-scaler observability — check engine load before session
    // ═══════════════════════════════════════════════════
    try {
      const healthRes = await engineFetch("/health", { method: "GET" });
      const activeSessions = healthRes.active_sessions || 0;
      const maxSessions = healthRes.max_sessions || 10;
      const loadRatio = activeSessions / maxSessions;

      if (loadRatio >= 0.8) {
        // Near capacity — log warning + create notification
        await logAudit(base44, user || { id: "system", full_name: "System" }, "warn", "engine", null,
          `Engine near capacity: ${activeSessions}/${maxSessions} sessions active (${Math.round(loadRatio * 100)}%)`);

        await base44.asServiceRole.entities.Notification.create({
          type: "warning",
          category: "scaling",
          title: "Engine Near Capacity",
          message: `Engine is at ${Math.round(loadRatio * 100)}% capacity (${activeSessions}/${maxSessions} sessions). Consider scaling up Railway replicas.`,
          read: false,
          created_at: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error("Auto-scaler check failed:", e.message);
    }

    // Mark job running
    await base44.asServiceRole.entities.Job.update(jobId, {
      status: "running",
      started_at: new Date().toISOString(),
      steps_count: steps.length,
    });

    // ═══════════════════════════════════════════════════
    // TASK 3: Wire anti-bot bypass into session creation
    // ═══════════════════════════════════════════════════
    const sessionConfig = job.session_config || {};
    const antiBotSystem = sessionConfig.antiBotSystem || sessionConfig.anti_bot_system;

    let bypassConfig = null;
    let tlsFingerprint = null;

    if (antiBotSystem) {
      const strategy = getBypassStrategy(antiBotSystem);
      if (strategy) {
        bypassConfig = strategy.recommendedConfig;
        // Generate TLS fingerprint matching the user agent
        const ua = sessionConfig.userAgent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
        tlsFingerprint = matchFingerprintToUA(ua);
      }
    }

    // ═══════════════════════════════════════════════════
    // TASK 4: Wire proxy rotation
    // ═══════════════════════════════════════════════════
    let selectedProxy = null;
    let proxyIdForSession = null;
    try {
      selectedProxy = await selectProxy(base44, sessionConfig);
      if (selectedProxy?._proxyId) proxyIdForSession = selectedProxy._proxyId;
    } catch (e) {
      console.error("Proxy selection failed:", e.message);
    }

    // Create session on engine with all wired config
    let sessionEntity;
    let sessionId;
    try {
      const sessionBody = {
        viewport: sessionConfig.viewport,
        userAgent: sessionConfig.userAgent,
        locale: sessionConfig.locale,
        timezone: sessionConfig.timezone,
        geolocation: sessionConfig.geolocation,
        proxy: selectedProxy ? {
          server: selectedProxy.server,
          username: selectedProxy.username,
          password: selectedProxy.password,
          protocol: selectedProxy.protocol,
        } : sessionConfig.proxy,
        headers: {
          ...(sessionConfig.headers || {}),
          ...(bypassConfig?.additionalHeaders || {}),
        },
        blockedResources: sessionConfig.blockedResources,
        recordVideo: sessionConfig.recordVideo,
        enableCDP: sessionConfig.enableCDP,
        extensions: sessionConfig.extensions,
        userDataDir: sessionConfig.userDataDir,
        networkMocks: sessionConfig.networkMocks,
        usePool: sessionConfig.usePool,
        // TASK 3: Anti-bot fields
        fingerprintLevel: bypassConfig?.fingerprintLevel || sessionConfig.fingerprintLevel,
        behaviorLevel: bypassConfig?.behaviorLevel || sessionConfig.behaviorLevel,
        antiBotSystem: antiBotSystem || sessionConfig.antiBotSystem,
        tlsFingerprint: tlsFingerprint || sessionConfig.tlsFingerprint,
        // TASK 3: Captcha provider from bypass strategy
        captchaProvider: bypassConfig?.captchaProvider || sessionConfig.captchaProvider,
        captchaSolver: sessionConfig.captchaSolver || (bypassConfig?.captchaProvider && bypassConfig.captchaProvider !== "none" ? {
          provider: bypassConfig.captchaProvider,
        } : undefined),
      };

      const engineRes = await withRetry(() => engineFetch("/sessions", {
        method: "POST",
        body: JSON.stringify(sessionBody),
      }), "session_create");
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
        proxy_id: proxyIdForSession || sessionConfig.proxyId,
        headers: sessionBody.headers,
        blocked_resources: sessionConfig.blockedResources,
        started_at: new Date().toISOString(),
        timeout_ms: sessionConfig.timeoutMs || 30000,
        record_video: !!sessionConfig.recordVideo,
        enable_cdp: !!sessionConfig.enableCDP,
        cdp_url: engineRes.cdpUrl,
        profile_id: sessionConfig.profileId,
        extension_ids: sessionConfig.extensionIds,
        // Store fingerprint + TLS fingerprint on session
        fingerprint: sessionConfig.fingerprint || null,
        tls_fingerprint: tlsFingerprint || sessionConfig.tlsFingerprint || null,
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

    // ═══════════════════════════════════════════════════
    // TASK 6: Shadow mode — read-only defense scan after first goto
    // ═══════════════════════════════════════════════════
    let shadowScanDone = false;

    // Execute each step
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      // TASK 6: In shadow mode, skip mutation steps
      if (job.shadow_mode && ["click", "fill", "type", "select", "press", "submit", "scroll"].includes(step.action_type)) {
        await base44.asServiceRole.entities.LogEntry.create({
          session_id: sessionEntity.id, job_id: jobId, step_id: step.id,
          level: "info", category: "shadow_skip",
          message: `Shadow mode: skipped mutation step ${step.action_type}`,
          timestamp: new Date().toISOString(),
        });
        continue;
      }

      try {
        // Handle screenshot/PDF specially (upload + store)
        if (step.action_type === "screenshot") {
          const engineRes = await engineFetch(`/sessions/${sessionId}/execute`, {
            method: "POST",
            body: JSON.stringify({ action_type: "screenshot", options: { fullPage: step.options?.fullPage } }),
          });
          if (engineRes.base64) {
            const file = new File([Uint8Array.from(atob(engineRes.base64), (c) => c.charCodeAt(0))], `screenshot_${step.order}.png`, { type: "image/png" });
            const uploadRes = await base44.integrations.Core.UploadFile({ file });
            await base44.asServiceRole.entities.Screenshot.create({
              session_id: sessionEntity.id,
              job_id: jobId,
              step_id: step.id,
              file_url: uploadRes.file_url,
              caption: step.name || "",
              full_page: !!step.options?.fullPage,
              taken_at: new Date().toISOString(),
            });
            await createArtifact(base44, "screenshot", uploadRes.file_url, "base44_files", sessionEntity, jobId, step, engineRes.base64, "image/png");
          }
        } else if (step.action_type === "pdf") {
          const engineRes = await engineFetch(`/sessions/${sessionId}/execute`, {
            method: "POST",
            body: JSON.stringify({ action_type: "pdf" }),
          });
          if (engineRes.base64) {
            const file = new File([Uint8Array.from(atob(engineRes.base64), (c) => c.charCodeAt(0))], `document_${step.order}.pdf`, { type: "application/pdf" });
            const uploadRes = await base44.integrations.Core.UploadFile({ file });
            await base44.asServiceRole.entities.Result.create({
              job_id: jobId, session_id: sessionEntity.id, step_id: step.id,
              step_order: step.order, action_type: "pdf", data_type: "pdf_url",
              data: { file_url: uploadRes.file_url }, extracted_at: new Date().toISOString(),
            });
            await createArtifact(base44, "pdf", uploadRes.file_url, "base44_files", sessionEntity, jobId, step, engineRes.base64, "application/pdf");
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
          // TASK 5: Try self-solver first, then LLM vision fallback
          const captchaKey = secrets.get("CAPTCHA_SOLVER_API_KEY") || "";
          const engineRes = await engineFetch(`/sessions/${sessionId}/execute`, {
            method: "POST",
            body: JSON.stringify({ action_type: "solve_captcha", options: { ...step.options, apiKey: captchaKey } }),
          });

          // If self-solver failed, try LLM vision fallback
          if (!engineRes?.data?.solved && !engineRes?.ok) {
            const visionResult = await solveCaptchaWithVision(base44, sessionId, sessionEntity, jobId, step);
            if (visionResult.solved) {
              engineRes.data = { solved: true, ...visionResult };
            }
          }

          const result = await base44.asServiceRole.entities.Result.create({
            job_id: jobId, session_id: sessionEntity.id, step_id: step.id,
            step_order: step.order, action_type: "solve_captcha", data_type: "text",
            data: { value: engineRes.data }, extracted_at: new Date().toISOString(),
          });
          stepResults.push(result);
        } else {
          const engineRes = await withRetry(() => engineFetch(`/sessions/${sessionId}/execute`, {
            method: "POST",
            body: JSON.stringify({
              action_type: step.action_type,
              selector: step.selector,
              value: step.value,
              options: step.options || {},
            }),
          }), `step_${step.action_type}_${step.order}`);

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

        // TASK 6: Run shadow scan after first goto
        if (job.shadow_mode && !shadowScanDone && step.action_type === "goto") {
          await runShadowScan(base44, sessionId, sessionEntity, jobId);
          shadowScanDone = true;
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
          const file = new File([Uint8Array.from(atob(closeRes.videoBase64), (c) => c.charCodeAt(0))], `video_${sessionId}.webm`, { type: "video/webm" });
          const uploadRes = await base44.integrations.Core.UploadFile({ file });
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
