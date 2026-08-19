# CloudBrowser Control V1 — Operational Handoff

## Production Start Procedure

### 1. Health Verification
```
POST /functions/engineHealth  {}
```
Verify `status: "healthy"`, `engine_version: "3.0.0"`, `active_sessions < max_sessions`.
If unhealthy, see Railway Recovery (step 12).

### 2. Create a Project
Navigate to Settings → Projects → New Project. Name it, optionally set default
session config (viewport, proxy). Projects provide tenant isolation boundaries.

### 3. Create and Scope an API Key
Navigate to Settings → API Keys → Create. Name it, select scopes
(`sessions:write`, `jobs:write`, `results:read`), bind to the Project from step 2.
Copy the key immediately — it is shown once and stored as a SHA-256 hash.

### 4. Start a Browser Session
```
POST /functions/cloudBrowserGatewayV6
Authorization: Bearer cb_live_<key>
{ "path": "/sessions", "method": "POST", "data": { "target_url": "https://example.com" } }
```
Returns `session_id`. Session enters `running` status.

### 5. Run Browser Actions
```
POST /functions/cloudBrowserGatewayV6
{ "path": "/sessions/{id}/actions", "method": "POST",
  "data": { "action": "click", "selector": "#button" } }
```
Actions: `goto`, `click`, `type`, `fill`, `scroll`, `screenshot`, `extract_text`,
`extract_html`, `evaluate`, `wait_for_selector`, `press`, `select_option`.

### 6. Create and Run Jobs
Navigate to Jobs → New Job (visual builder) or Jobs → AI Builder. Set start URL,
add steps, configure session options, save. Run via API:
```
POST /functions/runJob  { "job_id": "<job_id>" }
```
Job executes all steps sequentially, stores results and artifacts, triggers
webhooks on completion.

### 7. Use MCP (Model Context Protocol)
```
POST /functions/mcpTools
{ "tool": "browser_navigate", "params": { "url": "..." }, "api_key": "cb_live_<key>" }
```
Tools: `browser_start`, `browser_navigate`, `browser_click`, `browser_type`,
`browser_extract`, `browser_screenshot`, `browser_observe`, `browser_act`,
`context_create`, `context_attach`. All scoped to the API key's project_id.

### 8. Use Durable Contexts
Create a Profile (Settings → Profiles) with cookies/storage state. A
BrowserContext is created from the Profile with lease/lock/revoke lifecycle.
Attach to a session:
```
{ "path": "/sessions", "method": "POST", "data": { "profile_id": "<profile_id>" } }
```
Contexts persist auth state across sessions. Expired contexts are auto-reaped.

### 9. Retrieve Artifacts
Navigate to Jobs → job → Artifacts tab, or via API:
```
GET /functions/cloudBrowserGatewayV6  { "path": "/artifacts/{id}" }
```
Each artifact has a SHA-256 content hash for integrity. Signed URLs are
time-limited for download. Types: screenshot, pdf, download, video, json, csv.

### 10. Monitor Errors
Navigate to Errors page (sidebar). Filter by pattern, severity, or date.
ErrorPattern entities auto-classify recurring failures. Click an error to see
affected jobs/sessions and stack traces.

### 11. Check Rate Limits
Rate limits are database-backed (RateLimitEntry entity, fixed-window, atomic $inc).
Default: 60 requests/minute per API key (configurable in Settings → System).
When exceeded, gateway returns HTTP 429. Monitor via:
```
GET /functions/cloudBrowserGatewayV6  { "path": "/health" }
```
Rate limit entries are auto-cleaned after each window expires.

### 12. Railway (Engine) Recovery
If engine health = unhealthy/unreachable:
1. Check Railway dashboard for worker status
2. Verify ENGINE_URL and ENGINE_API_KEY secrets (Settings → Secrets)
3. Railway auto-restarts crashed workers
4. Sessions queue but do not execute until engine recovers
5. Run `engineHealth` to confirm recovery
6. Orphaned sessions recovered by `recoverOrphans` function

### 13. Base44 (Control Plane) Recovery
If gateway returns 500 or functions not responding:
1. Check Base44 status page
2. Verify functions deployed via `getDeploymentStatus`
3. If deployment drift: redeploy affected functions from the builder
4. If RLS lockout: verify user role is admin in Settings → Team
5. Contact Base44 support if platform is down

### 14. Rollback
**Deployment rollback:** Revert function source to prior version in the builder,
redeploy, run `getDeploymentStatus` to verify all functions report CURRENT,
run `runTestSuite` to verify runtime health. Known-good checkpoint: v5.0.0.

**Job rollback:** Navigate to Jobs → job → Versions tab, select a prior
JobVersion, restore — creates a new version with the prior steps snapshot.

### 15. Credential Rotation
**ENCRYPTION_KEY:** Generate new key → update Settings → Secrets → run
`migrateSecrets` to re-encrypt all stored secrets → verify decryption.

**ENGINE_API_KEY:** Generate new key in engine → update Settings → Secrets →
run `engineHealth` to verify connectivity.

**CAPTCHA_SOLVER_API_KEY:** Update Settings → Secrets → test with a
captcha-protected page.

### 16. Daily Health Verification
1. Dashboard loads, engine status = healthy
2. Create a test session → navigate → screenshot → terminate
3. Run a test job → verify results appear
4. Check Errors page for new patterns
5. Run `engineHealth` → response time < 500ms
6. Check `getDeploymentStatus` → 0 functional drift
7. Review AuditLog for unexpected admin actions

---

## Daily Operations Guide (Detailed Reference)

### API Keys

**Create an API key:**
1. Navigate to Settings → API Keys
2. Click "Create API Key"
3. Name it (e.g., "production", "staging")
4. Select scopes (sessions:write, jobs:write, results:read)
5. Bind to a Project
6. Copy the key immediately (shown once, stored as SHA-256 hash)

**Use an API key:**
```
Authorization: Bearer cb_live_<key>
```
All API requests go through the gateway at `/functions/cloudBrowserGatewayV6`.

**Rotate an API key:**
1. Create a new key
2. Update your application to use the new key
3. Deactivate the old key (do not delete — preserves audit trail)
4. Delete the old key after confirming no traffic

---

### Projects

**Create a project:**
1. Navigate to Settings → Projects
2. Click "New Project"
3. Name it and optionally set default session config
4. Create an API key bound to this project

Projects provide tenant isolation — API keys bound to Project A cannot access
Project B's sessions, jobs, or results.

---

### Sessions

**Create a session via API:**
```json
POST /functions/cloudBrowserGatewayV6
{
  "path": "/sessions",
  "method": "POST",
  "data": {
    "target_url": "https://example.com",
    "viewport": { "width": 1920, "height": 1080 }
  }
}
```

**Session actions:**
```json
POST /functions/cloudBrowserGatewayV6
{
  "path": "/sessions/{id}/actions",
  "method": "POST",
  "data": { "action": "click", "selector": "#button" }
}
```

**Terminate a session:**
```json
DELETE /functions/cloudBrowserGatewayV6
{ "path": "/sessions/{id}", "method": "DELETE" }
```

---

### Jobs

**Create a job:**
1. Navigate to Jobs → New Job (visual builder) or Jobs → AI Builder
2. Set the start URL
3. Add steps (navigate, click, extract, screenshot, etc.)
4. Configure session options (viewport, proxy, headers)
5. Save and run

**Run a job via API:**
```json
POST /functions/runJob
{ "job_id": "<job_id>" }
```

**View job results:**
- Navigate to Jobs → click job → Results tab
- Or via API: `GET /functions/cloudBrowserGatewayV6 { "path": "/jobs/{id}/results" }`

---

### MCP (Model Context Protocol)

MCP tools allow AI clients to control browser sessions programmatically.

**Use MCP:**
1. Create a session via the gateway
2. Call `mcpTools` function with the session ID and tool name:
   - `browser_navigate` — navigate to a URL
   - `browser_click` — click an element
   - `browser_extract` — extract data from a page
   - `browser_screenshot` — capture a screenshot
   - `context_create` — create a browser context
   - `context_attach` — attach a context to a session
3. All MCP tools are scoped to the API key's project_id

---

### Contexts

Browser contexts persist authentication state (cookies, localStorage) across sessions.

**Create a context:**
1. Navigate to Settings → Profiles (saved auth states)
2. Create a Profile with cookies/storage state
3. A BrowserContext is created from the Profile

**Attach a context to a session:**
```json
{
  "path": "/sessions",
  "method": "POST",
  "data": { "profile_id": "<profile_id>" }
}
```

Contexts support leasing (lock/unlock) and expiration (auto-reap).

---

### Artifacts

**Retrieve artifacts:**
- Navigate to Jobs → job → Artifacts tab
- Or via API: `GET /functions/cloudBrowserGatewayV6 { "path": "/artifacts/{id}" }`
- Artifacts include screenshots, PDFs, downloads, extracted data
- Each artifact has a SHA-256 content hash for integrity verification
- Signed URLs are time-limited for download

---

### Error Inspection

**View errors:**
1. Navigate to Errors page (sidebar)
2. Filter by error pattern, severity, or date
3. ErrorPattern entities auto-classify recurring failures
4. Click an error to see affected jobs/sessions and stack traces

---

### Rate Limits

**Check rate limit status:**
Rate limits are database-backed (RateLimitEntry entity) using fixed-window
algorithm with atomic $inc for concurrency safety.

- Default: 60 requests/minute per API key (configurable in Settings → System)
- When exceeded: gateway returns HTTP 429 with error "Rate limit exceeded"
- Rate limit entries are auto-cleaned after each 60-second window expires
- To adjust: update `rate_limit_per_minute` in SystemSettings

**Monitor rate limit entries:**
RateLimitEntry records are admin-only (read). Navigate to Settings to view
current rate limit configuration. The gateway checks rate limits on every
authenticated request via `checkRateLimit` in gatewayCore.ts.

---

### Health Monitoring

**View system health:**
1. Navigate to Dashboard — shows active sessions, jobs, engine status
2. Engine health is probed by `engineHealth` function
3. EngineHealthLog records each probe (status, response time, active sessions)
4. Health statuses: healthy, degraded, unhealthy, unreachable

**Check health via API:**
```json
POST /functions/engineHealth
{}
```

---

### Responding to Railway (Engine) Failure

**Symptoms:** Engine health = unhealthy/unreachable, sessions fail to create

**Steps:**
1. Check Railway dashboard for worker status
2. Verify ENGINE_URL and ENGINE_API_KEY secrets are correct (Settings → Secrets)
3. If engine crashed: Railway auto-restarts the worker
4. If engine is down: sessions queue but do not execute until engine recovers
5. Run `engineHealth` to confirm recovery
6. Orphaned sessions are recovered by `recoverOrphans` function

---

### Responding to Base44 (Control Plane) Failure

**Symptoms:** Gateway returns 500, functions not responding

**Steps:**
1. Check Base44 status page
2. Verify functions are deployed (getDeploymentStatus)
3. If deployment drift: redeploy affected functions from the builder
4. If RLS lockout: verify user role is admin in Settings → Team
5. Contact Base44 support if platform is down

---

### Credential Rotation

**ENCRYPTION_KEY:**
1. Generate a new key
2. Update Settings → Secrets → ENCRYPTION_KEY
3. Run `migrateSecrets` function to re-encrypt all stored secrets
4. Verify decryption works (create a new proxy/webhook/profile)

**ENGINE_API_KEY:**
1. Generate a new key in the browser engine
2. Update Settings → Secrets → ENGINE_API_KEY
3. Run `engineHealth` to verify connectivity

**CAPTCHA_SOLVER_API_KEY:**
1. Update Settings → Secrets → CAPTCHA_SOLVER_API_KEY
2. Test by running a job with a captcha-protected page

---

### Rollback

**Rollback a deployment:**
1. Identify the known-good version (v5.0.0 is current checkpoint)
2. Revert function source to prior version in the builder
3. Redeploy functions
4. Run `getDeploymentStatus` to verify all functions report CURRENT
5. Run `runTestSuite` to verify runtime health

**Rollback a job:**
1. Navigate to Jobs → job → Versions tab
2. Select a prior JobVersion
3. Restore — creates a new version with the prior steps snapshot

---

### Verifying System Health

**Minimum verification:**
1. Dashboard loads and shows engine status = healthy
2. Create a test session → navigate → screenshot → terminate
3. Run a test job → verify results appear
4. Check Errors page for new patterns
5. Run `engineHealth` → response time < 500ms

---

## Minimum Recurring Health Checks

| Frequency | Check | Method |
|-----------|-------|--------|
| Every 5 min | Engine health | `engineHealth` function (automated via workflow) |
| Every hour | Deployment drift | `getDeploymentStatus` — verify 0 drift |
| Every 6 hours | Orphan recovery | `recoverOrphans` — clean up stale sessions |
| Daily | Retention sweep | `reapExpired` — delete expired artifacts/screenshots/logs |
| Daily | Error pattern review | Check Errors page for new patterns |
| Weekly | Audit log review | Review AuditLog for unexpected admin actions |
| Weekly | Credential rotation check | Verify secrets are current, rotate if > 90 days old |
| Weekly | Backup verification | Verify JobVersion checkpoints exist for critical jobs |

### Automated Workflows (already configured)

- **Schedule Checker** — runs every minute, triggers due schedules
- **Nightly Test Run** — runs runtime suite nightly
- **Retention Reaper** — daily cleanup of expired artifacts
- **Governance Heartbeat** — periodic deployment drift detection