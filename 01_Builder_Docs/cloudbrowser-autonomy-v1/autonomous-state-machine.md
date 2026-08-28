# Autonomous State Machine and Hourly Lease

## Purpose
Define the durable project state and concurrency rules that allow autonomous engineering to stop, resume, recover after failures, and continue across stateless agent invocations.

## Owner
Strategic Minds operator owns approval state and release authority. Workflow owns mechanical state transitions.

## Canonical states
- `DOCS_APPROVED`
- `READY_FOR_BRANCH_IMPLEMENTATION`
- `MONITORING`
- `ENGINEERING_DUE`
- `PLANNING`
- `WORK_PACKET_READY`
- `EXECUTING_BRANCH_WORK`
- `VALIDATING`
- `REPAIR_REQUIRED`
- `INFRA_BLOCKED`
- `APPROVAL_REQUIRED`
- `READY_FOR_OPERATOR_APPROVAL`
- `PAUSED`
- `FAILED_SAFE`

## Durable project state
```json
{
  "project_id": "cloudbrowser-control",
  "repo": "XTREME-SYSTEMS/cloudbrowser-control",
  "staging_app_id": "6a8688c834cf23adb0937741",
  "state": "MONITORING",
  "candidate_branch": null,
  "base_sha": null,
  "candidate_sha": null,
  "next_engineering_run_at": null,
  "engineering_interval_minutes": 60,
  "lease_owner": null,
  "lease_acquired_at": null,
  "lease_expires_at": null,
  "hour_bucket": null,
  "active_work_packet_id": null,
  "latest_validation_run_id": null,
  "latest_quality_score": null,
  "consecutive_clean_passes": 0,
  "critical_count": 0,
  "high_count": 0,
  "deployment_drift_count": null,
  "approval_required": false,
  "autonomous_mutation_enabled": false,
  "last_receipt_id": null
}
```

No secret values are stored in this state.

## Hourly lease key
`engineering:<project_id>:<UTC-hour-bucket>`

Example bucket format: `2026-08-20T06`.

## Lease acquisition
An engineering lease may be acquired only when all are true:
1. `autonomous_mutation_enabled == true`.
2. state is not approval-gated, paused, complete, or failed-safe.
3. `now >= next_engineering_run_at`.
4. no unexpired engineering lease exists.
5. candidate branch is allowed and is not `main`/`master`.
6. current source baseline has not drifted unexpectedly.
7. no critical safety/governance blocker is open.

Lease acquisition must be an atomic compare-and-set. The winner records `lease_owner`, timestamps, hour bucket, and idempotency key before calling an agent.

## Lease duration
Default TTL: 50 minutes. The lease may be renewed in bounded increments only while the same work packet is active. Renewal never moves the next engineering cadence earlier.

## Crash recovery
If `lease_expires_at < now` and no completion receipt exists:
1. mark previous lease `STALE`;
2. preserve active work packet and evidence;
3. inspect branch SHA for partial changes;
4. run validation before any new edit;
5. either resume the same bounded packet or roll it back;
6. emit recovery receipt.

## State transitions
`MONITORING -> ENGINEERING_DUE` when hourly due.

`ENGINEERING_DUE -> PLANNING` after successful lease.

`PLANNING -> WORK_PACKET_READY` for one safe packet.

`PLANNING -> APPROVAL_REQUIRED` for protected action.

`PLANNING -> VALIDATING` for validate-only decision.

`WORK_PACKET_READY -> EXECUTING_BRANCH_WORK` after Codex contract validation.

`EXECUTING_BRANCH_WORK -> VALIDATING` after candidate SHA/patch receipt.

`VALIDATING -> REPAIR_REQUIRED` on deterministic product failure.

`VALIDATING -> INFRA_BLOCKED` on unavailable validation infrastructure.

`VALIDATING -> MONITORING` on clean pass count below three.

`VALIDATING -> READY_FOR_OPERATOR_APPROVAL` after third consecutive clean pass.

Any state -> `PAUSED` by operator.

Any unsafe ambiguity -> `FAILED_SAFE` or `APPROVAL_REQUIRED`.

## Next engineering time
After an engineering attempt is finalized, set `next_engineering_run_at = max(previous_due + 60 minutes, now + safety_floor)` where the safety floor prevents immediate re-entry. A validation-only heartbeat does not consume the hourly engineering lease unless it was chosen by the planner during a due engineering cycle.

## Completion behavior
`READY_FOR_OPERATOR_APPROVAL` sets `autonomous_mutation_enabled=false`. The five-minute heartbeat remains active in read-only mode.

## Inputs
Current project state, GitHub branch/SHA, staging evidence, receipts, and operator decisions.

## Outputs
Deterministic transition plus lease/transition receipt.

## Gates
No transition can confer production authority. Approval state can only be set by verified operator input or an approval registry record.

## Validation receipts
Every state transition records previous state, new state, reason, evidence IDs, actor, timestamp, and idempotency key.

## Rollback path
A corrupted state record is reconstructed from GitHub SHA, latest valid receipts, and staging evidence. Ambiguity resolves to `PAUSED`/`FAILED_SAFE`, never to autonomous mutation.
