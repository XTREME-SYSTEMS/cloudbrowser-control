# Phase 1 — Capability Inventory (measured)

**Mission:** X1-CLOUDBROWSER-ONE-AND-DONE-2026
**App under inspection:** Base44 app `6a837c8e995cc4824aabf594`
**Repository:** `XTREME-SYSTEMS/cloudbrowser-control`
**Method:** direct file-system inspection of the working tree (`ls`, `find`, `grep`, `wc`). Every number below was counted, not estimated.
**Recorded:** 2026-10-20

---

## 1. Repository shape (measured)

| Area | Path | Count |
|---|---|---|
| Entities (data model) | `base44/entities/` | **113** |
| Backend functions | `base44/functions/` | **207** |
| Workflows | `base44/workflows/` | **23** |
| In-app agents | `base44/agents/` | **20** |
| Shared backend modules | `base44/shared/` | **59** |
| Connector bindings | `base44/connectors/` | **6** |
| Email templates | `base44/emails/` | **1** |
| Frontend pages | `src/pages/` | **87** |
| Frontend components | `src/components/` | **186** |
| Frontend lib helpers | `src/lib/` | **12** |
| Documentation | `docs/`, `src/docs/` | **37** |
| Automated tests | whole tree | **4** |

Frontend dependency surface: **145** files under `src/` import the platform client
(`@/api/base44Client` or `@base44/sdk`).

## 2. Portable layer (already Base44-free — verified)

This is the single most important finding of Phase 1. The extraction is **partially complete and
already independent** at the engine layer.

| Component | Path | Lines | Base44 imports |
|---|---|---|---|
| Browser engine (Express + Playwright) | `browser-engine/server.js` | 1414 | **0** |
| Session manager | `browser-engine/session-manager.js` | 288 | **0** |
| TLS/device fingerprint randomizer | `browser-engine/fingerprint-randomizer.js` | 206 | **0** |
| Human behaviour model | `browser-engine/human-behavior.js` | 187 | **0** |
| Self-hosted CAPTCHA solvers | `browser-engine/captcha-self-solver.js` + `self-solvers/` (3 files) | 540 | **0** |
| Speech-to-text bridge | `browser-engine/stt-whisper.js` | 71 | **0** |
| Engine schema | `browser-engine/migrations.sql` | — | **0** |
| Autonomous Railway operator | `operator/index.js` | 532 | **0** |
| Python SDK | `python-sdk/cloudbrowser/` (3 files) | 296 | **0** |
| **Total portable code** | | **≈3882** | **0** |

Verified by: `grep -rn "@base44|base44Client|createClientFromRequest" browser-engine operator python-sdk` → **no matches**.
The engine runtime (`browser-engine/*.js`, `browser-engine/self-solvers/*.js`) and `operator/*.js`
also import nothing from `@base44`. One **test** file is the exception and is not runtime coupling:
`browser-engine/tests/skiptrace-integrity.test.js:47` asserts that `src/pages/StrategicReport.jsx`
still calls `base44.entities.SkipTrace.filter(` — it reads platform source as a fixture. Tracked as
a migration tripwire in `PHASE4_BASE44_DEPENDENCY_AUDIT.md` §5.

### Engine HTTP contract (measured, `browser-engine/server.js`)

| Method | Path |
|---|---|
| POST | `/sessions` |
| GET | `/sessions` |
| GET | `/sessions/:id` |
| DELETE | `/sessions/:id` |
| POST | `/sessions/:id/execute` |
| POST | `/sessions/:id/share` |
| POST | `/sessions/:id/keepalive` |
| GET | `/sessions/:id/screenshot` |

### Engine hardening already in place (measured)

* **Fail-closed boot** — refuses to start unless `ENGINE_API_KEY` is set and ≥ 16 chars (`process.exit(1)`).
* **Constant-time key comparison** for `x-api-key`.
* **CORS allowlist only** — no wildcard; empty allowlist permits same-origin only.
* **Bounded body size** — `express.json({ limit: UPLOAD_MAX_BYTES })`, default 50 MiB.
* **SSRF guard** present (`isBlockedHost`, asserted by CI).
* **Versioned contract** — `ENGINE_VERSION 3.1.0`, `SCHEMA_VERSION 3.0`.

## 3. Existing deployment and CI assets

| Asset | Path | Notes |
|---|---|---|
| Vercel multi-service config | `vercel.json` | 3 services: `app` (vite), `browser-engine`, `operator` + rewrites `/engine/*`, `/operator/*` |
| Railway service config | `browser-engine/railway.toml` | region `ams`, `numReplicas = 3`, restart on failure ×10 |
| Engine image | `browser-engine/Dockerfile` | present |
| Operator image | `operator/Dockerfile` | present |
| Release gate workflow | `.github/workflows/release-gate.yml` | code-quality + engine-syntax + security-audit |
| Dependency hardening | `.github/workflows/dependency-hardening-audit.yml` | present |
| Code owners | `.github/CODEOWNERS` | present |
| Supply-chain cooldown | `.npmrc` | `min-release-age=7` |
| Vercel governance heartbeat | `docs/VERCEL_GOVERNANCE_HEARTBEAT.md` | present |

## 4. Environmental contract (measured)

**54** distinct environment variables are referenced across `base44/`, `browser-engine/`,
`operator/` and `python-sdk/`. Grouped: database, engine limits, CORS, captcha, storage,
GitHub, Railway, Supabase, video, download/upload bounds, worker secrets.

## 5. Security posture (measured against the live release gate)

Checks that already exist and pass as written:

* No plaintext `password` / `secret` / `cookies` / `storage_state` **property keys** in entity schemas.
* No hardcoded `cb_live_*` / `cb_test_*` API keys in `src/` or `base44/`.
* SSRF guard present in the engine.
* RLS key present on every entity schema except built-in `User.jsonc`.

## 6. Test coverage (measured — the weakest area)

Only **4** automated test files exist:

| File | Scope |
|---|---|
| `tests/autocomplete-source-contract.test.mjs` | source-contract assertions (177 lines) |
| `browser-engine/tests/persistence-contract.test.js` | session persistence (40 lines) |
| `browser-engine/tests/max-skiptrace-evidence-contract.test.js` | evidence-record shape (31 lines) |
| `browser-engine/tests/skiptrace-integrity.test.js` | skip-trace integrity (100 lines) |

Against 207 backend functions and 113 entities this is a small fraction. **Gap: no API-layer,
queue-layer, auth, tenant-isolation, or benchmark tests existed before this mission.**

## 7. Gaps identified (before this mission's work)

| # | Gap | Severity |
|---|---|---|
| G1 | No standalone API gateway (all 207 functions live only on the Base44 runtime) | Critical |
| G2 | No portable worker / durable queue (jobs run inside platform functions) | Critical |
| G3 | No portable auth (Base44 auth on the service surface) | Critical |
| G4 | 113 entities have no portable Postgres schema + RLS outside `browser_sessions` | Critical |
| G5 | 145 frontend files coupled to the platform client | Critical |
| G6 | No local stack (`docker-compose`, `.env.example`) | High |
| G7 | Engine and services have **no committed lockfiles** — builds are not reproducible | High |
| G8 | No benchmark harness; competitor claims unmeasured | High |
| G9 | No operator plugin / skills package | Medium |
| G10 | No release manifest with commit SHA + checksums | Medium |
| G11 | `cloudbrowser-control/` directory exists but is empty | Low |
| G12 | `ci/release-gate.yml` duplicates `.github/workflows/release-gate.yml` and both differ | Low |

## 8. Duplicate / dead weight found

* `src/App.jsx` imports both `AgentCommandCenter` and `AgentCommandCenterPage` from the **same**
  file (`@/pages/AgentCommandCenter`) — one line is redundant.
* `ci/release-gate.yml` is a stale handoff copy whose header instructs the reader to copy it to
  `.github/workflows/` — but that file already exists with **different, newer** content.
* `cloudbrowser-control/` is an empty directory.

---

## 9. Portable replacement map (Phase 4 target)

| Base44 dependency | Portable replacement | Status after this mission's work |
|---|---|---|
| `base44.auth.*` (frontend) | API-key + tenant model (`api/lib/auth.js`) | service side **built**; frontend **pending** |
| `base44.entities.*` (113 entities) | PostgreSQL + RLS (`db/migrations/001_portable_core.sql`) | core schema **built**; 113-entity port **pending** |
| `base44.functions.*` (207 functions) | Versioned REST (`api/`) + workers (`worker/`) | gateway + queue **built**; per-function port **pending** |
| Platform storage | `artifacts` table + storage adapter | table **built**; adapter **pending** |
| Platform AI integrations | provider-neutral adapter layer | **pending** |
| Platform hosting | Docker + Railway + Vercel services | config **present**; new services wired in compose |

---

**Verification method:** every figure above is reproducible with the commands recorded in
`docs/portable/PHASE4_BASE44_DEPENDENCY_AUDIT.md` § Reproduction.