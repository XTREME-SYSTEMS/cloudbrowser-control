# Three-Clean-Pass Completion Gate

## Purpose
Prevent a single lucky green run from ending autonomous engineering. Completion requires repeated, independent evidence on an unchanged candidate.

## Owner
Validator lane calculates the streak. Operator alone decides whether a completed candidate advances toward release.

## Clean-pass requirements
A run counts as one clean pass only when `scoring-gates.md` returns `clean_pass=true` and `validation-mesh.md` V0-V9 are complete.

## Consecutive pass rule
Required streak: 3.

All three runs must:
1. have unique validation `run_id` values;
2. test the exact same candidate SHA;
3. use the same validation-matrix/scoring contract version;
4. target CloudBrowser Fortress Staging;
5. have no code/config mutation between runs;
6. be separated by at least one five-minute heartbeat boundary;
7. maintain healthy staging runtime across the interval;
8. preserve critical=0, high=0, drift=0;
9. preserve expected pool health;
10. have complete receipts.

Minimum evidence window: three full validations over at least 10 elapsed minutes between the first and third start times. A policy may later increase this interval, but autonomous agents may not shorten it.

## Streak transitions
- clean pass on same SHA -> `consecutive_clean_passes += 1`
- any deterministic mandatory failure -> reset to 0
- candidate SHA change -> reset to 0
- matrix/scoring contract version change -> reset to 0
- critical/high finding -> reset to 0
- drift >0 -> reset to 0
- protected-action violation -> reset to 0 and transition to blocked
- infrastructure-blocked run -> streak is preserved but not incremented; next successful run must still be clean

## Completion transition
When pass #3 is recorded:
```text
state = READY_FOR_OPERATOR_APPROVAL
autonomous_mutation_enabled = false
next_engineering_run_at = null
```

The five-minute heartbeat continues read-only monitoring. It may detect a regression but cannot resume autonomous mutation unless policy allows a repair state or the operator re-authorizes it.

## Post-completion regression
If a mandatory regression is detected while waiting for approval:
- transition to `REGRESSION_DETECTED`/`REPAIR_REQUIRED` only if branch-safe repair autonomy remains explicitly enabled by policy;
- otherwise transition to `PAUSED` and request operator decision;
- never retain a stale three-pass completion receipt after candidate state changes.

## Completion receipt
Required fields:
- candidate SHA
- three validation run IDs
- start/end timestamps
- score and hard-gate vector for each run
- runtime-health evidence for the interval
- streak-reset history since last code change
- final state transition

## Inputs
Validation/score receipts and immutable candidate SHA.

## Outputs
Updated streak and, at 3, completion receipt plus `READY_FOR_OPERATOR_APPROVAL` state.

## Gates
Three clean staging passes do not authorize production deployment or main merge.

## Validation receipts
The completion receipt references all child receipts and their artifact hashes/IDs.

## Rollback path
Any new candidate SHA or proven regression invalidates the completion receipt and resets the streak to zero. The old receipt remains append-only historical evidence.
