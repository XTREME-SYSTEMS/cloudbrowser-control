// ═══════════════════════════════════════════════════
// SerpMeasurement — Google SERP position checker with auto-solve
// Uses the cloudbrowser engine to search Google for a keyword,
// auto-solves reCAPTCHA via 2captcha, and extracts the ranking
// position of a target URL.
// ═══════════════════════════════════════════════════

import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { enginePost, engineGet, setEngineClient } from "../../shared/engineClient.ts";
import { getCaptchaCredentials } from "../../shared/captchaSolver.ts";

export default async function (req) {
  const base44 = createClientFromRequest(req);
  setEngineClient(base44);
  const requestId = req.headers?.["x-request-id"];

  try {
    const body = await req.json();
    const { keyword, target_url, max_results } = body;

    if (!keyword) return Response.json({ ok: false, error: "keyword is required" }, { status: 400 });
    if (!target_url) return Response.json({ ok: false, error: "target_url is required" }, { status: 400 });

    const maxRows = Math.min(max_results || 100, 100);

    // Get captcha credentials for auto-solve
    const captchaCreds = await getCaptchaCredentials(base44);

    // 1. Create a browser session with captcha solver enabled
    const sessionPayload = {
      usePool: false,
      fingerprintLevel: "full",
      behaviorLevel: "high",
    };
    if (captchaCreds) {
      sessionPayload.captchaSolver = {
        provider: captchaCreds.provider,
        apiKey: captchaCreds.apiKey,
      };
    }

    const session = await enginePost("/sessions", sessionPayload, requestId);

    // 2. Navigate to Google search
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(keyword)}&num=${maxRows}`;
    const navResult = await enginePost(`/sessions/${session.sessionId}/execute`, {
      action_type: "goto",
      value: searchUrl,
      options: { timeout: 180000, waitUntil: "domcontentloaded" },
    }, requestId);

    // Check if captcha was encountered and solved
    const captchaInfo = navResult.captcha || {};
    let captchaSolved = false;
    if (captchaInfo.detected) {
      if (captchaInfo.solved) {
        captchaSolved = true;
      } else {
        // Captcha detected but not solved — return partial result
        return Response.json({
          ok: false,
          error: "reCAPTCHA detected but not solved",
          captcha: captchaInfo,
          keyword,
          target_url,
          engine_session_id: session.sessionId,
        }, { status: 200 });
      }
    }

    // 3. If captcha was solved, re-navigate to the search URL
    // The captcha solve redirects to google.com/index, but the session cookie is now set.
    // Re-navigating to the search URL should serve actual search results.
    if (captchaSolved) {
      const reNavResult = await enginePost(`/sessions/${session.sessionId}/execute`, {
        action_type: "goto",
        value: searchUrl,
        options: { timeout: 60000, waitUntil: "domcontentloaded" },
      }, requestId);
      // Check if we got a second captcha (unlikely but possible)
      if (reNavResult.captcha?.detected && !reNavResult.captcha?.solved) {
        return Response.json({
          ok: false,
          error: "reCAPTCHA on re-navigation but not solved",
          captcha: reNavResult.captcha,
          keyword,
          target_url,
          engine_session_id: session.sessionId,
        }, { status: 200 });
      }
    }

    // 4. Extract SERP results from the page
    const extractResult = await enginePost(`/sessions/${session.sessionId}/execute`, {
      action_type: "evaluate",
      value: `(() => {
        const results = [];
        const links = document.querySelectorAll('#search a[href], #rso a[href]');
        let position = 0;
        const seen = new Set();
        for (const link of links) {
          const href = link.href;
          if (!href || seen.has(href)) continue;
          if (href.startsWith('https://www.google.com/') || href.startsWith('https://accounts.google.com/')) continue;
          if (!href.startsWith('http')) continue;
          seen.add(href);
          position++;
          const title = link.textContent || '';
          const container = link.closest('.g, .tF2Cxc, [data-sokoban-container]');
          const snippet = container ? container.querySelector('[data-sncf], .IsZrtc, .VwiC3b')?.textContent || '' : '';
          results.push({ position, url: href, title: title.trim(), snippet: snippet.trim().slice(0, 200) });
          if (results.length >= ${maxRows}) break;
        }
        return JSON.stringify(results);
      })()`,
    }, requestId);

    let serpResults = [];
    try {
      serpResults = JSON.parse(extractResult.data || "[]");
    } catch (_e) {
      serpResults = [];
    }

    // 5. Find the target URL's position
    const target = target_url.toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
    let foundPosition = -1;
    let foundResult = null;

    for (const result of serpResults) {
      const resultUrl = result.url.toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
      if (resultUrl.includes(target) || target.includes(resultUrl)) {
        foundPosition = result.position;
        foundResult = result;
        break;
      }
    }

    // 6. Clean up session
    try {
      await engineGet(`/sessions/${session.sessionId}`, requestId);
    } catch (_e) { /* session cleanup is best-effort */ }

    return Response.json({
      ok: true,
      keyword,
      target_url,
      found: foundPosition > 0,
      position: foundPosition,
      found_result: foundResult,
      total_results: serpResults.length,
      captcha_detected: captchaInfo.detected || false,
      captcha_solved: captchaSolved,
      serp_results: serpResults.slice(0, 10),
      engine_session_id: session.sessionId,
      timestamp: new Date().toISOString(),
    }, { status: 200 });
  } catch (err) {
    return Response.json({
      ok: false,
      error: err.message,
    }, { status: 500 });
  }
}