# CAPTCHA Self-Solver — Iframe Timing Fix

## Date: 2026-08-24

## Problem
The self-hosted reCAPTCHA v2 solver was detecting the captcha on Google's `/sorry/` page but failing with:
```
"reCAPTCHA anchor iframe not found"
```

## Root Cause
`findFrame()` in `browser-engine/self-solvers/recaptcha-v2.js` checked `page.frames()` synchronously. When the reCAPTCHA iframe element is attached to the DOM, Playwright registers the frame, but its URL is still `about:blank` until the content loads. The synchronous check `f.url().includes("recaptcha/api2/anchor")` fails because `about:blank` doesn't match the pattern.

## Fix Applied
Replaced the synchronous `findFrame()` calls with `findFrameAsync()` — a polling version that waits up to 10s for the frame URL to populate before matching. Applied to both the anchor iframe lookup (Step 2) and the challenge iframe lookup (Step 6).

Also added a broader fallback pattern (`recaptcha/anchor` without the `api2` segment) for Google pages that use a different reCAPTCHA path.

### Files Changed
- `browser-engine/self-solvers/recaptcha-v2.js`
  - Added `findFrameAsync(page, urlPattern, timeoutMs)` helper
  - Step 2: anchor iframe lookup now polls + has broader fallback
  - Step 6: challenge iframe lookup now polls

## Deployment Required
**The browser-engine on Railway must be redeployed for this fix to take effect.** The current running engine still has the old code.

## Post-Deploy Validation
1. Run `testCaptchaSolver` against `https://www.google.com/search?q=test`
2. Expected: `detected: true`, `solved: true` (if stealth passes) or `solved: false` with error `"Image challenge appeared and audio fallback failed"` (if Google triggers image challenge)
3. The `"reCAPTCHA anchor iframe not found"` error should NOT appear

## Known Limitation
If Google triggers an image challenge after the checkbox click, the audio fallback uses Google's free speech-to-text API which is rate-limited and unreliable on high-security targets. This is a separate issue from the iframe timing fix.