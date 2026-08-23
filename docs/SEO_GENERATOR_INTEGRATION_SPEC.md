# CloudBrowser Control → SEO Generator Integration Spec

> **Purpose:** Connect the CloudBrowser Control platform (headless Chrome fleet) to the SEO Generator app so it can perform real-time, headless browser measurements — SERP scraping, rank checking, AI search citation detection, and competitor analysis across all 50 US states.

---

## 1. Connection Details

### API Endpoint

The cloud browser system is a **Base44 backend function** exposed as a public HTTPS endpoint. The gateway function is `cloudBrowserGatewayV6`.

**Public invocation URL:**
```
https://<your-cloudbrowser-app>.base44.app/api/functions/cloudBrowserGatewayV6
```

> Replace `<your-cloudbrowser-app>` with the actual Base44 app subdomain where CloudBrowser Control is deployed. You can find this in the Base44 builder under Settings → Domains, or by checking the app preview URL.

All requests are `POST` with a JSON body. The body contains a virtual `path` and `method` that the gateway routes internally — it is **not** a raw HTTP proxy.

### Authentication

**Method:** Bearer token (API key)

- Keys are prefixed `cb_live_` (production) or `cb_test_` (test).
- Passed as `Authorization: Bearer cb_live_<64hex>` header, OR as `api_key` in the JSON body.
- Keys are SHA-256 hashed at rest; the plaintext is shown **only once** at creation time.

**To create an API key for the SEO Generator app:**
1. Log into the CloudBrowser Control dashboard.
2. Navigate to **Settings → API Keys**.
3. Click "Create API Key", name it "SEO Generator", select scopes:
   - `sessions:read`
   - `sessions:write`
   - `jobs:read`
   - `jobs:write`
4. Bind it to a Project (e.g., "SEO Generator") for tenant isolation.
5. Copy the `cb_live_...` key immediately — it won't be shown again.

### Where the Credential Lives (SEO Generator side)

Store the API key in the SEO Generator app's Base44 secrets:
```
Secret name: CLOUDBROWSER_API_KEY
Value: cb_live_<64hex characters>
```

Also store the gateway URL:
```
Secret name: CLOUDBROWSER_GATEWAY_URL
Value: https://<your-cloudbrowser-app>.base44.app/api/functions/cloudBrowserGatewayV6
```

### Rate Limits

| Limit | Default | Configurable Via |
|---|---|---|
| Requests per minute per API key | 60 | SystemSettings.rate_limit_per_minute |
| Concurrent sessions per project | 10 | SystemSettings.max_concurrent_sessions |
| Concurrent sessions per store | 5 | Store.concurrency_limit |
| Session creation rate per store/min | 20 | Store.session_creation_limit_per_min |
| Max sessions per batch | 20 | Hard limit in gateway |
| Max steps per job | 100 | SystemSettings.max_steps_per_job |
| Max job duration | 30 min | SystemSettings.max_job_duration_min |

Rate-limited responses return HTTP `429` with these headers:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: <epoch seconds>
Retry-After: <seconds>
```

### IP Allowlisting

Optional. If `SystemSettings.ip_allowlist` is populated, only those IPs/CIDRs can access the gateway. If empty (default), any IP can connect. To lock down to the SEO Generator's egress IPs, add them in **Settings → System → IP Allowlist**.

### Network Requirements

- Outbound HTTPS from the SEO Generator to the gateway URL (443).
- The browser engine runs on Railway (or your hosting provider) and is accessed by the gateway — the SEO app never talks to the engine directly.

---

## 2. Browser Session API

### Request a New Browser Session

**Endpoint:** `POST` to gateway URL
**Body:**
```json
{
  "path": "/sessions",
  "method": "POST",
  "data": {
    "viewport": { "width": 1920, "height": 1080 },
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
    "locale": "en-US",
    "timezone": "America/New_York",
    "geolocation": { "latitude": 40.7128, "longitude": -74.0060, "accuracy": 100 },
    "proxy": {
      "server": "http://proxy.example.com:8080",
      "username": "user",
      "password": "pass"
    },
    "headers": { "Accept-Language": "en-US,en;q=0.9" },
    "blocked_resources": ["image", "font", "media"],
    "record_video": false,
    "enable_cdp": false,
    "use_pool": true,
    "cookies": [],
    "storage_state": null,
    "tags": ["serp", "ohio"],
    "store_id": "store-ohio"
  }
}
```

**Response (201):**
```json
{
  "session": {
    "id": "sess_abc123...",
    "session_id": "sess_xyz789...",
    "status": "idle",
    "project_id": "proj_seo_gen",
    "viewport": { "width": 1920, "height": 1080 },
    "started_at": "2026-08-23T16:50:00.000Z",
    "metadata": {
      "worker_id": "worker-1",
      "region": "us-east",
      "engine_version": "3.0.0",
      "expires_at": "2026-08-23T16:55:00.000Z"
    }
  },
  "runtime_session_id": "sess_xyz789...",
  "control_plane_session_id": "sess_abc123...",
  "worker_id": "worker-1",
  "region": "us-east",
  "engine_version": "3.0.0",
  "request_id": "req_...",
  "gateway": "cloudBrowserGatewayV6"
}
```

> **Two IDs are returned:** `control_plane_session_id` (the Base44 entity ID — use this for all subsequent calls) and `runtime_session_id` (the engine's internal ID — do not use directly).

### Response Format

- **Session ID:** `control_plane_session_id` (string, Base44 entity ID)
- **No WebSocket URL** — this is a REST-only API. Live view is via screenshot polling (see §3).
- CDP endpoint is internal-only and never exposed externally.

### Session Lifetime

- **Default TTL:** 5 minutes (300,000 ms) of inactivity.
- **Keep-alive:** Call `POST /sessions/:id/keepalive` to reset the TTL timer. Recommended every 2-3 minutes for long-running sessions.
- **Hard timeout:** Configurable via `timeout_ms` (default 30,000 ms per action).

### Close/Terminate a Session

**Endpoint:** `POST` to gateway URL
**Body:**
```json
{
  "path": "/sessions/sess_abc123...",
  "method": "DELETE",
  "data": {}
}
```

**Response (200):**
```json
{
  "success": true,
  "runtime_closed": true,
  "close_error": null,
  "request_id": "req_...",
  "gateway": "cloudBrowserGatewayV6"
}
```

> Closing is **idempotent** — calling DELETE on an already-closed session returns success.

### Playwright/Puppeteer Compatibility

- **Not CDP-compatible externally.** The engine uses Playwright internally but exposes a custom REST API.
- **MCP tool surface** (`mcpTools` function) provides a higher-level tool API (browser_start, browser_navigate, browser_act, browser_observe, browser_extract, browser_screenshot) — see §4 and §5.
- For the SEO Generator, the **MCP tool surface** is the recommended integration path because it's simpler and purpose-built for agent-driven browser automation.

---

## 3. Capabilities

### Navigate to a URL and Return Rendered HTML

**Via MCP tool surface (recommended):**
```json
// POST to /api/functions/mcpTools
{
  "tool": "browser_navigate",
  "params": { "session_id": "sess_abc123...", "url": "https://www.google.com/search?q=concrete+polishing+near+me" },
  "api_key": "cb_live_..."
}
```
**Response:**
```json
{
  "url": "https://www.google.com/search?q=concrete+polishing+near+me",
  "title": "concrete polishing near me - Google Search",
  "request_id": "mcp_...",
  "__v": "v5.0.0"
}
```

**To get rendered HTML, use browser_extract:**
```json
{
  "tool": "browser_extract",
  "params": { "session_id": "sess_abc123...", "extract_type": "extract_html", "selector": "body" },
  "api_key": "cb_live_..."
}
```
**Response:**
```json
{ "data": "<div id=\"search\">...</div>", "request_id": "mcp_...", "__v": "v5.0.0" }
```

### Execute JavaScript on the Page

```json
{
  "tool": "browser_act",
  "params": {
    "session_id": "sess_abc123...",
    "action_type": "evaluate",
    "options": { "fn": "() => ({ url: location.href, title: document.title, results: [...document.querySelectorAll('h3')].map(h => h.innerText) })" }
  },
  "api_key": "cb_live_..."
}
```
**Response:**
```json
{
  "result": { "ok": true, "action_type": "evaluate", "data": { "url": "...", "title": "...", "results": ["..."] } },
  "request_id": "mcp_...",
  "__v": "v5.0.0"
}
```

### Take Screenshots

```json
{
  "tool": "browser_screenshot",
  "params": { "session_id": "sess_abc123...", "full_page": false },
  "api_key": "cb_live_..."
}
```
**Response:**
```json
{
  "screenshot_url": "https://media.base44.com/.../mcp_screenshot.png",
  "size": 153684,
  "request_id": "mcp_...",
  "__v": "v5.0.0"
}
```
> Screenshots are uploaded to Base44 file storage and returned as a **URL** (not base64). The URL is publicly accessible for the app's lifetime.

### Set Geographic Location / Proxy Per Session (50-state SERP checks)

**At session creation (via gateway):**
```json
{
  "path": "/sessions",
  "method": "POST",
  "data": {
    "geolocation": { "latitude": 32.7767, "longitude": -96.7970, "accuracy": 100 },
    "locale": "en-US",
    "timezone": "America/Chicago",
    "proxy": {
      "server": "http://tx-residential.proxy.example.com:8080",
      "username": "user",
      "password": "pass"
    }
  }
}
```

**Per-state configuration table (examples):**

| State | Latitude | Longitude | Timezone | Locale |
|---|---|---|---|---|
| TX | 32.7767 | -96.7970 | America/Chicago | en-US |
| CA | 34.0522 | -118.2437 | America/Los_Angeles | en-US |
| NY | 40.7128 | -74.0060 | America/New_York | en-US |
| OH | 39.9612 | -82.9982 | America/New_York | en-US |
| FL | 25.7617 | -80.1918 | America/New_York | en-US |

> **Critical for SERP scraping:** Google personalizes results by geolocation + IP. For accurate 50-state rank checking, you must set BOTH `geolocation` AND a proxy with an IP in (or near) the target state. Geolocation alone is not sufficient — Google checks the TCP source IP.

### Set User-Agent / Device Type (Mobile vs Desktop SERPs)

**Desktop SERP:**
```json
{
  "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "viewport": { "width": 1920, "height": 1080 }
}
```

**Mobile SERP:**
```json
{
  "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  "viewport": { "width": 390, "height": 844 }
}
```

> The engine applies advanced stealth fingerprinting automatically (WebGL, Canvas, AudioContext, WebRTC, navigator surface) — no additional configuration needed.

### Concurrent Sessions

- **Max concurrent:** 10 per project (default), configurable in SystemSettings.
- **Per-store limit:** 5 (default), configurable per Store entity.
- **Batch creation:** Up to 20 sessions in a single `POST /sessions/batch` call.
- **Session pooling:** Enabled by default (`use_pool: true`) — pre-warmed sessions launch in ~200ms instead of ~2s.

### Proxy / Residential IP Support

**Yes — critical for SERP scraping.** Proxies are configured per session at creation time:

```json
{
  "proxy": {
    "server": "http://residential.proxy.example.com:8080",
    "username": "state-tx-session-abc",
    "password": "pass"
  }
}
```

**Proxy rotation:** Create Proxy entities in the dashboard with a `rotation_group`, and the engine will round-robin across them. You can also pass a `proxyPool` array for per-session rotation.

**Supported protocols:** HTTP, HTTPS, SOCKS5.

> **Recommendation for 50-state SERP checks:** Use a residential proxy provider (e.g., Bright Data, Smartproxy, Oxylabs) with state-level targeting. Create one Store entity per state with its proxy pre-configured, then pass `store_id` at session creation to automatically bind the right proxy + geolocation + timezone.

---

## 4. Example: Scraping a Google SERP

### a) Open a Headless Browser

```json
// POST to /api/functions/mcpTools
{
  "tool": "browser_start",
  "params": {
    "viewport": { "width": 1920, "height": 1080 },
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "use_pool": true
  },
  "api_key": "cb_live_..."
}
```
**Response:**
```json
{
  "session_id": "sess_abc123...",
  "runtime_session_id": "sess_xyz789...",
  "status": "idle",
  "request_id": "mcp_...",
  "__v": "v5.0.0"
}
```

### b) Navigate to Google Search

```json
{
  "tool": "browser_navigate",
  "params": {
    "session_id": "sess_abc123...",
    "url": "https://www.google.com/search?q=concrete+polishing+near+me"
  },
  "api_key": "cb_live_..."
}
```
**Response:**
```json
{
  "url": "https://www.google.com/search?q=concrete+polishing+near+me",
  "title": "concrete polishing near me - Google Search",
  "request_id": "mcp_...",
  "__v": "v5.0.0"
}
```

### c) Set Location to a Specific US State

> **Location must be set at session creation**, not after navigation. For Texas:

```json
// Step a) should be called with these params instead:
{
  "tool": "browser_start",
  "params": {
    "viewport": { "width": 1920, "height": 1080 },
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
    "geolocation": { "latitude": 32.7767, "longitude": -96.7970, "accuracy": 100 },
    "locale": "en-US",
    "timezone": "America/Chicago",
    "proxy": {
      "server": "http://tx-residential.proxy.example.com:8080",
      "username": "user",
      "password": "pass"
    }
  },
  "api_key": "cb_live_..."
}
```

> **Note:** The MCP `browser_start` tool currently passes `viewport` and `userAgent` to the engine but does NOT forward `geolocation`, `locale`, `timezone`, or `proxy`. For full geo-targeting, use the **gateway API** (`cloudBrowserGatewayV6`) to create the session instead of the MCP tool, then use MCP tools for navigation/extraction:

```json
// POST to /api/functions/cloudBrowserGatewayV6
{
  "path": "/sessions",
  "method": "POST",
  "data": {
    "viewport": { "width": 1920, "height": 1080 },
    "geolocation": { "latitude": 32.7767, "longitude": -96.7970, "accuracy": 100 },
    "locale": "en-US",
    "timezone": "America/Chicago",
    "proxy": { "server": "http://tx-residential.proxy.example.com:8080" }
  }
}
// Use the returned control_plane_session_id as session_id for subsequent MCP calls.
```

### d) Extract Organic Results (title, URL, position, domain)

```json
{
  "tool": "browser_act",
  "params": {
    "session_id": "sess_abc123...",
    "action_type": "evaluate",
    "options": {
      "fn": "() => { const results = []; document.querySelectorAll('#search .g').forEach((el, i) => { const titleEl = el.querySelector('h3'); const linkEl = el.querySelector('a[href]'); if (titleEl && linkEl) { const url = linkEl.href; results.push({ position: i + 1, title: titleEl.innerText, url: url, domain: new URL(url).hostname }); } }); return results; }"
    }
  },
  "api_key": "cb_live_..."
}
```
**Response:**
```json
{
  "result": {
    "ok": true,
    "action_type": "evaluate",
    "data": [
      { "position": 1, "title": "Top Concrete Polishing Services in Dallas, TX", "url": "https://www.example1.com/dallas", "domain": "example1.com" },
      { "position": 2, "title": "Professional Concrete Polishing - Houston", "url": "https://www.example2.com/houston", "domain": "example2.com" },
      { "position": 3, "title": "Concrete Polishing Near You - Yelp", "url": "https://www.yelp.com/search?find_concrete+polishing", "domain": "yelp.com" }
    ]
  },
  "request_id": "mcp_...",
  "__v": "v5.0.0"
}
```

### e) Extract AI Overview Content (if present)

```json
{
  "tool": "browser_act",
  "params": {
    "session_id": "sess_abc123...",
    "action_type": "evaluate",
    "options": {
      "fn": "() => { const overview = document.querySelector('[data-ved] .LGOjhe, .IZ6rId, .zXz7ue'); if (!overview) return { has_ai_overview: false }; const text = overview.innerText; const links = [...overview.querySelectorAll('a[href]')].map(a => a.href); return { has_ai_overview: true, text: text, cited_urls: links, cited_domains: links.map(u => { try { return new URL(u).hostname; } catch { return null; } }).filter(Boolean) }; }"
    }
  },
  "api_key": "cb_live_..."
}
```
**Response:**
```json
{
  "result": {
    "ok": true,
    "action_type": "evaluate",
    "data": {
      "has_ai_overview": true,
      "text": "Concrete polishing is a multi-step process that involves grinding and polishing concrete floors to achieve a smooth, glossy finish...",
      "cited_urls": ["https://www.concretepolishingassociation.org/what-is", "https://www.angi.com/articles/concrete-polishing.htm"],
      "cited_domains": ["concretepolishingassociation.org", "angi.com"]
    }
  },
  "request_id": "mcp_...",
  "__v": "v5.0.0"
}
```

### f) Close the Session

```json
{
  "tool": "browser_end",
  "params": { "session_id": "sess_abc123..." },
  "api_key": "cb_live_..."
}
```
**Response:**
```json
{
  "success": true,
  "session_id": "sess_abc123...",
  "request_id": "mcp_...",
  "__v": "v5.0.0"
}
```

---

## 5. Example: Checking AI Search Citations

### a) Open ChatGPT / Perplexity / Google AI Overview

**For ChatGPT:**
```json
{
  "tool": "browser_start",
  "params": {
    "viewport": { "width": 1280, "height": 800 },
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36..."
  },
  "api_key": "cb_live_..."
}
```
Then navigate:
```json
{
  "tool": "browser_navigate",
  "params": { "session_id": "sess_abc123...", "url": "https://chat.openai.com" },
  "api_key": "cb_live_..."
}
```

**For Perplexity:**
```json
{
  "tool": "browser_navigate",
  "params": { "session_id": "sess_abc123...", "url": "https://www.perplexity.ai" },
  "api_key": "cb_live_..."
}
```

### b) Submit a Prompt

```json
{
  "tool": "browser_act",
  "params": {
    "session_id": "sess_abc123...",
    "action_type": "fill",
    "selector": "textarea#prompt-textarea, textarea[data-testid='prompt-input'], div[contenteditable='true']",
    "value": "best concrete polishing company in Ohio"
  },
  "api_key": "cb_live_..."
}
```

Then submit (press Enter or click send):
```json
{
  "tool": "browser_act",
  "params": {
    "session_id": "sess_abc123...",
    "action_type": "press",
    "value": "Enter"
  },
  "api_key": "cb_live_..."
}
```

Wait for the response to load:
```json
{
  "tool": "browser_act",
  "params": {
    "session_id": "sess_abc123...",
    "action_type": "wait_for_timeout",
    "value": "10000"
  },
  "api_key": "cb_live_..."
}
```

### c) Extract Response Text and Cited URLs

```json
{
  "tool": "browser_act",
  "params": {
    "session_id": "sess_abc123...",
    "action_type": "evaluate",
    "options": {
      "fn": "() => { const responseEl = document.querySelector('[data-testid=\"conversation-turn-2\"], .prose, .markdown'); const text = responseEl ? responseEl.innerText : document.body.innerText; const links = [...document.querySelectorAll('a[href]')].map(a => a.href).filter(u => !u.includes('openai.com') && !u.includes('perplexity.ai')); return { response_text: text.slice(0, 5000), cited_urls: links, cited_domains: [...new Set(links.map(u => { try { return new URL(u).hostname; } catch { return null; } }).filter(Boolean))] }; }"
    }
  },
  "api_key": "cb_live_..."
}
```
**Response:**
```json
{
  "result": {
    "ok": true,
    "data": {
      "response_text": "Based on my research, several concrete polishing companies in Ohio stand out...",
      "cited_urls": ["https://www.ohioconcretepolishing.com", "https://www.clevelandconcrete.com"],
      "cited_domains": ["ohioconcretepolishing.com", "clevelandconcrete.com"]
    }
  },
  "request_id": "mcp_...",
  "__v": "v5.0.0"
}
```

### d) Determine if a Specific Domain Was Cited

```json
{
  "tool": "browser_act",
  "params": {
    "session_id": "sess_abc123...",
    "action_type": "evaluate",
    "options": {
      "fn": "() => { const targetDomain = 'ohioconcretepolishing.com'; const allLinks = [...document.querySelectorAll('a[href]')].map(a => a.href); const cited = allLinks.some(u => { try { return new URL(u).hostname.includes(targetDomain); } catch { return false; } }); return { target_domain: targetDomain, is_cited: cited, matching_urls: allLinks.filter(u => { try { return new URL(u).hostname.includes(targetDomain); } catch { return false; } }) }; }"
    }
  },
  "api_key": "cb_live_..."
}
```
**Response:**
```json
{
  "result": {
    "ok": true,
    "data": {
      "target_domain": "ohioconcretepolishing.com",
      "is_cited": true,
      "matching_urls": ["https://www.ohioconcretepolishing.com/services"]
    }
  },
  "request_id": "mcp_...",
  "__v": "v5.0.0"
}
```

### Close the Session
```json
{
  "tool": "browser_end",
  "params": { "session_id": "sess_abc123..." },
  "api_key": "cb_live_..."
}
```

---

## 6. Cost & Scaling

### Cost Per Session / Per Request / Per Minute

| Resource | Rate | Unit |
|---|---|---|
| Browser compute | $0.005 | per minute |
| LLM (AI extract) | $0.02 | per call |
| File storage | $0.02 | per GB / month |
| Proxy bandwidth | $2.00 | per GB |

**Typical SERP scrape cost:**
- 1 query = ~15 seconds = 0.25 min × $0.005 = **$0.00125**
- With proxy: ~0.5 MB bandwidth = 0.0005 GB × $2.00 = **$0.001**
- **Total per SERP check: ~$0.002**

**Typical AI citation check:**
- 1 query = ~30 seconds = 0.5 min × $0.005 = **$0.0025**
- With proxy: ~1 MB bandwidth = 0.001 GB × $2.00 = **$0.002**
- **Total per AI citation check: ~$0.005**

### Free Tier / Included Quota

No free tier — costs are usage-based and tracked per job in the `CostEntry` entity. Budgets and alerts can be configured in **Settings → Costs**.

### Scale: 200 queries × 50 states = 10,000 checks per run

| Metric | Value |
|---|---|
| Total cost per full run | ~$20–$50 (SERP) or ~$50–$100 (AI citations) |
| Wall-clock time (sequential) | ~4 hours (10,000 × 1.5s avg) |
| Wall-clock time (10 concurrent) | ~25 minutes |
| Wall-clock time (max concurrency, 10 per project) | ~25 minutes (need 10+ projects for full parallelism) |

### Recommended Batching Strategy

1. **Create one Project per client** (for tenant isolation + per-project concurrency).
2. **Create one Store per state** (50 stores) with the state's proxy, geolocation, timezone, and locale pre-configured.
3. **Use batch session creation** (`POST /sessions/batch`) to create up to 20 sessions at once.
4. **Pipeline execution:** Create sessions in batches of 10 (max concurrent per project), execute SERP scrape, close, then create the next batch.
5. **Use session pooling** (`use_pool: true`) — pre-warmed sessions eliminate ~2s cold start per session.
6. **Schedule off-peak:** Run full 50-state scans at 3 AM ET to avoid Google rate-limiting and reduce proxy costs.
7. **Throttle per state:** Max 20 session creations per minute per store (enforced automatically via `Store.session_creation_limit_per_min`).

**Pseudocode for the SEO Generator's scheduling loop:**
```javascript
for (const client of clients) {           // e.g., 200 clients
  for (const state of states) {            // 50 states
    const session = await createSession({
      store_id: `store-${state.code}`,     // pre-configured proxy + geo
      project_id: client.project_id,       // per-client isolation
      viewport: { width: 1920, height: 1080 },
      use_pool: true
    });
    const results = await scrapeSERP(session.id, client.keywords);
    await closeSession(session.id);
    // Rate limit: 20 sessions/min per store — engine enforces this
  }
}
```

---

## 7. Error Handling

### Error Response Format

All errors return JSON with this structure:
```json
{
  "error": "Human-readable error message",
  "request_id": "req_abc123...",
  "__v": "v5.0.0",
  "gateway": "cloudBrowserGatewayV6"
}
```

HTTP status codes:
| Code | Meaning |
|---|---|
| 400 | Bad request (missing/invalid params) |
| 401 | Missing or invalid API key |
| 403 | IP not allowlisted, or insufficient scope |
| 404 | Session/job/route not found |
| 429 | Rate limit or concurrency quota exceeded |
| 500 | Internal server error |
| 502 | Engine communication failure (upstream) |
| 503 | Engine not configured or max sessions reached |

### Common Failure Modes

| Failure | Cause | Detection | Recovery |
|---|---|---|---|
| **Timeout** | Page didn't load within `timeout_ms` | `error.message` contains "timeout" | Retry with longer timeout or different proxy |
| **CAPTCHA** | Google detects bot behavior | `error.message` contains "captcha" or page has CAPTCHA element | Use `solve_captcha` action (requires CAPTCHA solver API key), or rotate proxy |
| **Rate limit (429)** | Too many requests per minute | HTTP 429 + `X-RateLimit-Remaining: 0` | Exponential backoff, respect `Retry-After` header |
| **Concurrency limit (429)** | Too many concurrent sessions | HTTP 429 + `error` contains "concurrency" | Wait for a session to close, then retry |
| **Engine unreachable (502/503)** | Engine down or overloaded | HTTP 502/503 | Retry with exponential backoff (3 attempts, 1s/2s/4s) |
| **Session expired** | TTL exceeded without keep-alive | 404 on session action | Create a new session |
| **Proxy failure** | Proxy is down or returns 407 | `error.message` contains "proxy" | Rotate to a different proxy in the rotation group |
| **Block/ban** | Google returns 429 or CAPTCHA page | Page content contains "unusual traffic" | Rotate proxy + user-agent, add delay between requests |

### Retry Strategy Recommendations

```javascript
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000;

async function withRetry(fn, stepName) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isTransient = err.message.includes("timeout") ||
        err.message.includes("502") || err.message.includes("503") ||
        err.message.includes("network") || err.message.includes("ECONNRESET");
      if (attempt < MAX_RETRIES && isTransient) {
        const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt) + Math.random() * 500;
        await new Promise(r => setTimeout(r, backoff));
        continue;
      }
      throw err;
    }
  }
}
```

> The cloud browser system already applies this retry internally for job execution. For direct session API calls from the SEO Generator, apply the same pattern.

**SERP-specific retry rules:**
- On CAPTCHA: rotate proxy + user-agent before retrying.
- On 429 from Google: wait 60–120 seconds, then retry with a different session.
- On "unusual traffic" page: stop scraping that keyword for 1 hour; rotate proxy.

---

## 8. Security Notes

### Publicly Accessible vs Internal Only

- The gateway is **publicly accessible** via HTTPS (Base44 function URL).
- Access is controlled by API key authentication + optional IP allowlist.
- The browser engine itself (Railway) is **internal only** — not directly accessible from the internet. Only the gateway function can reach it, using an API key stored in the encrypted secrets vault (`ENGINE_API_KEY`).

### Data Residency / Compliance

- Browser sessions run on Railway in the configured region (default: `us-east`).
- Screenshots and artifacts are stored in Base44 file storage (US).
- Session data (cookies, storage state) is encrypted at rest with AES-GCM (`ENCRYPTION_KEY`).
- No PII is logged in audit logs (only action types, entity IDs, and timestamps).
- Webhook signing secrets and proxy passwords are encrypted at rest — never returned in API responses (only `has_secret` / `has_password` boolean flags).

### Safe Requests to Google Without IP Bans

**Yes, with proper configuration:**

1. **Residential proxies:** Use residential proxy IPs (not datacenter) for all Google requests. Datacenter IPs are flagged within 10–20 requests.
2. **Per-state proxy rotation:** Rotate proxies per state to distribute the load.
3. **Advanced stealth:** The engine applies realistic browser fingerprinting automatically — WebGL vendor/renderer, Canvas noise, AudioContext, WebRTC IP leak prevention, navigator surface (hardwareConcurrency, deviceMemory, platform, plugins).
4. **Rate limiting:** The engine enforces per-store session creation limits (default 20/min) and per-project concurrency (default 10). Don't bypass these.
5. **Human-like delays:** Add `wait_for_timeout` steps (2–5 seconds) between page loads. Don't scrape at maximum speed.
6. **CAPTCHA solving:** If a CAPTCHA appears, the engine supports multi-provider solving (2captcha, anti-captcha, capmonster) for reCAPTCHA v2/v3, hCaptcha, Turnstile, and FunCaptcha. Configure `CAPTCHA_SOLVER_API_KEY` in the cloud browser system's secrets.
7. **Blocked resources:** Block images, fonts, and media to reduce bandwidth and appear less like a scraper:
   ```json
   "blocked_resources": ["image", "font", "media"]
   ```

### Tenant Isolation

- The SEO Generator should use a dedicated API key bound to a dedicated Project.
- All sessions, jobs, and results created with that key are scoped to that project.
- The gateway enforces entity-level filtering — the SEO app cannot see or access sessions/jobs from other projects.
- If managing multiple SEO clients, create separate Projects per client and use separate API keys per project.

---

## Appendix: Quick Reference

### MCP Tools Surface (Recommended for SEO Generator)

| Tool | Scope Required | Description |
|---|---|---|
| `browser_start` | `sessions:write` | Create a new browser session |
| `browser_end` | `sessions:write` | Close a session |
| `browser_navigate` | `sessions:write` | Navigate to a URL |
| `browser_act` | `sessions:write` | Execute any browser action (click, type, evaluate, extract, etc.) |
| `browser_observe` | `sessions:read` | Run JavaScript and return page state |
| `browser_extract` | `sessions:read` | Extract text/HTML/attribute/table/JSON |
| `browser_screenshot` | `sessions:read` | Take a screenshot (returns URL) |
| `browser_list_tabs` | `sessions:read` | List open tabs |
| `browser_switch_tab` | `sessions:write` | Switch to a specific tab |
| `context_create` | `sessions:write` | Create a persistent browser context (cookies + storage) |
| `context_use` | `sessions:read` | Lease a context for a session |
| `context_delete` | `sessions:write` | Delete a context |
| `artifact_get` | `sessions:read` | Retrieve artifact metadata |

### Gateway REST Routes (for advanced use)

| Method | Path | Scope | Description |
|---|---|---|---|
| GET | /health | none | Health check |
| POST | /sessions | sessions:write | Create session (full geo/proxy config) |
| POST | /sessions/batch | sessions:write | Create up to 20 sessions |
| GET | /sessions | sessions:read | List sessions (project-scoped) |
| GET | /sessions/:id | sessions:read | Get session details |
| POST | /sessions/:id/action | sessions:write | Execute a browser action |
| POST | /sessions/:id/keepalive | sessions:write | Extend session TTL |
| GET | /sessions/:id/cookies | sessions:read | Export cookies |
| POST | /sessions/:id/cookies | sessions:write | Import cookies |
| GET | /sessions/:id/screenshot | sessions:read | Take screenshot (returns base64) |
| DELETE | /sessions/:id | sessions:write | Close session |
| POST | /jobs | jobs:write | Create a multi-step job |
| POST | /jobs/:id/run | jobs:write | Execute a job (async, returns 202) |
| GET | /jobs/:id | jobs:read | Get job status |
| GET | /jobs/:id/results | jobs:read | Get job results |
| GET | /projects | projects:read | List projects |

### Supported Browser Action Types

`goto`, `back`, `forward`, `reload`, `wait_for_selector`, `wait_for_load_state`, `wait_for_timeout`, `click`, `hover`, `type`, `fill`, `press`, `select_option`, `scroll`, `drag_and_drop`, `upload_file`, `download`, `handle_dialog`, `new_tab`, `switch_tab`, `close_tab`, `frame_switch`, `screenshot`, `pdf`, `extract_text`, `extract_html`, `extract_attribute`, `extract_table`, `extract_json`, `ai_extract`, `evaluate`, `set_cookies`, `import_cookies`, `export_cookies`, `set_headers`, `set_local_storage`, `capture_response`, `solve_captcha`, `mock_response`, `save_state`, `restore_state`, `crawl`, `paginate`

---

*Document generated: 2026-08-23 | CloudBrowser Control v5.0.0 | Deployment version: v5.0.0*