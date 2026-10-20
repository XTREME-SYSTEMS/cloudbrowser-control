# Phase 4 — Base44 Dependency Audit

**Mission:** X1-CLOUDBROWSER-ONE-AND-DONE-2026
**Recorded:** 2026-10-20
**Verdict: MIGRATION INCOMPLETE — see the verified counts below.**

This audit reports measured numbers only. No claim of "verified removal" is made for any layer
that still contains platform coupling.

---

## 1. Measured coupling

| Measure | Count | Command |
|---|---|---|
| Frontend files importing the platform client | **145** | `grep -rl "base44Client\|@base44/sdk" src \| wc -l` |
| Backend functions using the platform request SDK | **206** of 207 | `grep -rl "createClientFromRequest" base44/functions \| wc -l` |
| Backend functions using service-role access | **122** | `grep -rl "asServiceRole" base44/functions \| wc -l` |
| Distinct backend functions invoked from the frontend | **110** | `grep -roh "functions\.invoke( *[\"'][A-Za-z0-9_-]*" src \| …` |
| Entities served only by the platform database | **113** | `ls base44/entities \| wc -l` |
| Workflows bound to platform triggers | **23** | `ls base44/workflows \| wc -l` |
| Agents bound to platform runtime | **20** | `ls base44/agents \| wc -l` |
| Connectors bound to platform OAuth | **6** | `ls base44/connectors \| wc -l` |

### What is already clean (verified)

| Layer | Base44 imports |
|---|---|
| `browser-engine/` | **0** |
| `operator/` | **0** |
| `python-sdk/` | **0** |
| `api/` (this mission) | **0** |
| `worker/` (this mission) | **0** |
| `shared/` (this mission) | **0** |
| `db/` (this mission) | **0** |

Files outside `src/` and `base44/` that still reference the platform, and why each is acceptable:

| File | Reference | Assessment |
|---|---|---|
| `package.json` | `@base44/sdk`, `@base44/vite-plugin` | **required while the frontend still runs on the platform** — removed with the frontend port |
| `vite.config.js` | platform build plugin | same |
| `package-lock.json` | transitive | same |
| `docs/releases/*.json` | a hash recorded in a receipt | documentation only |

## 2. Replacement map with status

| # | Platform dependency | Portable replacement | Status |
|---|---|---|---|
| 1 | `base44.auth.me / loginWithProvider / verifyOtp / setToken / logout` | API-key + tenant resolution (`api/lib/auth.js`) | **service side BUILT · frontend PENDING** |
| 2 | `base44.entities.<113>` | PostgreSQL schema + RLS (`db/migrations/001_portable_core.sql`) | **core tables BUILT · 113-entity port PENDING** |
| 3 | `base44.functions.invoke(<110>)` | Versioned REST (`api/`) + durable worker (`worker/`) | **gateway + queue BUILT · per-function port PENDING** |
| 4 | `base44.asServiceRole` (122 functions) | Worker role with `BYPASSRLS` and explicit service paths | **role BUILT · call sites PENDING** |
| 5 | Platform storage | `artifacts` table + storage adapter | **table BUILT · adapter PENDING** |
| 6 | Platform AI integrations | provider-neutral adapter layer | **PENDING** |
| 7 | Platform workflow triggers (23) | Scheduler + queue-driven workflows | **PENDING** |
| 8 | Platform OAuth connectors (6) | Direct OAuth with own client credentials | **PENDING** |
| 9 | Platform in-app agents (20) | Self-hosted agent loop | **PENDING** |
| 10 | Platform hosting | Docker + Railway + Vercel services | **engine/operator/api/worker configs PRESENT** |

## 3. What "removal" would require — honest scope

To make the *whole* system independently deployable, the following must happen, and none of it is
complete as of this audit:

1. Port **113** entity schemas to SQL tables with equivalent RLS. (Core 5 tables done; 108 remain.)
2. Port **207** backend functions to REST handlers or workers. (0 of 207 ported; a gateway and a
   worker runtime now exist to receive them.)
3. Port **145** frontend files off `@/api/base44Client` onto the portable API client.
4. Port **23** workflows off platform triggers.
5. Port **20** agents.
6. Replace platform OAuth connectors with directly-held credentials.
7. Replace platform AI integrations with a provider-neutral adapter.
8. Delete `@base44/sdk` and `@base44/vite-plugin` from `package.json`.

Item 8 is the single objective test of completion: **as long as those two packages are in
`package.json`, the system is not Base44-free.** They are still there today.

## 4. Reproduction

Every figure in this document is reproducible from the repository root:

```bash
# inventory
ls base44/entities | wc -l
ls base44/functions | wc -l
ls base44/workflows | wc -l
ls base44/agents | wc -l
ls base44/shared | wc -l
find src/pages -type f | wc -l
find src/components -type f | wc -l

# coupling
grep -rl "base44Client\|@base44/sdk" src | wc -l
grep -rl "createClientFromRequest" base44/functions | wc -l
grep -rl "asServiceRole" base44/functions | wc -l
grep -rn "@base44\|base44Client\|createClientFromRequest" browser-engine operator python-sdk api worker shared db
```

The last command must print **nothing** for the portable layers to be considered clean. It does.

## 5. Verification test

`tests/portable-core.contract.test.mjs` asserts the portable isolation invariant automatically:
it walks every **source** file (`.js .mjs .cjs .ts .tsx .jsx .py .json .sql .toml`) under
`browser-engine/`, `operator/`, `python-sdk/`, `api/`, `worker/`, `shared/` and `db/` and fails
the suite if any of them references `@base44/sdk`, `base44Client`, `createClientFromRequest`,
`base44.entities`, `base44.functions`, `base44.auth` or `base44.integrations`. Markdown is
excluded on purpose: integration documentation may describe the platform it is being migrated
away from. Coupling can therefore only be reintroduced by breaking the build.

**Two deliberate exclusions, both verified:**

* **Markdown** — integration docs may name the platform they describe.
* **Test files** — one existing engine suite, `browser-engine/tests/skiptrace-integrity.test.js:47`,
  asserts that `src/pages/StrategicReport.jsx` still contains
  `base44.entities.SkipTrace.filter(`. It **reads platform source as a fixture**; it does not
  depend on the platform runtime. `grep` confirms the engine runtime (`browser-engine/*.js`,
  `browser-engine/self-solvers/*.js`) and `operator/*.js` import nothing from the platform.

That fixture assertion is a **migration tripwire**: it will fail as soon as the frontend stops
using the platform data API, and must be rewritten at that point. It is recorded in
`PHASE1_CAPABILITY_INVENTORY.md` §2 so the work is not lost. A separate test confirms the
reference is confined to test files and that all four service entry points
(`browser-engine/server.js`, `operator/index.js`, `api/server.js`, `worker/worker.js`) import
nothing from the platform.