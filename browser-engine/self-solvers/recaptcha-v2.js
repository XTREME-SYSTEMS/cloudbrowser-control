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
  let anchorFrame = findFrame(page, "recaptcha/api2/anchor");
  if (!anchorFrame) {
    try {
      await page.waitForSelector('iframe[src*="recaptcha/api2/anchor"]', { timeout: 8000, state: "attached" });
    } catch { /* might still be loading */ }
    anchorFrame = findFrame(page, "recaptcha/api2/anchor");
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
    const challengeFrame = findFrame(page, "recaptcha/api2/bframe");
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
    const el = document.getElementById("g-recaptcha-response") 
      || document.querySelector('textarea[name="g-recaptcha-response"]');
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
    await challengeFrame.waitForSelector(".rc-imageselect-broken-alias, .rc-button-arc", { timeout: 5000 })
      .catch(() => {});

    // Look for and click the audio challenge button
    const audioBtnSelector = '#recaptcha-audio-button, .rc-button-audio, .rc-button-default';
    const hasButton = await challengeFrame.evaluate((sel) => {
      return document.querySelector(sel) ? true : false;
    }, audioBtnSelector).catch(() => false);

    if (!hasButton) return null;

    // Click the audio button
    await challengeFrame.click(audioBtnSelector).catch(() => {});
    await sleep(2000);

    // Wait for audio challenge interface to load
    await challengeFrame.waitForSelector('.rc-audiochallenge-play-button, audio[source], .rc-audiochallenge-tdownload-link', { timeout: 8000 })
      .catch(() => {});

    // Get the audio download URL
    const audioUrl = await challengeFrame.evaluate(() => {
      const dlLink = document.querySelector('.rc-audiochallenge-tdownload-link');
      if (dlLink) return dlLink.href || dlLink.getAttribute('href');
      const audio = document.querySelector('audio');
      if (audio && audio.src) return audio.src;
      const audioLink = document.querySelector('a[href*=".mp3"], a[href*=".wav"]');
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

// ── Transcribe audio using free Google Speech-to-Text ──
async function transcribeAudio(audioBuffer) {
  try {
    const response = await fetch('https://www.google.com/speech-api/v2/recognize?output=json&lang=en-US&key=AIzaSyBOti4mM-6x9WDnZIjIeyEU21FObmLW40g', {
      method: 'POST',
      headers: { 'Content-Type': 'audio/l16; rate=44100' },
      body: audioBuffer,
    });

    if (!response.ok) return null;
    const text = await response.text();
    
    // Parse response (Google returns JSON or multiple JSON objects)
    const lines = text.trim().split('\n');
    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        const transcript = data.result?.[0]?.alternative?.[0]?.transcript;
        if (transcript) return transcript;
      } catch {}
    }
    return null;
  } catch {
    return null;
  }
}

// ── Helpers ──
function findFrame(page, urlPattern) {
  return page.frames().find(f => f.url().includes(urlPattern));
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
