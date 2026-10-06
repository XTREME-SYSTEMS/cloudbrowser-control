import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { engineFetch, isEngineConfigured, setEngineClient } from '../../shared/engineClient.ts';
import { sanitizeUrl } from '../../shared/urlValidator.ts';
import { generateFingerprint, buildStealthSessionConfig } from '../../shared/fingerprintRandomizer.ts';
import { invokeLLM } from '../../shared/vercelAiGateway.ts';
import { uploadPrivateFile } from '../../shared/storageGateway.ts';
import { matchFingerprintToUA } from '../../shared/tlsFingerprint.ts';
import { pickBestProxy, recordProxyResult } from '../../shared/manageProxyRotation.ts';
import { solveCaptchaWithFallback } from '../../shared/captchaFallbackChain.ts';
import { generateTypingDelays, humanDelay } from '../../shared/humanBehavior.ts';
import { withRetry } from '../../shared/resilience.ts';
import { DEPLOYMENT_VERSION } from '../../shared/deploymentVersion.ts';

// Tier-6 Autonomous Browser Task — unified, hardened, agent-dispatchable.
// Actions: form_fill | scrape | captcha_solve | shadow_browse | interact
// Hardening: SSRF-safe URL, randomized fingerprint (shadow), human-like typing,
// engine captcha solve with vision-LLM fallback, private evidence capture.

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    setEngineClient(base44);
    const body = await req.json().catch(() => ({}));
    let proxyPick = null;

    // Service-role dispatch (from runAgentLoop) OR user auth
    const expectedSecret = secrets.get('WORKER_SECRET');
    const isWorker = !!(body?.worker_secret && expectedSecret && body.worker_secret === expectedSecret);
    if (!isWorker) {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized', __v: DEPLOYMENT_VERSION }, { status: 401 });
    }

    const goal = body.goal || body;
    const rawUrl = (goal.url || '').trim();
    if (!rawUrl) return Response.json({ error: 'url is required', __v: DEPLOYMENT_VERSION }, { status: 400 });

    // SSRF / protocol validation
    const urlCheck = sanitizeUrl(rawUrl);
    if (!urlCheck.valid) return Response.json({ error: `URL rejected: ${urlCheck.reason}`, __v: DEPLOYMENT_VERSION }, { status: 400 });

    if (!await isEngineConfigured()) {
      return Response.json({ error: 'Browser engine not configured. Set ENGINE_URL and ENGINE_API_KEY in Secrets.', __v: DEPLOYMENT_VERSION }, { status: 503 });
    }

    const action = goal.action || 'shadow_browse';
    const shadow = goal.shadow !== false;
    const humanLike = !!goal.human_like;
    const captureEvidence = goal.screenshot !== false;
    const timeoutMs = Math.min(goal.timeout_ms || 60000, 120000);

    // Randomized fingerprint for shadow/stealth mode — full spoofing + TLS match
    const fp = shadow ? generateFingerprint() : null;
    const tls = fp ? matchFingerprintToUA(fp.userAgent) : null;
    const sessionConfig = fp ? buildStealthSessionConfig(fp) : { blockedResources: ['image', 'media', 'font'] };
    if (tls) sessionConfig.tls = { ja3: tls.ja3_hash, ja4: tls.ja4, alpn: tls.alpn };

    // Proxy rotation — pick best by geo + health if requested
    if (goal.use_proxy || goal.geo) {
      proxyPick = await pickBestProxy(base44, { geo: goal.geo, rotationGroup: goal.rotation_group, ipType: goal.ip_type, protocol: goal.protocol });
      if (proxyPick) sessionConfig.proxy = proxyPick.config;
    }

    const session = await withRetry(() => engineFetch('/sessions', {
      method: 'POST',
      body: JSON.stringify(sessionConfig),
    }), { retries: 2 });

    const sessionId = session.sessionId;
    const evidence = [];
    const log = [];
    let captchaSolved = false;
    let captchaAttempts = 0;
    let result = {};

    const execStep = async (step) => engineFetch(`/sessions/${sessionId}/execute`, {
      method: 'POST',
      body: JSON.stringify({ action_type: step.action_type, selector: step.selector, value: step.value, options: step.options || {} }),
    });

    try {
      await withRetry(() => execStep({ action_type: 'goto', value: urlCheck.sanitized, options: { timeout: timeoutMs } }), { retries: 1 });
      log.push({ step: 'navigate', url: urlCheck.sanitized });

      if (action === 'form_fill') {
        const fields = Array.isArray(goal.fields) ? goal.fields : [];
        for (const field of fields) {
          const delays = humanLike ? generateTypingDelays(field.value || '') : null;
          await execStep({ action_type: 'type', selector: field.selector, value: field.value, options: humanLike ? { typingDelays: delays } : {} });
          if (humanLike) await new Promise((r) => setTimeout(r, humanDelay(120, 80)));
          log.push({ step: 'fill', selector: field.selector });
        }
        if (goal.submit) {
          await execStep({ action_type: 'click', selector: goal.submit });
          log.push({ step: 'submit', selector: goal.submit });
        }
        result = { form_filled: fields.length, submitted: !!goal.submit };
      } else if (action === 'scrape') {
        const selectors = Array.isArray(goal.selectors) ? goal.selectors : [];
        const extracted = {};
        for (const sel of selectors) {
          const res = await execStep({ action_type: 'extract_text', selector: sel });
          extracted[sel] = res.data || res.text || null;
        }
        if (goal.schema) {
          const aiRes = await execStep({ action_type: 'ai_extract' });
          const llmRes = await invokeLLM({
            prompt: `Extract data from this page content.\n\n${aiRes.data || ''}`,
            response_json_schema: goal.schema,
          });
          result = { extracted, ai: llmRes };
        } else {
          result = { extracted };
        }
        log.push({ step: 'scrape', selectors: selectors.length });
      } else if (action === 'captcha_solve') {
        const chainRes = await solveCaptchaWithFallback(base44, { sessionId, url: urlCheck.sanitized, captchaType: goal.captcha_type || 'recaptcha_v2', siteKey: goal.site_key || '', triggeredBy: 'auto' });
        captchaSolved = chainRes.solved;
        captchaAttempts++;
        result = { captcha_solved: chainRes.solved, provider: chainRes.provider, fallback_level: chainRes.fallbackLevel, token: chainRes.token };
        log.push({ step: 'captcha_solve', solved: chainRes.solved, provider: chainRes.provider, level: chainRes.fallbackLevel });
      } else if (action === 'interact') {
        const steps = Array.isArray(goal.steps) ? goal.steps : [];
        for (const s of steps) {
          await execStep(s);
          if (humanLike) await new Promise((r) => setTimeout(r, humanDelay(200, 120)));
        }
        result = { steps_executed: steps.length };
        log.push({ step: 'interact', count: steps.length });
      } else {
        if (goal.scroll) await execStep({ action_type: 'scroll', options: { direction: 'down', amount: goal.scroll } });
        result = { browsed: true };
        log.push({ step: 'shadow_browse' });
      }

      // Auto captcha detection + solve with fallback chain (if enabled and not the primary action)
      if (goal.solve_captcha && action !== 'captcha_solve') {
        try {
          const detect = await execStep({ action_type: 'detect_captcha' });
          if (detect.data?.detected) {
            log.push({ step: 'captcha_detected', type: detect.data.type });
            const chainRes = await solveCaptchaWithFallback(base44, { sessionId, url: urlCheck.sanitized, captchaType: detect.data.type || 'unknown', triggeredBy: 'auto' });
            captchaSolved = chainRes.solved;
            captchaAttempts++;
            log.push({ step: 'captcha_auto_solved', solved: chainRes.solved, provider: chainRes.provider, level: chainRes.fallbackLevel });
          }
        } catch (e) { /* detect_captcha not supported — skip */ }
      }

      // Capture evidence (screenshot) — stored privately
      if (captureEvidence) {
        try {
          const shot = await engineFetch(`/sessions/${sessionId}/execute`, {
            method: 'POST',
            body: JSON.stringify({ action_type: 'screenshot', options: { fullPage: !!goal.full_page } }),
          });
          if (shot.base64) {
            const file = new File([Uint8Array.from(atob(shot.base64), (c) => c.charCodeAt(0))], `evidence_${Date.now()}.png`, { type: 'image/png' });
            const upload = await uploadPrivateFile({ file });
            evidence.push(upload.file_uri);
          }
          if (shot.url) result.current_url = shot.url;
          if (shot.title) result.current_title = shot.title;
        } catch (e) { log.push({ step: 'screenshot_failed', error: e.message }); }
      }
    } finally {
      try { await engineFetch(`/sessions/${sessionId}`, { method: 'DELETE' }); } catch (e) {}
    }

    // Audit log (service role)
    try {
      await base44.asServiceRole.entities.LogEntry.create({
        session_id: sessionId,
        level: 'info',
        category: 'autonomous_browser',
        message: `Autonomous ${action} on ${urlCheck.sanitized}`,
        details: { action, log, captchaSolved, evidenceCount: evidence.length },
        timestamp: new Date().toISOString(),
      });
    } catch (e) {}

    if (proxyPick) await recordProxyResult(base44, proxyPick.proxyId, true, 0).catch(() => {});

    return Response.json({
      ok: true,
      action,
      session_id: sessionId,
      proxy_used: proxyPick ? proxyPick.meta : null,
      url: urlCheck.sanitized,
      result,
      captcha_solved: captchaSolved,
      captcha_attempts: captchaAttempts,
      evidence,
      log,
      fingerprint: fp ? { screen: fp.screen, locale: fp.language, timezone: fp.timezone, tls_ja4: tls?.ja4, stealth: fp.stealth } : null,
      __v: DEPLOYMENT_VERSION,
    });
  } catch (error) {
    if (proxyPick) await recordProxyResult(base44, proxyPick.proxyId, false, 0).catch(() => {});
    return Response.json({ error: error.message, __v: DEPLOYMENT_VERSION }, { status: 500 });
  }
}