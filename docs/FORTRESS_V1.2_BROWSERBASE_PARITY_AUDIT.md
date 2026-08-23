# Fortress v1.2 — Browserbase Parity Forensic Audit & Gap Analysis

**Date:** 2026-08-23
**Auditor:** Base44 autonomous hardening pass
**Baseline:** Fortress v1.1 (47/47 production matrix, 23/23 runtime suite, 3× staging certification)
**Reference architecture:** Browserbase (browserbase.com) — cloud browser infrastructure for AI agents

---

## 1. Forensic Audit — Current System State

### 1.1 Control Plane (Base44) — STRENGTHS
- **Entities:** Session, Job, Schedule, Step, Result, Screenshot, LogEntry, ApiKey, Proxy, Webhook, AuditLog, Extension, Profile, Project, SystemSettings, Template, JobVersion, ChangeAlert, ErrorPattern, EngineHealthLog, Plan, Subscription, Team, Notification, WebhookDelivery, TestResult, ScoreRecord, Setting, CapabilityRegistry, Artifact, BrowserContext, RateLimitEntry.
- **Security:** fail-closed auth (timing-safe), CORS allowlist, SSRF egress guard, AES-GCM secret encryption, HMAC webhooks + replay protection, database-backed rate limiting, RLS tenant isolation (project-scoped), admin-only sensitive ops, audit logging.
- **Reliability:** job retries + backoff, fan-out, dependencies, orphan recovery, expired reaping, settings drift detection, rollback values, JobVersion.
- **Observability:** EngineHealthLog, AuditLog, P50/P95/P99 metrics, ErrorPattern fingerprinting.
- **AI:** MCP tools (browser_start/act/observe/extract), AI extract, AI job builder.
- **Certification:** 47/47 master matrix, real CI/CD gate, deployment drift = 0, staging isolation proven.

### 1.2 Browser Engine (Node.js/Playwright) — STRENGTHS
- Session lifecycle, warm pool, multi-tab, frame switch, crawl (bounded), pagination.
- Video recording, CDP (internal-only), cookie import/export, storage state, save/restore state.
- Network mocking, resource blocking, stealth script (basic).
- SSRF host blocking, body size limits, secure headers, constant-time auth.
- CAPTCHA solving (2captcha, recaptcha_v2 only).

### 1.3 FORENSIC FINDINGS — WEAKNESSES / RISKS

| # | Finding | Severity | Evidence |
|---|---|---|---|
| F1 | Engine session state is **process-local `Map`** — lost on worker restart, not shared across instances | CRITICAL | `server.js:141` `const sessions = new Map()` |
| F2 | **Single-worker enforced** — horizontal scale blocked by design | CRITICAL | `distributedFabric.ts:179` `enforceSingleWorker()` throws on WORKER_ID≠0/1 |
| F3 | Redis adapter **stubbed, throws** even when REDIS_URL provisioned | CRITICAL | `distributedFabric.ts:162` throws "BLOCKED" |
| F4 | **No region routing** — single region, no geo-affinity | HIGH | no region selection in gateway dispatch |
| F5 | **No per-project / per-store concurrency limits** — only global MAX_SESSIONS | HIGH | `gatewayCore.ts` POST /sessions has no quota check |
| F6 | **No session-creation rate limit** (distinct from request rate limit) | HIGH | only `checkRateLimit` (per-minute requests) |
| F7 | **No 429 retry-after / x-ratelimit headers** — clients can't back off cleanly | HIGH | `errorResponse(429)` has no headers |
| F8 | **Stealth is basic** — webdriver/languages/plugins only; no WebGL/Canvas/Audio/WebRTC fingerprinting | HIGH | `server.js:155` stealthScript |
| F9 | **No proxy rotation** — proxy is per-session static | HIGH | no rotation group logic |
| F10 | **CAPTCHA limited** — recaptcha_v2 via 2captcha only | HIGH | `server.js:219` solveCaptcha |
| F11 | **No Store/Location entity** — cannot model 70+ store locations with per-store quotas/proxy/credentials | HIGH | no entity |
| F12 | **No session replay** — only screenshots/video | MEDIUM | no DOM timeline |
| F13 | **Live View is screenshot polling** — not real-time CDP screencast | MEDIUM | LiveView.jsx polls |
| F14 | **No HAR / trace export** | MEDIUM | not in engine |
| F15 | **No Stagehand-equivalent resilient act/observe/extract** — MCP tools are basic | MEDIUM | mcpTools basic |
| F16 | **No Fetch primitive** (read page without browser) | LOW | can use InvokeLLM |
| F17 | **No autoscaler** — fixed pool size | MEDIUM | warmPool fixed POOL_SIZE |
| F18 | **No health-based routing / circuit breaker per worker** | MEDIUM | no per-worker health in routing |
| F19 | **No SSO/SAML** | LOW (enterprise) | not in auth |
| F20 | **No per-store credential vault / MFA handling** | MEDIUM | no vault |

---

## 2. Browserbase Architecture (researched)

### 2.1 Core Primitives
1. **Browsers** — managed Chromium, persistent sessions, file downloads, live view, logs, replay.
2. **Concurrency** — org-level concurrency, per-project distribution, session-creation rate limit, 429 + `retry-after` + `x-ratelimit-*` headers.
3. **Agent Identity / Stealth** — Basic + Advanced (custom Chromium, real fingerprints); Verified identity (Cloudflare, Stytch, Fingerprint) → fewer CAPTCHAs.
4. **Proxy orchestration** — geographic locations, per-session config, rotation, residential.
5. **CAPTCHA** — automatic, built-in, multi-type.
6. **Contexts API** — cookies + state across sessions, retention 7–90+ days. ✅ (we have BrowserContext)
7. **Live View + Session Inspector + Replay.**
8. **Stagehand SDK** — observe(), act(), extract(), agent() — resilient to UI changes.
9. **Functions** — serverless runtime, automatic session lifecycle.
10. **Search** — web search in one call. (we have InvokeLLM + add_context_from_internet)
11. **Fetch** — read page without a browser.
12. **Models** — route to every major LLM from one key. (we have InvokeLLM)
13. **Observability** — recordings, console, network.
14. **Enterprise** — SOC 2, HIPAA, SSO/SAML, 2000+ concurrent per instance.

### 2.2 Scale Targets (Browserbase)
- 250+ to **2000+ concurrent browsers per instance**; thousands of instances.
- **35M+ monthly sessions**.
- Session duration up to 6+ hours.
- Session-creation limit 150+/min.
- Regional control + autoscaling.

---

## 3. Gap Matrix — This System vs Browserbase

| Capability | Browserbase | This System (v1.1) | Gap | Wave |
|---|---|---|---|---|
| Distributed session registry | Redis-backed | process-local Map | F1,F2,F3 | W1 |
| Multi-worker horizontal scale | yes | blocked | F2,F3 | W1 |
| Region routing | yes | no | F4 | W1 |
| Per-project concurrency | org+project | global only | F5 | W1 |
| Per-store concurrency | (via projects) | no Store entity | F11 | W1 |
| Session-creation rate limit | yes (429+headers) | no | F6,F7 | W1 |
| 429 retry-after / ratelimit headers | yes | no | F7 | W1 |
| Advanced stealth (WebGL/Canvas/Audio/WebRTC) | Advanced | basic | F8 | W1 |
| Proxy rotation + residential + geo | yes | static per-session | F9 | W1 |
| Multi-provider CAPTCHA (v3,hCaptcha,Turnstile) | yes | recaptcha_v2 only | F10 | W1 |
| Autoscaler | yes | fixed pool | F17 | W2 |
| Health-based routing + circuit breaker | yes | no | F18 | W2 |
| Session replay (DOM timeline) | yes | no | F12 | W2 |
| Real-time live view (CDP screencast) | yes | screenshot poll | F13 | W2 |
| HAR / trace export | yes | no | F14 | W2 |
| Stagehand resilient act/observe/extract | yes | basic MCP | F15 | W3 |
| Fetch (no browser) | yes | via InvokeLLM | F16 | W3 |
| Per-store credential vault + MFA | yes | no | F20 | W3 |
| SSO/SAML | yes | no | F19 | W3 |
| Contexts (cookies+state) | yes | ✅ BrowserContext | — | — |
| Webhooks | yes | ✅ HMAC+replay | — | — |
| Audit logs | yes | ✅ AuditLog | — | — |
| Cost tracking | yes | ✅ CostEntry | — | — |

---

## 4. Scale Target Design — 100k+ users, 70+ store locations

### 4.1 Multi-tenancy model
- **Organization** → **Projects** → **Stores** (70+ locations).
- Each Store has: concurrency quota, region, proxy assignment, config profile, credential vault.
- Org-level concurrency distributed across projects/stores (Browserbase model).

### 4.2 Concurrency model
- **Hard limits:** max concurrent browsers (org), session-creation rate (per min, per project/store).
- **429 response** with `retry-after`, `x-ratelimit-limit`, `x-ratelimit-remaining`, `x-ratelimit-reset`.
- **Soft limits:** queue + backpressure when at capacity (Wave 2).

### 4.3 Distributed model (Wave 1 unblock + Wave 2)
- Redis-backed: SessionStore, WorkerRegistry, LeaseStore, RateLimiter, IdempotencyStore, DLQ, PoolState.
- Worker heartbeat → registry → health-based routing.
- Region-aware session placement.
- Autoscaler on queue depth + utilization.

---

## 5. Implementation Waves

**Wave 1 (this turn) — Scalability + Stealth parity:**
- Store entity (70+ locations, quotas, proxy, region, credentials).
- Per-project + per-store concurrency + session-creation rate limit + 429 headers.
- Redis adapter implementation (unblock multi-worker).
- Engine: advanced stealth fingerprinting, proxy rotation groups, multi-provider CAPTCHA.

**Wave 2 (next) — Reliability + Observability:**
- Autoscaler, health-based routing, circuit breaker.
- Session replay, real-time live view (CDP screencast), HAR/trace export.

**Wave 3 (after) — AI + Enterprise:**
- Stagehand-equivalent resilient act/observe/extract + agent loop.
- Fetch primitive, per-store credential vault + MFA, SSO/SAML.

---

## 6. Validation Plan
- Re-run `runTestSuite` (23/23 baseline must hold).
- Re-run `runMasterReleaseSuite` (47/47 must hold).
- New `runScaleParitySuite` validating concurrency quotas, 429 headers, Store isolation, advanced stealth, proxy rotation, multi-provider captcha, Redis adapter contract.
- Regression: staging certification must remain 11/11.