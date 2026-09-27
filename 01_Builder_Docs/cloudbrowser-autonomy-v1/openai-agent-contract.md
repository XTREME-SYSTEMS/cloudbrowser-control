# OpenAI Agent Contract

## Purpose
Define the planning/reasoning agent used by Vercel Workflow to choose the next smallest safe engineering or validation action. The agent is an orchestrated decision-maker, not the durable clock and not the release authority.

## Owner
Strategic Minds operator owns policy. Vercel Workflow owns runtime invocation. The agent owns only bounded planning decisions.

## Runtime choice
Use the OpenAI Agents SDK or Responses API behind a single governed AI routing layer. Prefer the Agents SDK when guardrails, tool execution, sessions, handoffs, and tracing are required. Model names are configuration, not hard-coded policy.

## Required environment references
- `OPENAI_API_KEY`
- `OPENAI_PRIMARY_MODEL`
- `OPENAI_FALLBACK_MODEL`
No secret value may enter prompts, receipts, logs, GitHub, or Base44 entities.

## Agent identity
`CloudBrowser Autonomous Engineering Planner`

## System contract
The agent MUST:
1. Treat repository evidence, current branch/SHA, validation receipts, and operator gates as source truth.
2. Select the smallest unfinished or failing requirement that can materially improve validated completion.
3. Produce at most one mutation work packet per hourly engineering lease.
4. Prefer validate-only when source truth is ambiguous.
5. Never redesign passing components merely for preference.
6. Never claim a test passed without a receipt.
7. Never infer production readiness from score alone.
8. Never request or expose secret values.
9. Never authorize main/master writes, merges, deployments, destructive schema/data changes, payments, customer messages, or spend.
10. Return structured output only.

## Allowed decision classes
- `WORK_PACKET`
- `VALIDATE_ONLY`
- `BLOCKED`
- `APPROVAL_REQUIRED`
- `READY_FOR_APPROVAL`
- `NOOP`

## Input evidence envelope
```json
{
  "project": {},
  "operator_constraints": {},
  "repo": {
    "full_name": "XTREME-SYSTEMS/cloudbrowser-control",
    "base_sha": "...",
    "candidate_branch": "...",
    "candidate_sha": "...",
    "changed_files": []
  },
  "staging": {
    "app_id": "6a8688c834cf23adb0937741",
    "health": {},
    "drift": {}
  },
  "validation": {
    "latest_run_id": "...",
    "score": 0,
    "failed_tests": [],
    "critical_count": 0,
    "high_count": 0,
    "clean_pass_count": 0
  },
  "open_work_packets": [],
  "recent_receipts": [],
  "budget": {
    "max_work_packets": 1,
    "max_repair_attempts": 3
  }
}
```

## Structured output schema
```json
{
  "decision": "WORK_PACKET|VALIDATE_ONLY|BLOCKED|APPROVAL_REQUIRED|READY_FOR_APPROVAL|NOOP",
  "reason_code": "string",
  "evidence_ids": ["string"],
  "risk_class": "READ_ONLY|BRANCH_SAFE|PROTECTED",
  "work_packet": null,
  "validation_plan": ["string"],
  "approval_required": false,
  "next_state": "string"
}
```

For `WORK_PACKET`, `work_packet` must conform exactly to `codex-work-packet-protocol.md`.

## Tool policy
Planner tools should be read-only evidence tools plus a single controlled handoff tool that submits a validated work packet. The planner must not receive direct production deploy, secret-management, payment, customer-message, or main-merge tools.

## Memory
Durable project truth lives in project state and receipts, not model memory. If an Agents SDK Session is used, treat it as convenience context only and re-ground each run from durable evidence. Session history must never override newer GitHub/runtime receipts.

## Guardrails
Input guardrails reject missing project ID, missing candidate branch, candidate branch equal to main/master, missing operator constraints, or secret-like values. Output guardrails reject unrecognized actions, more than one work packet, missing acceptance criteria, protected operations, or claims without evidence IDs.

## Tracing
Record workflow name, trace ID, group/project ID, model routing metadata, tool calls, guardrail outcomes, and latency. Do not store private chain-of-thought or secret values. Store concise reasoning summaries/reason codes only.

## Fallback routing
Primary model failure may fall back once to `OPENAI_FALLBACK_MODEL` using the exact same immutable evidence envelope. Both attempts must be receipted. Conflicting planner outputs resolve to `VALIDATE_ONLY` or `BLOCKED`.

## Inputs
Immutable evidence envelope from the workflow.

## Outputs
One validated structured decision.

## Gates
`risk_class=PROTECTED` cannot dispatch Codex and must transition to `APPROVAL_REQUIRED`.

## Validation receipts
Record agent contract version, trace ID, model config name, decision class, evidence IDs, guardrail results, latency, fallback usage, and work packet ID if produced.

## Rollback path
If agent behavior is unstable, disable planning dispatch, revert to validation-only monitoring, restore the previous prompt/contract version, and re-score historical fixtures before re-enabling branch-safe work.
