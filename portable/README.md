# Portable clone — CloudBrowser browser infrastructure

A self-contained copy of the browser infrastructure that runs on Railway, plus
everything an operator needs to stand it up under a **new GitHub account** and a
**new Railway account** without touching the stack that is serving today.

## What travels

| Layer | Path | Deploys as | State |
|---|---|---|---|
| Browser engine | `browser-engine/` | `cloudbrowser-engine` — Playwright, stealth, CAPTCHA chain | in production |
| API gateway | `api/` | `cloudbrowser-api` — versioned REST, tenant isolation, job intake | built, never deployed |
| Durable worker | `worker/` | `cloudbrowser-worker` — leases, bounded retries, dead-letter | built, never deployed |
| Railway operator | `operator/` | `railway-operator` — autonomous deploy monitor | in production |
| Shared layer | `shared/` | PostgreSQL pool + helpers | built |
| Schema | `db/migrations/` | PostgreSQL schema (RLS, core tables) | built |
| Python SDK | `python-sdk/` | not deployed — client library | present |

## What does not travel, and why

* **`src/` and `base44/`** — the Base44-side application: the dashboard, 145
  frontend files, 113 entity schemas, 207 backend functions, 23 workflows, 20
  agents, 6 OAuth connectors. It is still coupled to the platform, and
  `docs/portable/PHASE4_BASE44_DEPENDENCY_AUDIT.md` measures that coupling
  honestly. It moves when the frontend port lands, not before.
* **Secrets.** Never copied, never read. `SERVICES.md` lists every variable *by
  name*; you enter the values in the new account yourself.
* **Records.** The clone carries schema, not data. Moving data is a separate,
  deliberate operation with its own verification and rollback.

## Verified clean before you start

No file under `browser-engine/`, `api/`, `worker/`, `operator/`, `shared/` or
`db/` references the Base44 runtime. That invariant is enforced mechanically by
`tests/portable-core.contract.test.mjs` — coupling can only be reintroduced by
breaking the build.

| Check | Result |
|---|---|
| Engine suite, including the self-heal contract | 26 pass / 0 fail |
| Portable-core isolation contract | 41 pass / 0 fail |
| Service entry-point syntax | 4 / 4 |
| External credential fields in the env template | empty |
| **Lockfiles for `api/`, `worker/`, `browser-engine/`** | **MISSING — blocking, see CUTOVER step 2** |

## Reliability hardening carried by this clone

The primary engine was failing intermittently in production: it answered
`/health` as `"healthy"` with a full-looking pool while being unable to start a
single browser ("spawn … EAGAIN"). A pooled session that failed part-way through
creation left its Chromium process behind, and the `catch` that should have
reported it was `catch (e) { break; }` — no log, no counter, nothing. Every
two-minute re-warm leaked another process until the container ran out of room.

`browser-engine/pool-healer.js` now enforces four rules, each covered by
`browser-engine/tests/pool-self-heal.test.js`:

1. a browser that does not reach the pool is always closed — no orphan processes;
2. a pooled session whose browser has died is dropped, never handed to a caller;
3. failures are counted, logged and backed off exponentially instead of swallowed;
4. once no browser can start and no warm capacity remains, the engine **exits**
   so its restart policy recreates the container — leaked processes cannot be
   reclaimed from inside it, so a fresh container is the only real cure.

`/health` now reports `status: "degraded"`, `pool_deficit` and a `self_heal`
block instead of claiming health it does not have. `POST /pool/recycle` drains
and re-warms on demand.

## Order of operations

1. **`CUTOVER.md`** — the runbook. Read it first.
2. **`SERVICES.md`** — the service, watch-pattern and variable manifest you enter
   in the new account.
3. **`scripts/preflight.sh`** — must pass before anything is pushed.
4. **`scripts/push-to-new-account.sh`** — mirror the repository to the new account.
5. **`scripts/verify-deployment.sh`** — smoke the new stack once it is deployed.

Every script prints usage with `--help`.