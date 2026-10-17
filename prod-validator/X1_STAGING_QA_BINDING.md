# X1 Independent Staging Validator Route (branch-only repair)

## Current result
- Source branch: repair/x1-independent-qa-route-20261017
- Source repository: XTREME-SYSTEMS/cloudbrowser-control
- Original checkout SHA: 34dda4668acbc4151655d1741ccad299871473b2
- Added POST /api/x1/validate-preview handler in prod-validator/server.mjs.
- The URL returned HTTP 404 before the source repair. **No live service has been changed.**
- The handler refuses unauthenticated calls; with no provider bindings it returns HTTP 503 VALIDATOR_PROVIDER_NOT_BOUND.
- The route cannot assert a PASS unless all independently provided service callbacks succeed, and a persisted receipt is independently fetched back.
- Local test suite: node --test prod-validator/x1-task-qa.test.mjs.

## Inputs and separations required
1. Bind a distinct **staging-only** validator identity and strong provider-managed inbound token. Do not reuse the builder, JARVIS, generic browser MCP token, production token, or Supabase service-role key.
2. Implement readWork against the authoritative X1 staging queue and lease through an independently permission-scoped read-only provider route. Confirm work_id, tenant_id, task_id, source SHA, status LEASED, holder, lease expiry and environment preview. Re-fetch before completion.
3. Implement inspectPreview using the existing independent Xtreme Cloud Browser, with actual desktop and mobile captures, noindex, HTML byte hash, navigation and calculator action verification. Do not trust the build request to self-attest.
4. Implement persistAndReadBack as an idempotent transaction through a separately authorized staging-only receipt writer, followed by read-back; require worker/task/lease/source/hash/deployment and distinct validator identity.
5. Configure the existing X1 staging worker with X1_PREVIEW_QA_ENDPOINT, X1_PREVIEW_QA_TOKEN and X1_PREVIEW_QA_VALIDATOR_ID only through approved provider-native secret bindings. Do not disclose values.
6. Validate a live synthetic READ_ONLY dispatch with signed authorization, existing queue, one worker lease, one execution ledger record, and exactly one worker ACK. For interruption/recovery test, use a controlled approved staging fixture and demonstrate no duplicated committed effect before release.

## Contract safety
- This source change is **not** a live deployed validator.
- The callback interfaces readWork, inspectPreview and persistAndReadBack are intentionally unbound; the entrypoint fails closed without them.
- The existing Railway worker version dd186b7de199f05998e5c69a41d8af1547e28eb2 was not modified.
- Existing Supabase ACL currently permits queue mutation RPC to service_role only; new validator permissions/RLS and secrets require separate scoped approval.
- Never create a second worker, scheduler, or platform-wide reconciler.
- No production release or customer messaging. Rollback is discard/close this isolated branch. Verify a distinct independent PASS before any staging activation.
