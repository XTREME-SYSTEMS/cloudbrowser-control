# Cutover runbook — move this stack to a new GitHub and Railway account

Read this end to end before starting. Steps 1–6 leave the running production
stack untouched; only step 7 moves traffic, and step 8 undoes it.

**Shape of the migration.** The new stack is stood up *beside* the old one and
verified while the old one keeps serving. The cutover itself is three secret
values in the Base44 app — `ENGINE_URL`, `ENGINE_URL_2`, `ENGINE_URL_3` — which
is what makes the switch instantly reversible.

---

## 0. Prerequisites

| Need | Why |
|---|---|
| New GitHub account | destination for the repository |
| New Railway account | destination for the services |
| Node 24 | the services pin `node:24`; the gate checks this |
| Railway CLI, authenticated to the new account | the CLI cannot set watch patterns; the dashboard does |
| Terminal at the repository root | every command below assumes it |
| Old stack still deployable | it is your rollback |

## 1. Prepare

```bash
git status                      # must be clean, or know exactly what is uncommitted
git log --oneline -5            # note where you are
```

**Commit this bundle and the engine hardening before you start.** The push script
refuses to run against a dirty tree, and it pushes commits — not files. Review the
diff first: it should contain `portable/`, `browser-engine/pool-healer.js`,
`browser-engine/tests/pool-self-heal.test.js`, the `browser-engine/server.js`
edits, `browser-engine/railway.toml` and the `docker-compose.yml` comment fix.

Decide the branch. Everything below assumes `main`.

## 2. Generate the three missing lockfiles — BLOCKING

`api/`, `worker/` and `browser-engine/` ship without committed lockfiles, so
their builds are not reproducible and the repository's own release gate **fails**
on this. Only `operator/` has one. Generate them once:

```bash
npm install --package-lock-only --omit=optional --prefix api
npm install --package-lock-only --omit=optional --prefix worker
npm install --package-lock-only --omit=optional --prefix browser-engine
git add api/package-lock.json worker/package-lock.json browser-engine/package-lock.json
git commit -m "build: commit lockfiles so every deployable service rebuilds reproducibly"
```

Do this **before** pushing. A lockfile generated later means the new account's
first builds are unreproducible.

Optional, afterwards: once a lockfile exists, switch the engine Dockerfile from
`npm install --production --omit=optional` to `npm ci --omit=dev --omit=optional`
for a reproducible install. Do not make that change before the lockfile exists,
or the image build fails.

## 3. Run the pre-flight gate

```bash
./portable/scripts/preflight.sh
```

If a script reports `Permission denied`, run it as `bash portable/scripts/preflight.sh`
or restore the bit with `chmod +x portable/scripts/*.sh`. Some editors and file
transfers silently drop it.

It must exit `0`. It re-runs the contract suites, checks the isolation
invariant, checks the lockfiles from step 2, and refuses to proceed if a real
credential is sitting in the environment template.

## 4. Create the repository in the new GitHub account

Create an **empty** repository there — no README, no `.gitignore`, no licence,
so the first push has nothing to reconcile.

## 5. Push, then check history for leaked secrets

```bash
NEW_GITHUB_REPO=git@github.com:<new-account>/cloudbrowser-control.git \
  ./portable/scripts/push-to-new-account.sh --dry-run     # review what it will do
NEW_GITHUB_REPO=git@github.com:<new-account>/cloudbrowser-control.git \
  ./portable/scripts/push-to-new-account.sh
```

A push carries the **whole history**. If a credential was ever committed, the
new account now holds it too. The script scans for tracked env files and will
tell you what it finds; treat anything it reports as compromised and rotate that
credential before the new stack goes live.

## 6. Create the new Railway project

1. **New Project → Deploy from GitHub repo** → the repository from step 5.
2. Add **PostgreSQL** from Railway's database templates.
3. Create four services from the same repository. For each one set the root
   directory, watch patterns and healthcheck from **`SERVICES.md` §1 and §2**.
   Getting the watch patterns right is what stops a `src/` edit from rebuilding
   the engines.
4. Enter the variables from **`SERVICES.md` §3**. `ENGINE_API_KEY` must be the
   same value in the engine, the gateway and the worker.
5. Apply the schema once the database is up:

   ```bash
   psql "$NEW_DATABASE_URL" -f db/migrations/001_portable_core.sql
   ```

6. Deploy. Watch the **worker**: it has no HTTP surface, so a successful deploy
   is confirmed from its logs, not from a healthcheck.

## 7. Verify, then cut over

```bash
ENGINE_URL=https://<new-engine-domain> \
ENGINE_API_KEY=<new-engine-key> \
./portable/scripts/verify-deployment.sh
```

It asserts that each engine can **launch a real browser**, that the hardened
`self_heal` surface is present, and that a pool recycle restores warm capacity.
Do not cut over on a green `/health` alone — that is precisely the signal that
was lying before.

Add the second and third engines to the same command if you created them
(`ENGINE_URL_2`, `ENGINE_URL_3` — each with its own `ENGINE_API_KEY_2` /
`_3` if the values differ).

Then, in the Base44 app: **Dashboard → Secrets**, replace `ENGINE_URL`,
`ENGINE_URL_2` and `ENGINE_URL_3` with the new engine domains. Point the
operator at the new account by replacing `RAILWAY_TOKEN` and the project id it
watches. Run `verify-deployment.sh` once more against the values the app now
holds, then stop the **old** services.

> Confirm the exact secret names in the dashboard before editing — this runbook
> names the three the app reads today, but the dashboard is the source of truth.

## 8. Rollback

Rollback is the same three values. Restore the previous `ENGINE_URL*` secrets and
the app is back on the old engines in seconds, provided you have **not** yet torn
the old services down. Keep the old services running until you have watched the
new stack handle real traffic for at least one full working day.

If the new stack misbehaves after the old services are gone, redeploy the old
stack from the previous commit — do not attempt an in-place repair of a stack you
have just cut over to.

---

## Known gaps, stated plainly

* **Lockfiles are not committed.** Step 2 fixes it; until then the repository's
  release gate fails by design.
* **Rate limiting is per replica, not global** — in-process state. Accepted
  limitation, needs a shared store.
* **The engine's browser pool is process-local.** Sessions live on the engine
  that created them, so routing around a briefly-unready engine strands live
  work. The healer therefore only moves traffic on a real outage.
* **`railway.toml` does not win.** The dashboard overrides it; `numReplicas = 3`
  in the file while the live service reports 1.
* **The environment template does not cover the whole surface.** The
  "every variable is documented" test scans only `api/`, `worker/` and `shared/`.
  See `SERVICES.md` §3 for the engine and operator variables it misses.
* **No staging target has been verified.** `docs/portable/MISSION_STATE.json`
  records `phase8_cloud_deployment: NOT ATTEMPTED`; this bundle makes the move
  reproducible but does not claim it has been executed.