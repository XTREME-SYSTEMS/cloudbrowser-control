# Recursive Repair Loop

## Purpose
Convert failed validation evidence into the smallest responsible repair packet, re-run the exact failing check, then run broader regression before accepting the repair.

## Owner
Planner classifies and scopes. Codex repairs. Independent validator decides pass/fail.

## Repair sequence
1. Capture immutable failure signature.
2. Classify failure layer.
3. Identify smallest responsible component/path.
4. Check whether the failure requires a protected action.
5. If protected, transition to `APPROVAL_REQUIRED` and stop.
6. Otherwise create one repair work packet.
7. Record pre-repair candidate SHA.
8. Execute repair on approved branch/sandbox.
9. Re-run the exact failed test first.
10. If exact test still fails, compare failure signature and score delta.
11. If exact test passes, run the nearest category/regression suite.
12. If category passes, run the full validation mesh required by the changed surface.
13. Persist repair receipt.
14. Reset or increment clean-pass state only from independent full validation.

## Failure classification
- specification/acceptance criteria -> `SPEC_FAIL`
- compile/build/lint/typecheck -> `CODE_FAIL`
- schema/data integrity -> `DATA_FAIL`
- authentication/authorization -> `AUTH_FAIL`
- external connector/API -> `INTEGRATION_FAIL`
- SSRF/secrets/RLS/tenant escape -> `SECURITY_FAIL`
- UI/layout/visual regression -> `VISUAL_FAIL`
- worker/session/job/runtime -> `RUNTIME_FAIL`
- unavailable test runner/provider -> `INFRA_BLOCKED`
- forbidden operation/gate conflict -> `GOVERNANCE_BLOCKED`

## Failure signature
Generate a stable hash/reference from:
- test/suite name
- normalized error code/message class
- relevant route/function
- candidate SHA
- environment ID

Do not include secret values or raw sensitive payloads.

## Attempt limits
Default maximum: 3 repair attempts for one work packet/failure family.

Escalate immediately when:
- same normalized failure occurs twice with no meaningful evidence change;
- score declines on two consecutive repair attempts;
- repair creates a new critical/high finding;
- required change exceeds packet scope/budget;
- root cause appears to be production, secret, billing, destructive data, or external human configuration;
- validator evidence contradicts itself.

## Anti-thrash rule
The planner must not alternate between two patches that reproduce the same failure signatures. Detect repeating candidate-state/failure-state pairs and transition to `BLOCKED_REPAIR_LOOP`.

## Repair priority
1. critical security/tenant isolation defects
2. data loss/corruption risk
3. authentication/authorization
4. runtime availability
5. mandatory regression failures
6. functional e2e failures
7. accessibility/visual defects
8. non-mandatory quality improvements

Priority does not authorize protected actions.

## Roll-forward versus rollback
Prefer a minimal repair when:
- root cause is isolated;
- acceptance criteria are clear;
- change is branch-safe;
- regression surface is bounded.

Prefer branch rollback when:
- multiple unrelated regressions appear;
- score materially declines;
- causal change is unclear;
- repair attempts are thrashing;
- security posture worsens.

## Inputs
Failed validation receipt, failure signature, candidate branch/SHA, prior repair attempts, source-truth acceptance criteria.

## Outputs
Repair work packet, blocked/escalation decision, repair receipt, and updated failure history.

## Gates
Never repair by weakening tests, hiding errors, disabling security, expanding permissions, or modifying protected environments.

## Validation receipts
Receipt records failure signature, classification, pre/post SHA, exact test re-run, broader regression result, score delta, attempt number, and next action.

## Rollback path
Use `rollback-rules.md`. A rollback also resets consecutive clean passes to zero and preserves all failed-attempt receipts for diagnosis.
