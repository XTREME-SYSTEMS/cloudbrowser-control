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

  // Strip whitespace/newlines that may have been introduced during secret detection
  const cleanKey = apiKey.trim();
  
  // Validate: 2captcha keys are 32-char alphanumeric. If the key starts with "6L"
  // and is ~40 chars, it's likely a Google reCAPTCHA site key, not a 2captcha API key.
  // This happens when the platform auto-detects a site key in chat and saves it.
  if (cleanKey.startsWith("6L") && cleanKey.length > 35) {
    console.warn(`[captchaSolver] WARNING: API key looks like a reCAPTCHA site key (starts with "6L", ${cleanKey.length} chars). 2captcha keys are 32 chars. Current key will likely be rejected by 2captcha.`);
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

  return { apiKey: cleanKey, provider };
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