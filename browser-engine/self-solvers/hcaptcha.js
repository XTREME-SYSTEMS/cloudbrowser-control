// ═══════════════════════════════════════════════════
// hCaptcha Self-Solver
// ═══════════════════════════════════════════════════

export async function solveHCaptcha(page, maxWait) {
  // Check for existing token
  const existingToken = await page.evaluate(() => {
    const el = document.querySelector('textarea[name="h-captcha-response"], textarea[name="g-recaptcha-response"]');
    return el && el.value && el.value.length > 10 ? el.value : null;
  }).catch(() => null);
  if (existingToken) return { solved: true, token: existingToken };

  // Find the hCaptcha iframe
  let hcaptchaFrame = page.frames().find(f => f.url().includes("hcaptcha.com"));
  if (!hcaptchaFrame) {
    try {
      await page.waitForSelector('iframe[src*="hcaptcha.com"]', { timeout: 8000, state: "attached" });
    } catch {}
    hcaptchaFrame = page.frames().find(f => f.url().includes("hcaptcha.com"));
  }
  if (!hcaptchaFrame) throw new Error("hCaptcha iframe not found");

  // Wait for and click the checkbox
  try {
    await hcaptchaFrame.waitForSelector("#checkbox", { timeout: 10000, state: "visible" });
    
    const isChecked = await hcaptchaFrame.evaluate(() => {
      const cb = document.querySelector("#checkbox");
      return cb && cb.getAttribute("aria-checked") === "true";
    }).catch(() => false);
    
    if (isChecked) {
      const token = await pollForHCaptchaToken(page, 5000);
      if (token) return { solved: true, token };
      return { solved: true, token: "" };
    }
    
    await hcaptchaFrame.click("#checkbox", { delay: 50 + Math.random() * 100 });
  } catch (e) {
    throw new Error("Failed to click hCaptcha checkbox: " + e.message);
  }

  // Wait for token
  const deadline = Date.now() + maxWait;
  while (Date.now() < deadline) {
    await sleep(500);
    const token = await page.evaluate(() => {
      const el = document.querySelector('textarea[name="h-captcha-response"], textarea[name="g-recaptcha-response"]');
      return el && el.value && el.value.length > 10 ? el.value : null;
    }).catch(() => null);
    if (token) return { solved: true, token };
  }

  return { solved: false, error: "hCaptcha solving timed out" };
}

async function pollForHCaptchaToken(page, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const token = await page.evaluate(() => {
      const el = document.querySelector('textarea[name="h-captcha-response"], textarea[name="g-recaptcha-response"]');
      return el && el.value && el.value.length > 10 ? el.value : null;
    }).catch(() => null);
    if (token) return token;
    await sleep(500);
  }
  return null;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
