# CloudBrowser Control — V1.1 Fortress Branch Receipts

**Branch:** V1.1 Production Fortress (development branch from V1.0 lineage)
**V1.0 Rollback Source:** `2d8deadeedb35aa110bdd49f1d93a13f5d56b2a9` (immutable)
**Deployment Version:** v6.0.0 (V1.1 branch)
**Date:** 2026-08-20
**Status:** Code complete on working tree. NOT deployed. NOT merged to main.

> **Governance boundary honored:** No production deployment, no main merge, no
> secret changes, no customer exposure, no production data deletion, no V1.0
> retirement. All changes below are source edits on the Fortress development
> branch only. Runtime verification (matrix, regression, 3 clean runs, rollback
> proof) REQUIRES an operator-authorized deployment and is therefore PENDING.

---

## Changed Files

### 1. `docs/FORTRESS_AUDIT_V1.1.md` (control document)
- **Change:** Added Amendments Addendum (AM-1..AM-8); expanded Fortress Release Matrix from 35 to 39 gates (added gates 36–39: subresource SSRF, CORS fail-closed, dangerous-action capability authorization, container isolation).
- **Finding:** All (control document).
- **Tests:** N/A (documentation).
- **Rollback:** Revert to pre-addendum version.

### 2. `browser-engine/server.js` (engine core)
- **CORS fail-closed (AM-3):** Empty `CORS_ALLOWLIST` no longer permits all cross-origin Origins; same-origin only.
- **Cryptographic tokens (F-07):** `uid()`, `shareToken`, `stateToken` now use `crypto.getRandomValues`/`crypto.randomUUID` (≥128 bits).
- **SSRF DNS resolution (F-02):** Added `isBlockedIp` (IPv4+IPv6) and `resolveAndCheck` (async DNS lookup, fail-closed). `validateTargetUrl` is now async and resolves hostnames before allowing navigation.
- **SSRF subresource/redirect guard (AM-2, F-03):** Installed a `context.route("**/*")` guard that validates every request's host (covers subresources, iframes, page-side fetch/XHR, redirect targets) and applies `blockedResources`.
- **userDataDir rejection (F-08):** Caller-supplied `userDataDir` ignored; always ephemeral non-persistent context.
- **Extension path rejection (F-08):** Only alphanumeric extension IDs from a fixed admin-controlled base (`EXTENSION_DIR`) are loaded.
- **CDP admin gate (F-19):** `enableCDP` honored only when `ALLOW_CDP=true` (default off).
- **Pool bypass (F-13):** Pool skipped when caller-specific options (proxy/headers/blockedResources/networkMocks/cookies/storage/extensions/CDP/video) are provided.
- **Tests:** Gates 3, 4, 9, 10, 14, 20, 36, 37 (Fortress matrix).
- **Rollback:** Revert to V1.0 `server.js` at SHA `2d8deade…`.

### 3. `base44/shared/gatewayCore.ts`
- **Dangerous-action capabilities (AM-4, F-01):** Added `ACTION_CAPABILITIES` map + `requiredCapability()`. The action route enforces per-action capability scopes (`sessions:evaluate`, `sessions:storage`, `sessions:upload`, `sessions:download`, `sessions:captcha`, `sessions:network_mock`, `sessions:crawl`).
- **CDP/proxy session capabilities (AM-4):** `POST /sessions` requires `sessions:cdp` / `sessions:proxy` for those options.
- **runJob project passthrough (F-06):** `POST /jobs/:id/run` passes `keyRecord.project_id` to `runJob`.
- **Rate limiter decrement (F-10):** Rejected requests decrement the counter (no over-count).
- **Tests:** Gates 1, 12, 38.
- **Rollback:** Revert.

### 4. `base44/shared/engineClient.ts`
- **Engine timeout (F-12):** `engineFetch` uses `AbortController` with 30s timeout.
- **engine.url host validation (F-28):** Rejects private/loopback/metadata engine URL overrides.
- **Tests:** Gates 13, 21.
- **Rollback:** Revert.

### 5. `base44/functions/mcpTools/entry.ts`
- **MCP scope enforcement (F-05, AM-4):** Added `TOOL_SCOPES` map; each tool requires its scope (`browser_observe` → `sessions:evaluate`, etc.).
- **context_use non-disclosure (F-09):** Decrypted cookies/storage_state no longer returned to the caller; only lease metadata + auth_state returned.
- **Artifact project scoping (F-14):** `private` AND `project` artifacts scoped by key project; only `public` skips.
- **Tests:** Gates 2, 11, 15.
- **Rollback:** Revert.

### 6. `base44/functions/saveProxy/entry.ts`, `saveWebhook/entry.ts`, `saveProfile/entry.ts`
- **Admin authorization (F-04):** Each function verifies `base44.auth.me().role === "admin"` before any `asServiceRole` operation; non-admins get 403.
- **saveWebhook project_id (F-06):** Accepts and stores `project_id` for inbound job/project scoping.
- **Tests:** Gate 5.
- **Rollback:** Revert.

### 7. `base44/functions/createApiKey/entry.ts`, `createProject/entry.ts`
- **Admin authorization (F-04):** Added `user.role !== "admin"` → 403.
- **Tests:** Gate 5.
- **Rollback:** Revert.

### 8. `base44/functions/runJob/entry.ts`
- **Tenant authorization (F-06):** Accepts `project_id`; rejects if job's project mismatches (admin bypasses).
- **Idempotency (F-06):** Accepts `idempotency_key`; rejects duplicate run while job is `running` (409).
- **Step/duration caps (F-15):** Enforces `max_steps_per_job` and `max_job_duration_min` from SystemSettings; fails job over cap.
- **Tests:** Gates 6, 8, 17.
- **Rollback:** Revert.

### 9. `base44/functions/receiveWebhook/entry.ts`
- **Webhook project scoping (F-06):** Verifies `job.project_id` matches `verifiedWebhook.project_id`; 403 on mismatch.
- **No plaintext fallback (F-17):** Removed `w.secret` legacy fallback; encrypted secret only.
- **Tests:** Gates 7, 18.
- **Rollback:** Revert.

### 10. `base44/functions/triggerWebhook/entry.ts`
- **DNS SSRF hardening (F-02):** `isBlockedUrl` now async with `Deno.resolveDns` (guarded) + `isBlockedIp` for resolved addresses.
- **No plaintext fallback (F-17):** Removed `webhook.secret` legacy fallback.
- **Decrypt fail-closed (F-18):** Corrupted `secret_encrypted` → webhook skipped + logged (no unsigned send).
- **Tests:** Gates 3 (webhook URL), 18, 19.
- **Rollback:** Revert.

### 11. `base44/functions/resumeSession/entry.ts`
- **No plaintext fallback (F-17):** Removed legacy `cookies`/`storage_state` plaintext fallbacks.
- **Rollback:** Revert.

### 12. `base44/entities/Webhook.jsonc`
- **Additive field (F-06):** Added `project_id` (string, optional) for inbound job/project scoping. RLS unchanged.
- **Rollback:** Remove field (additive, no data loss).

### 13. `browser-engine/Dockerfile`
- **Container isolation (AM-5, F-29):** Non-root `engine` user; `USER engine`; ephemeral dir setup; `ALLOW_CDP=false` default; documented runtime flags (`--read-only`, `--tmpfs`, `--cap-drop=ALL`, `--security-opt=no-new-privileges`, `--memory`, `--cpus`, `--pids-limit`).
- **Tests:** Gate 39.
- **Rollback:** Revert to V1.0 Dockerfile.

### 14. `base44/shared/deploymentVersion.ts`
- **Version bump:** `DEPLOYMENT_VERSION` → `v6.0.0` (V1.1 branch). Added `runFortressMatrix` to `FUNCTION_REGISTRY`.
- **Rollback:** Revert to v5.0.0.

### 15. `base44/functions/runFortressMatrix/entry.ts` (NEW)
- **Fortress matrix harness:** Encodes the 39 gates as `TestResult` records. Static gates verify source controls; runtime gates execute engine-dependent suites (skipped if engine not configured). Returns 39-gate score.
- **Rollback:** Delete function + remove from registry.

---

## Findings Coverage

| Finding | Class | Implemented | Gate(s) |
|---------|-------|-------------|---------|
| F-01 evaluate scope | CRITICAL→authz | ✅ | 1, 38 |
| F-02 SSRF DNS/rebinding | CRITICAL | ✅ | 3, 36 |
| F-03 redirect SSRF | HIGH | ✅ | 4, 36 |
| F-04 function authz | HIGH | ✅ | 5 |
| F-05 MCP scopes | HIGH | ✅ | 2 |
| F-06 runJob tenant + idempotency | HIGH | ✅ | 6, 7, 8 |
| F-07 crypto tokens | HIGH | ✅ | 9 |
| F-08 userDataDir/extensions | HIGH | ✅ | 10 |
| F-09 context_use disclosure | HIGH | ✅ | 11 |
| F-10 rate limiter over-count | MEDIUM | ✅ | 12 |
| F-11 XFF trust | MEDIUM | ⏸ deferred (allowlist disabled — latent) | — |
| F-12 engine timeout | MEDIUM | ✅ | 13 |
| F-13 pool honors proxy | MEDIUM | ✅ | 14 |
| F-14 artifact scoping | MEDIUM | ✅ | 15 |
| F-15 quotas + caps | MEDIUM | ✅ (job caps) / ⏸ (gateway quota deferred) | 16, 17 |
| F-16 budget cap | MEDIUM | ⏸ P2 (deferred) | — |
| F-17 plaintext fallback | MEDIUM | ✅ | 18 |
| F-18 decrypt fail-closed | MEDIUM | ✅ | 19 |
| F-19 CDP gate | MEDIUM | ✅ | 20 |
| F-20 dep scanning/SBOM | MEDIUM | ⏸ CI (operator) | 22 |
| F-21 branch protection | MEDIUM | ⏸ GitHub (operator) | 23 |
| F-22 DR runbook | MEDIUM | ⏸ P2 (operator) | 24 |
| F-23 drift cache | MEDIUM | ✅ (documented) | 25 |
| F-24 save_state persistence | LOW | ⏸ P2 | — |
| F-25 audit log source | LOW | ⏸ P3 | — |
| F-26 HKDF/salt | HARDENING | ⏸ P3 | — |
| F-27 alerting | HARDENING | ⏸ P2 (operator) | 26 |
| F-28 engine.url validation | HARDENING | ✅ | 21 |
| F-29 container isolation | HARDENING→P0 | ✅ | 39 |
| AM-3 CORS fail-closed | NEW | ✅ | 37 |
| AM-4 dangerous-action caps | EXPANDED | ✅ | 38 |
| AM-5 container isolation | MOVED FORWARD | ✅ | 39 |

---

## Tests (smallest responsible)

Static/source gates are verified by inspection of the edited source (no
deployment required). Runtime gates are encoded in `runFortressMatrix` and will
execute upon operator-authorized deployment:

- **runFortressMatrix** — 39-gate harness (new function, source only).
- **runTestSuite** — original 23-test runtime suite (unchanged).
- **runMasterReleaseSuite** — 47-gate V1.0 matrix (unchanged).
- **runDeployedTenantIsolationTests** — 18/18 deployed tenant isolation (unchanged).
- **runMcpBlackBox** — 18/18 MCP black-box (unchanged).
- **runContextBlackBox** — 11/11 context black-box (unchanged).

## Failures & Repairs

- **Failure 1:** `saveProxy`/`saveWebhook`/`saveProfile` edits introduced a
  `const user` redeclaration (those functions already declare `user` for audit
  logging).
- **Repair:** Moved `const user` to the top of each function (with the admin
  check) and removed the later redeclaration; the audit-log call reuses the
  top-scoped `user`. All three re-edited successfully.

## Rollback Proof (procedure, not yet executed)

1. Revert all V1.1 source to V1.0 SHA `2d8deadeedb35aa110bdd49f1d93a13f5d56b2a9`.
2. Redeploy affected functions (operator-authorized).
3. `getDeploymentStatus` (direct) → confirm v5.0.0 / 0 drift.
4. `runTestSuite` → confirm 23/23.
5. `runMasterReleaseSuite` → confirm 47/47.
6. Confirm V1.0 baseline (1 active key, 0 webhooks, 0 critical/high).
- **Schema:** V1.1 changes are additive (Webhook `project_id`); no destructive
  schema change, so rollback needs no schema revert.

> **Rollback proof is NOT yet executed** — it requires a deployment, which is
> pending operator authorization.

---

## Production Deployment Status

**NOT EXECUTED.** No functions redeployed. No main merge. No secret changes.
The V1.1 branch is code-complete on the working tree and awaits operator
release approval for deployment + runtime verification.