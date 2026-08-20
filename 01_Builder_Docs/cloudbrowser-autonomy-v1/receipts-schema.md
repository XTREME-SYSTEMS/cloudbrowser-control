# Receipt Schema

## Purpose
Create an append-only evidence contract for every meaningful autonomous action, validation, failure, repair, approval boundary, and rollback.

## Owner
Workflow/validator writes machine receipts. Operator decisions are stored as operator-decision receipts. Receipts are evidence, not secrets storage.

## Canonical location
Repository-side durable references live under `03_Bridge_Receipts/` when GitHub receipts are appropriate. Runtime copies may also be stored in the canonical Base44/registry layer selected during implementation. All copies must share the same `receipt_id`.

## Receipt types
- `DISCOVERY`
- `MCP_ACTION`
- `HEARTBEAT`
- `LEASE`
- `STATE_TRANSITION`
- `AGENT_DECISION`
- `WORK_PACKET`
- `CODE_EXECUTION`
- `VALIDATION`
- `SCORE`
- `REPAIR`
- `COMPLETION`
- `APPROVAL`
- `ROLLBACK`
- `INCIDENT`

## Canonical JSON shape
```json
{
  "receipt_version": "1.0",
  "receipt_id": "RCP-<type>-<timestamp>-<nonce>",
  "receipt_type": "VALIDATION",
  "created_at": "RFC3339 UTC",
  "project_id": "cloudbrowser-control",
  "repo": "XTREME-SYSTEMS/cloudbrowser-control",
  "branch": "...",
  "base_sha": "...",
  "candidate_sha": "...",
  "environment": {
    "class": "staging|sandbox|none",
    "base44_app_id": "6a8688c834cf23adb0937741"
  },
  "actor": {
    "class": "workflow|planner|codex|validator|operator|connector",
    "id": "non-secret identifier"
  },
  "workflow": {
    "heartbeat_id": "...",
    "lease_id": "...",
    "work_packet_id": "...",
    "validation_run_id": "...",
    "trace_id": "..."
  },
  "action": "normalized action name",
  "inputs": {
    "evidence_ids": [],
    "contract_versions": {}
  },
  "result": {
    "status": "PASS|FAIL|BLOCKED|NOOP|APPROVAL_REQUIRED",
    "summary": "concise factual summary",
    "metrics": {}
  },
  "tests": [],
  "artifacts": [
    {
      "artifact_id": "...",
      "type": "...",
      "hash": "...",
      "location_ref": "non-secret reference"
    }
  ],
  "errors": [
    {
      "class": "...",
      "code": "...",
      "message_sanitized": "...",
      "failure_signature": "..."
    }
  ],
  "gates": {
    "main_write": false,
    "production": false,
    "secret_change": false,
    "destructive": false,
    "spend": false,
    "customer_message": false,
    "approval_required": false
  },
  "score": {
    "quality_score": null,
    "pass_rate": null,
    "critical_count": null,
    "high_count": null,
    "drift_count": null,
    "clean_pass": null,
    "consecutive_clean_passes": null
  },
  "rollback": {
    "required": false,
    "rollback_ref": null,
    "previous_known_good_sha": null
  },
  "next_action": "...",
  "parent_receipt_ids": [],
  "content_hash": "sha256 of canonical receipt excluding content_hash"
}
```

## Test receipt item
```json
{
  "suite": "...",
  "test_name": "...",
  "status": "pass|fail|skip|not_applicable|infra_blocked",
  "duration_ms": 0,
  "expected": "...",
  "actual_sanitized": "...",
  "artifact_ids": [],
  "failure_signature": null
}
```

## Data rules
- timestamps are UTC RFC3339;
- SHA fields use full commit SHA when known;
- secret values, tokens, cookies, passwords, private keys, raw authorization headers, and private chain-of-thought are forbidden;
- reasoning is stored only as concise reason codes/summaries;
- receipts are append-only after finalization;
- corrections create a new receipt referencing the superseded receipt;
- a missing required receipt blocks a pass.

## Receipt lineage
Completion receipt -> validation receipts -> score/test/artifact receipts -> code/work-packet receipt -> planner/lease/heartbeat receipt.

Rollback receipt -> triggering failure/incident receipt -> previous known-good receipt.

## Inputs
Sanitized action evidence from workflow, GitHub, Base44 staging, agent runtime, and validators.

## Outputs
Canonical immutable receipt plus stable ID/hash.

## Gates
Receipt storage must not become a secret side channel. Sensitive raw logs must stay in their authorized system and be referenced by sanitized IDs.

## Validation receipts
Receipt schema itself is validated using JSON schema/type validation during implementation and versioned when changed.

## Rollback path
Schema evolution is additive/versioned. Never rewrite historical receipts to a new schema; migrate readers instead.
