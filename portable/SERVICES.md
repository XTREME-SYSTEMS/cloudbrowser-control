# Service, watch-pattern and variable manifest

Everything you enter in the new Railway account. Values are deliberately absent —
this file is safe to commit, because it names variables and never carries one.

## 1. Services

Four services plus a database. `Root directory` is relative to the repository
root and matters: it is what makes one repository deploy four different things.

| Service | Root directory | Builder | Healthcheck | Port | Auto-deploy |
|---|---|---|---|---|---|
| `cloudbrowser-engine` | `browser-engine` | Dockerfile | `/health` | `8080` | watch pattern only |
| `cloudbrowser-api` | `api` | Dockerfile | `/health` | `4000` (`API_PORT`) | watch pattern only |
| `cloudbrowser-worker` | `worker` | Dockerfile | **none** — no HTTP surface | — | watch pattern only |
| `railway-operator` | `operator` | Dockerfile | `/operator/health` | `8081` (`PORT`) | watch pattern only |
| `Postgres` | — | Railway database | — | — | n/a |

Deploy three engine services (`engine`, `engine-2`, `engine-3`) if you want the
fleet topology this repository currently runs. They are three services sharing
one root directory, not three replicas of one service.

`browser-engine/railway.toml` also carries the deploy settings, but the Railway
dashboard wins over the file. Note the discrepancy: the file says
`numReplicas = 3` while the live `cloudbrowser-engine` service reports **1**, so
set the replica count in the dashboard rather than trusting the file.

## 2. Watch patterns — set these, or every push rebuilds the fleet

**Every one of the nine services in the current project has an empty watch
pattern.** With an empty watch pattern a service rebuilds on *any* push to its
branch — so a documentation edit redeploys all three engines and the operator.
That is why a commit once triggered a fleet-wide rebuild nobody asked for.

Set them explicitly in the new account:

| Service | Watch patterns |
|---|---|
| `cloudbrowser-engine` (and `-2`, `-3`) | `browser-engine/**` |
| `cloudbrowser-api` | `api/**`<br>`shared/**`<br>`db/migrations/**` |
| `cloudbrowser-worker` | `worker/**`<br>`shared/**` |
| `railway-operator` | `operator/**` |

A change to `src/` or `base44/` must never rebuild an engine. If a pattern is
empty, the service is not scoped — treat an empty pattern as a defect.

## 3. Variables

Set these per service in the new account. `MUST replace` means the value is an
account-specific credential that cannot be reused from the old deployment.

### Engine — `browser-engine`

| Variable | Purpose | |
|---|---|---|
| `ENGINE_API_KEY` | authenticates every engine call | MUST replace |
| `PORT` | listen port (default `8080`) | |
| `MAX_SESSIONS` | concurrent session ceiling (default `10`) | |
| `POOL_SIZE` | warm browser pool (default `3`) | |
| `DEFAULT_TIMEOUT` | action timeout, ms | |
| `SESSION_TTL_MS` | idle session TTL | |
| `VIDEO_DIR` | recording directory | |
| `ENFORCE_HTTPS` | reject non-HTTPS targets | |
| `CONFIG_VERSION` | config label surfaced in `/config` | |
| `CORS_ALLOWLIST` | allowed origins | |
| `CRAWL_MAX_PAGES`, `CRAWL_MAX_DEPTH`, `CRAWL_DELAY_MS` | bounded-crawl limits | |
| `UPLOAD_MAX_BYTES`, `DOWNLOAD_MAX_BYTES` | transfer ceilings | |
| `BROWSER_CPU_LIMIT`, `BROWSER_MEMORY_LIMIT` | resource ceilings | |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | session persistence. **Optional** — the engine disables the session store when unset | MUST replace if used |
| `CAPTCHA_SOLVER_API_KEY`, `TWOCAPTCHA_API_KEY` | CAPTCHA solving | MUST replace if used |

### Engine — self-healing controls (new in this clone)

All four have safe defaults; set them only to retune.

| Variable | Default | Effect |
|---|---|---|
| `SELF_HEAL_ENABLED` | `true` | `false` disables the self-restart. Failure counting and backoff continue either way |
| `LAUNCH_FAILURE_EXIT_THRESHOLD` | `6` | consecutive launch failures, with an empty pool, before the container exits for a fresh one |
| `WARM_BACKOFF_BASE_MS` | `15000` | first backoff after a failed warm-up |
| `WARM_BACKOFF_MAX_MS` | `300000` | backoff ceiling — stops a broken container being hammered |

### API — `api`

| Variable | Purpose | |
|---|---|---|
| `API_PORT` | listen port (default `4000`) | |
| `API_KEY_PEPPER` | peppers stored API-key hashes — **changing it invalidates every issued key** | MUST set fresh |
| `DATABASE_URL` | PostgreSQL connection (read via `shared/db.js`) | MUST replace |
| `PG_POOL_MAX`, `PGSSLMODE` | pool sizing / TLS mode | |
| `ENGINE_URL` | engine base URL the gateway calls | MUST replace |
| `ENGINE_API_KEY` | must match the engine's | MUST replace |
| `ENGINE_REQUEST_TIMEOUT_MS`, `ENGINE_HEALTH_TIMEOUT_MS` | upstream timeouts | |
| `RATE_LIMIT_PER_MINUTE` | in-process rate limit. Per replica, not global — see the limitation note below | |
| `API_BODY_LIMIT` | request body ceiling | |
| `CORS_ALLOWLIST` | allowed origins | |

### Worker — `worker`

| Variable | Purpose | |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection (read via `shared/db.js`) | MUST replace |
| `ENGINE_URL`, `ENGINE_API_KEY` | engine the worker drives | MUST replace |
| `POLL_INTERVAL_MS`, `WORKER_CONCURRENCY` | polling cadence and parallelism | |
| `LEASE_MS` | job lease before it is considered abandoned | |
| `BACKOFF_BASE_MS`, `BACKOFF_MAX_MS` | retry backoff | |
| `REAP_INTERVAL_MS` | how often expired leases are reclaimed | |

### Operator — `railway-operator`

| Variable | Purpose | |
|---|---|---|
| `RAILWAY_TOKEN` / `RAILWAY_API_TOKEN` | Railway access. A **project**-scoped token cannot manage the workspace or create environments | MUST replace |
| `PROJECT_ID` | the Railway project the operator watches | MUST replace |
| `GITHUB_TOKEN` | repository access for deploy inspection | MUST replace |
| `GITHUB_OWNER`, `GITHUB_REPO` | the repository to watch | MUST replace |
| `PORT` | listen port (default `8081`) | |
| `POLL_INTERVAL_MS` | monitor cadence | |
| `AUTO_FIX_DEPLOYS` | whether the operator redeploys a failed service on its own | |
| `CLOUD_BROWSER_UI_WEBHOOK` | where it reports back | |

### Notes that are easy to get wrong

* **`ENGINE_API_KEY` must be identical** in the engine, the gateway and the
  worker. Three services, one value, or every call fails closed.
* **`API_KEY_PEPPER` cannot be rotated casually** — it invalidates all issued API
  keys. Choose it once for the new account.
* **Rate limiting is per replica, not global.** In-process state; a shared store
  is needed to fix it. Recorded as an accepted limitation, not a solved problem.
* **The operator's token is currently project-scoped**, so it cannot manage the
  workspace or create environments. Use a workspace-scoped token in the new
  account if you want full self-healing.
* **`POSTGRES_*`** in the env template are for the local `docker-compose.yml`
  stack only; Railway injects `DATABASE_URL` for the managed database.
* **Some engine and operator variables are absent from `.env.example`**:
  `CAPTCHA_API_KEY`, `CAPTCHA_SERVICE_TOKEN`, `AUTO_FIX_DEPLOYS`,
  `CLOUD_BROWSER_UI_WEBHOOK`, `PROJECT_ID`. The repository's
  "every environment variable is documented" test only scans `api/`, `worker/`
  and `shared/`, so the engine and operator surface is not covered by it. Worth
  widening, and worth knowing before you rely on the template as a checklist.
* `RAILWAY_REGION`, `RAILWAY_REPLICA_ID`, `HOSTNAME`, `REGION` are injected by
  the platform — do not set them.