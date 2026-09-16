# Vercel Workflow Orchestration Contract

## Purpose
Define the durable orchestration loop for CloudBrowser autonomous engineering. Vercel Workflow owns scheduling, idempotency, leases, state transitions, retries, and receipts. It does not own product decisions or production release authority.

## Owner
Strategic Minds operator. Workflow code executes approved policy only.

## Endpoint
`POST /api/cron/auto-builder`

## Trigger
The endpoint is invoked by Vercel Cron every five minutes. The workflow must verify the cron request using `CRON_SECRET` when configured and validate the expected cron schedule header when available.

## Inputs
- `project_id`
- current autonomy state
- current candidate branch and SHA
- `next_engineering_run_at`
- active lease data
- unresolved work packets
- latest validation/score receipts
- GitHub CI status
- CloudBrowser Fortress Staging health and test evidence
- operator approval/block flags

## Outputs
- updated autonomy state
- heartbeat receipt
- engineering lease receipt when applicable
- work-packet receipt when applicable
- validation receipt
- score receipt
- repair/escalation receipt when applicable
- `next_engineering_run_at`

## Five-minute execution sequence
1. Authenticate cron request. Reject unauthenticated or malformed calls.
2. Generate `heartbeat_id` and idempotency key `heartbeat:<project_id>:<UTC-five-minute-bucket>`.
3. Load durable project state. If absent, transition to `BLOCKED_STATE_MISSING` and emit a receipt.
4. Acquire a short heartbeat lease. If already owned, return `NOOP_ALREADY_RUNNING`.
5. Run read-only health checks: engine health, stale sessions/jobs, schedule consistency, deployment drift, unresolved critical/high findings, branch/SHA truth, and receipt continuity.
6. Persist the heartbeat evidence.
7. If project state is terminal or approval-gated, skip mutation and continue monitoring.
8. If `now < next_engineering_run_at`, finish after validation/reconciliation.
9. If `now >= next_engineering_run_at`, attempt the hourly engineering lease defined in `autonomous-state-machine.md`.
10. If the engineering lease is acquired, load a compact evidence packet and call the planning agent.
11. Planning agent may return exactly one of: `WORK_PACKET`, `VALIDATE_ONLY`, `BLOCKED`, `READY_FOR_APPROVAL`, `NOOP`.
12. `WORK_PACKET` may be handed to Codex only when risk class is autonomous-safe and branch scope is valid.
13. Validate the candidate using `validation-mesh.md`.
14. Score the run using `scoring-gates.md`.
15. If failed, route through `recursive-repair-loop.md`.
16. If clean, apply `three-clean-pass-gate.md`.
17. Persist all receipts before releasing the lease.
18. Set `next_engineering_run_at` to the next eligible hourly boundary after an engineering attempt. Validation remains five-minute.

## Idempotency
Required keys:
- heartbeat: `heartbeat:<project_id>:<five_minute_bucket>`
- engineering lease: `engineering:<project_id>:<hour_bucket>`
- validation: `validation:<candidate_sha>:<matrix_version>:<run_nonce>`
- work packet: stable `work_packet_id`
- repair attempt: `<work_packet_id>:repair:<attempt_number>`

Repeated delivery of the same key must return the previously stored result and must not create duplicate changes or duplicate test records.

## Retry policy
- Transient connector/network failure: exponential backoff with jitter, maximum 3 workflow-level retries.
- Model timeout: retry once with same immutable evidence packet, then use configured fallback model; record both attempts.
- Test infrastructure unavailable: mark `INFRA_BLOCKED`, do not count as a clean or failed product pass.
- Deterministic test failure: never hide behind retry; send to repair classification.
- Lease conflict: no retry inside the same invocation; next heartbeat will re-evaluate.

## Concurrency
At most one active heartbeat lease and one active engineering lease per project. An engineering lease owner may renew only while its work packet is actively progressing. Expired leases can be reclaimed only after a receipt marks the previous owner stale.

## Hard gates
The workflow MUST NOT:
- push or merge `main`
- deploy production
- modify production secrets
- execute destructive schema/data operations
- send customer messages
- initiate spend or payments
- self-approve release

Any requested action in these classes becomes `APPROVAL_REQUIRED` with no mutation.

## Validation receipts
Every workflow invocation writes a heartbeat receipt, even for NOOP. Missing receipt means the invocation is unverified.

## Rollback path
Workflow mutation is limited to durable orchestration state and branch/sandbox work. On orchestration defect, disable engineering dispatch, preserve the five-minute read-only monitor, restore the last known-good workflow definition, and mark all in-flight leases stale before resumption.
