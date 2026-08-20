# CloudBrowser Control — V1.1 Production Fortress Audit

**Audit Type:** Read-only security, reliability, infrastructure, and software-supply-chain audit.
**V1.0 Frozen Release (rollback baseline):** `2d8deadeedb35aa110bdd49f1d93a13f5d56b2a9`
**Audit Date:** 2026-08-19
**Auditor:** Base44 (automated static + architectural review)
**Scope:** All V1.0 source, backend functions, shared modules, browser engine, CI, entities/RLS, secrets handling, integrations.

> **Governance:** No production mutations were performed during this audit. No
> source, schema, RLS, workflow, CI, secret, or deployment changes were made.
> V1.0 remains the known-good rollback release. All findings below are
> recommendations for operator approval before any V1.1 implementation.

---

## Amendments Addendum (Operator-Authorized V1.1 Boundary)

The following amendments are incorporated into this control document before any
V1.1 coding begins. They refine, expand, and reclassify findings per the
operator's authorized boundary. Where an amendment conflicts with the original
finding text below, the amendment controls.

**AM-1 — F-01 Reclassification.** F-01 is reclassified as **unrestricted
browser-context code execution / authorization failure**, NOT host-level Node.js
RCE. The `evaluate` action executes JavaScript inside the Chromium page context
(sandboxed to the page origin), not in the Node.js engine process. The risk is
unauthorized arbitrary code execution within the browser context (DOM/credential
access, page-side network requests) due to insufficient scope granularity —
not operating-system command execution. Classification remains CRITICAL for
authorization impact, but the blast radius is the browser context, not the host.

**AM-2 — SSRF Hardening Expansion.** SSRF hardening (F-02, F-03) is expanded to
cover, at minimum: (a) DNS resolution at validation time; (b) DNS-rebinding
protection (resolved-IP check + IP pinning where supported); (c) HTTP redirect
chain re-validation; (d) browser subresource requests (images, scripts, fonts,
iframes, XHR/fetch initiated by page content); (e) iframe/resource requests;
(f) page-side `fetch`/`XHR` egress; (g) IPv4 private/reserved ranges
(RFC1918, CGNAT 100.64/10, 0/8, 127/8, 224/4); (h) IPv6 private/reserved ranges
(fc/fd, fe80/10, ::1, ::); (i) cloud metadata endpoints
(169.254.169.254, metadata.google.internal, fd00:ec2::254); (j) loopback and
link-local; (k) network-layer egress enforcement where the platform (Railway)
supports it. A shared resolved-IP allowlist is the authoritative check.

**AM-3 — CORS Fail-Closed.** The engine CORS policy must fail closed: an empty
or unconfigured `CORS_ALLOWLIST` must NOT permit arbitrary browser Origins. The
current behavior (`!origin || CORS_ALLOWLIST.length === 0 || includes(origin)`)
allows all origins when the allowlist is empty. New behavior: when the allowlist
is empty, only same-origin (no `Origin` header) requests are allowed; any
cross-origin request is rejected. (New finding F-31.)

**AM-4 — Dangerous-Action Capability Authorization.** Capability controls are
expanded beyond `evaluate` to cover all privileged browser-state and
resource actions. Each requires a distinct capability scope, enforced at the
gateway and MCP layer:
- `evaluate` / `extract_json` (with evaluateFn) / MCP `browser_observe` → `sessions:evaluate`
- cookies/storage (`set_cookies`, `import_cookies`, `export_cookies`, `set_local_storage`, `save_state`, `restore_state`) → `sessions:storage`
- `upload_file` → `sessions:upload`
- `download` → `sessions:download`
- `enable_cdp` / CDP attach → `sessions:cdp`
- proxy configuration on a session → `sessions:proxy`
- `solve_captcha` → `sessions:captcha`
- `mock_response` / network mocking → `sessions:network_mock`
- `crawl` → `sessions:crawl`
A key must hold the specific capability scope; `sessions:write` alone is no
longer sufficient for these actions. (Expands F-01, F-05.)

**AM-5 — Container/Browser Isolation Moved Forward.** Container hardening
(F-29) is moved from P3 into the core Fortress release (P0/P1). The engine
container must run: non-root user; dropped Linux capabilities; `no-new-privileges`;
read-only root filesystem where compatible with Chromium; ephemeral writable
temp storage (tmpfs for `/tmp`, video dir, profile dir); CPU/memory/PID limits;
and the strongest Chromium/container sandbox supported by the Railway runtime.

**AM-6 — P0 Preservation.** All existing P0 findings remain P0: MCP scope
enforcement (F-05), direct-function authorization (F-04), runJob tenant
authorization (F-06), runJob idempotency (F-06), cryptographic tokens (F-07),
caller-supplied path rejection (F-08), context secret non-disclosure (F-09),
and SSRF DNS/redirect hardening (F-02, F-03).

**AM-7 — P1/P2 Preservation.** P1 hardening and essential P2 controls are
preserved: branch protection (F-21), dependency scanning (F-20), SBOM (F-20),
alerting (F-27), DR runbook (F-22), engine timeout (F-12), quotas (F-15),
artifact isolation (F-14), fail-closed webhook behavior (F-17, F-18).

**AM-8 — Fortress Release Matrix Expansion.** The matrix is expanded from 35 to
39 minimum gates by adding: (36) Browser subresource SSRF block; (37) CORS
fail-closed; (38) Dangerous-action capability authorization; (39) Runtime/
container isolation verification. See Part C.

---

## Classification Legend

| Class | Meaning |
|-------|---------|
| CRITICAL | Exploitable for RCE, cross-tenant data access, auth bypass, or secret exfiltration. |
| HIGH | Serious authorization bypass, data exposure, or reliability gap with realistic exploit path. |
| MEDIUM | Correctness, hardening, or defense-in-depth gap with limited or conditional impact. |
| LOW | Minor hygiene or defense-in-depth improvement. |
| HARDENING OPPORTUNITY | Not a defect; improvement to reduce blast radius or improve resilience. |
| ALREADY STRONG | Verified control operating as designed. |

---

## Part A — Findings

### F-01 — CRITICAL: Arbitrary code execution via `evaluate` action with no separate scope

| Field | Value |
|-------|-------|
| Source | `browser-engine/server.js` L604-613; `base44/shared/gatewayCore.ts` L222-252 (route `POST:/sessions/:id/action`); `base44/functions/mcpTools/entry.ts` L127-137 (`browser_observe`) |
| Current behavior | The `evaluate` action takes a user-supplied string (`options.fn` or `value`) and executes `page.evaluate(\`(${fnStr})()\`)` in the live browser context. The gateway route requires only `sessions:write` scope. MCP `browser_observe` passes `params.fn` straight to `evaluate` with no scope check at all. |
| Risk | Any holder of a `sessions:write` API key (or any MCP key, since MCP has no scope enforcement) can execute arbitrary JavaScript inside a browser that has network access, runs `--no-sandbox`, and can navigate to arbitrary URLs. This is effectively remote code execution within the engine's browser sandbox. Combined with F-02 (SSRF), it enables internal network reach from the browser. |
| Attack scenario | A leaked `sessions:write` key → create session → `evaluate` with JS that uses `fetch()` to internal metadata endpoints or exfiltrates data; or `evaluate` to read/modify any page content including auth tokens in the DOM. |
| Recommended architecture | Introduce a distinct capability scope `sessions:evaluate` (or `browser:eval`) required for `evaluate`, `extract_json` (when `evaluateFn` is used), and MCP `browser_observe`. Default API keys should NOT include this scope. MCP must enforce scopes per tool. |
| Minimum safe fix | Add `sessions:evaluate` scope to `ROUTE_SCOPES` for the evaluate action_type (gateway-side action-type allowlist), and reject `evaluate` when the key lacks it. Add scope checks to `mcpTools`. |
| Maximum-strength fix | Sandbox evaluate via a restricted JS subset or a separate hardened worker; per-tenant evaluate allowlist flag; audit-log every evaluate call with full source; rate-limit evaluate separately. |
| Required tests | (1) Key without `sessions:evaluate` → evaluate returns 403. (2) Key with scope → evaluate succeeds. (3) MCP key without scope → browser_observe returns 403. (4) Audit log records evaluate invocations. |
| Rollback | Revert gateway scope map to V1.0; redeploy. |
| Target | V1.1 |
| Production mutation required | Yes (gateway + mcpTools function source redeploy; no schema change — scopes are free-text strings). |

---

### F-02 — CRITICAL: SSRF guard is hostname-string-based (DNS rebinding / TOCTOU)

| Field | Value |
|-------|-------|
| Source | `browser-engine/server.js` L101-134 (`isBlockedHost`, `validateTargetUrl`); `base44/functions/triggerWebhook/entry.ts` L19-39 (`isBlockedUrl`) |
| Current behavior | SSRF protection checks the *hostname string* against a blocklist of literal private IPs and `.internal`/`.local` suffixes. It does NOT resolve the hostname to an IP before deciding. The actual DNS resolution happens later inside Chromium/`fetch`, creating a time-of-check-to-time-of-use (TOCTOU) gap. |
| Risk | An attacker who can supply a target URL (job `start_url`, `goto` value, webhook `url`, crawl start) can use a DNS-rebinding domain that alternates between a public IP (passing the check) and `169.254.169.254` / `127.0.0.1` / `10.x` (reached at connection time). This defeats the SSRF guard and allows access to cloud metadata endpoints, internal services, and the engine's loopback. |
| Attack scenario | Register a domain with a low TTL A record that flips between a public IP and `169.254.169.254`. Submit it as a job `start_url`. Engine's `validateTargetUrl` sees the public IP resolution (or no resolution — it only checks the string), allows it; Chromium resolves to the metadata IP and fetches `http://169.254.169.254/latest/meta-data/iam/security-credentials/`. |
| Recommended architecture | Resolve the hostname to IP(s) at validation time, block if any resolved IP is private/loopback/metadata, and pin the resolved IP for the connection (or use a DNS-resolving proxy that rejects rebinding). Apply the same resolved-IP check to outbound webhook URLs and the `ENGINE_URL` setting. |
| Minimum safe fix | In `validateTargetUrl` and `isBlockedUrl`, perform `dns.lookup(hostname, { all: true })` and reject if any resolved address is private/loopback/metadata/link-local. Re-check after redirects (see F-03). |
| Maximum-strength fix | Egress firewall policy at the network layer (egress allowlist to public CIDRs only, deny RFC1918/CGNAT/link-local/metadata at the container/network boundary) so even a rebinding bypass is blocked at L3. Pin resolved IPs in the Chromium route. |
| Required tests | (1) Submit a rebinding-style domain resolving to 169.254.169.254 → rejected. (2) Submit `http://127.0.0.1` → rejected (current passes). (3) Submit a domain that resolves to a public IP then re-resolves to private → rejected. (4) Webhook URL resolving to private IP → blocked. |
| Rollback | Revert to string-based guard. |
| Target | V1.1 |
| Production mutation required | Yes (engine source + redeploy; triggerWebhook source + redeploy). |

---

### F-03 — HIGH: Redirect handling does not re-validate SSRF on intermediate redirects

| Field | Value |
|-------|-------|
| Source | `browser-engine/server.js` L543 (`goto` with `waitUntil: domcontentloaded` — follows redirects by default); crawl L269 |
| Current behavior | `page.goto` follows HTTP 3xx redirects automatically. The SSRF check runs only on the *initial* URL. A public URL that 302-redirects to `http://169.254.169.254/` is followed without re-validation. |
| Risk | Even without DNS rebinding, a benign-looking start URL can redirect to an internal target. |
| Attack scenario | Attacker hosts a page at `https://evil.com/redirect` that returns `302 → http://169.254.169.254/...`. Job navigates there; engine follows the redirect to metadata. |
| Recommended architecture | Intercept navigation responses; on any redirect, re-run `validateTargetUrl` against the `Location` header target before following. |
| Minimum safe fix | Add a `page.on("framenavigated")` / response handler that validates `response.url()` and `response.headers().location` for redirect chains; abort navigation if blocked. |
| Maximum-strength fix | Network-layer egress allowlist (same as F-02 maximum). |
| Required tests | (1) Start URL that 302-redirects to 169.254.169.254 → blocked. (2) Multi-hop redirect to private IP → blocked. (3) Legitimate same-site redirect → allowed. |
| Rollback | Revert handler. |
| Target | V1.1 |
| Production mutation required | Yes (engine source + redeploy). |

---

### F-04 — HIGH: Direct function invocation bypasses gateway scope model + RLS (asServiceRole)

| Field | Value |
|-------|-------|
| Source | `base44/functions/saveProxy/entry.ts`, `saveWebhook/entry.ts`, `saveProfile/entry.ts`, `createApiKey/entry.ts`, `createProject/entry.ts`, `runJob/entry.ts`, `mcpTools/entry.ts` |
| Current behavior | These functions call `base44.asServiceRole.entities.*` (which bypasses RLS) without first verifying the caller's role. Any authenticated app user invoking the function directly (not through the gateway) can create/update/delete proxies, webhooks, profiles, API keys, and projects, and run any job by ID — regardless of ownership or project binding. The gateway enforces API-key scopes, but the functions are independently invocable HTTP endpoints. |
| Risk | Authorization bypass. A regular (non-admin) app user, or any holder of a session JWT, can manage infrastructure resources and trigger cross-tenant job execution without an API key. |
| Attack scenario | Authenticated non-admin user POSTs to `/functions/saveProxy` with `asServiceRole` → creates a proxy visible only to admins (RLS read) but the create succeeds. Or POSTs to `/functions/runJob` with another tenant's `jobId` → runs it. |
| Recommended architecture | Every privileged function must verify `base44.auth.me()` role at the top and reject non-admins for admin-only operations, OR be restricted to invocation only via the gateway (not directly). `runJob` must verify the caller's project matches the job's `project_id`. |
| Minimum safe fix | Add `const user = await base44.auth.me(); if (user.role !== 'admin') return 403;` at the top of saveProxy, saveWebhook, saveProfile, createApiKey, createProject. For runJob, require the caller to be admin OR the job's `created_by_id`/`project_id` to match. |
| Maximum-strength fix | Move all privileged operations behind the gateway exclusively; remove direct function exposure for admin functions (platform-level route guard). Add per-function authorization policies enforced by the platform. |
| Required tests | (1) Non-admin user → saveProxy returns 403. (2) Non-admin → runJob on another tenant's job → 403. (3) Admin → succeeds. (4) Gateway path still works. |
| Rollback | Remove role checks. |
| Target | V1.1 |
| Production mutation required | Yes (function source + redeploy; no schema change). |

---

### F-05 — HIGH: MCP tools have no scope enforcement

| Field | Value |
|-------|-------|
| Source | `base44/functions/mcpTools/entry.ts` L31-48 |
| Current behavior | `mcpTools` authenticates the API key and checks active/expiry, but never inspects `keyRecord.scopes`. Every tool (`browser_start`, `browser_act`, `browser_observe` [→ evaluate], `context_create`, `context_use`, `artifact_get`) is available to any valid API key regardless of its scopes. |
| Risk | A key provisioned with only `results:read` can start sessions, execute actions, run arbitrary JS via `browser_observe`, and create/use contexts. This collapses the least-privilege model for MCP. |
| Attack scenario | A read-only analytics key is leaked → attacker uses it via MCP to run `browser_observe` with arbitrary JS (F-01) and exfiltrate data. |
| Recommended architecture | Define a `MCP_TOOL_SCOPES` map (tool → required scope) and enforce it after auth. `browser_*` → `sessions:write`; `context_*` → `contexts:write`; `artifact_get` → `artifacts:read`; `browser_observe`/evaluate → `sessions:evaluate`. |
| Minimum safe fix | Add a scope map and check `keyRecord.scopes.includes(required)` per tool; return 403 if missing. |
| Maximum-strength fix | Same as F-01 maximum; plus per-tool audit with full params, and rate limits per tool. |
| Required tests | (1) Key without `sessions:write` → browser_start 403. (2) Key without `sessions:evaluate` → browser_observe 403. (3) Key with scopes → succeeds. |
| Rollback | Remove scope map. |
| Target | V1.1 |
| Production mutation required | Yes (mcpTools source + redeploy). |

---

### F-06 — HIGH: `runJob` has no tenant authorization and no idempotency

| Field | Value |
|-------|-------|
| Source | `base44/functions/runJob/entry.ts` L40-42 (`Job.get(jobId)` with no project check); `base44/functions/receiveWebhook/entry.ts` L92-95 (attacker-supplied `job_id` run after any webhook signature validates) |
| Current behavior | `runJob` loads the job by ID via `asServiceRole` and executes it without verifying the caller's project or ownership. `receiveWebhook` runs `runJob` with the `job_id` from the request body once *any* active webhook's signature matches — the `job_id` is not scoped to the verified webhook's project. `runJob` has no idempotency key, so duplicate invocations create duplicate sessions and results. |
| Risk | Cross-tenant job execution: a caller who can invoke `runJob` directly, or who knows any webhook signing secret, can run any job in any project. Duplicate execution wastes compute and can produce duplicate artifacts/results. |
| Attack scenario | (a) Direct: non-admin invokes `/functions/runJob` with another tenant's `jobId`. (b) Webhook: attacker with one tenant's webhook secret submits a forged request with a different tenant's `job_id` → runs it. |
| Recommended architecture | `runJob` must accept a `project_id` / `api_key` context and verify `job.project_id === caller.project_id`. `receiveWebhook` must verify that the `job_id` belongs to the same project as the verified webhook (add `project_id` to Webhook entity and match). Add an `idempotency_key` parameter to `runJob` that short-circuits if the job is already running/completed for that key. |
| Minimum safe fix | Add project check in `runJob`; add `project_id` to Webhook and match in `receiveWebhook`; add `idempotency_key` to `runJob` (reject if job status is already `running`). |
| Maximum-strength fix | Per-tenant webhook secrets (one secret per webhook, never shared across tenants); idempotency store (see F-07) backed by database unique constraint on `(job_id, idempotency_key)`. |
| Required tests | (1) runJob with mismatched project → 403. (2) receiveWebhook with job_id from different project than verified webhook → 403. (3) Duplicate runJob with same idempotency_key → second returns 409/skipped. |
| Rollback | Remove checks. |
| Target | V1.1 |
| Production mutation required | Yes (runJob + receiveWebhook source + redeploy; Webhook schema gains `project_id` field — minor schema addition, backward compatible). |

---

### F-07 — HIGH: Non-cryptographic tokens (session IDs, share tokens, state tokens)

| Field | Value |
|-------|-------|
| Source | `browser-engine/server.js` L148 (`uid`), L624 (`stateToken`), L682 (`shareToken`) |
| Current behavior | All tokens use `Math.random().toString(36)`, which is not cryptographically secure and is predictable in some runtimes. Session IDs, share tokens (live-view bearer), and save-state tokens are all generated this way. |
| Risk | Share tokens grant live-view access to a browser session without the engine API key. If predictable, an attacker can enumerate share tokens and observe another tenant's live session (data exfiltration). State tokens grant session-state restore. |
| Attack scenario | Attacker observes a share token pattern and brute-forces/enumerates active share tokens to view live sessions of other tenants. |
| Recommended architecture | Use `crypto.randomUUID()` or `crypto.getRandomValues()` for all security-relevant tokens. Share tokens should be long (≥128 bits) and single-use or expiry-bound. |
| Minimum safe fix | Replace `Math.random()` with `crypto.randomUUID()` in `uid`, `stateToken`, `shareToken`. |
| Maximum-strength fix | Share tokens stored server-side with TTL and single-use semantics; rotate on each live-view session; bind to the creating API key's project. |
| Required tests | (1) Token entropy test — confirm ≥128 bits. (2) Share token no longer matches old pattern. (3) Live view rejects expired/revoked share token. |
| Rollback | Revert token generation. |
| Target | V1.1 |
| Production mutation required | Yes (engine source + redeploy). |

---

### F-08 — HIGH: `userDataDir` and extension paths passed unsanitized to the engine

| Field | Value |
|-------|-------|
| Source | `browser-engine/server.js` L419-424 (extensions), L443-444 (`userDataDir`); gateway passes `data.user_data_dir` and `data.extensions` straight through (`gatewayCore.ts` L157, L156) |
| Current behavior | `opts.userDataDir` is passed directly to `chromium.launchPersistentContext` as a filesystem path on the engine host. `opts.extensions` is passed as `--load-extension=<path>` Chrome args. No validation, allowlist, or sandboxing. |
| Risk | Path traversal / arbitrary file access on the engine host via `userDataDir` (e.g., `/etc/`, `/root/`); arbitrary code loaded into the browser via a malicious extension path. A compromised `sessions:write` key can persist data to or read from sensitive host paths. |
| Attack scenario | Attacker sets `user_data_dir: "/tmp/../../root/.ssh"` or loads an extension from a path they control (if they can write files to the engine). |
| Recommended architecture | `userDataDir` must be restricted to a per-session sandboxed directory under a fixed base (e.g., `/data/profiles/<uuid>`), generated by the engine, not supplied by the caller. Extensions must be loaded only from a verified, admin-uploaded extension store (Extension entity), not arbitrary paths. |
| Minimum safe fix | Engine ignores caller-supplied `userDataDir` and generates its own path under a fixed base; reject `extensions` that are not registered Extension IDs. |
| Maximum-strength fix | No caller-supplied filesystem paths reach `chromium` ever; extensions run in a separate sandboxed profile with no host FS access. |
| Required tests | (1) `user_data_dir: "/etc"` → engine ignores/rejects. (2) Extension path traversal → rejected. (3) Legitimate profile dir works. |
| Rollback | Restore passthrough. |
| Target | V1.1 |
| Production mutation required | Yes (engine source + redeploy). |

---

### F-09 — HIGH: `context_use` returns decrypted cookies/storage_state to the caller

| Field | Value |
|-------|-------|
| Source | `base44/functions/mcpTools/entry.ts` L218-227 |
| Current behavior | `context_use` decrypts `cookies_encrypted` and `storage_state_encrypted` and returns the plaintext in the HTTP response to the MCP caller. |
| Risk | Sensitive auth material (session cookies, localStorage tokens) is exposed to the client. If the caller is an MCP client over an untrusted channel, or the response is logged, auth material leaks. |
| Attack scenario | An MCP client with `contexts:write` calls `context_use` and receives another user's decrypted session cookies, then reuses them outside the platform. |
| Recommended architecture | `context_use` should return a lease token and attach the decrypted state directly to the engine session server-side; never return plaintext cookies/storage to the client. The client gets `{ auth_state, lease_expires_at }` only. |
| Minimum safe fix | Remove `cookies` and `storage_state` from the `context_use` response; instead, pass them to the engine in the same call (or return only a lease reference). |
| Maximum-strength fix | Decrypted state never leaves the server; a separate `context_attach` tool passes the lease to an engine session by ID. |
| Required tests | (1) `context_use` response contains no `cookies`/`storage_state` fields. (2) Engine session receives the cookies. (3) Lease is recorded. |
| Rollback | Restore response fields. |
| Target | V1.1 |
| Production mutation required | Yes (mcpTools source + redeploy). |

---

### F-10 — MEDIUM: Rate limiter TOCTOU race and over-counting on rejected requests

| Field | Value |
|-------|-------|
| Source | `base44/shared/gatewayCore.ts` L48-87 (`checkRateLimit`) |
| Current behavior | `$inc` is applied before the limit decision; concurrent requests can both see `updatedCount === 0` and both create rows (then dedup merges). Rejected requests still increment the counter, so a burst of rejected requests inflates the count and extends the effective block window. |
| Risk | Under concurrency, the limit can be slightly exceeded; under a flood, legitimate requests are over-throttled. Not a security bypass, but a correctness/fairness issue. |
| Recommended architecture | Atomic check-and-increment: read current count, decide, then increment only if allowed (or use a Redis `INCR` with a Lua script — V2). For V1.1, accept the race but fix the over-count by decrementing on rejection, or check-before-increment. |
| Minimum safe fix | After rejecting, decrement the count (`$inc: { count: -1 }`) so rejected requests don't penalize the window. |
| Maximum-strength fix | Redis-backed atomic limiter (V2, requires Redis). |
| Required tests | (1) Flood of 100 concurrent requests → allow exactly `limit`, reject the rest, no over-count. (2) Counter returns to 0 after window. |
| Rollback | Revert decrement. |
| Target | V1.1 (minimum fix) / V2 (Redis) |
| Production mutation required | Yes (gatewayCore source + redeploy). |

---

### F-11 — MEDIUM: `deriveClientIP` trusts `X-Forwarded-For` for IP allowlist

| Field | Value |
|-------|-------|
| Source | `base44/shared/gatewayCore.ts` L41-46; `cloudBrowserGatewayV6/entry.ts` L50-56 |
| Current behavior | The first value of `X-Forwarded-For` is trusted as the client IP for the IP allowlist. No edge proxy normalization is enforced. |
| Risk | If IP allowlist is enabled, an attacker can spoof `X-Forwarded-For: <allowlisted-ip>` to bypass it. (Currently the allowlist is empty/disabled per the operations approval packet, so impact is latent.) |
| Recommended architecture | Trust only the *last* untrusted hop from a configured edge proxy, or require the platform to overwrite XFF at the edge. Document that IP allowlist requires a trusted proxy in front of the gateway. |
| Minimum safe fix | Use the rightmost XFF entry from a trusted proxy, or disable IP allowlist by default and warn when enabled. |
| Maximum-strength fix | mTLS or signed proxy headers (e.g., Cloudflare `CF-Connecting-IP` trusted only when `CF-Connecting-IP` secret matches). |
| Required tests | (1) Spoofed XFF with allowlist on → rejected. (2) Legitimate IP → allowed. |
| Rollback | Revert. |
| Target | V1.1 (hardening) |
| Production mutation required | Yes (gatewayCore source + redeploy). |

---

### F-12 — MEDIUM: `engineFetch` has no timeout; hung engine hangs gateway functions

| Field | Value |
|-------|-------|
| Source | `base44/shared/engineClient.ts` L62-80 |
| Current behavior | `engineFetch` uses `fetch` with no `AbortController`/timeout. A slow or hung engine request blocks the gateway function until the platform function timeout. |
| Risk | Engine degradation causes cascading gateway slowness; pool exhaustion; degraded user experience. |
| Recommended architecture | Add an `AbortController` with a configurable timeout (e.g., 30s default, from SystemSettings) to all engine calls. |
| Minimum safe fix | Add `AbortController` + 30s timeout to `engineFetch`. |
| Maximum-strength fix | Per-action timeouts, circuit breaker, and fallback to a degraded-mode response. |
| Required tests | (1) Engine hangs → gateway returns 504 within 30s. (2) Normal call → succeeds. |
| Rollback | Revert. |
| Target | V1.1 |
| Production mutation required | Yes (engineClient source + redeploy of all importing functions). |

---

### F-13 — MEDIUM: Pooled sessions ignore caller's proxy/viewport/headers (functional + SSRF bypass)

| Field | Value |
|-------|-------|
| Source | `browser-engine/server.js` L398-411 (pool path returns pre-warmed session created with default options) |
| Current behavior | When `usePool` is true (default), the engine returns a pre-warmed session that was launched at warmup time with default config (no proxy, default viewport, no headers, no fingerprint). The caller's `proxy`, `viewport`, `headers`, `blockedResources`, and `networkMocks` are silently ignored for pooled sessions. |
| Risk | (a) Functional: callers expecting a proxy get none, so their source IP is the engine's egress IP — defeating proxy-based anonymity and potentially violating data-source TOS. (b) Security: if a caller relies on a proxy for SSRF/egress control, the pooled session bypasses it. |
| Recommended architecture | Either (a) disable pooling when caller-specific options are provided, or (b) apply caller options to the pooled session before returning (reconfigure context). For V1.1, prefer (a): only use pool when no caller-specific options are set. |
| Minimum safe fix | In `POST /sessions`, if `proxy`/`headers`/`viewport`/`blockedResources`/`networkMocks` are provided, bypass the pool and launch a fresh session. |
| Maximum-strength fix | Pool categorized by config profile; reconfigure pooled context on claim. |
| Required tests | (1) Create session with proxy + usePool → egress IP is the proxy, not the engine. (2) Create session with no custom options + usePool → fast pooled path. |
| Rollback | Revert. |
| Target | V1.1 |
| Production mutation required | Yes (engine source + redeploy). |

---

### F-14 — MEDIUM: `artifact_get` allows cross-project access for non-private artifacts

| Field | Value |
|-------|-------|
| Source | `base44/functions/mcpTools/entry.ts` L239-256 |
| Current behavior | Only `access_policy === "private"` artifacts are project-scoped. `project`, `team`, and `public` artifacts are returned to any API key. |
| Risk | If an artifact is misconfigured to `public` or `team` with sensitive content, any key can read its `storage_key` (file URL) and download it. |
| Recommended architecture | Enforce project scoping for `private` and `project` policies; `team` requires team membership; `public` requires no key. Always scope by the key's project unless explicitly `public`. |
| Minimum safe fix | Project-scope `private` and `project` artifacts; only `public` skips the check. |
| Maximum-strength fix | Per-artifact ACL with explicit grant records; signed URLs with short TTL for all downloads. |
| Required tests | (1) Key from project B requests project-A `private` artifact → 403. (2) `public` artifact → allowed. (3) `project` artifact from project B → 403. |
| Rollback | Revert. |
| Target | V1.1 |
| Production mutation required | Yes (mcpTools source + redeploy). |

---

### F-15 — MEDIUM: No per-key concurrency or session quota; no global job duration/step cap enforcement

| Field | Value |
|-------|-------|
| Source | `base44/functions/cloudBrowserGatewayV6/entry.ts` (no concurrency check); `base44/functions/runJob/entry.ts` (no `max_steps_per_job`/`max_job_duration_min` enforcement) |
| Current behavior | Rate limit is per-minute request count only. A single key can open up to `MAX_SESSIONS` (10) concurrent sessions, exhausting capacity for others. `runJob` executes all steps with no global duration cap or step-count enforcement from SystemSettings. |
| Risk | DoS/abuse: one key monopolizes engine capacity; a runaway job with many steps runs indefinitely. |
| Recommended architecture | Per-key concurrent-session limit (from Plan or SystemSettings); enforce `max_steps_per_job` and `max_job_duration_min` in `runJob`. |
| Minimum safe fix | Count active sessions per `project_id`/key in `POST /sessions`; reject if over limit. In `runJob`, cap step count and total elapsed time. |
| Maximum-strength fix | Per-tenant quotas backed by Plan entity; queue with backpressure. |
| Required tests | (1) Key over session quota → 429. (2) Job with > max_steps → rejected/truncated. (3) Job exceeding max_duration → marked failed. |
| Rollback | Revert. |
| Target | V1.1 |
| Production mutation required | Yes (gateway + runJob source + redeploy). |

---

### F-16 — MEDIUM: No per-key spend/budget cap (cost abuse)

| Field | Value |
|-------|-------|
| Source | `base44/shared/costCalculator.ts` (post-hoc only); no pre-execution budget check |
| Current behavior | `calculateJobCost` computes cost after a job completes. No pre-flight or rolling spend limit per API key or project. |
| Risk | A compromised key can run unlimited jobs, accumulating compute/proxy/LLM costs until noticed. |
| Recommended architecture | Per-key/project monthly budget (from Plan or a new Budget entity); pre-flight estimate via `estimateCost` before run; rolling spend check before each job; alert on threshold. |
| Minimum safe fix | Before `runJob`, check rolling monthly spend for the key's project against a configured cap; reject if exceeded. |
| Maximum-strength fix | Hard and soft limits, alerts, auto-deactivate key on hard-limit breach. |
| Required tests | (1) Project over budget → runJob rejected with 402/429. (2) Under budget → runs. (3) Alert fires at 80%. |
| Rollback | Revert. |
| Target | V1.1 (minimum) / V2 (full budgets) |
| Production mutation required | Yes (runJob + new check source + redeploy). |

---

### F-17 — MEDIUM: Legacy plaintext fallback for webhook secrets (downgrade path)

| Field | Value |
|-------|-------|
| Source | `base44/functions/receiveWebhook/entry.ts` L64-67; `base44/functions/triggerWebhook/entry.ts` L78-81 |
| Current behavior | Both functions fall back to `w.secret` (plaintext) if `secret_encrypted` is absent. The schema no longer has a `secret` field, so this is currently dead code, but it's a downgrade path if a plaintext field is ever reintroduced. |
| Risk | Low immediate risk; latent downgrade path. |
| Recommended architecture | Remove the plaintext fallback; require `secret_encrypted` only. Fail-closed if absent. |
| Minimum safe fix | Delete the `else if (w.secret)` branches. |
| Maximum-strength fix | Same. |
| Required tests | (1) Webhook with only plaintext secret → rejected/fails closed. (2) Encrypted secret → works. |
| Rollback | Revert. |
| Target | V1.1 |
| Production mutation required | Yes (function source + redeploy). |

---

### F-18 — MEDIUM: `decrypt` failure silently downgrades webhook signing to unsigned

| Field | Value |
|-------|-------|
| Source | `base44/functions/triggerWebhook/entry.ts` L75-83 |
| Current behavior | If `decrypt(secret_encrypted)` returns `null` (corrupted ciphertext or key mismatch), `signingSecret` is `null`, so `signature` is `null`, and the webhook is delivered *unsigned*. The receiver may accept an unsigned request. |
| Risk | A corrupted encrypted secret silently disables webhook authentication, allowing forged deliveries. |
| Recommended architecture | Fail-closed: if `secret_encrypted` exists but `decrypt` returns `null`, skip the webhook and log an error (do not send unsigned). |
| Minimum safe fix | `if (webhook.secret_encrypted) { signingSecret = await decrypt(...); if (!signingSecret) { log + skip; continue; } }` |
| Maximum-strength fix | Same + alert on decrypt failure. |
| Required tests | (1) Corrupted `secret_encrypted` → webhook skipped, error logged, no unsigned send. |
| Rollback | Revert. |
| Target | V1.1 |
| Production mutation required | Yes (triggerWebhook source + redeploy). |

---

### F-19 — MEDIUM: CDP debugging port open on engine loopback

| Field | Value |
|-------|-------|
| Source | `browser-engine/server.js` L428-432, L492 |
| Current behavior | When `enableCDP` is set, Chrome opens `--remote-debugging-port=<port>` bound to `127.0.0.1`. The `cdpUrl` is not returned to the client (good), but the port is open on the engine's loopback for the session's lifetime. Any process on the engine host (or an SSRF from another browser context) could connect and control the session. |
| Risk | Lateral movement on the engine host; session hijack if another process can reach loopback. |
| Recommended architecture | Disable CDP by default; require an explicit admin flag; bind to a random high port and close it immediately after the debugging client disconnects; or require a CDP auth token. |
| Minimum safe fix | Default `enableCDP` to false (already is); add an admin-only SystemSetting `allow_cdp` that must be true to accept `enable_cdp=true`; close the port on session end. |
| Maximum-strength fix | CDP over a Unix socket with permission bits, not a TCP port. |
| Required tests | (1) `enable_cdp=true` with `allow_cdp=false` → rejected. (2) Port closed after session end. |
| Rollback | Revert. |
| Target | V1.1 |
| Production mutation required | Yes (engine source + redeploy). |

---

### F-20 — MEDIUM: No dependency vulnerability scanning / SBOM / supply-chain provenance in CI

| Field | Value |
|-------|-------|
| Source | `.github/workflows/release-gate.yml` |
| Current behavior | CI runs build, lint, typecheck, engine syntax check, and grep-based secret/SSRF/RLS scans. There is no `npm audit` / Dependabot / Snyk / SBOM generation / SLSA provenance / artifact signing. |
| Risk | Known-vulnerable dependencies ship to production undetected; no verifiable build provenance. |
| Recommended architecture | Add `npm audit --audit-level=high` (or equivalent) to CI; enable Dependabot; generate an SBOM (CycloneDX); publish SLSA build provenance; sign release artifacts. |
| Minimum safe fix | Add `npm audit --audit-level=high` step + Dependabot config. |
| Maximum-strength fix | SLSA Level 3 provenance + cosign artifact signing + reproducible builds. |
| Required tests | (1) CI fails on high-severity advisory. (2) SBOM artifact produced. (3) Provenance attestation exists. |
| Rollback | Remove steps. |
| Target | V1.1 (minimum) / V2 (SLSA) |
| Production mutation required | Yes (CI workflow file — operator commits to `.github/workflows/`). |

---

### F-21 — MEDIUM: No verifiable GitHub branch protection / required-status-check enforcement

| Field | Value |
|-------|-------|
| Source | GitHub repository settings (not readable from this audit, but no evidence of enforcement in-repo) |
| Current behavior | The release-gate workflow runs on push/PR, but there's no in-repo evidence that `main` is protected with required status checks, required reviews, or no-force-push. |
| Risk | A push to `main` bypassing CI could ship unverified code; the release SHA could be rewritten. |
| Recommended architecture | Enforce branch protection on `main`: required status checks (all 4 CI jobs), require PR review, no direct push, no force-push, linear history. |
| Minimum safe fix | Configure GitHub branch protection rules (operator action in GitHub settings). |
| Maximum-strength fix | CODEOWNERS + multiple required reviewers + signed commits required. |
| Required tests | (1) Direct push to `main` → rejected. (2) PR without green CI → cannot merge. |
| Rollback | Loosen rules. |
| Target | V1.1 |
| Production mutation required | No source change; GitHub settings change by operator. |

---

### F-22 — MEDIUM: No backup/restore procedure for entity data (disaster recovery)

| Field | Value |
|-------|-------|
| Source | No backup mechanism documented or implemented |
| Current behavior | Base44 manages the database, but there is no documented export/restore procedure for entities (Sessions, Jobs, Results, Artifacts, ApiKeys, Proxies, Webhooks, Profiles, Settings). |
| Risk | Data loss or prolonged outage if the database is corrupted or unavailable; no tested restore path. |
| Recommended architecture | Document a periodic export (`exportResults` + a new `exportEntities` function) to a durable object store; tested restore procedure; RPO/RTO defined. |
| Minimum safe fix | Document a manual export runbook and schedule a weekly export workflow. |
| Maximum-strength fix | Automated daily export to external storage with restore drills. |
| Required tests | (1) Export produces complete dataset. (2) Restore into a fresh app recovers entities. |
| Rollback | N/A. |
| Target | V1.1 (runbook) / V2 (automation) |
| Production mutation required | No source change for runbook; workflow for automation (V2). |

---

### F-23 — MEDIUM: `asServiceRole.functions.invoke` deployment-drift cache artifact (known)

| Field | Value |
|-------|-------|
| Source | `base44/shared/deploymentVersion.ts`; `docs/RELEASE_RECEIPT_V1.md` (documented) |
| Current behavior | 9 functions report `v4.1.1` via the `asServiceRole.functions.invoke` path due to a platform-level cache artifact, while direct invocation reports `v5.0.0`. `getDeploymentStatus` reports drift via that path. |
| Risk | Deployment integrity verification is unreliable through the asServiceRole path; operators may mistrust drift signals. |
| Recommended architecture | Treat direct-invocation version as source of truth; document the cache artifact; add a platform-level cache invalidation step on deploy. |
| Minimum safe fix | Document the artifact clearly (already done in release receipt); add a drift-detection test that uses direct invocation. |
| Maximum-strength fix | Platform-level fix (outside app control). |
| Required tests | (1) Direct invocation returns `v5.0.0` for all functions. (2) Drift test uses direct path. |
| Rollback | N/A. |
| Target | V1.1 (test) / Platform (fix) |
| Production mutation required | No (test-only). |

---

### F-24 — LOW: `save_state`/`restore_state` use process-local Map (lost on restart, weak token)

| Field | Value |
|-------|-------|
| Source | `browser-engine/server.js` L143 (`savedStates`), L624-625 |
| Current behavior | Saved session state is stored in a process-local `Map` keyed by a `Math.random()` token. Lost on worker restart; not shared across workers. |
| Risk | Session resume fails after a worker restart; token is predictable (F-07). |
| Recommended architecture | Persist state to the control plane (Profile entity, encrypted) or a distributed store (V2). |
| Minimum safe fix | Persist `save_state` output to a Profile/BrowserContext entity (encrypted) instead of a local Map. |
| Maximum-strength fix | Distributed state store (Redis, V2). |
| Required tests | (1) Save state → restart worker → restore succeeds. |
| Rollback | Revert. |
| Target | V1.1 (minimum) / V2 (distributed) |
| Production mutation required | Yes (engine source + redeploy). |

---

### F-25 — LOW: Audit log open-create allows log poisoning

| Field | Value |
|-------|-------|
| Source | `AuditLog` RLS `create: {}` |
| Current behavior | Any authenticated user can create AuditLog records (needed for system logging). A malicious user could insert forged entries. |
| Risk | Audit trail integrity; false attribution. |
| Recommended architecture | Restrict AuditLog creation to service-role/system functions only; or add a `source` field distinguishing system vs user entries. |
| Minimum safe fix | Add `source` field; user-created entries flagged; admin review filters. |
| Maximum-strength fix | Append-only log with hash chaining. |
| Required tests | (1) User-created audit entry flagged as user-sourced. |
| Rollback | Revert. |
| Target | V1.1 (minimum) / V2 (append-only) |
| Production mutation required | Yes (AuditLog schema + source field). |

---

### F-26 — HARDENING: Encryption key derivation has no salt/KDF; no key rotation without full re-encryption

| Field | Value |
|-------|-------|
| Source | `base44/shared/crypto.ts` L9-15 |
| Current behavior | AES-256-GCM key is derived via `SHA-256(ENCRYPTION_KEY)` with no salt and no KDF. All records share the same key. Rotation requires `migrateSecrets` to re-encrypt everything. |
| Risk | If `ENCRYPTION_KEY` leaks, all ciphertexts decrypt; no per-record key separation. |
| Recommended architecture | Use HKDF with a per-record salt (store salt alongside ciphertext); or envelope encryption with a KMS-managed master key. |
| Minimum safe fix | Add HKDF with a stored per-record salt; keep backward-compatible decrypt for legacy records. |
| Maximum-strength fix | KMS-managed master key + envelope encryption (AWS/GCP KMS). |
| Required tests | (1) New records use salted key. (2) Legacy records still decrypt. (3) Rotation re-encrypts with new salt. |
| Rollback | Revert. |
| Target | V1.1 (HKDF) / V2 (KMS) |
| Production mutation required | Yes (crypto.ts source + redeploy + migration). |

---

### F-27 — HARDENING: No structured alerting / incident-response automation

| Field | Value |
|-------|-------|
| Source | `base44/workflows/Governance Heartbeat.jsonc` (logs but doesn't page) |
| Current behavior | Governance Heartbeat checks health and logs, but does not send alerts on engine-down or drift. |
| Risk | Incidents go unnoticed until manual review. |
| Recommended architecture | Add alerting (email/webhook) on engine-down, drift, error-spike, budget-breach. |
| Minimum safe fix | Heartbeat sends a notification on unhealthy status. |
| Maximum-strength fix | PagerDuty/Opsgenie integration with escalation. |
| Required tests | (1) Engine down → alert sent. |
| Rollback | Revert. |
| Target | V1.1 |
| Production mutation required | Yes (workflow edit). |

---

### F-28 — HARDENING: `ENGINE_URL` Setting override has no SSRF/host validation

| Field | Value |
|-------|-------|
| Source | `base44/shared/engineClient.ts` L18-31 |
| Current behavior | The `engine.url` Setting can override `ENGINE_URL`. There's no validation that the URL points to a trusted host. A compromised admin could redirect engine traffic (and leak `ENGINE_API_KEY` via the `x-api-key` header) to an attacker-controlled host. |
| Risk | Engine API key exfiltration via malicious `engine.url`. |
| Recommended architecture | Validate `engine.url` against an allowlist of trusted engine hosts; reject private/loopback hosts; alert on change. |
| Minimum safe fix | Validate `engine.url` host is not private/loopback; log all changes. |
| Maximum-strength fix | Remove the Setting override; require `ENGINE_URL` secret only. |
| Required tests | (1) `engine.url` set to private IP → rejected. (2) Set to public → allowed. |
| Rollback | Revert. |
| Target | V1.1 |
| Production mutation required | Yes (engineClient source + redeploy). |

---

### F-29 — HARDENING: Chromium launched with `--no-sandbox`

| Field | Value |
|-------|-------|
| Source | `browser-engine/server.js` L204, L354, L415, L447 |
| Current behavior | All Chromium launches use `--no-sandbox --disable-setuid-sandbox`. |
| Risk | Reduces the Chrome renderer sandbox; a browser exploit has more impact. Standard for headless containers but should be paired with container-level isolation. |
| Recommended architecture | Run the engine in a hardened container (seccomp profile, read-only FS, dropped capabilities, separate user namespace). |
| Minimum safe fix | Document container hardening in Dockerfile (seccomp, no-new-privileges, read-only root). |
| Maximum-strength fix | gVisor/Firecracker microVM per session. |
| Required tests | (1) Container runs with dropped capabilities. |
| Rollback | N/A. |
| Target | V1.1 (container hardening) / V2 (microVM) |
| Production mutation required | Yes (Dockerfile + deploy config). |

---

### F-30 — ALREADY STRONG (verified controls)

| Control | Evidence |
|---------|---------|
| Engine API key fail-closed | `server.js` L34-38: refuses to start without a ≥16-char key. |
| Engine auth timing-safe compare | `server.js` L81-86, constant-time. |
| CORS allowlist (no wildcard) | `server.js` L46-60; `credentials: false`. |
| Secure headers | `server.js` L66-75: `nosniff`, `DENY` frame, `no-referrer`, `no-store`. |
| Body size limits | `server.js` L63 (upload), L564 (download). |
| Operational secrets AES-GCM encrypted | `crypto.ts`; Proxy/Webhook/Profile/BrowserContext use `_encrypted` + `has_*` flags; plaintext never returned. |
| API keys stored as SHA-256 hash | `gatewayCore.ts` L7-10; raw key shown once. |
| API key expiry + revocation | `cloudBrowserGatewayV6` L41-43 (expiry), L37 (active check). |
| Gateway scope enforcement | `cloudBrowserGatewayV6` L66-69; `ROUTE_SCOPES`. |
| Tenant isolation (project filter) | `gatewayCore.ts` dispatch filters by `keyRecord.project_id` on every read/action/delete. |
| Rate limiting (database-backed) | `gatewayCore.ts` L48-87; `RateLimitEntry` entity. |
| Webhook HMAC-SHA256 + replay protection | `receiveWebhook` L25-45 (5-min window), idempotency. |
| Outbound webhook SSRF guard | `triggerWebhook` L19-39 (string-based — see F-02 for gap). |
| Webhook retry + DLQ + delivery records | `triggerWebhook` L41-141; `WebhookDelivery` entity. |
| RLS on all 34 entities | Verified in release receipt; User.jsonc platform-managed. |
| Single-worker mode enforced | `distributedFabric.ts` L179-185. |
| Orphan/stale recovery | `recoverOrphans` covers sessions, leases, jobs, rate-limit entries. |
| Retention reaping | `reapExpired` + Retention Reaper workflow. |
| Deployment version registry | `deploymentVersion.ts`; `__v` in every response; drift detection. |
| CI release gate | 4 jobs: code quality, engine syntax, security audit, release status. |
| Content hashing on artifacts | `runJob` `computeContentHash` (SHA-256). |
| Idempotent session close | `server.js` L645-660. |
| Bounded crawl/paginate | `server.js` L246-311 (max pages/depth/delay). |

---

## Part B — V1.1 Production Fortress Implementation Plan

### P0 — Blockers (must ship before V1.1 release)

| ID | Finding | Action | Prod Mutation |
|----|---------|--------|---------------|
| P0-1 | F-01 | Introduce `sessions:evaluate` scope; gate `evaluate`/`extract_json`/MCP `browser_observe` | Yes (gateway + mcpTools) |
| P0-2 | F-02 | Resolve-and-validate SSRF guard (DNS lookup → IP blocklist) for engine + webhook URLs | Yes (engine + triggerWebhook) |
| P0-3 | F-03 | Re-validate SSRF on redirect chains | Yes (engine) |
| P0-4 | F-04 | Add admin-role checks to privileged functions; project check in runJob | Yes (6 functions) |
| P0-5 | F-05 | Add MCP tool scope map + enforcement | Yes (mcpTools) |
| P0-6 | F-06 | runJob tenant authorization + webhook project scoping + idempotency_key | Yes (runJob + receiveWebhook + Webhook schema) |
| P0-7 | F-07 | Cryptographic tokens (`crypto.randomUUID`) for session/share/state tokens | Yes (engine) |
| P0-8 | F-08 | Reject caller-supplied `userDataDir`/extension paths; engine-generated paths only | Yes (engine) |
| P0-9 | F-09 | Stop returning decrypted cookies/storage from `context_use` | Yes (mcpTools) |

### P1 — Hardening (ship with V1.1)

| ID | Finding | Action | Prod Mutation |
|----|---------|--------|---------------|
| P1-1 | F-10 | Rate limiter: decrement on rejection (fix over-count) | Yes (gatewayCore) |
| P1-2 | F-11 | XFF trust model: use trusted-hop; warn on allowlist enable | Yes (gatewayCore) |
| P1-3 | F-12 | `engineFetch` 30s timeout via AbortController | Yes (engineClient) |
| P1-4 | F-13 | Bypass pool when caller-specific options provided | Yes (engine) |
| P1-5 | F-14 | Scope `private` + `project` artifacts by key project | Yes (mcpTools) |
| P1-6 | F-15 | Per-key concurrent session quota + job step/duration caps | Yes (gateway + runJob) |
| P1-7 | F-17 | Remove plaintext webhook secret fallback | Yes (2 functions) |
| P1-8 | F-18 | Fail-closed on decrypt failure in triggerWebhook | Yes (triggerWebhook) |
| P1-9 | F-19 | CDP admin-gated + port closed on session end | Yes (engine) |
| P1-10 | F-28 | Validate `engine.url` Setting host (no private/loopback) | Yes (engineClient) |

### P2 — Resilience (ship with V1.1 or V1.1.1)

| ID | Finding | Action | Prod Mutation |
|----|---------|--------|---------------|
| P2-1 | F-16 | Per-project rolling spend cap pre-flight in runJob | Yes (runJob) |
| P2-2 | F-20 | Add `npm audit` + Dependabot to CI | Yes (CI workflow) |
| P2-3 | F-21 | Enforce GitHub branch protection (required checks, PR review) | GitHub settings |
| P2-4 | F-22 | Document DR runbook + weekly export workflow | Runbook + workflow |
| P2-5 | F-23 | Drift test uses direct invocation (document cache artifact) | Test only |
| P2-6 | F-24 | Persist save_state to encrypted Profile/BrowserContext | Yes (engine) |
| P2-7 | F-27 | Heartbeat alerts on unhealthy/drift | Yes (workflow) |

### P3 — Enterprise hardening (V1.1.x / V2)

| ID | Finding | Action | Prod Mutation |
|----|---------|--------|---------------|
| P3-1 | F-25 | AuditLog `source` field; user vs system flag | Yes (schema) |
| P3-2 | F-26 | HKDF + per-record salt for encryption | Yes (crypto + migration) |
| P3-3 | F-29 | Container hardening (seccomp, no-new-privs, read-only FS) | Yes (Dockerfile) |
| P3-4 | F-20 | SBOM (CycloneDX) + SLSA provenance + cosign signing | Yes (CI) |
| P3-5 | F-16 | Full budget system (hard/soft limits, auto-deactivate) | Yes (V2) |
| P3-6 | F-02 | Network-layer egress allowlist (L3) | Yes (infra) |
| P3-7 | F-26 | KMS-managed master key + envelope encryption | Yes (V2) |
| P3-8 | F-24 | Redis-backed distributed state (sessions, leases, idempotency, DLQ) | Yes (V2) |

---

## Part C — FORTRESS RELEASE MATRIX (new V1.1 release gate)

The V1.0 matrix (47/47) remains the baseline. V1.1 adds the following
Fortress-specific gates. A V1.1 release is verified only when **all** gates pass
on 3 consecutive runs, with V1.0 rollback proven.

| # | Gate | Category | Method | Pass Criterion |
|---|------|----------|--------|----------------|
| 1 | Evaluate scope enforcement | Authorization | `sessions:write`-only key → evaluate returns 403 | 403 |
| 2 | MCP scope enforcement | Authorization | Key without required scope per tool → 403 | 403 per tool |
| 3 | SSRF DNS-rebinding block | SSRF | Domain resolving to 169.254.169.254 → rejected | 400/rejected |
| 4 | SSRF redirect block | SSRF | Public URL 302→private IP → blocked | Navigation aborted |
| 5 | Direct-function authz | Authorization | Non-admin → saveProxy/runJob → 403 | 403 |
| 6 | runJob tenant isolation | Tenant Isolation | runJob cross-project → 403 | 403 |
| 7 | Webhook project scoping | Tenant Isolation | Forged webhook with other-tenant job_id → 403 | 403 |
| 8 | runJob idempotency | Reliability | Duplicate idempotency_key → second rejected | 409/skipped |
| 9 | Cryptographic tokens | Security | Share/state/session tokens ≥128 bits, non-Math.random | Entropy pass |
| 10 | userDataDir sanitization | Security | Caller-supplied path → ignored/rejected | Engine-generated path |
| 11 | context_use no plaintext return | Data Protection | Response has no `cookies`/`storage_state` | Fields absent |
| 12 | Rate limiter no over-count | Reliability | Flood → no over-count after rejects | Counter correct |
| 13 | engineFetch timeout | Reliability | Hung engine → 504 ≤30s | ≤30s |
| 14 | Pool honors proxy | Correctness | Session with proxy + usePool → egress via proxy | Proxy IP |
| 15 | Artifact project scoping | Tenant Isolation | Cross-project `private`/`project` artifact → 403 | 403 |
| 16 | Per-key session quota | Abuse | Over-quota → 429 | 429 |
| 17 | Job step/duration caps | Abuse | Over cap → rejected/failed | Rejected |
| 18 | Webhook no plaintext fallback | Security | Plaintext-only secret → fail-closed | Skipped |
| 19 | Decrypt-fail fail-closed | Security | Corrupted secret_encrypted → no unsigned send | Skipped + logged |
| 20 | CDP admin-gated | Security | enable_cdp with allow_cdp=false → rejected | Rejected |
| 21 | engine.url host validation | Security | Private/loopback override → rejected | Rejected |
| 22 | npm audit clean | Supply Chain | `npm audit --audit-level=high` → 0 high | 0 |
| 23 | Branch protection enforced | Supply Chain | Direct push to main → rejected | Rejected |
| 24 | DR export + restore | Reliability | Export → restore into fresh app → entities recover | Recovered |
| 25 | Drift via direct invocation | Deployment | All functions report v6.0.0 via direct path | 0 drift |
| 26 | Heartbeat alerting | Observability | Engine down → alert sent | Alert received |
| 27 | V1.0 rollback proven | Rollback | Revert to `2d8deade…` → all V1.0 tests pass | 47/47 |
| 28 | Fortress runtime suite | Runtime | Original 23/23 + all above | 100% |
| 29 | Tenant isolation (deployed) | Tenant Isolation | 18/18 + new cross-project cases | 100% |
| 30 | MCP black-box | MCP | 18/18 + scope-enforcement cases | 100% |
| 31 | Context black-box | Contexts | 11/11 + no-plaintext-return case | 100% |
| 32 | Build / Lint / Typecheck | Code Quality | npm run build/lint/typecheck | PASS |
| 33 | CI/CD (GitHub Actions) | CI/CD | Green run on V1.1 SHA | SUCCESS |
| 34 | Critical defects | Quality | 0 critical | 0 |
| 35 | High defects | Quality | 0 high | 0 |
| 36 | Browser subresource SSRF block | SSRF | Page-side fetch/XHR/iframe to private IP → blocked at engine | Blocked |
| 37 | CORS fail-closed | Security | Empty CORS_ALLOWLIST + cross-origin Origin → rejected | 403 |
| 38 | Dangerous-action capability authorization | Authorization | Key lacking per-action capability scope → action 403 | 403 per action |
| 39 | Runtime/container isolation verification | Isolation | Container runs non-root, no-new-privs, dropped caps, read-only root, resource limits | Verified |

**Fortress Release Gate:** 39/39 PASS on 3 consecutive runs + V1.0 rollback
proven (gate 27) → **V1.1 PRODUCTION FORTRESS VERIFIED**.

---

## Part D — Rollback Plan

V1.0 (`2d8deadeedb35aa110bdd49f1d93a13f5d56b2a9`) remains the known-good
rollback release. If any V1.1 gate fails:

1. Revert all V1.1 function source to the V1.0 SHA.
2. Redeploy affected functions.
3. Run `getDeploymentStatus` (direct invocation) → confirm v5.0.0 / 0 drift.
4. Run `runTestSuite` → confirm 23/23.
5. Run `runMasterReleaseSuite` → confirm 47/47.
6. Confirm V1.0 operational baseline (1 active key, 0 webhooks, 0 critical/high).

No schema destructive changes in V1.1 (Webhook `project_id` and AuditLog
`source` are additive fields). Rollback requires no schema revert.

---

## Part E — Production Mutation Summary

| Category | V1.1 Mutations | Requires Operator Approval |
|----------|---------------|---------------------------|
| Backend function source | 12 functions edited + redeploy | Yes |
| Browser engine source | server.js edited + redeploy | Yes |
| Shared modules | gatewayCore, engineClient, crypto edited | Yes |
| Entity schemas | Webhook (+project_id), AuditLog (+source) — additive | Yes |
| CI workflow | Add npm audit + Dependabot | Yes (operator commits) |
| GitHub settings | Branch protection | Yes (operator) |
| Secrets | No changes | No |
| RLS | No changes (additive fields inherit existing rules) | No |
| Workflows | Heartbeat alerting edit | Yes |
| Railway / deploy config | Container hardening (P3) | Yes (operator) |

**No production mutations have been performed.** All changes above are pending
operator approval.

---

V1.1 PRODUCTION FORTRESS
READY FOR OPERATOR APPROVAL