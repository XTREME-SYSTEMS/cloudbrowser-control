# Phase 2 — Capability Parity Matrix

**Mission:** X1-CLOUDBROWSER-ONE-AND-DONE-2026
**Recorded:** 2026-10-20

## Evidence rules used in this document

This matrix separates three kinds of statement, and never mixes them:

* **DOCUMENTED (competitor)** — taken from the vendor's own public documentation. Cited inline.
* **VERIFIED (CloudBrowser)** — the capability exists in this repository and its source was inspected.
* **UNVERIFIED** — no evidence exists in this repository. Never claimed as parity.

**No competitor performance measurement appears anywhere in this document.** Latency,
throughput, concurrency and cost figures for Browserbase / Browserless / Browser Use are
**not measured here** because no independent measurement harness has been run against them.
They are marked `NOT MEASURED`.

## Reference systems and their documented capability sets

### Browserbase — DOCUMENTED
Source: `docs.browserbase.com`

| Capability | Documented behaviour |
|---|---|
| Remote Chromium via CDP | Sessions expose a `connectUrl` used with Playwright/Puppeteer/Selenium (`chromium.connectOverCDP`) |
| Persistent browser state | "Contexts" — a reusable browser data directory that survives across sessions |
| Live View | Real-time watch **and interact** (click, type, scroll) on a running session; embeddable |
| Session logs API | CDP events: console logs, network activity, page lifecycle, retrievable per session |
| Observability | Session Inspector in dashboard; Stagehand tab; recordings |
| Bot protection | Documented as a first-class product area (identity / stealth) |

### Browserless — DOCUMENTED
Source: `docs.browserless.io`

| Capability | Documented behaviour |
|---|---|
| CDP over WebSocket | `wss://production-sfo.browserless.io?token=…` with `connectOverCDP` |
| Playwright-native connect | `…/chromium/playwright?token=…` |
| Context options via CDP | Stealth, geolocation, viewport only honoured with `connectOverCDP` |
| REST endpoint families | Screenshots, PDFs, content scraping, session create, crawl jobs, unblock, profiles |
| CDP extensions | Vendor commands `liveURL`, `solveCaptcha`, `reconnect` |
| Session recording | Documented screen recording |
| Anti-bot / stealth + proxies | Residential and datacenter routing as a product area |

### Browser Use — DOCUMENTED
Source: independent platform comparison (mastra.ai, Oct 2026) summarising the vendor's model

| Capability | Documented behaviour |
|---|---|
| CDP connections | Remote browsers compatible with Playwright and Puppeteer |
| Live session URLs | Live URLs for monitoring a session in real time |
| AI agent operation | Agent-driven browser operation is the product's core premise |

## Parity matrix — CloudBrowser Control vs the three references

Legend: ✅ verified present · ⚠️ partial · ❌ absent · `NOT MEASURED` no evidence

| Capability | Browserbase | Browserless | Browser Use | CloudBrowser | CloudBrowser evidence |
|---|---|---|---|---|---|
| Playwright automation | DOCUMENTED | DOCUMENTED | DOCUMENTED | ✅ | `browser-engine/server.js` imports `playwright.chromium` |
| CDP connection endpoint | DOCUMENTED | DOCUMENTED | DOCUMENTED | ❌ | no CDP server exposed; automation is in-process |
| Session create / list / get / delete | DOCUMENTED | DOCUMENTED | DOCUMENTED | ✅ | `POST/GET /sessions`, `GET/DELETE /sessions/:id` |
| Page execution endpoint | DOCUMENTED | DOCUMENTED | DOCUMENTED | ✅ | `POST /sessions/:id/execute` |
| Live view / real-time share | DOCUMENTED | DOCUMENTED (`liveURL`) | DOCUMENTED | ⚠️ | `POST /sessions/:id/share` + `docs/LIVE_VIEW_TRANSPORT.md`; interaction parity **not verified** |
| Screenshot capture | DOCUMENTED | DOCUMENTED | — | ✅ | `GET /sessions/:id/screenshot` |
| Session keepalive | DOCUMENTED (keepalive) | DOCUMENTED (`reconnect`) | — | ✅ | `POST /sessions/:id/keepalive` |
| Session persistence across restarts | DOCUMENTED (Contexts) | DOCUMENTED (profiles) | — | ✅ | `browser-engine/migrations.sql` + `session-manager.js`; covered by `persistence-contract.test.js` |
| Session recording / replay | DOCUMENTED | DOCUMENTED | — | ⚠️ | `VIDEO_DIR` capture path exists; replay UI **absent** |
| Structured console/network logs | DOCUMENTED (logs API) | DOCUMENTED | — | ✅ | `LogEntry` entity + `LogEntry`-backed engine logging |
| Zombie / orphan session reclamation | DOCUMENTED | — | — | ✅ | `status = 'zombie'` in engine schema; `archive_old_sessions()` |
| Proxy routing (residential/datacenter) | DOCUMENTED | DOCUMENTED | — | ✅ | `Proxy` entity (`ip_type`, geo fields, `health_score`), `managePool`, `testProxyHealth` |
| Geo-targeted proxy eviction | — | — | — | ✅ | `Proxy.health_score` auto-eviction < 10 |
| Stealth / fingerprint randomisation | DOCUMENTED | DOCUMENTED | — | ✅ | `fingerprint-randomizer.js` + `tlsFingerprint.ts` |
| Human-like input model | — | — | — | ✅ | `human-behavior.js` (mouse paths, typing cadence) |
| CAPTCHA solving | — | DOCUMENTED (`solveCaptcha`) | — | ✅ | self-solvers for reCAPTCHA v2, hCaptcha, Turnstile + LLM-vision + third-party fallback chain |
| CAPTCHA without third-party API | — | ❌ (vendor API) | — | ✅ | `captcha-self-solver.js` is dependency-free |
| Durable job queue | ✅ (documented managed infra) | DOCUMENTED (crawl jobs) | — | ✅ | `jobs` table + `worker/` — leases, bounded retries, dead-letter, crash recovery |
| Idempotent submission | DOCUMENTED | — | — | ✅ | partial unique index on `(tenant_id, idempotency_key)` |
| Tenant isolation | DOCUMENTED | DOCUMENTED (tokens) | — | ✅ | API key → tenant + Postgres RLS, fail-closed |
| SSRF protection | DOCUMENTED | DOCUMENTED | — | ✅ | `isBlockedHost` in engine, asserted by CI |
| Rate limiting / quotas | DOCUMENTED | DOCUMENTED | — | ✅ | fixed-window limiter per tenant (§known limitation) |
| Request correlation IDs | DOCUMENTED | — | — | ✅ | `x-request-id` honoured or generated |
| OpenAPI contract published | DOCUMENTED | DOCUMENTED | — | ✅ | `api/openapi.json` (OpenAPI 3.1) |
| Secrets redaction in logs | DOCUMENTED | — | — | ⚠️ | `piiRedaction.ts`, `crypto.ts` present; not asserted by a test |
| Multi-language SDKs | DOCUMENTED (JS/Python) | DOCUMENTED (JS/Py/Java/C#/Go) | — | ⚠️ | Python SDK only (`python-sdk/`) |
| Self-hostable | ❌ | ⚠️ (enterprise) | ✅ | ✅ | Docker + Railway + Vercel; **zero Base44 runtime in the engine layer** |
| Independent of the authoring platform | — | — | — | ⚠️ | engine/operator/SDK verified clean; frontend + 207 functions still platform-bound |
| Independent performance benchmarks | `NOT MEASURED` | `NOT MEASURED` | `NOT MEASURED` | `NOT MEASURED` | no harness executed |
| Documented uptime SLA | DOCUMENTED | DOCUMENTED | — | ❌ | no SLA claim made; none warranted |

## Honest conclusions

**Where CloudBrowser already leads or differentiates (verified in source):**

1. **Self-hosted CAPTCHA solving with no third-party dependency** — the three references either
   offer no CAPTCHA capability or route it through their own paid API.
2. **Dependency-free stealth stack** — fingerprint randomisation, TLS fingerprinting and a human
   behaviour model are in-tree rather than vendor-managed.
3. **Geo-targeted, health-scored, auto-evicting proxy rotation** with ZIP/city/ASN granularity —
   a richer targeting model than either reference documents.
4. **Zombie-session reclamation** driven by a persisted heartbeat table.

**Where CloudBrowser genuinely lags (no parity claim is made):**

1. **No CDP endpoint.** All three references expose CDP; CloudBrowser drives Playwright
   in-process. A CDP surface is the single largest developer-experience gap.
2. **Live view interaction parity is unproven.** A `share` endpoint and a transport doc exist; that
   is not evidence of Browserbase-grade click/type/scroll parity.
3. **No independent performance measurement.** Every latency, throughput, concurrency and cost
   cell is `NOT MEASURED`. **No composite quality score is asserted anywhere in this mission**
   until the benchmark harness has actually been executed and its raw output preserved.
4. **No replay UI**, and no log-parity claim with Browserbase's CDP logs API.
5. **No published SLA.**

## Benchmark harness — design (not yet executed)

To convert `NOT MEASURED` cells into evidence, the harness must:

1. Run against **controlled local fixtures only** — never production, never third-party hosts.
2. Record `p50`/`p95` latency for: session create, navigate, extract, screenshot, job enqueue→complete.
3. Record throughput and concurrency at `POOL_SIZE` = 1, 3, 10 with the engine under test.
4. Measure resource use: peak RSS and CPU seconds per session.
5. Inject faults and record recovery time: worker SIGKILL mid-job, engine restart mid-session,
   forced navigation timeout, expired lease.
6. Publish raw JSON output plus the fixture digests, with environment metadata.
7. Compare only against **identically measured** baselines; a competitor's marketing number is
   never a baseline.

Until step 1–7 have run and their raw output is preserved, this document's competitor columns
stand as DOCUMENTED and CloudBrowser's performance stands as UNVERIFIED.