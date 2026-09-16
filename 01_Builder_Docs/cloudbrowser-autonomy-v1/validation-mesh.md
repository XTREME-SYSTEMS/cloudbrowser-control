# CloudBrowser Validation Mesh

## Purpose
Define the independent evidence matrix that every autonomous candidate must pass. No agent self-report can substitute for these receipts.

## Owner
QA/validator lane under Strategic Minds governance. Coding executor is not the authority for final pass/fail.

## Source-truth suites already present
- npm build/lint/typecheck scripts
- GitHub Release Gate
- browser-engine syntax/security checks
- `runTestSuite`
- `runMasterReleaseSuite`
- `runDeployedTenantIsolationTests`
- `runMcpBlackBox`
- `runContextBlackBox`
- screenshot-diff and artifact evidence functions
- engine health/deployment drift functions

## Validation stages

### V0: Source truth and scope
PASS requires:
- repo equals `XTREME-SYSTEMS/cloudbrowser-control`
- target branch is approved and not main/master
- candidate SHA exists on target branch
- changed files match work-packet scope
- no protected-action flag was crossed

### V1: Static code quality
Run or obtain receipts for:
- dependency install using lockfile-compatible command
- `npm run build`
- `npm run lint`
- `npm run typecheck`
- `node --check browser-engine/server.js`

Any failure is deterministic `CODE_QUALITY_FAIL`.

### V2: Security/static governance
Require the equivalent of the repository Release Gate checks:
- plaintext secret/password/cookie/storage-state schema scan
- hardcoded CloudBrowser API key scan
- SSRF guard presence
- RLS presence across applicable entities
- dependency/security checks configured for the candidate

Security checks may not be disabled or weakened by an autonomous packet without approval.

### V3: Core runtime regression
Staging target only.
Required target:
- `runTestSuite`: 23/23
- pass rate: 100%

### V4: Master release matrix
Staging target only.
Required target:
- `runMasterReleaseSuite`: 47/47
- all mandatory categories pass

### V5: Isolation and black-box suites
Required targets:
- `runDeployedTenantIsolationTests`: 18/18
- `runMcpBlackBox`: 18/18
- `runContextBlackBox`: 11/11

### V6: Fortress/adversarial matrix
When the candidate changes Fortress/security/runtime behavior or is on the Fortress release path:
- `runFortressMatrix`: 39/39

If the suite is not applicable, the receipt must say `NOT_APPLICABLE` with a rule-based reason. Missing is not N/A.

### V7: Browser/e2e/visual evidence
For changed user-facing behavior:
- route smoke tests
- critical user flows
- desktop and mobile viewport checks
- screenshot artifacts
- screenshot-diff result against approved baseline where available
- console/network error review

Visual checks may not replace functional assertions.

### V8: Runtime health and deployment truth
Staging only. PASS requires:
- engine health healthy
- browser pool expected size 3/3 when that staging topology is active
- deployment drift count 0
- critical findings 0
- high findings 0
- no non-terminal orphan sessions attributable to the run

If staging topology differs from 3/3 by approved configuration, the expected topology must be stored in source truth and receipted. Do not silently relax the gate.

### V9: Receipt integrity
PASS requires:
- every required stage has a receipt
- every receipt references candidate SHA and run ID
- artifacts have stable IDs/hashes where available
- no contradictory pass/fail result is unresolved

## Full clean pass definition
A run is `CLEAN` only when V0-V9 all pass or are explicitly rule-based N/A, with zero mandatory failures, zero critical/high findings, and zero drift.

## Failure classes
- `SPEC_FAIL`
- `CODE_FAIL`
- `DATA_FAIL`
- `AUTH_FAIL`
- `INTEGRATION_FAIL`
- `SECURITY_FAIL`
- `VISUAL_FAIL`
- `RUNTIME_FAIL`
- `INFRA_BLOCKED`
- `GOVERNANCE_BLOCKED`

## Inputs
Candidate SHA, work-packet contract, staging app ID, GitHub CI, Base44 test/runtime functions, approved visual/source baselines.

## Outputs
One immutable validation-run receipt with child receipts per stage and a normalized failure list.

## Gates
Preview/staging pass does not equal production pass. This mesh can advance only to `READY_FOR_OPERATOR_APPROVAL`.

## Validation receipts
Timestamp, run ID, candidate SHA, suite versions, commands/function names, counts, durations, errors, artifacts, score, and next action are required.

## Rollback path
Any deterministic regression resets clean-pass count to zero and routes to repair or branch rollback. Infrastructure failure does not trigger product rollback until the candidate is proven responsible.
