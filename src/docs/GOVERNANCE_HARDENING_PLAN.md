# CloudBrowser Control — Post-Incident Governance Hardening Plan

**Date:** 2026-08-20
**Incident:** V1.1 Fortress commit `2910748` escaped branch-only boundary → main → Railway auto-deploy → pool 3/3→0/3.
**Restored baseline (main):** `0035353272cec572ea36cef12bba3aad2793db53` (pre-Fortress)
**Fortress branch:** `fortress/v1.1` @ `2910748fc79d652b2fde8be2cfcc02c9a045631f`
**Engine:** healthy · **Pool:** 3/3 · **Critical:** 0 · **High:** 0
**Status:** DESIGN ONLY — no runtime code or protected settings changed.

---

## 1. GOVERNANCE HARDENING PLAN

### 1.1 Main branch protection
- **Require pull request before merge** to `main` — no direct pushes.
- **Require linear history** (merge queue or squash); no merge commits that bypass CI.
- **Require CODEOWNERS approval** — at least one approval from `@xps-admin` (or designated release approver).
- **Dismiss stale approvals** on new push.
- **Restrict who can push** to matching branches: admins only, and only via PR.
- **Block force-push** to `main` (history is immutable).
- **Block tag deletion** on release tags.

### 1.2 Required PR workflow
- Every change to `main` arrives via PR from a non-`main` branch.
- PR title + body must reference a release/rollback intent.
- **Conversation resolution required** before merge.
- **PR cannot be self-approved** (author ≠ approver).
- **PR must target `main` only**; cross-branch merges to `main` rejected.

### 1.3 Required status checks
All must be **passing and required** before merge is enabled:
- `code-quality` (build + lint + typecheck)
- `engine-syntax` (`node --check browser-engine/server.js`)
- `security-audit` (plaintext-secret scan, hardcoded-key scan, SSRF-guard presence, RLS-on-all-entities)
- `release-gate` (aggregate job: all above green)
- **Branch protection requires these checks to pass on the PR's last commit before merge.**
- Add a **"no-skipping" rule**: status checks cannot be made non-required without an admin-logged override.

### 1.4 Fortress branch rules (`fortress/v1.1`)
- **No direct merges to `main` from `fortress/v1.1`** — only via a release PR.
- `fortress/v1.1` may push freely for development, but is **gated from production** by the release pipeline (§3).
- **Tag Fortress snapshots**: `fortress-snap-<sha>` (e.g. `fortress-snap-2910748`) so the exact escape commit is auditable and re-creatable.
- **Branch never auto-deploys** — Railway production environment is bound to `main` only (§2.4).

### 1.5 Deployment environment gates
- **Two environments:** `preview/staging` and `production`.
- **Production environment** requires a manual approval gate in the deploy system; auto-deploy to production is **disabled**.
- **Environment protection rules:** production requires a reviewer (release approver) and all required status checks.
- **No environment has write access to secrets** except production, and only via the deploy system's secret store — never from a branch build.

### 1.6 Railway production deployment policy
- **Railway watches `main` only.** `fortress/v1.1` and all feature branches are **excluded** from Railway production triggers.
- **Auto-deploy is OFF for production.** Every production deploy is a manual "Deploy" action after PR merge, gated by the environment approval.
- **Deploy freezes:** a deploy freeze window (manual flag) blocks all production deploys during incidents or release windows.
- **Health gate post-deploy:** Railway must report healthy within 90s, else auto-rollback to the previous known-good deployment (§4).
- **Pool gate post-deploy:** `engineHealth.pool_size == 3` within 120s, else auto-rollback.
- **Single-worker standard** remains the production standard; multi-worker requires a separate governance change.

### 1.7 Preview/staging deployment model
- **Preview deploys from PRs** (not from `main`), ephemeral per-PR environment.
- Preview **never** has access to production secrets — it uses a separate, redacted secret set (or stubs).
- Preview **cannot write to production entities** — isolated DB scope or read-only.
- Preview is the only environment where `fortress/v1.1` may run end-to-end.

### 1.8 Rollback procedure
- See §4 (ROLLBACK PIPELINE). Every release ships with a tested rollback path; rollback is a one-command, no-rewrite operation.

### 1.9 Release receipts
- Every production release produces a **signed receipt** in `docs/releases/RELEASE-<version>-<sha>.md`:
  - source SHA (main), Fortress snapshot tag (if applicable), deploy timestamp, Railway deployment ID, health/pool evidence, regression + Fortress matrix scores, approver.
- Receipts are **append-only**; never edited after publication.

### 1.10 Signed/provenance strategy
- **Commit signing:** all merges to `main` must be **GPG/SSH-signed** commits.
- **Release tags:** `v1.0.x`, `v1.1.x` are **signed annotated tags** (`git tag -s`) pointing at the exact main SHA.
- **Provenance artifact:** each release produces a SLSA-style provenance attestation (source SHA, build inputs, build runner, status-check results) stored alongside the release receipt.
- **No unsigned release tags** may be referenced by the deploy system.

### 1.11 Approval boundaries
- **Author ≠ approver** for any `main` merge.
- **Release approver** (designated human, e.g. `@xps-admin`) is the only identity that can (a) approve the production environment deploy, (b) approve a rollback, (c) approve a secret change.
- **Secret changes** require an explicit, logged approval and are **never** part of a code PR.
- **Schema changes** require a separate approval flag in the PR body (`SCHEMA_CHANGE: yes`) and a migration plan.

### 1.12 Base44 builder write boundaries
- The Base44 builder (this AI agent) **must not**:
  - push or merge to `main` directly (no Git tools exist; even if present, prohibited).
  - change production secrets.
  - deploy to production / trigger Railway production deploys.
  - delete production data.
  - modify Railway directly.
  - force-push or rewrite history.
  - approve its own PRs.
- The builder **may**:
  - edit files on `fortress/v1.1` and feature branches.
  - write docs/receipts.
  - run read-only verification (`engineHealth`, `getDeploymentStatus`, entity reads).
  - propose PRs (never merge them).
- **Enforcement:** these boundaries are codified in this document and reviewed at every release gate; any builder action outside this list is an incident.

---

## 2. REQUIRED SETTINGS

### 2.1 GitHub (repository settings — apply via Settings → Branches)
```
Branch protection rule — branch name pattern: main
  ✓ Require a pull request before merging
      - Required approvals: 1
      - Dismiss stale pull request approvals when new commits are pushed
      - Require review from Code Owners
  ✓ Require status checks to pass
      - Require branches to be up to date before merging
      - Required checks: code-quality, engine-syntax, security-audit, release-gate
  ✓ Require conversation resolution before merging
  ✓ Require signed commits
  ✓ Require linear history
  ✓ Do not allow bypassing the above settings
  ✓ Restrict who can push to matching branches: (admins only)
  ✓ Block force pushes
  ✓ Block force pushes and branch deletion
```
```
Branch protection rule — branch name pattern: fortress/*
  ✓ Restrict who can push: (developers)
  ✓ Block force pushes
  (no PR required — free development, but cannot reach production)
```
```
Environment: production
  ✓ Required reviewers: (release approver)
  ✓ Required status checks: release-gate
  ✓ Wait timer: 60s (cooling-off before deploy)
  ✓ Deployment branch: main only
Environment: preview
  ✓ Deployment branch: any PR branch
  (no production secret access)
```
```
CODEOWNERS:
* @xps-admin
/base44/ @xps-admin
/browser-engine/ @xps-admin
/docs/ @xps-admin
```

### 2.2 Railway (production service)
- **Source branch:** `main` only.
- **Auto-deploy:** **OFF** (manual deploys only).
- **Deploy webhook:** gated behind the GitHub `production` environment approval.
- **Health check:** `/health` must return 200 within 90s or auto-rollback.
- **Post-deploy check:** `engineHealth` pool == 3 within 120s or auto-rollback.
- **Watch paths:** exclude `docs/**` from deploy triggers (doc-only commits don't redeploy).

### 2.3 Base44 control plane
- **Auto-deploy of functions:** confirm it follows the corrected `main` only (the incident showed partial/stale propagation — verify the platform redeploys cleanly from main after merge).
- **Function drift check:** `getDeploymentStatus` must report 0 drift before a release is declared complete.
- **Secrets:** unchanged; no builder access.

### 2.4 Secrets
- No changes. Existing: `ENCRYPTION_KEY`, `CAPTCHA_SOLVER_API_KEY`, `ENGINE_API_KEY`, `ENGINE_URL`.

---

## 3. RELEASE PIPELINE (safe V1.1 lifecycle)

```
fortress/v1.1  (development, free pushes, no production access)
      │
      ▼
[1] Test environment (preview/staging from PR)
      │  - ephemeral, no prod secrets, isolated DB
      ▼
[2] Real adversarial Fortress matrix  (runFortressMatrix — 39 gates)
      │  - all static gates PASS (source-verified)
      │  - all runtime gates PASS (engine-dependent, live)
      ▼
[3] Original V1 regression  (runTestSuite 23/23, runMasterReleaseSuite 47/47,
      │  runDeployedTenantIsolationTests 18/18, runMcpBlackBox 18/18,
      │  runContextBlackBox 11/11)
      ▼
[4] Three clean passes  (3 consecutive green runs of [2]+[3] on staging,
      │  no new defects, pool stays 3/3 across all three)
      ▼
[5] Operator approval  (release approver signs off; author ≠ approver)
      ▼
[6] PR  →  main  (from fortress/v1.1, not direct)
      │  - required status checks pass on PR head
      │  - CODEOWNERS approval
      │  - signed commits
      ▼
[7] Protected main  (merge via merge queue; main stays protected)
      ▼
[8] Production canary  (manual deploy to production environment,
      │  health gate + pool gate active, auto-rollback armed)
      ▼
[9] Rollback gate  (if pool ≠ 3/3 or health fails within 120s → auto-rollback,
      │  release aborted, Fortress branch stays intact)
      ▼
[10] Release  (signed tag v1.1.x, provenance attestation, release receipt
       published; drift check = 0; 3 clean runs recorded)
```

**Hard gates (any failure → STOP, no release):**
- Fortress matrix < 39/39 → STOP
- V1 regression < 100% on any suite → STOP
- < 3 clean passes → STOP
- Pool ≠ 3/3 post-deploy → auto-rollback + STOP
- Drift > 0 post-deploy → STOP
- Critical > 0 or High > 0 → STOP

---

## 4. ROLLBACK PIPELINE

**Principle:** rollback is a one-command, no-history-rewrite, no-data-destroy operation. Every release ships with a known-good previous SHA.

```
[1] Trigger: pool ≠ 3/3  OR  health fail  OR  drift > 0  OR  critical > 0
      │
      ▼
[2] Railway auto-rollback  (redeploys previous known-good deployment,
      │  no Git action required) — armed by the health/pool gate
      ▼
[3] If auto-rollback insufficient:
      git checkout main
      git revert <release-commit-sha> --no-edit
      git push origin main          # no force-push
      → Railway manual redeploy from corrected main
      ▼
[4] Verify:
      - engineHealth: healthy, pool 3/3
      - getDeploymentStatus: 0 drift, version = previous-good
      - ErrorPattern: 0 critical, 0 high
      - Session: 0 non-terminal orphans
      - runTestSuite: 23/23
      ▼
[5] Publish rollback receipt  (docs/releases/ROLLBACK-<from>-<to>.md):
      - from SHA, to SHA, timestamp, reason, evidence, approver
      ▼
[6] STOP.  Do not resume Fortress development without a new authorization.
```

**Rollback guarantees:**
- Schema changes are additive-only (e.g. `Webhook.project_id`), so rollback needs no destructive migration.
- Fortress source is preserved on `fortress/v1.1` + snapshot tag — rollback never deletes it.
- Secrets are never changed by a rollback.

---

## 5. FORTRESS RESTART GATE

Before any new V1.1 Fortress development may begin, **all** of the following must be true:

```
GATE A — Baseline integrity
  [ ] main = 0035353272cec572ea36cef12bba3aad2793db53 (or a later signed release tag)
  [ ] engineHealth: healthy, pool 3/3
  [ ] getDeploymentStatus: 0 drift, version = v5.0.0 (V1.0)
  [ ] ErrorPattern: 0 critical, 0 high
  [ ] Session: 0 non-terminal orphans

GATE B — Governance controls in place
  [ ] main branch protection enabled (§2.1)
  [ ] required status checks enforced (code-quality, engine-syntax, security-audit, release-gate)
  [ ] Railway auto-deploy OFF for production; main-only trigger
  [ ] production environment approval gate configured
  [ ] CODEOWNERS set
  [ ] signed commits required on main

GATE C — Fortress source preserved
  [ ] fortress/v1.1 branch exists at 2910748fc79d652b2fde8be2cfcc02c9a045631f
  [ ] fortress-snap-2910748 tag exists (signed)
  [ ] incident documentation intact (docs/FORTRESS_RECEIPTS.md, docs/GOVERNANCE_HARDENING_PLAN.md)

GATE D — Rollback proven
  [ ] rollback procedure executed at least once (dry or real) with a passing receipt
  [ ] previous known-good SHA recorded for the current release

GATE E — Explicit authorization
  [ ] operator (release approver) explicitly authorizes Fortress restart
  [ ] author ≠ approver for the first Fortress PR
```

**Any single unchecked box → Fortress development remains STOPPED.**

---

## 6. Summary

This plan ensures a development commit can never again auto-escape to production:
- **main is protected** (PR + status checks + signed + CODEOWNERS, no direct push, no force-push).
- **Railway production is manual + main-only**, with health/pool auto-rollback.
- **Fortress lives on a branch** that cannot reach production except through the full release pipeline.
- **Every release is signed, receipted, and rollback-tested.**
- **The builder's write boundary is codified** — no main pushes, no secrets, no Railway, no self-approval.

**No runtime code or protected settings were changed in producing this plan.**