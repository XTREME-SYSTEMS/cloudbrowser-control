// ═══════════════════════════════════════════════════
// reCAPTCHA v2 Self-Solver
// Strategy: Click the "I'm not a robot" checkbox in the
// reCAPTCHA anchor iframe. With good stealth fingerprinting,
// Google often passes without an image challenge.
// Falls back to audio challenge if an image challenge appears.
// ═══════════════════════════════════════════════════

export async function solveReCaptchaV2(page, maxWait) {
  // ── Step 1: Check for existing token ──
  const existingToken = await getReCaptchaToken(page);
  if (existingToken) return { solved: true, token: existingToken };

  // ── Step 2: Find the reCAPTCHA anchor iframe ──
  // The iframe element may be attached before its content loads — page.frames()
  // won't match the URL pattern until the frame navigates away from about:blank.
  // Poll for up to 10s until the frame URL contains the pattern.
  // Match both standard (api2/anchor) and enterprise (enterprise/anchor) reCAPTCHA
  let anchorFrame = await findFrameAsync(page, [
    "recaptcha/api2/anchor",
    "recaptcha/enterprise/anchor",
  ], 10000);
  if (!anchorFrame) {
    // Last resort: any recaptcha iframe with "anchor" in the URL
    anchorFrame = await findFrameAsync(page, "recaptcha", 3000);
    if (anchorFrame && !anchorFrame.url().includes("anchor")) anchorFrame = null;
  }
  if (!anchorFrame) throw new Error("reCAPTCHA anchor iframe not found");

  // ── Step 3: Wait for checkbox to be ready ──
  try {
    await anchorFrame.waitForSelector("#recaptcha-anchor", { timeout: 10000, state: "visible" });
  } catch {
    throw new Error("reCAPTCHA checkbox not found in anchor iframe");
  }

  // ── Step 4: Check if already checked ──
  const alreadyChecked = await anchorFrame.evaluate(() => {
    const a = document.getElementById("recaptcha-anchor");
    return a && a.getAttribute("aria-checked") === "true";
  }).catch(() => false);

  if (alreadyChecked) {
    const token = await pollForToken(page, 5000);
    if (token) return { solved: true, token };
    return { solved: true, token: "" };
  }

  // ── Step 5: Click the checkbox ──
  try {
    await anchorFrame.click("#recaptcha-anchor", { delay: 50 + Math.random() * 100 });
  } catch (e) {
    throw new Error("Failed to click reCAPTCHA checkbox: " + e.message);
  }

  // ── Step 6: Wait for result (token or challenge) ──
  const deadline = Date.now() + maxWait;
  let challengeDetected = false;

  while (Date.now() < deadline) {
    await sleep(500);

    // Check for token (success case)
    const token = await getReCaptchaToken(page);
    if (token) return { solved: true, token };

    // Check if checkbox turned green
    const isChecked = await anchorFrame.evaluate(() => {
      const a = document.getElementById("recaptcha-anchor");
      return a && a.getAttribute("aria-checked") === "true";
    }).catch(() => false);

    if (isChecked && !challengeDetected) {
      continue; // Token not yet available — keep waiting
    }

    // Check if image challenge iframe appeared
    const challengeFrame = await findFrameAsync(page, [
      "recaptcha/api2/bframe",
      "recaptcha/enterprise/bframe",
    ], 2000);
    if (challengeFrame && !challengeDetected) {
      challengeDetected = true;
      // ── Try audio challenge ──
      const audioResult = await tryAudioChallenge(page, challengeFrame, deadline - Date.now());
      if (audioResult) return { solved: true, token: audioResult };
    }
  }

  return { solved: false, error: challengeDetected 
    ? "Image challenge appeared and audio fallback failed" 
    : "reCAPTCHA solving timed out" };
}

// ── Get reCAPTCHA token from the page ──
async function getReCaptchaToken(page) {
  return page.evaluate(() => {
    // Standard reCAPTCHA v2: #g-recaptcha-response
    // Enterprise reCAPTCHA: may use g-recaptcha-response or a numeric ID variant
    const el = document.getElementById("g-recaptcha-response") 
      || document.querySelector('textarea[name="g-recaptcha-response"]')
      || document.querySelector('textarea[id^="g-recaptcha-response"]')
      || document.querySelector('textarea[name^="g-recaptcha-response"]');
    return el && el.value && el.value.length > 10 ? el.value : null;
  }).catch(() => null);
}

// ── Poll for token with timeout ──
async function pollForToken(page, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const token = await getReCaptchaToken(page);
    if (token) return token;
    await sleep(500);
  }
  return null;
}

// ── Try audio challenge ──
async function tryAudioChallenge(page, challengeFrame, remainingMs) {
  if (remainingMs < 12000) return null;

  try {
    // Wait for challenge frame to be ready
    // The challenge frame shows an image grid first — we need to switch to audio
    await challengeFrame.waitForSelector(".rc-imageselect-broken-alias, .rc-imageselect-payload, .rc-button-arc", { timeout: 5000 })
      .catch(() => {});
    await sleep(1000);

    // Click the audio challenge button — reCAPTCHA has an accessibility/audio button
    // Try multiple selector patterns for different reCAPTCHA versions (standard + enterprise)
    const audioBtnSelectors = [
      '#recaptcha-audio-button',
      '.rc-button-audio',
      '.rc-button-default', 
      'button[aria-label*="audio" i]',
      'a[aria-label*="audio" i]',
      '.rc-audiochallenge',
      '#recaptcha-switch-button',
    ];
    
    let clickedAudio = false;
    for (const sel of audioBtnSelectors) {
      const found = await challengeFrame.evaluate((s) => {
        const el = document.querySelector(s);
        if (el) { el.click(); return true; }
        return false;
      }, sel).catch(() => false);
      if (found) { clickedAudio = true; console.log(`[captcha] Clicked audio button: ${sel}`); break; }
    }
    
    if (!clickedAudio) {
      // Try clicking by visible text
      const clickedByText = await challengeFrame.evaluate(() => {
        const elements = [...document.querySelectorAll('a, button, div[role="button"]')];
        for (const el of elements) {
          const text = (el.textContent || '').toLowerCase();
          if (text.includes('audio') || text.includes('headphones')) {
            el.click();
            return true;
          }
        }
        return false;
      }).catch(() => false);
      if (clickedByText) clickedAudio = true;
    }
    
    if (!clickedAudio) return null;
    
    // Wait for audio challenge interface to load
    await sleep(2000);
    await challengeFrame.waitForSelector('.rc-audiochallenge-play-button, audio, .rc-audiochallenge-tdownload-link, .rc-audiochallenge', { timeout: 10000 })
      .catch(() => {});

    // Get the audio download URL — try multiple sources
    const audioUrl = await challengeFrame.evaluate(() => {
      // Direct download link
      const dlLink = document.querySelector('.rc-audiochallenge-tdownload-link');
      if (dlLink) return dlLink.href || dlLink.getAttribute('href');
      // Audio element source
      const audio = document.querySelector('audio');
      if (audio) {
        if (audio.src) return audio.src;
        const source = audio.querySelector('source');
        if (source && source.src) return source.src;
      }
      // Any link to audio file
      const audioLink = document.querySelector('a[href*=".mp3"], a[href*=".wav"], a[href*="audio"]');
      if (audioLink) return audioLink.href || audioLink.getAttribute('href');
      return null;
    }).catch(() => null);

    if (!audioUrl) return null;

    // Download the audio file
    const audioResp = await fetch(audioUrl);
    if (!audioResp.ok) return null;
    const audioBuffer = await audioResp.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString('base64');

    // Transcribe using free Google Speech-to-Text endpoint
    const transcription = await transcribeAudio(Buffer.from(audioBuffer));
    if (!transcription || transcription.trim().length < 2) return null;

    // Enter the transcription into the response input
    const inputFilled = await challengeFrame.evaluate((text) => {
      const input = document.getElementById('audio-response') 
        || document.querySelector('input[name="audio-response"]')
        || document.querySelector('input[type="text"]');
      if (input) {
        input.value = text;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
      return false;
    }, transcription).catch(() => false);

    if (!inputFilled) return null;

    // Click the Verify button
    const hasVerify = await challengeFrame.evaluate(() => {
      const btn = document.querySelector('#recaptcha-verify-button') 
        || document.querySelector('.rc-button-submit')
        || document.querySelector('button[type="submit"]');
      return btn ? true : false;
    }).catch(() => false);

    if (hasVerify) {
      await challengeFrame.click('#recaptcha-verify-button, .rc-button-submit').catch(() => {});
      await sleep(3000);
    }

    // Check if token appeared
    const token = await pollForToken(page, 5000);
    return token;
  } catch {
    return null;
  }
}

// ── Transcribe audio using offline Whisper (no API key needed) ──
// Falls back to multiple attempts since Whisper may need retries on noisy audio
async function transcribeAudio(audioBuffer) {
  try {
    const { transcribeAudioOffline } = await import('../stt-whisper.js');
    
    // First attempt with raw buffer
    let result = await transcribeAudioOffline(audioBuffer);
    if (result) return result;
    
    // Retry: Whisper sometimes returns empty on first pass
    // Wait a moment and try again
    await sleep(1000);
    result = await transcribeAudioOffline(audioBuffer);
    if (result) return result;
    
    // Last resort: try with the base64 buffer (different code path in transformers.js)
    console.log('[captcha] All STT attempts failed');
    return null;
  } catch (e) {
    console.error('[captcha] transcribeAudio error:', e.message);
    return null;
  }
}

// ── Helpers ──
function findFrame(page, urlPattern) {
  return page.frames().find(f => f.url().includes(urlPattern));
}

// Poll for a frame whose URL contains urlPattern — handles the case where
// the iframe is attached but its content hasn't loaded yet (URL is about:blank).
// urlPattern can be a single string or an array of strings (matches ANY).
async function findFrameAsync(page, urlPattern, timeoutMs) {
  const patterns = Array.isArray(urlPattern) ? urlPattern : [urlPattern];
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const p of patterns) {
      const frame = page.frames().find(f => f.url().includes(p));
      if (frame) return frame;
    }
    await sleep(300);
  }
  return null;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}