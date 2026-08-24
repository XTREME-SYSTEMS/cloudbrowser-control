// ═══════════════════════════════════════════════
// Captcha Solver Credentials — shared injection
// Reads the CAPTCHA_SOLVER_API_KEY secret + captcha_provider from SystemSettings
// and injects them into solve_captcha options / session creation payloads.
// Used by both cloudBrowserGatewayV6 and mcpTools to ensure the engine's
// solveCaptcha() always receives the API key + provider it needs.
// ═══════════════════════════════════════════════

/**
 * Returns { apiKey, provider } if captcha solving is configured, or null if not.
 * - apiKey comes from the CAPTCHA_SOLVER_API_KEY app secret (process.env).
 * - provider comes from SystemSettings.captcha_provider (default: "2captcha").
 */
export async function getCaptchaCredentials(base44) {
  // Check multiple possible secret names — the platform may save the key
  // under different names depending on how it was entered
  const apiKey = process.env.CAPTCHA_SOLVER_API_KEY 
    || process.env.CAPTCHA_API_KEY
    || process.env.TWO_CAPTCHA_API_KEY
    || process.env.TWOCAPTCHA_API_KEY;
  if (!apiKey || apiKey.length < 8) {
    return null;
  }

  let provider = "2captcha";
  try {
    const settings = await base44.asServiceRole.entities.SystemSettings.list("-created_date", 1);
    if (settings[0]?.captcha_provider && settings[0].captcha_provider !== "none") {
      provider = settings[0].captcha_provider;
    }
  } catch (_e) {
    // SystemSettings not yet configured — use default provider
  }

  return { apiKey, provider };
}

/**
 * Injects captcha credentials into solve_captcha action options.
 * Caller-provided apiKey/provider take precedence (allow per-call override).
 */
export async function withCaptchaCredentials(base44, options) {
  const creds = await getCaptchaCredentials(base44);
  if (!creds) {
    throw new Error("Captcha solver not configured: CAPTCHA_SOLVER_API_KEY (or CAPTCHA_API_KEY) secret is missing or too short. Set it in the app secrets.");
  }
  return {
    ...options,
    apiKey: options?.apiKey || creds.apiKey,
    provider: options?.provider || creds.provider,
  };
}