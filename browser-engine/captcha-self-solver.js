// ═══════════════════════════════════════════════════════════════
// Self-Hosted CAPTCHA Solver — Browser-based, zero external API.
// Solves reCAPTCHA v2, hCaptcha, and Cloudflare Turnstile by
// interacting with the captcha widgets directly in the browser.
// No API keys, no per-solve fees, no external dependencies.
// ═══════════════════════════════════════════════════════════════

import { solveReCaptchaV2 } from './self-solvers/recaptcha-v2.js';
import { solveHCaptcha } from './self-solvers/hcaptcha.js';
import { solveTurnstile } from './self-solvers/turnstile.js';

/**
 * Main entry point — dispatches to the appropriate solver based on type.
 * @param {import('playwright').Page} page - The Playwright page with the captcha
 * @param {Object} options - { type, siteKey, maxWait, ... }
 * @returns {Promise<{solved: boolean, token?: string, provider: string, type: string, error?: string}>}
 */
export async function solveCaptchaSelf(page, options) {
  const type = options.type;
  const maxWait = options.maxWait || 30000;
  const startTime = Date.now();

  try {
    if (type === "recaptcha_v2") {
      const result = await solveReCaptchaV2(page, maxWait);
      return { ...result, provider: "self", type: "recaptcha_v2" };
    }
    if (type === "hcaptcha") {
      const result = await solveHCaptcha(page, maxWait);
      return { ...result, provider: "self", type: "hcaptcha" };
    }
    if (type === "turnstile") {
      const result = await solveTurnstile(page, maxWait);
      return { ...result, provider: "self", type: "turnstile" };
    }
    return {
      solved: false,
      provider: "self",
      type,
      error: `Self-solver does not support ${type}. Use 2captcha or anticaptcha provider for this type.`
    };
  } catch (e) {
    return {
      solved: false,
      provider: "self",
      type,
      error: e.message,
      duration: Date.now() - startTime,
    };
  }
}
