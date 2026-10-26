# Environment Checklist

## Purpose
Define the non-secret configuration references and connector prerequisites required to implement the autonomous CloudBrowser engineering loop safely.

## Owner
Strategic Minds operator owns secrets/connections. Implementation agents may verify presence/status but never reveal values.

## Static identifiers
- [ ] `CLOUDBROWSER_REPO=XTREME-SYSTEMS/cloudbrowser-control`
- [ ] `CLOUDBROWSER_STAGING_APP_ID=6a8688c834cf23adb0937741`
- [ ] `AUTONOMY_HEARTBEAT_CRON=*/5 * * * *`
- [ ] `AUTONOMY_ENGINEERING_INTERVAL_MINUTES=60`
- [ ] `AUTONOMY_CLEAN_PASSES_REQUIRED=3`
- [ ] `AUTONOMY_CRON_PATH=/api/cron/auto-builder`
- [ ] scoring/validation contract version is pinned

These identifiers are configuration, not secret values.

## Vercel
- [ ] Vercel project for orchestrator selected
- [ ] Workflow capability enabled/validated
- [ ] cron route exists in preview before activation
- [ ] `CRON_SECRET` configured in Vercel secret store when used
- [ ] cron request validation implemented
- [ ] workflow logs/receipts exclude secret values
- [ ] timeout/retry settings documented
- [ ] production deployment remains disabled for this docs phase

## OpenAI
- [ ] `OPENAI_API_KEY` configured in runtime secret store
- [ ] `OPENAI_PRIMARY_MODEL` configured
- [ ] `OPENAI_FALLBACK_MODEL` configured
- [ ] agent contract version configured
- [ ] structured output validation enabled
- [ ] input/output guardrails enabled
- [ ] tracing policy selected
- [ ] traces do not include secrets/private chain-of-thought
- [ ] cost/latency/model routing recorded in receipts

## GitHub
- [ ] authenticated GitHub App/connector can read repository
- [ ] branch creation/write permission is limited to approved branch scope
- [ ] autonomous executor cannot merge `main`
- [ ] autonomous executor cannot force-push
- [ ] candidate SHA verification implemented
- [ ] GitHub Actions status can be read
- [ ] CODEOWNERS is present
- [ ] MAIN BRANCH PROTECTION IS ENABLED before implementation/release automation can advance
- [ ] required status checks are actually enforced by GitHub settings

## Base44 CloudBrowser Control
- [ ] production app is treated read-only unless separately approved
- [ ] existing TestResult and ScoreRecord schemas are readable
- [ ] existing test functions are discoverable
- [ ] secret values remain in Base44 secret/runtime store only

## CloudBrowser Fortress Staging
- [ ] app ID `6a8688c834cf23adb0937741` is accessible
- [ ] staging can execute runtime test suites
- [ ] staging data is isolated from production
- [ ] staging secret set is separate/approved
- [ ] staging engine health endpoint/function is available
- [ ] expected browser pool topology is explicitly configured
- [ ] deployment drift can be measured
- [ ] artifacts/screenshots can be stored with stable references

## Existing runtime secret names to verify, never print
- [ ] `ENGINE_URL`
- [ ] `ENGINE_API_KEY`
- [ ] `ENCRYPTION_KEY` when required by staging tests
- [ ] other required provider keys discovered from source truth

Do not copy values into Vercel/OpenAI/GitHub docs unless the architecture explicitly requires that provider and the operator configures the value through its secret store.

## Durable state store
Implementation must select and validate one canonical store for:
- [ ] project autonomy state
- [ ] hourly lease records
- [ ] work packets
- [ ] validation run metadata
- [ ] approval gates
- [ ] receipt index

If Base44 entities are chosen, schema additions remain approval-gated and must have RLS/security review before creation.

## Required observability
- [ ] heartbeat success/failure metric
- [ ] lease conflicts/stale lease metric
- [ ] planner model/fallback metric
- [ ] work-packet success/failure metric
- [ ] validation score/history
- [ ] critical/high/drift metric
- [ ] clean-pass streak
- [ ] blocked/approval-required alerts

## Required pre-implementation blockers
- [ ] GitHub `main` protection verified active
- [ ] no autonomous production deployment path
- [ ] branch/sandbox rollback path proven
- [ ] staging isolation verified
- [ ] receipt storage selected
- [ ] operator approves implementation phase

## Inputs
Repository/runtime source truth and approved connector/environment configuration.

## Outputs
Pass/fail readiness checklist with no secret values.

## Gates
Any missing protected control keeps the system in docs/validation-only mode.

## Validation receipts
Environment verification receipt records variable/connector NAME, present/missing status, scope, timestamp, and verifier. Never record values.

## Rollback path
If a connector or environment scope is broader than intended, disable autonomous mutation, reduce the scope through operator-controlled settings, then re-run this checklist before resuming.
