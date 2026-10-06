import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { setEngineClient, isEngineConfigured, engineFetch } from '../../shared/engineClient.ts';
import { generateFingerprint, buildStealthSessionConfig } from '../../shared/fingerprintRandomizer.ts';
import { matchFingerprintToUA } from '../../shared/tlsFingerprint.ts';
import { pickBestProxy, recordProxyResult } from '../../shared/manageProxyRotation.ts';
import { solveCaptchaWithFallback } from '../../shared/captchaFallbackChain.ts';
import { generateTypingDelays, humanDelay } from '../../shared/humanBehavior.ts';
import { withRetry } from '../../shared/resilience.ts';
import { invokeLLM } from '../../shared/vercelAiGateway.ts';
import { uploadPrivateFile } from '../../shared/storageGateway.ts';
import { sanitizeUrl } from '../../shared/urlValidator.ts';

// Social Media Autonomous Operations Engine
// Actions: create_account | login | post | comment | respond | edit_profile | follow | like | dm
// Uses stealth browser + CAPTCHA fallback + AI-generated interaction steps.
// The AI analyzes each page and generates the exact selectors/actions needed.

const PLATFORM_URLS: Record<string, { login: string; signup: string; post: string }> = {
  twitter: { login: 'https://x.com/login', signup: 'https://x.com/i/flow/signup', post: 'https://x.com/compose/post' },
  facebook: { login: 'https://www.facebook.com/login', signup: 'https://www.facebook.com/r.php', post: 'https://www.facebook.com' },
  instagram: { login: 'https://www.instagram.com/accounts/login/', signup: 'https://www.instagram.com/accounts/emailsignup/', post: 'https://www.instagram.com' },
  tiktok: { login: 'https://www.tiktok.com/login', signup: 'https://www.tiktok.com/signup', post: 'https://www.tiktok.com' },
  linkedin: { login: 'https://www.linkedin.com/login', signup: 'https://www.linkedin.com/signup', post: 'https://www.linkedin.com/feed' },
  pinterest: { login: 'https://www.pinterest.com/login/', signup: 'https://www.pinterest.com/business/create/', post: 'https://www.pinterest.com' },
  reddit: { login: 'https://www.reddit.com/login', signup: 'https://www.reddit.com/register', post: 'https://www.reddit.com/submit' },
  threads: { login: 'https://www.threads.net/login', signup: 'https://www.threads.net/signup', post: 'https://www.threads.net' },
  medium: { login: 'https://medium.com/m/signin', signup: 'https://medium.com/m/signup', post: 'https://medium.com/new-story' },
  quora: { login: 'https://www.quora.com/login', signup: 'https://www.quora.com/signup', post: 'https://www.quora.com' },
  bluesky: { login: 'https://bsky.app/login', signup: 'https://bsky.app/signup', post: 'https://bsky.app' },
  mastodon: { login: 'https://mastodon.social/auth/sign_in', signup: 'https://mastodon.social/auth/sign_up', post: 'https://mastodon.social' },
  tumblr: { login: 'https://www.tumblr.com/login', signup: 'https://www.tumblr.com/register', post: 'https://www.tumblr.com' },
  youtube: { login: 'https://accounts.google.com/login', signup: 'https://accounts.google.com/signup', post: 'https://www.youtube.com/upload' },
  discord: { login: 'https://discord.com/login', signup: 'https://discord.com/register', post: 'https://discord.com' },
  telegram: { login: 'https://web.telegram.org', signup: 'https://web.telegram.org', post: 'https://web.telegram.org' }
};

const STEP_SCHEMA = {
  type: 'object',
  properties: {
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          action_type: { type: 'string', enum: ['goto', 'click', 'type', 'wait', 'scroll', 'screenshot', 'extract_text', 'select', 'press_key', 'wait_for_selector'] },
          selector: { type: 'string' },
          value: { type: 'string' },
          options: { type: 'object' },
          description: { type: 'string' }
        },
        required: ['action_type']
      }
    },
    success_check: { type: 'string', description: 'What to look for to confirm success' }
  },
  required: ['steps']
};

async function generateSteps(action: string, platform: string, content: string, targetUrl: string, pageContext: string) {
  const actionDescriptions: Record<string, string> = {
    create_account: 'Create a new account on this platform. Fill in signup form fields with the provided details. Handle email/phone verification prompts.',
    login: 'Log in to an existing account using the provided credentials.',
    post: 'Create and publish a new post with the provided content text and hashtags. Navigate to the compose/post area, enter the text, and submit.',
    comment: 'Find the specified post and add a comment with the provided text.',
    respond: 'Find the specified post or message and respond/reply with the provided text.',
    edit_profile: 'Navigate to profile settings and update the bio, description, or other profile fields with the provided content.',
    follow: 'Find the specified user/account and click the follow button.',
    like: 'Find the specified post and click the like button.',
    dm: 'Send a direct message with the provided text to the specified user.'
  };

  const prompt = `You are a browser automation expert. Generate the exact browser steps to ${action} on ${platform}.

Action: ${action}
Platform: ${platform}
Target URL: ${targetUrl}
Content to post/comment/send: ${content}

${actionDescriptions[action] || 'Perform the requested action.'}

Current page context (HTML elements visible):
${pageContext.slice(0, 8000)}

Generate a sequence of browser automation steps. Each step has:
- action_type: one of goto, click, type, wait, scroll, screenshot, extract_text, select, press_key, wait_for_selector
- selector: CSS selector for the element (use common selectors like input[type=email], textarea, button[type=submit], [data-testid*="post"], etc.)
- value: text to type or URL to navigate to
- options: optional { timeout: number }
- description: what this step does

For posting: navigate to the compose area, find the text input, type the content, find and click the submit/post button.
For login: find email/username field, type it, find password field, type it, click login button.
For create_account: navigate to signup, fill all visible form fields, click submit.

Be specific with selectors based on common platform patterns. Use [data-testid] attributes when likely. Use generic fallbacks like textarea, button[type=submit].

Return only valid JSON matching the schema.`;

  const result = await invokeLLM({
    prompt,
    response_json_schema: STEP_SCHEMA,
    model: 'gpt_5_mini'
  });
  return result;
}

export default async function(req: any) {
  const base44 = createClientFromRequest(req);
  setEngineClient(base44);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const action = body.action;
  const platform = body.platform;
  const content = body.content || '';
  const targetUrl = body.target_url || '';
  const credentials = body.credentials || {};
  const humanLike = body.human_like !== false;
  const useProxy = body.use_proxy !== false;
  const geo = body.geo;

  if (!action) return Response.json({ error: 'action is required' }, { status: 400 });
  if (!platform) return Response.json({ error: 'platform is required' }, { status: 400 });

  const platformUrls = PLATFORM_URLS[platform];
  if (!platformUrls) return Response.json({ error: `Unsupported platform: ${platform}` }, { status: 400 });

  if (!await isEngineConfigured()) {
    return Response.json({ error: 'Browser engine not configured. Set ENGINE_URL and ENGINE_API_KEY in Secrets.' }, { status: 503 });
  }

  let proxyPick = null;
  const fp = generateFingerprint();
  const tls = matchFingerprintToUA(fp.userAgent);
  const sessionConfig = buildStealthSessionConfig(fp);
  if (tls) sessionConfig.tls = { ja3: tls.ja3_hash, ja4: tls.ja4, alpn: tls.alpn };

  if (useProxy) {
    proxyPick = await pickBestProxy(base44, { geo, ipType: 'residential' }).catch(() => null);
    if (proxyPick) sessionConfig.proxy = proxyPick.config;
  }

  const session = await withRetry(() => engineFetch('/sessions', {
    method: 'POST',
    body: JSON.stringify(sessionConfig),
  }), { retries: 2 });

  const sessionId = session.sessionId;
  const evidence: string[] = [];
  const log: any[] = [];

  const execStep = async (step: any) => engineFetch(`/sessions/${sessionId}/execute`, {
    method: 'POST',
    body: JSON.stringify({ action_type: step.action_type, selector: step.selector, value: step.value, options: step.options || {} }),
  });

  try {
    // Determine starting URL
    const startUrl = action === 'create_account' ? platformUrls.signup
      : action === 'login' ? platformUrls.login
      : action === 'post' ? platformUrls.post
      : targetUrl || platformUrls.login;

    const urlCheck = sanitizeUrl(startUrl);
    if (!urlCheck.valid) return Response.json({ error: `URL rejected: ${urlCheck.reason}` }, { status: 400 });

    await withRetry(() => execStep({ action_type: 'goto', value: urlCheck.sanitized, options: { timeout: 60000 } }), { retries: 1 });
    log.push({ step: 'navigate', url: urlCheck.sanitized });

    // Wait for page to load
    await new Promise(r => setTimeout(r, 2000));

    // Extract page context for AI step generation
    let pageContext = '';
    try {
      const extractRes = await execStep({ action_type: 'extract_text' });
      pageContext = extractRes.data || extractRes.text || '';
    } catch { /* skip */ }

    // For login/create_account, fill credentials first
    if (action === 'login' || action === 'create_account') {
      const fields = action === 'login'
        ? [
          { selector: 'input[type="email"], input[name="email"], input[autocomplete="username"], input[name="username"]', value: credentials.email || credentials.username || '' },
          { selector: 'input[type="password"], input[name="password"], input[autocomplete="current-password"]', value: credentials.password || '' },
        ]
        : [
          { selector: 'input[type="email"], input[name="email"], input[name="userEmail"]', value: credentials.email || '' },
          { selector: 'input[type="text"], input[name="username"], input[name="user[login]"]', value: credentials.username || '' },
          { selector: 'input[type="password"], input[name="password"], input[name="user[password]"]', value: credentials.password || '' },
        ];

      for (const field of fields) {
        if (!field.value) continue;
        try {
          const delays = humanLike ? generateTypingDelays(field.value) : null;
          await execStep({ action_type: 'type', selector: field.selector, value: field.value, options: humanLike ? { typingDelays: delays } : {} });
          if (humanLike) await new Promise(r => setTimeout(r, humanDelay(120, 80)));
          log.push({ step: 'type', selector: field.selector });
        } catch (e) { log.push({ step: 'type_failed', selector: field.selector, error: e.message }); }
      }

      // Click submit
      try {
        await execStep({ action_type: 'click', selector: 'button[type="submit"], button[data-testid*="submit"], button[data-testid*="login"], button[data-testid*="signup"], input[type="submit"]' });
        log.push({ step: 'submit' });
      } catch (e) { log.push({ step: 'submit_failed', error: e.message }); }

      await new Promise(r => setTimeout(r, 3000));
    }

    // Auto-detect and solve CAPTCHAs
    try {
      const detect = await execStep({ action_type: 'detect_captcha' });
      if (detect.data?.detected) {
        log.push({ step: 'captcha_detected', type: detect.data.type });
        const chainRes = await solveCaptchaWithFallback(base44, { sessionId, url: urlCheck.sanitized, captchaType: detect.data.type || 'unknown', triggeredBy: 'auto' });
        log.push({ step: 'captcha_solved', solved: chainRes.solved, provider: chainRes.provider });
      }
    } catch { /* detect not supported */ }

    // For post/comment/respond/edit_profile/follow/like/dm — use AI to generate steps
    if (['post', 'comment', 'respond', 'edit_profile', 'follow', 'like', 'dm'].includes(action)) {
      // Re-extract page context after login
      if (action === 'login' || action === 'create_account') {
        try {
          const extractRes = await execStep({ action_type: 'extract_text' });
          pageContext = extractRes.data || extractRes.text || '';
        } catch { /* skip */ }
      }

      const aiPlan = await generateSteps(action, platform, content, targetUrl, pageContext);
      log.push({ step: 'ai_plan_generated', steps: aiPlan.steps?.length || 0 });

      for (const step of (aiPlan.steps || [])) {
        try {
          if (step.action_type === 'type' && step.value && humanLike) {
            step.options = { ...(step.options || {}), typingDelays: generateTypingDelays(step.value) };
          }
          await execStep(step);
          if (humanLike) await new Promise(r => setTimeout(r, humanDelay(200, 120)));
          log.push({ step: step.action_type, description: step.description || '' });
        } catch (e) {
          log.push({ step: 'step_failed', action: step.action_type, error: e.message });
        }
      }
    }

    // Capture evidence screenshot
    try {
      const shot = await engineFetch(`/sessions/${sessionId}/execute`, {
        method: 'POST',
        body: JSON.stringify({ action_type: 'screenshot', options: { fullPage: false } }),
      });
      if (shot.base64) {
        const file = new File([Uint8Array.from(atob(shot.base64), c => c.charCodeAt(0))], `social_${platform}_${action}_${Date.now()}.png`, { type: 'image/png' });
        const upload = await uploadPrivateFile({ file });
        evidence.push(upload.file_uri);
      }
      if (shot.url) log.push({ step: 'final_url', url: shot.url });
    } catch (e) { log.push({ step: 'screenshot_failed', error: e.message }); }

  } finally {
    try { await engineFetch(`/sessions/${sessionId}`, { method: 'DELETE' }); } catch {}
  }

  if (proxyPick) await recordProxyResult(base44, proxyPick.proxyId, true, 0).catch(() => {});

  // Update SocialMediaAccount if connected
  try {
    if (body.account_id) {
      const updates: any = { last_post_at: new Date().toISOString(), $inc: { posts_count: 1 } };
      if (action === 'login' || action === 'create_account') {
        updates.connected = true;
        updates.connected_at = new Date().toISOString();
        updates.api_connection_status = 'connected';
        updates.status = 'active';
      }
      await base44.asServiceRole.entities.SocialMediaAccount.update(body.account_id, updates);
    }
  } catch { /* skip */ }

  return Response.json({
    ok: true,
    action,
    platform,
    session_id: sessionId,
    proxy_used: proxyPick ? proxyPick.meta : null,
    evidence,
    log,
    fingerprint: { screen: fp.screen, locale: fp.language, timezone: fp.timezone, tls_ja4: tls?.ja4 }
  });
}