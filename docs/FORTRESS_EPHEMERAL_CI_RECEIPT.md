# Fortress Ephemeral CI Receipt

- Tested commit: 011a2315890b7ddaa75441168d832a2e9a1da70f
- Workflow run: 32361440900
- Run attempt: 1
- Source/security gates: success
- Hardened container/browser smoke: success
- Overall ephemeral validation: PASS
- Production deployment: NOT EXECUTED
- Main merge/write: NOT EXECUTED
- Production secrets/data: NOT USED
- DNS-rebinding TOCTOU: NOT VERIFIED unless separate network-layer evidence exists

This receipt proves only the GitHub Actions ephemeral environment represented by this run. It does not prove Railway staging or production readiness.

## Automation audit 2026-08-20T11:05Z

- Validation heartbeat candidate: 011a2315890b7ddaa75441168d832a2e9a1da70f
- Enterprise Integration run 32361440914: PASS
- Enterprise Parallel run 32361440889: PASS
- Ephemeral Validation run 32361440900: PASS
- Branch Rollback Rehearsal run 32361440861: PASS
- Release Readiness run 32361440917: HOLD by design
- Container soak: 5/5 PASS under PID limit 256, pool 3/3, four concurrent sessions, metadata navigation blocked, final UID 10001
- Dependency Critical: 0
- Dependency High: 0
- Base44 isolated Test Data state: COULD NOT VERIFY; available AUTO BUILDER bridge routed Base44 inspection to dry-run/manual-receipt fallback because no provider adapter is implemented
- Observed main remains b1bb5af6b93b46aeb3e5edd762f70be6d3777336, two commits ahead of approved baseline 1da8c5bf4c20581606d2ec746b5fc892aaafe598
- Main drift attribution: commits 324ce8293ef9dba97296123ee4dc9315796364b7 and b1bb5af6b93b46aeb3e5edd762f70be6d3777336 were authored/committed by base44-builder[bot] and add unrelated Intelligence entities/function/workflow
- Main write/merge by this automation: NOT EXECUTED
- Production deploy/mutation by this automation: NOT EXECUTED

## Automation audit 2026-08-20T12:52Z

- Starting fortress/v1.1 HEAD: cc1d5050120fcab2cb0074abb86b85bc0d963c0d
- Starting main HEAD: b1bb5af6b93b46aeb3e5edd762f70be6d3777336
- Production Base44 read-only schema inspection: 40 entities observed; IntelligenceEvent, IntelligenceRun, IntelligenceSignal, IntelligenceSnapshot, and IntelligenceSource are present, consistent with the two base44-builder[bot] main-drift commits and not part of the approved production baseline.
- Latest stored Runtime Evidence Test Suite v2 score: 23/23 PASS, 100%, run_id run_1787192455421_lnj3lr.
- Latest production engine health observation at 2026-08-20T12:50:12.600Z: healthy, engine_version 3.0.0, pool 3/3, max_sessions 10, worker 24a3da65-305d-458e-805f-8cc94dac0371.
- Canonical Fortress runtime candidate remains 91f516c2feb002103de37268dfcb72cb9ded73f6 and is NOT deployed to production; production engine version 3.0.0 is direct evidence that the Fortress candidate has not been promoted.
- Base44 connector still exposes production entities but no positively verifiable Test Data selector/environment identity. No synthetic records were created.
- Current-candidate Fortress 39/39: NOT CERTIFIED.
- Current-candidate V1 47/47: NOT CERTIFIED.
- Live isolated Railway/Test Data path: BLOCKED by unavailable/ unverifiable non-production environment control surface.
- This commit is receipt-only and is intended to trigger a fresh branch-safe validation cycle without changing runtime source.
- Main write/merge by this automation: NOT EXECUTED.
- Production deploy/mutation by this automation: NOT EXECUTED.
