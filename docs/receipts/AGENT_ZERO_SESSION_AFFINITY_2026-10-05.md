# Agent Zero Cloud Browser Session-Affinity Hardening Receipt

Date: 2026-10-05
Status: BLOCKED

## Scope
Branch-only repair of session-bound multi-engine routing for the Xtreme Cloud Browser primary operator.

## Repository identity
- Repository: XTREME-SYSTEMS/cloudbrowser-control
- Branch: feat/apex-cloudbrowser-connector-v1
- Source baseline synced from main: 7dc1bfda6df51e513736fec62e337708609887df
- Hardened branch code SHA before this receipt: 057ab39abbf0c587be4dbccf38e2782defa18e48

## Defect reproduced
A live session-bound run_script attempt returned:
- primary engine: HTTP 500
- engine 2: Session not found
- engine 3: Session not found

Root cause: generic multi-engine failover treated stateful session actions as stateless requests and retried them on workers that did not own the session.

## Repair
- Engine creation responses record internal __engine_url affinity.
- Session records persist metadata.engine_url.
- Added engineSessionFetch / engineSessionPost / engineSessionGet / engineSessionDelete.
- Known session owner is pinned for session-bound requests.
- Known-owner 5xx no longer blindly migrates a live session to another worker.
- Legacy sessions without affinity may probe configured engines only to locate the actual owner.
- Canonical MCP gateway session actions, console/errors/network reads, and session closure use pinned routing.
- Shared gateway core accepts optional session-aware handlers.
- apiGateway and cloudBrowserGatewayV6 inject production session-aware handlers.
- Staging isolation remains untouched.

## Static validation
Feature-branch inspection confirms:
- engineClient: session-aware helpers present.
- mcpGateway: no generic session-bound enginePost/engineGet/engineDelete calls remain.
- gatewayCore: no generic session-bound enginePost/engineDelete patterns remain after hardening.
- production gateway identities pass session-aware handlers into shared dispatch.
- generic enginePost('/sessions') remains only where session creation has no existing owner.

## Live production evidence
Existing production fleet remains healthy:
- 3/3 engines healthy
- engine version 3.1.0
- pool capacity 3 per observed engine
- active sessions observed
- browser_health HTTP 200

## Why status is BLOCKED
The repaired feature branch has not been deployed to an isolated staging/preview Cloud Browser runtime, so the new session-affinity code has not received a live black-box regression test.

No production deployment, secret mutation, or main merge was performed.

## Rollback
Discard feat/apex-cloudbrowser-connector-v1. main remains unchanged by this repair.

## Next protected action
Deploy this exact feature branch to an isolated Cloud Browser staging/preview runtime, then rerun:
1. browser_start
2. navigate
3. run_script
4. console/errors/network
5. browser_end
6. engine failover/session-owner regression
