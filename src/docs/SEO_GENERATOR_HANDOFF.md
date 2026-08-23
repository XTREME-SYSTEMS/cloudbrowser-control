# Handoff: CloudBrowser Control Integration for SEO Generator Agent

> **Read this first.** This is the actionable handoff for the SEO Generator app's AI agent. It contains everything needed to wire real headless-browser measurements into the SEO platform. The full reference spec lives at `docs/SEO_GENERATOR_INTEGRATION_SPEC.md` in the CloudBrowser Control repo — this document is the condensed execution version.

---

## STEP 0 — Set these two secrets in the SEO Generator app

```
CLOUDBROWSER_GATEWAY_URL = https://<cloudbrowser-app-subdomain>.base44.app/api/functions/cloudBrowserGatewayV6
CLOUDBROWSER_MCP_URL     = https://<cloudbrowser-app-subdomain>.base44.app/api/functions/mcpTools
CLOUDBROWSER_API_KEY     = cb_live_<64hex>   (create in CloudBrowser dashboard → Settings → API Keys, scopes: sessions:read, sessions:write, jobs:read, jobs:write)
```

> Replace `<cloudbrowser-app-subdomain>` with the real Base44 subdomain where CloudBrowser Control is deployed. Get it from the CloudBrowser builder's preview URL or Settings → Domains.

---

## STEP 1 — Two integration surfaces (pick per call)

| Surface | URL (secret) | When to use |
|---|---|---|
| **MCP tools** | `CLOUDBROWSER_MCP_URL` | Navigation, extraction, screenshots, JS eval — the 90% case. Simpler. |
| **Gateway REST** | `CLOUDBROWSER_GATEWAY_URL` | Session creation when you need geolocation + proxy + timezone (required for 50-state SERP). Batch session creation. Job orchestration. |

**Rule of thumb:** Create the session via the **Gateway** (to set geo/proxy), then drive it with **MCP tools** (navigate/extract/observe).

---

## STEP 2 — Auth (both surfaces)

```
Header:  Authorization: Bearer <CLOUDBROWSER_API_KEY>
   — OR —
Body field: "api_key": "<CLOUDBROWSER_API_KEY>"
```

Key format: `cb_live_` + 64 hex chars. Created once in the CloudBrowser dashboard; plaintext shown only at creation.

---

## STEP 3 — Create a geo-targeted session (Gateway — required for 50-state SERP)

```http
POST <CLOUDBROWSER_GATEWAY_URL>
Authorization: Bearer <CLOUDBROWSER_API_KEY>
Content-Type: application/json

{
  "path": "/sessions",
  "method": "POST",
  "data": {
    "viewport": { "width": 1920, "height": 1080 },
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "geolocation": { "latitude": 32.7767, "longitude": -96.7970, "accuracy": 100 },
    "locale": "en-US",
    "timezone": "America/Chicago",
    "proxy": { "server": "http://tx-residential.proxy.example.com:8080", "username": "user", "password": "pass" },
    "blocked_resources": ["image", "font", "media"],
    "use_pool": true,
    "tags": ["serp", "TX"],
    "store_id": "store-tx"
  }
}
```

**Response (201) — capture `control_plane_session_id`:**
```json
{
  "session": { "id": "sess_abc123...", "status": "idle", ... },
  "control_plane_session_id": "sess_abc123...",
  "runtime_session_id": "sess_xyz789...",
  "region": "us-east",
  "engine_version": "3.0.0"
}
```

> **Use `control_plane_session_id` (the `session.id` field) as `session_id` in all MCP calls below.** Do NOT use `runtime_session_id`.

---

## STEP 4 — Drive the session (MCP tools)

All calls: `POST <CLOUDBROWSER_MCP_URL>` with `Authorization: Bearer <key>`, body `{ "tool": "...", "params": {...}, "api_key": "..." }`.

### Navigate
```json
{ "tool": "browser_navigate", "params": { "session_id": "sess_abc123...", "url": "https://www.google.com/search?q=concrete+polishing+near+me" } }
```

### Extract organic SERP results
```json
{ "tool": "browser_act", "params": {
  "session_id": "sess_abc123...",
  "action_type": "evaluate",
  "options": { "fn": "() => { const r=[]; document.querySelectorAll('#search .g').forEach((el,i)=>{const t=el.querySelector('h3'),l=el.querySelector('a[href]');if(t&&l)r.push({position:i+1,title:t.innerText,url:l.href,domain:new URL(l.href).hostname});});return r; }" }
}}
```

### Extract AI Overview (if present)
```json
{ "tool": "browser_act", "params": {
  "session_id": "sess_abc123...",
  "action_type": "evaluate",
  "options": { "fn": "() => {const o=document.querySelector('[data-ved] .LGOjhe, .IZ6rId, .zXz7ue');if(!o)return{has_ai_overview:false};const links=[...o.querySelectorAll('a[href]')].map(a=>a.href);return{has_ai_overview:true,text:o.innerText,cited_urls:links,cited_domains:[...new Set(links.map(u=>{try{return new URL(u).hostname}catch{return null}}).filter(Boolean))]}; }" }
}}
```

### Screenshot (returns a URL, not base64)
```json
{ "tool": "browser_screenshot", "params": { "session_id": "sess_abc123...", "full_page": false } }
```

### Keep-alive (call every 2-3 min for long sessions)
```json
// Gateway call:
{ "path": "/sessions/sess_abc123.../keepalive", "method": "POST", "data": {} }
```

### Close
```json
{ "tool": "browser_end", "params": { "session_id": "sess_abc123..." } }
```

---

## STEP 5 — 50-state geo table (pre-configure one Store per state)

For each state, create a Store entity in the CloudBrowser dashboard with proxy + geo + timezone pre-set, then pass `store_id` at session creation to auto-bind everything.

| State | Lat | Lng | Timezone | Store ID |
|---|---|---|---|---|
| AL | 32.3182 | -86.9023 | America/Chicago | store-al |
| AK | 61.2181 | -149.9003 | America/Anchorage | store-ak |
| AZ | 33.4484 | -112.0740 | America/Phoenix | store-az |
| AR | 34.7465 | -92.2896 | America/Chicago | store-ar |
| CA | 36.7783 | -119.4179 | America/Los_Angeles | store-ca |
| CO | 39.5505 | -105.7821 | America/Denver | store-co |
| CT | 41.6032 | -73.0877 | America/New_York | store-ct |
| DE | 38.9261 | -75.5266 | America/New_York | store-de |
| FL | 27.6648 | -81.5158 | America/New_York | store-fl |
| GA | 32.1656 | -82.9001 | America/New_York | store-ga |
| HI | 19.8987 | -155.6659 | Pacific/Honolulu | store-hi |
| ID | 44.0682 | -114.7420 | America/Denver | store-id |
| IL | 40.6331 | -89.3985 | America/Chicago | store-il |
| IN | 40.2672 | -86.1349 | America/Indiana/Indianapolis | store-in |
| IA | 41.8780 | -93.0977 | America/Chicago | store-ia |
| KS | 39.0119 | -98.4842 | America/Chicago | store-ks |
| KY | 37.8393 | -84.2700 | America/New_York | store-ky |
| LA | 31.2448 | -92.1450 | America/Chicago | store-la |
| ME | 45.2538 | -69.4455 | America/New_York | store-me |
| MD | 39.0458 | -76.6413 | America/New_York | store-md |
| MA | 42.4072 | -72.3824 | America/New_York | store-ma |
| MI | 44.3148 | -85.6024 | America/Detroit | store-mi |
| MN | 46.7296 | -94.6859 | America/Chicago | store-mn |
| MS | 32.3547 | -89.3985 | America/Chicago | store-ms |
| MO | 37.9643 | -91.8318 | America/Chicago | store-mo |
| MT | 46.8797 | -110.3626 | America/Denver | store-mt |
| NE | 41.4925 | -99.9018 | America/Chicago | store-ne |
| NV | 38.8026 | -116.4194 | America/Los_Angeles | store-nv |
| NH | 43.1939 | -71.5724 | America/New_York | store-nh |
| NJ | 40.0583 | -74.4057 | America/New_York | store-nj |
| NM | 34.5199 | -105.8701 | America/Denver | store-nm |
| NY | 40.7128 | -74.0060 | America/New_York | store-ny |
| NC | 35.7596 | -79.0193 | America/New_York | store-nc |
| ND | 47.5515 | -101.0020 | America/Chicago | store-nd |
| OH | 40.4173 | -82.9071 | America/New_York | store-oh |
| OK | 35.4676 | -97.5164 | America/Chicago | store-ok |
| OR | 43.8041 | -120.5542 | America/Los_Angeles | store-or |
| PA | 41.2033 | -77.1945 | America/New_York | store-pa |
| RI | 41.5801 | -71.4774 | America/New_York | store-ri |
| SC | 33.8361 | -81.1637 | America/New_York | store-sc |
| SD | 43.9695 | -99.9018 | America/Chicago | store-sd |
| TN | 35.5175 | -86.5804 | America/Chicago | store-tn |
| TX | 31.9686 | -99.9018 | America/Chicago | store-tx |
| UT | 39.3200 | -111.0937 | America/Denver | store-ut |
| VT | 44.5588 | -72.5778 | America/New_York | store-vt |
| VA | 37.4316 | -78.6569 | America/New_York | store-va |
| WA | 47.7511 | -120.7401 | America/Los_Angeles | store-wa |
| WV | 38.5976 | -80.4549 | America/New_York | store-wv |
| WI | 43.7844 | -88.7879 | America/Chicago | store-wi |
| WY | 43.0759 | -107.2903 | America/Denver | store-wy |

> **Critical:** Set BOTH `geolocation` AND a proxy with an IP in/near the target state. Google checks the TCP source IP — geolocation alone is not enough for accurate local SERP.

---

## STEP 6 — Mobile vs Desktop SERP

**Desktop:** `viewport: {width:1920,height:1080}`, UA: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`

**Mobile:** `viewport: {width:390,height:844}`, UA: `Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1`

---

## STEP 7 — AI citation detection (ChatGPT / Perplexity)

1. `browser_start` (no geo needed)
2. `browser_navigate` to `https://chat.openai.com` or `https://www.perplexity.ai`
3. `browser_act` with `action_type: "fill"`, `selector: "textarea#prompt-textarea, textarea[data-testid='prompt-input'], div[contenteditable='true']"`, `value: "best concrete polishing company in Ohio"`
4. `browser_act` with `action_type: "press"`, `value: "Enter"`
5. `browser_act` with `action_type: "wait_for_timeout"`, `value: "10000"`
6. `browser_act` with `action_type: "evaluate"`:
```js
() => {
  const r = document.querySelector('[data-testid="conversation-turn-2"], .prose, .markdown');
  const text = r ? r.innerText : document.body.innerText;
  const links = [...document.querySelectorAll('a[href]')].map(a=>a.href)
    .filter(u => !u.includes('openai.com') && !u.includes('perplexity.ai'));
  return {
    response_text: text.slice(0, 5000),
    cited_urls: links,
    cited_domains: [...new Set(links.map(u => { try { return new URL(u).hostname } catch { return null } }).filter(Boolean))]
  };
}
```
7. To check a specific domain:
```js
() => {
  const target = 'ohioconcretepolishing.com';
  const links = [...document.querySelectorAll('a[href]')].map(a=>a.href);
  const is_cited = links.some(u => { try { return new URL(u).hostname.includes(target) } catch { return false } });
  return { target_domain: target, is_cited, matching_urls: links.filter(u => { try { return new URL(u).hostname.includes(target) } catch { return false } }) };
}
```
8. `browser_end`

---

## STEP 8 — Rate limits & concurrency (enforced by CloudBrowser)

| Limit | Default |
|---|---|
| Requests/min per API key | 60 |
| Concurrent sessions per project | 10 |
| Concurrent sessions per store | 5 |
| Session creations/min per store | 20 |
| Max batch size | 20 sessions |
| Session idle TTL | 5 min (extend with keepalive) |

429 responses include `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After` headers.

---

## STEP 9 — Cost model (budget your runs)

| Resource | Rate |
|---|---|
| Browser compute | $0.005/min |
| LLM (ai_extract) | $0.02/call |
| Storage | $0.02/GB/month |
| Proxy bandwidth | $2.00/GB |

**Per SERP check:** ~$0.002 (15s session + small proxy bandwidth)
**Per AI citation check:** ~$0.005 (30s session)
**Full 200 clients × 50 states run (10,000 checks):** ~$20–$50 SERP / ~$50–$100 AI citations

---

## STEP 10 — Retry strategy (apply in the SEO Generator)

```js
const MAX_RETRIES = 3;
async function withRetry(fn) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try { return await fn(); }
    catch (err) {
      const transient = /timeout|502|503|network|ECONNRESET/i.test(err.message);
      if (attempt < MAX_RETRIES && transient) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt) + Math.random() * 500));
        continue;
      }
      throw err;
    }
  }
}
```

**SERP-specific:** On CAPTCHA → rotate proxy + UA, retry. On Google 429 → wait 60–120s. On "unusual traffic" → pause keyword for 1h.

---

## STEP 11 — Error response shape (all surfaces)

```json
{ "error": "message", "request_id": "req_...", "__v": "v5.0.0", "gateway": "cloudBrowserGatewayV6" }
```

| HTTP | Meaning |
|---|---|
| 400 | Bad params |
| 401 | Missing/invalid key |
| 403 | IP not allowlisted / insufficient scope |
| 404 | Session not found (or expired TTL) |
| 429 | Rate limit / concurrency quota |
| 502 | Engine upstream failure (retry) |
| 503 | Engine not configured / max sessions |

---

## STEP 12 — Batching strategy for 10,000-check runs

1. One Project per SEO client (tenant isolation + per-project concurrency).
2. One Store per state (50 stores) with proxy + geo + timezone pre-configured.
3. Create sessions in waves of 10 (max concurrent per project).
4. Use `use_pool: true` to eliminate ~2s cold start.
5. Run full scans off-peak (3 AM ET) to reduce blocks + proxy cost.
6. Throttle: max 20 session creations/min per store (auto-enforced).

---

## STEP 13 — Security notes

- Gateway is public HTTPS; engine (Railway) is internal-only.
- All secrets (proxy passwords, webhook secrets, cookies) encrypted at rest (AES-GCM); never returned in API responses.
- Use a dedicated API key per SEO client, bound to that client's Project, for hard tenant isolation.
- Stealth fingerprinting (WebGL, Canvas, AudioContext, WebRTC, navigator) is automatic — no config needed.
- CAPTCHA solving supported (reCAPTCHA v2/v3, hCaptcha, Turnstile, FunCaptcha) via `CAPTCHA_SOLVER_API_KEY` set in CloudBrowser secrets. Use `action_type: "solve_captcha"`.

---

## STEP 14 — What's NOT supported (be explicit)

- **No external WebSocket / CDP endpoint.** Live view is screenshot-polling only. Real-time interactive live view is V2 roadmap.
- **MCP `browser_start` does NOT forward geolocation/proxy/timezone.** Use the Gateway `POST /sessions` route for geo-targeted sessions, then switch to MCP tools.
- **No cross-app function invocation via in-app SDK.** The SEO Generator must call the CloudBrowser gateway/MCP via `fetch()` to the public function URLs above.
- **No session resume via MCP.** Use Gateway `POST /sessions/:id/keepalive` to extend TTL, or save/restore state via `save_state`/`restore_state` action types.

---

## STEP 15 — Minimal integration pseudocode for the SEO agent

```js
const GATEWAY = process.env.CLOUDBROWSER_GATEWAY_URL;
const MCP = process.env.CLOUDBROWSER_MCP_URL;
const KEY = process.env.CLOUDBROWSER_API_KEY;

async function serpCheck(keyword, stateCode) {
  // 1. Create geo-targeted session via Gateway
  const store = STATE_STORES[stateCode]; // {lat,lng,tz,proxy,store_id}
  const sessRes = await fetch(GATEWAY, {
    method: "POST",
    headers: { "Authorization": `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "/sessions", method: "POST",
      data: {
        viewport: { width: 1920, height: 1080 },
        geolocation: { latitude: store.lat, longitude: store.lng, accuracy: 100 },
        locale: "en-US", timezone: store.tz,
        proxy: store.proxy,
        blocked_resources: ["image", "font", "media"],
        use_pool: true, store_id: store.store_id
      }
    })
  }).then(r => r.json());
  const sessionId = sessRes.control_plane_session_id;

  try {
    // 2. Navigate to Google
    await mcp("browser_navigate", { session_id: sessionId, url: `https://www.google.com/search?q=${encodeURIComponent(keyword)}` });

    // 3. Extract organic results + AI overview
    const organic = await mcp("browser_act", { session_id: sessionId, action_type: "evaluate", options: { fn: SERP_EXTRACT_FN } });
    const aiOverview = await mcp("browser_act", { session_id: sessionId, action_type: "evaluate", options: { fn: AI_OVERVIEW_FN } });

    return { keyword, state: stateCode, organic: organic.result.data, ai_overview: aiOverview.result.data };
  } finally {
    // 4. Always close
    await mcp("browser_end", { session_id: sessionId }).catch(() => {});
  }
}

async function mcp(tool, params) {
  return fetch(MCP, {
    method: "POST",
    headers: { "Authorization": `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ tool, params, api_key: KEY })
  }).then(r => r.json());
}
```

---

## Done. Next actions for the SEO Generator agent:

1. Set the 3 secrets (`CLOUDBROWSER_GATEWAY_URL`, `CLOUDBROWSER_MCP_URL`, `CLOUDBROWSER_API_KEY`).
2. Ask the operator for the CloudBrowser app subdomain and the API key (created in CloudBrowser dashboard).
3. Pre-create 50 Store entities (one per state) in the CloudBrowser dashboard with residential proxies.
4. Implement `serpCheck(keyword, stateCode)` using the pseudocode above.
5. Replace modeled/estimated SERP data with real `serpCheck` calls.
6. Add AI citation checks (Step 7) for ChatGPT/Perplexity/Google AI Overview.
7. Schedule full 50-state scans off-peak with the batching strategy (Step 12).

*Full reference: `docs/SEO_GENERATOR_INTEGRATION_SPEC.md` in the CloudBrowser Control repo.*