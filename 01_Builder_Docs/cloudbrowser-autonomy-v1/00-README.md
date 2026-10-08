# CloudBrowser Autonomous Engineering Loop V1

## Purpose
Define the governed control plane that lets CloudBrowser Control continue engineering work autonomously in hourly bounded cycles while validating the system every five minutes until it reaches the three-clean-pass completion gate.

## Source truth
- Repository: `XTREME-SYSTEMS/cloudbrowser-control`
- Documentation branch: `docs/cloudbrowser-autonomy-v1`
- Source baseline SHA: `1da8c5bf4c20581606d2ec746b5fc892aaafe598`
- Runtime validation target: Base44 `CloudBrowser Fortress Staging`, app ID `6a8688c834cf23adb0937741`
- Production is out of scope.

## Operating invariants
1. Vercel Workflow is the durable orchestrator.
2. `/api/cron/auto-builder` is triggered every five minutes by `*/5 * * * *`.
3. Harmless validation may run every heartbeat.
4. Engineering work may begin only when an hourly lease is due and successfully claimed.
5. One bounded work packet is executed per engineering lease unless the packet is validation-only.
6. Autonomous changes are branch/sandbox only.
7. `main`, production deployment, production secrets, payments, destructive data changes, customer messages, and live publishing are hard-gated.
8. A missing validation receipt is a failure, not a pass.
9. Quality score and release readiness are separate concepts.
10. Completion requires three consecutive clean full-matrix validation runs on the same candidate SHA.
11. Completion changes the project to `READY_FOR_OPERATOR_APPROVAL`; autonomous mutation stops.
12. The five-minute heartbeat continues read-only after completion.

## Builder documents
- `workflow-vercel.md`
- `cron-5min.md`
- `autonomous-state-machine.md`
- `openai-agent-contract.md`
- `codex-work-packet-protocol.md`
- `validation-mesh.md`
- `scoring-gates.md`
- `recursive-repair-loop.md`
- `three-clean-pass-gate.md`
- `receipts-schema.md`
- `rollback-rules.md`
- `env-checklist.md`

## Inputs
Approved operator architecture, current GitHub source, existing Base44 test functions, TestResult/ScoreRecord evidence, CloudBrowser Fortress Staging runtime evidence, and GitHub CI evidence.

## Outputs
A deterministic orchestration contract and evidence schema suitable for later implementation by a coding agent without granting production authority.

## Gates
- Docs approval gate before implementation.
- Branch-only implementation gate.
- Validation gate before any PR proposal.
- Operator approval before release.

## Validation receipts
Every future implementation or run must emit receipts conforming to `receipts-schema.md` into `03_Bridge_Receipts` or the canonical durable registry selected during implementation.

## Rollback path
Documentation changes can be reverted on the documentation branch. Future code work must create a pre-change checkpoint and rollback receipt before mutation.

## Owner
Strategic Minds operator. Autonomous agents are executors/validators, never release approvers.
