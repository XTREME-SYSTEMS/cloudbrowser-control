# CAPTCHA Solver Fix & Validation Handoff

## Mission
Fix and validate the automated CAPTCHA solver so that:
1. `browser_navigate` auto-detects and solves reCAPTCHA v2 on Google's `/sorry/` page and demo pages
2. The `solve_captcha` MCP tool successfully solves captchas using the configured 2captcha API key
3. The SerpMeasurement external function can rely on auto-solve instead of falling back to Bing

---

## Current State

### What's Broken (as of 2026-08-24)
- **Auto-solve not triggering**: `browser_navigate` returns in ~1-2s with `captcha: null` even when `captcha_solver: true` was passed to `browser_start`. The 8s iframe wait in `autoSolveCaptcha()` is not happening.
- **`solve_captcha` returns `ERROR_KEY_DOES_NOT_EXIST`**: When using the correct 40-char site key (`6Le-wvkSAAAAAPBMRTvw0Q4Muexq9bi0DJwx_mJ-`), 2captcha rejects the API key. But with a wrong 39-char key, 2captcha accepts the API key and returns `ERROR_WRONG_GOOGLEKEY` — proving the API key itself is valid.

### Code Fixes Already Applied (in repository, NOT yet deployed)
Two fixes were made to `browser-engine/server.js` (the deployed Playwright engine):

#### Fix 1: Pool session captcha config merge (line ~680)
**Before:** Pooled sessions were returned without merging `captchaSolver` config, so `s.captchaSolver` was always `undefined` on pooled sessions (the default path), causing the `if (s.captchaSolver)` check to skip auto-solve entirely.

**After:** Pool checkout now merges `opts.captchaSolver` into the pooled session:
```js
// Use pool if available
if (opts.usePool && pool.length > 0) {
  const pooledId = pool.shift();
  const s = sessions.get(pooledId);
  if (s) {
    s.status = "idle"; s.isPooled = false; s.lastActivity = Date.now();
    // Merge per-session opts that pooled sessions don't have yet
    s.captchaSolver = opts.captchaSolver || null;  // <-- THIS LINE WAS MISSING
    warmPool();
    return res.json({ ... });
  }
}
```

#### Fix 2: 2captcha form-encoding (line ~358)
**Before:** 2captcha's `in.php` endpoint received JSON POST, which inconsistently dropped the `key` field depending on the `googlekey` value — producing `ERROR_KEY_DOES_NOT_EXIST` even with a valid API key.

**After:** 2captcha submits now use `application/x-www-form-urlencoded` (the format 2captcha actually documents). anticaptcha/capmonster keep JSON-RPC:
```js
let submitRes;
if (provider === "2captcha") {
  const formBody = new URLSearchParams();
  for (const [k, v] of Object.entries(submitBody)) formBody.append(k, String(v));
  submitRes = await fetch(ep.submit, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody.toString(),
  });
} else {
  submitRes = await fetch(ep.submit, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(submitBody),
  });
}
```

---

## What the Super Agent Needs to Do

### Step 1: Deploy the Browser Engine
The code fixes are in the repository but the running Railway engine is still executing OLD code. The engine must be redeployed for fixes to take effect.

**Action:** Deploy the `browser-engine` service on Railway:
- Push a commit to the `fortress/v1.1` branch (if auto-deploy is configured), OR
- Manually trigger a redeploy in the Railway dashboard

**Verify deployment:** After redeploy, hit the engine health endpoint and check `engine_version` and `config_version`:
```bash
curl -H "x-api-key: $ENGINE_API_KEY" $ENGINE_URL/health
```
The response should show the updated engine running.

### Step 2: Validate Auto-Solve on reCAPTCHA Demo Page
Test the full flow: start a session with `captcha_solver: true`, navigate to a reCAPTCHA demo page, and verify auto-solve triggers.

**Test via MCP tool (`mcpTools` function):**
```json
// 1. Start session with captcha_solver enabled
{
  "tool": "browser_start",
  "params": { "captcha_solver": true, "use_pool": false },
  "api_key": "<your_api_key>"
}
// Expected: { "session_id": "...", "captcha_solver_enabled": true }

// 2. Navigate to reCAPTCHA demo
{
  "tool": "browser_navigate",
  "params": { "session_id": "<session_id>", "url": "https://2captcha.com/demo/recaptcha-v2" },
  "api_key": "<your_api_key>"
}
// Expected: response takes 10-60s (iframe wait + solve + poll), returns:
// { "url": "...", "title": "...", "captcha": { "detected": true, "solved": true, "type": "recaptcha_v2", "token": "..." } }
```

**Pass criteria:**
- Navigation takes >10s (proves the 8s iframe wait + solve happened)
- `captcha.detected === true`
- `captcha.solved === true`
- `captcha.token` is a non-empty string

### Step 3: Validate Auto-Solve on Google /sorry/
Repeat Step 2 but navigate to `https://www.google.com/sorry/` (or trigger a block by doing rapid searches).

**Pass criteria:**
- Auto-solve triggers and returns `captcha.solved: true`, OR
- If Google's /sorry/ doesn't have a solvable reCAPTCHA on that particular page variant, the response should at least show `captcha.detected: true` (proving detection ran)

### Step 4: Validate Explicit `solve_captcha` MCP Tool
Test the manual solve_captcha tool with the known-good site key.

```json
{
  "tool": "solve_captcha",
  "params": {
    "session_id": "<session_id>",
    "type": "recaptcha_v2",
    "site_key": "6Le-wvkSAAAAAPBMRTvw0Q4Muexq9bi0DJwx_mJ-"
  },
  "api_key": "<your_api_key>"
}
```

**Pass criteria:**
- No `ERROR_KEY_DOES_NOT_EXIST` (the form-encoding fix should resolve this)
- Returns `{ "result": { "solved": true, "token": "...", "provider": "2captcha", "type": "recaptcha_v2" } }`
- The token is a non-empty string (typically 400+ chars for reCAPTCHA v2)

### Step 5: Validate Pool Path Specifically
The primary bug was that pooled sessions (the default) didn't get captcha config. Test with `use_pool: true` (or omit it, since default is `true`):

```json
{
  "tool": "browser_start",
  "params": { "captcha_solver": true },
  "api_key": "<your_api_key>"
}
// Expected: { "fromPool": true, "captcha_solver_enabled": true }
```

Then navigate to the demo page and verify auto-solve still works (should behave identically to Step 2).

---

## Key Files & Locations

| File | Role | Key Lines |
|------|------|-----------|
| `browser-engine/server.js` | Deployed Playwright engine | Pool checkout ~680, solveCaptcha ~300-420, autoSolveCaptcha ~430-510, goto handler ~830 |
| `base44/functions/mcpTools/entry.ts` | Production MCP tool surface | `browser_start` ~100, `solve_captcha` ~220 |
| `base44/functions/mcpToolsStaging/entry.ts` | Staging MCP (mirror) | Same structure |
| `base44/shared/captchaSolver.ts` | Credential injection | `getCaptchaCredentials()`, `withCaptchaCredentials()` |
| `base44/entities/SystemSettings.jsonc` | Captcha provider config | `captcha_provider` field |

## Secrets Involved
- `CAPTCHA_SOLVER_API_KEY` — The 2captcha API key (already set, confirmed valid via ERROR_WRONG_GOOGLEKEY test)
- `ENGINE_API_KEY` — Engine auth key
- `ENGINE_URL` — Engine base URL

## Credential Flow
1. `browser_start` with `captcha_solver: true` → `mcpTools` calls `getCaptchaCredentials()` → reads `CAPTCHA_SOLVER_API_KEY` from `process.env` + `captcha_provider` from `SystemSettings`
2. Credentials sent to engine as `captchaSolver: { apiKey, provider }` in the session creation body
3. Engine stores `s.captchaSolver` on the session object
4. On `goto`, engine checks `if (s.captchaSolver)` → calls `autoSolveCaptcha(page, s.captchaSolver)`
5. `autoSolveCaptcha` waits for reCAPTCHA iframe (8s timeout), detects sitekey, calls `solveCaptcha()`
6. `solveCaptcha` submits to 2captcha (form-encoded), polls for token, injects token into `g-recaptcha-response` textarea + triggers callback

## Known Gotchas
- **Engine must be redeployed** — code changes don't take effect until Railway restarts the service
- **Pooled sessions are the default** — `use_pool` defaults to `true` in `browser_start`, so the pool merge fix is critical
- **2captcha `in.php` does NOT reliably accept JSON** — must use form-encoding
- **Google /sorry/ may not always show reCAPTCHA** — sometimes it's just a static block page; test on the 2captcha demo page first
- **reCAPTCHA iframe loads async** — `autoSolveCaptcha` waits 8s for the iframe to attach before detecting; this is why navigation should take >10s when auto-solve runs

## SerpMeasurement Dependency
The external `SerpMeasurement` function currently falls back to Bing when captcha solving fails. Once Steps 2-5 pass, it can be updated to rely on auto-solve for Google SERP collection. Do NOT change SerpMeasurement until the captcha solver is validated end-to-end.