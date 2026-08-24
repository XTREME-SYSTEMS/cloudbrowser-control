// ═══════════════════════════════════════════════════
// Cloudflare Turnstile Self-Solver
// Turnstile often auto-solves with a good browser fingerprint.
// ═══════════════════════════════════════════════════

export async function solveTurnstile(page, maxWait) {
  // Check for existing token
  const existingToken = await page.evaluate(() => {
    const el = document.querySelector('input[name="cf-turnstile-response"], textarea[name="cf-turnstile-response"]');
    return el && el.value && el.value.length > 10 ? el.value : null;
  }).catch(() => null);
  if (existingToken) return { solved: true, token: existingToken };

  // Wait for Turnstile iframe to appear
  try {
    await page.waitForSelector('iframe[src*="challenges.cloudflare.com"]', { timeout: 8000, state: "attached" });
  } catch {
    return { solved: false, error: "Turnstile iframe not found" };
  }

  // Turnstile auto-solves — just wait for the token
  const deadline = Date.now() + maxWait;
  while (Date.now() < deadline) {
    await sleep(500);
    const token = await page.evaluate(() => {
      const el = document.querySelector('input[name="cf-turnstile-response"], textarea[name="cf-turnstile-response"]');
      return el && el.value && el.value.length > 10 ? el.value : null;
    }).catch(() => null);
    if (token) return { solved: true, token };
  }

  return { solved: false, error: "Turnstile auto-solve timed out" };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
