# Rollback Rules

## Purpose
Ensure autonomous branch work can be safely reversed without rewriting main history, hiding evidence, or escalating a staging failure into production.

## Owner
Workflow may execute only branch/sandbox rollback allowed by this contract. Production rollback always requires the separately approved release policy and operator authority.

## Pre-change requirement
Before any autonomous mutation record:
- work packet ID
- target branch
- starting SHA
- candidate baseline score
- known-good validation receipt
- rollback method

No pre-change rollback reference = no autonomous mutation.

## Autonomous rollback scope
Allowed without new production approval:
- abandon an unmerged branch candidate;
- create a revert commit on the autonomous/feature/Fortress branch;
- restore branch-scoped files to the recorded starting SHA through a normal commit;
- discard/recreate an isolated sandbox workspace;
- clear stale non-production orchestration leases after evidence capture.

Not allowed autonomously:
- force-push or rewrite `main`;
- delete protected branches/tags;
- deploy or roll back production;
- restore/alter production databases;
- change production secrets;
- disable audit/security controls.

## Rollback triggers
Rollback should be selected when any of these are attributable to the candidate:
- new critical or high security finding;
- tenant isolation regression;
- material score decline plus multiple new mandatory failures;
- runtime instability or pool-health regression;
- repeated repair thrash;
- changed files exceed authorized scope without a safe split;
- candidate makes source truth ambiguous;
- validator detects test weakening/score gaming.

A single isolated deterministic failure may be repaired instead of rolled back when the root cause is clear and branch-safe.

## Branch rollback procedure
1. Freeze new work packets for the project.
2. Record triggering validation/incident receipt.
3. Verify starting known-good SHA and candidate SHA.
4. Determine whether a normal revert commit or clean branch reconstruction is safer.
5. Apply rollback only on the approved non-main branch.
6. Run V0-V2 static/security validation.
7. Run the regression suites required for the changed surface.
8. Compare result to the known-good receipt.
9. Set candidate SHA to the rollback SHA.
10. Reset consecutive clean passes to zero.
11. Emit rollback receipt.
12. Resume only if state is healthy and policy permits.

## No-history-rewrite rule
Prefer normal revert commits. Force-push is prohibited for autonomous agents. If a branch must be reconstructed, create a new branch from the known-good SHA rather than rewriting protected/shared history.

## Staging rule
Staging state created solely for a candidate may be reset only through approved non-production mechanisms and must not touch production data/secrets. If staging reset is ambiguous, stop and request approval.

## Future production rollback boundary
Before any future production release, a separate approved receipt must capture previous deployment ID/SHA, health gate, data restore strategy, approver, and verification plan. This documentation packet does not authorize that action.

## Inputs
Starting SHA, failed candidate SHA, failure receipts, known-good validation receipt, branch policy.

## Outputs
Rollback decision, rollback candidate SHA, verification results, append-only rollback receipt.

## Gates
No production, main, secret, payment, customer-message, destructive data, or spend action.

## Validation receipts
Rollback is complete only after the restored branch passes the required validation matrix and its result matches or exceeds the known-good baseline without new mandatory failures.

## Rollback path for the rollback system
If rollback automation itself behaves incorrectly, disable autonomous mutation and keep read-only monitoring only. Manual operator review becomes mandatory.
