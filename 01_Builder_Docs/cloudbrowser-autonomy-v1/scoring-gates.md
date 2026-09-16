# Scoring and Hard-Gate Contract

## Purpose
Separate diagnostic quality scoring from completion/release readiness. A high score can guide repairs but can never override a failed mandatory gate.

## Owner
Validator lane. Planner may consume the score but may not redefine it during a run.

## Base score
Use the repository's existing TestResult point model as the canonical test score:

`quality_score = round(100 * sum(score_points) / sum(max_points))`

`pass_rate = round(100 * passed_tests / total_tests)`

The existing letter grade is informational only.

## Quality bands
- 100: candidate may qualify as a clean pass if every hard gate also passes.
- 95-99: strong but incomplete; repair required.
- 90-94: incomplete; repair required.
- 80-89: degraded; repair required with elevated review.
- <80: failed candidate; consider rollback/scope re-plan.

## Hard gates
All must be true for `clean_pass=true`:
```text
build_pass == true
lint_pass == true
typecheck_pass == true
engine_syntax_pass == true
security_gate_pass == true
runTestSuite == 23/23
runMasterReleaseSuite == 47/47
runDeployedTenantIsolationTests == 18/18
runMcpBlackBox == 18/18
runContextBlackBox == 11/11
runFortressMatrix == 39/39 when applicable
quality_score == 100
pass_rate == 100
critical_count == 0
high_count == 0
deployment_drift_count == 0
staging_health == healthy
expected_pool_health == pass
receipt_integrity == pass
protected_action_violation == false
```

## Release-ready boolean
`release_ready` is NOT set by the autonomous engineering loop.

The loop may set only:
`ready_for_operator_approval = true`

That requires `consecutive_clean_passes >= 3` under `three-clean-pass-gate.md`.

Production release readiness remains a separate human-governed decision.

## Category score
Category scores may be used to prioritize the next repair but must not average away a mandatory failure. A category with a mandatory failed test remains failed even if its weighted score is high.

## Regression delta
Every validation receipt should compute:
- previous score
- current score
- delta
- newly failing tests
- newly passing tests
- unchanged failures

A repair that lowers total score or creates a new mandatory failure is a regression and resets clean passes.

## No-score-gaming rules
Autonomous agents may not:
- remove tests to increase score
- lower expected counts
- mark failures skipped without a rule-based source-truth reason
- lower weights of failing tests during the same candidate cycle
- change score thresholds
- weaken security/tenant isolation assertions

Any such change is `GOVERNANCE_BLOCKED` and requires operator review.

## Inputs
Normalized validation results and TestResult records.

## Outputs
Quality score, pass rate, per-category summary, hard-gate vector, clean-pass boolean, score delta, and repair priority hints.

## Gates
Hard gates override score. Missing evidence is fail/unverified, never pass.

## Validation receipts
Score receipt must reference validation run ID, candidate SHA, test counts, points, hard-gate vector, score delta, and clean-pass decision.

## Rollback path
If scoring logic changes, version the scoring contract, replay it against known historical fixtures, compare results, and require approval before the new version can influence completion state.
