// CAPTCHA Fallback Chain — Tier 7 limitless solving.
// Tier 1: engine self-solver (built-in, all types)
// Tier 2: LLM vision solver (image/text/funcaptcha visual challenges)
// Tier 3: third-party API (2captcha/anti-captcha/capmonster for token-based)
// Each tier logs to CaptchaSolveLog; auto-escalates on failure.
import { engineFetch } from './engineClient.ts';
import { getCaptchaCredentials } from './captchaSolver.ts';

const TOKEN_BASED = new Set(['recaptcha_v2', 'recaptcha_v3', 'hcaptcha', 'turnstile', 'cloudflare_challenge']);
const VISION_BASED = new Set(['image_captcha', 'text_captcha', 'funcaptcha']);

export interface ChainResult {
  solved: boolean;
  provider: string;
  fallbackLevel: number;
  token?: string;
  error?: string;
}

export async function solveCaptchaWithFallback(base44, opts: {
  sessionId: string;
  url: string;
  captchaType?: string;
  siteKey?: string;
  triggeredBy?: string;
}): Promise<ChainResult> {
  const { sessionId, url } = opts;
  const captchaType = opts.captchaType || 'unknown';
  const siteKey = opts.siteKey || '';
  const triggeredBy = opts.triggeredBy || 'auto';

  const logAttempt = async (provider: string, solved: boolean, token: string, error: string, durationMs: number, level: number) => {
    try {
      await base44.asServiceRole.entities.CaptchaSolveLog.create({
        session_id: sessionId, url, captcha_type: captchaType as any, provider: provider as any,
        detected: true, solved, token, error, duration_ms: durationMs, triggered_by: triggeredBy as any, fallback_level: level,
      });
    } catch (e) { /* best-effort */ }
  };

  // ── Tier 1: engine self-solver ──
  const t1Start = Date.now();
  try {
    const res = await engineFetch(`/sessions/${sessionId}/execute`, {
      method: 'POST',
      body: JSON.stringify({ action_type: 'solve_captcha', options: { type: captchaType, siteKey, provider: 'self' } }),
    });
    const token = res.data?.token || res.data?.solution || '';
    if (token) { await logAttempt('self', true, token, '', Date.now() - t1Start, 1); return { solved: true, provider: 'self', fallbackLevel: 1, token }; }
    await logAttempt('self', false, '', res.data?.error || 'no token returned', Date.now() - t1Start, 1);
  } catch (e: any) { await logAttempt('self', false, '', e.message, Date.now() - t1Start, 1); }

  // ── Tier 2: LLM vision solver (visual captchas only) ──
  if (VISION_BASED.has(captchaType) || captchaType === 'unknown') {
    const t2Start = Date.now();
    try {
      const shot = await engineFetch(`/sessions/${sessionId}/execute`, {
        method: 'POST',
        body: JSON.stringify({ action_type: 'screenshot', options: { fullPage: false } }),
      });
      if (shot.base64) {
        const file = new File([Uint8Array.from(atob(shot.base64), (c) => c.charCodeAt(0))], `captcha_${Date.now()}.png`, { type: 'image/png' });
        const upload = await base44.asServiceRole.integrations.Core.UploadPrivateFile({ file });
        const signed = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri: upload.file_uri, expires_in: 120 });
        const llmRes: any = await base44.asServiceRole.integrations.Core.InvokeLLM({
          model: 'claude_sonnet_4_6',
          file_urls: [signed.signed_url],
          prompt: 'Analyze this CAPTCHA challenge image. Identify the challenge type and provide the solution. For image grid challenges, return the labels/coordinates of correct selections. For slider challenges, return the drag distance in pixels. For text challenges, return the text. Return JSON with {solution, confidence, type}.',
          response_json_schema: { type: 'object', properties: { solution: { type: 'string' }, confidence: { type: 'number' }, type: { type: 'string' } } },
        });
        const solution = llmRes?.solution || '';
        const confidence = llmRes?.confidence || 0;
        if (solution && confidence > 0.5) {
          await logAttempt('llm_vision', true, solution, '', Date.now() - t2Start, 2);
          return { solved: true, provider: 'llm_vision', fallbackLevel: 2, token: solution };
        }
        await logAttempt('llm_vision', false, '', 'low confidence or no solution', Date.now() - t2Start, 2);
      } else {
        await logAttempt('llm_vision', false, '', 'no screenshot captured', Date.now() - t2Start, 2);
      }
    } catch (e: any) { await logAttempt('llm_vision', false, '', e.message, Date.now() - t2Start, 2); }
  }

  // ── Tier 3: third-party API (token-based captchas) ──
  if (TOKEN_BASED.has(captchaType) || captchaType === 'unknown') {
    const t3Start = Date.now();
    try {
      const creds = await getCaptchaCredentials(base44);
      if (creds?.apiKey) {
        const res = await engineFetch(`/sessions/${sessionId}/execute`, {
          method: 'POST',
          body: JSON.stringify({ action_type: 'solve_captcha', options: { type: captchaType, siteKey, apiKey: creds.apiKey, provider: creds.provider } }),
        });
        const token = res.data?.token || res.data?.solution || '';
        if (token) { await logAttempt(creds.provider, true, token, '', Date.now() - t3Start, 3); return { solved: true, provider: creds.provider, fallbackLevel: 3, token }; }
        await logAttempt(creds.provider, false, '', res.data?.error || 'no token returned', Date.now() - t3Start, 3);
      } else {
        await logAttempt('none', false, '', 'no third-party API key configured (CAPTCHA_SOLVER_API_KEY)', Date.now() - t3Start, 3);
      }
    } catch (e: any) { await logAttempt('2captcha', false, '', e.message, Date.now() - t3Start, 3); }
  }

  return { solved: false, provider: 'none', fallbackLevel: 0, error: 'all captcha tiers failed' };
}

// Aggregate solve-rate stats by provider + type — for the dashboard.
export async function getCaptchaStats(base44): Promise<{ total: number; solved: number; rate: number; byProvider: any[]; byType: any[] }> {
  const byProvider = await base44.asServiceRole.entities.CaptchaSolveLog.aggregate({
    groupBy: 'provider',
    count: true,
  });
  const byType = await base44.asServiceRole.entities.CaptchaSolveLog.aggregate({
    groupBy: 'captcha_type',
    count: true,
  });
  const total = byProvider.rows?.reduce((s: number, r: any) => s + (r.count || 0), 0) || 0;
  const solved = byProvider.rows?.filter((r: any) => r.provider !== 'none').reduce((s: number, r: any) => s + (r.count || 0), 0) || 0;
  return { total, solved, rate: total > 0 ? Math.round((solved / total) * 100) : 0, byProvider: byProvider.rows || [], byType: byType.rows || [] };
}