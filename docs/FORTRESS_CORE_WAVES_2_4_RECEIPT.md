# CloudBrowser Control V1.1 Fortress — Core Hardening Waves 2–4 Receipt

**Scope:** branch-only development hardening  
**Branch:** `fortress/v1.1`  
**Starting WAVE 1 tip:** `8ee3d3802ca6e837bdacd75fd7b1477f8e9f63fa`  
**Pre-Fortress preserved snapshot:** `2910748fc79d652b2fde8be2cfcc02c9a045631f`  
**Production/main write:** NOT EXECUTED  
**Production deployment:** NOT EXECUTED  
**Railway mutation:** NOT EXECUTED  
**Secrets mutation:** NOT EXECUTED  
**Schema/RLS mutation:** NOT EXECUTED  
**PR/main merge:** NOT EXECUTED

## Operator boundary

This cycle implemented the approved consolidated Fortress Core Hardening work on `fortress/v1.1` only. Production promotion, staging deployment, secrets, schema/RLS changes, Railway settings, and main-branch mutation were outside scope.

## Commits

1. `5524f805f7ec5a0353513057b1e0f25a1d45c577` — `fortress: enforce job tenant boundary and durable execution claims`
2. `e3125c784b959919fa31bc7538b8a6202b700979` — `fortress: enforce MCP action capability scopes`
3. `ac4e3f37e92f86eb000a1f8b5f7401f8728c41a8` — `fortress: enforce per-request browser egress policy`
4. `5df3e0838ea2a79e3e070890ed7807f7bba3ce4a` — `fortress: make Playwright browser path non-root deterministic`
5. `1808e59e133ea08a6769f665d02bc62d6d13a087` — `fortress: harden webhook egress and engine destination control`
6. `9fcb918dffda1eb20cfb59a7d28f1ea230e57d13` — `fortress: gate direct runtime control functions`
7. `e65ecbb9847d581a6a1f68d3b56ee0e698518e81` — `fortress: bind delayed jobs to credential capability receipts`
8. `d1ac19d4db5b48e492602df3926e63d23acf1f8c` — `fix: correct extract_json capability scope`
9. `9196fa01dd294aac719d4ff42ea5b982f9de0de5` — `test: add Fortress core static adversarial checks`

The `d1ac19d4...` commit is an explicit repair receipt: verification found `extract_json` had been written as `sessions*evaluate`; it was corrected to `sessions:evaluate` before closeout.

## WAVE 2 — Authorization, tenancy, idempotency

### Job execution boundary

- Extracted trusted execution into `base44/shared/jobRunner.ts`.
- Public `runJob` now authenticates the caller.
- API-key gateway execution authorizes from the authenticated API-key project, not request-body `project_id`.
- HMAC webhook execution authorizes from the verified Webhook project.
- Scheduled execution must create a project-scoped Job.
- Job-created Session records explicitly inherit `job.project_id`.
- Artifact records inherit the Session project.
- `Result` still has no `project_id` field; no schema change was authorized, so no false claim of Result field-level project lineage is made.

### Idempotency

No schema migration was applied. Job execution uses `Job.results_summary.idempotency` plus a conditional `Job.updateMany` execution claim:

- fingerprint = SHA-256 of idempotency key
- same key in-flight returns the existing logical execution state
- same key after completion/failed state returns prior state instead of re-running
- different key may create a new logical execution when Job status permits

This is source-implemented but still requires a real concurrency test against the deployed Base44 entity semantics before being called exactly-once certified.

### Capability ceiling

Added `base44/shared/capabilities.ts` as the common action/session capability map.

Dangerous action scopes include:

- evaluate / extract_json → `sessions:evaluate`
- cookie/storage/header/state operations → `sessions:storage`
- upload → `sessions:upload`
- download → `sessions:download`
- CAPTCHA → `sessions:captcha`
- response mocking → `sessions:network_mock`
- crawl → `sessions:crawl`
- session proxy → `sessions:proxy`
- CDP → `sessions:cdp`
- extensions → `sessions:extensions`

Gateway-created Jobs are checked before creation. Delayed execution does not trust a caller-editable scope array: the Job stores an authorization key ID plus a server-derived proof `SHA256(ApiKey.key_hash + ':' + Job.id)`. `jobRunner` re-loads the key and requires:

- proof match
- active key
- unexpired key
- same project

The runner then uses the key's current scopes. An administrator direct run is the only explicit trusted-capability override.

### MCP

- MCP requires project-scoped API keys.
- `browser_act` checks the same dangerous-action capability map used by the gateway.
- `browser_observe` requires evaluate scope.
- Context/private artifact project matching remains strict.
- `context_use` does not return decrypted cookie/storage material.

### Direct runtime controls

- `managePool` is admin-gated.
- `engineAction` is admin-gated and checks runtime/control-plane Session identity where applicable.
- `triggerWebhook` is admin-gated after internal Job webhook dispatch was moved to the shared dispatcher.
- `resumeSession` preserves `original.project_id` on the new Session and refuses a null-project Session for non-admin callers.

## WAVE 3 — Network, SSRF, egress

### Browser engine

Added `browser-engine/ssrf.js` and modularized the engine under `browser-engine/engine/`.

Every fresh BrowserContext, including warm-pooled contexts, installs one `context.route('**/*')` egress guard before page use. The guard:

- permits only HTTP/HTTPS
- rejects URL userinfo
- defaults ports to 80/443
- rejects loopback, RFC1918, CGNAT, link-local, metadata, multicast/reserved IPv4 classes
- rejects IPv6 loopback, ULA/link-local patterns, metadata address, and IPv4-mapped private addresses
- rejects localhost/local/internal hostname forms and obvious alternate numeric forms
- resolves DNS with all A/AAAA answers and fails if any resolved address is blocked
- applies domain allow/block policy
- validates network mocks only after egress validation

Initial navigation, restored-state URLs, storage origins, and crawl URLs also pass through egress validation.

### Known SSRF boundary

**DNS rebinding TOCTOU is NOT certified closed.** The application revalidates DNS per browser request, but Chromium resolves again after `route.continue()`. Network-layer private-range egress denial or resolver/IP pinning remains required for full rebinding protection.

WebSocket/service-worker and other browser transport coverage must be proven in staging rather than assumed from source.

### Base44 outbound webhooks

Added `base44/shared/ssrf.ts` and `base44/shared/webhookDispatcher.ts`:

- encrypted signing secret required
- no plaintext-secret fallback
- manual redirect processing
- redirect destination validation
- HTTPS downgrade rejection
- private/metadata destination rejection
- project-scoped Job webhook dispatch
- cryptographic event IDs

The Base44 `safeFetch` still has the same DNS pinning limitation as ordinary fetch, so network-level enforcement remains an external Fortress gate.

### Engine destination

`updateEngineConfig` remains admin-only and now permits an engine URL only when its origin matches the current secret engine origin or an explicit `ENGINE_HOST_ALLOWLIST`. Empty destination authority fails closed.

## WAVE 4 — Container and runtime reliability

`browser-engine/Dockerfile` now uses:

- `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright`
- a dedicated non-root `engine` user
- deterministic Chromium installation under `/ms-playwright`
- ownership/read permissions for the non-root runtime
- explicit writable temp/upload/video/data paths

This directly addresses the prior likely root-owned Playwright-cache failure mode that coincided with pool `0/3`. It is still an inference until a staging image boots, readiness launches Chromium as `engine`, and pool reaches `3/3`.

Engine runtime additions include:

- explicit `userDataDir` rejection
- extension identifier allowlist rather than caller filesystem paths
- egress guard on pooled and fresh contexts
- health degradation when the warm pool remains below target
- runtime UID/GID health evidence
- SIGTERM/SIGINT browser drain with bounded shutdown
- browser/context cleanup and pool re-warm loops

External Railway controls were not changed. Read-only rootfs, tmpfs, Linux capability drop, no-new-privileges, PID/CPU/memory limits, and network-level egress remain staging/infrastructure gates.

## Verification evidence

### Syntax

Authored JavaScript and TypeScript-as-JavaScript modules were checked with `node --check` in the isolated work area before GitHub writes. The connector-truncated monolithic engine draft was rejected from the workflow and was never attached to a branch tree; the engine was then rewritten into smaller verifiable modules.

### Static/adversarial harness

Added:

`ci/fortress-core-static.mjs`

The harness performs 48 local checks covering:

- blocked IP classification
- blocked URL/protocol/userinfo/custom-port behavior
- dangerous action scope declarations
- project-scoped gateway/MCP invariants
- delayed Job authorization-receipt source invariants
- Job project lineage source invariant
- direct admin gates
- resume project lineage
- userDataDir/extension rejection
- egress-guard installation
- non-root deterministic Playwright Docker path
- explicit non-certification of DNS-rebinding TOCTOU

The harness passed `48/48` in the isolated authoring workspace. Because this environment could not materialize the GitHub branch directly into the container and no GitHub CI status exists for the final branch SHA yet, this is **not** promoted to an exact-branch CI receipt. The same source invariants were spot-checked against GitHub connector reads. A real branch CI run remains required.

## Branch delta

Compared with WAVE 1 tip `8ee3d380...`, the Fortress branch is 9 commits ahead before this receipt and changes only the intended authorization, network, container, and test surfaces. No production/main files were written by this cycle.

## Backward compatibility / expected breakage

- Project-null API keys are no longer accepted by gateway/MCP routes. Existing platform automation keys require explicit migration or a governed platform identity design.
- Dangerous Job steps without a valid current credential authorization receipt are denied. This intentionally affects legacy scheduled/webhook Jobs that previously relied on implicit privilege.
- Schedules must create project-scoped Jobs.
- Direct non-admin pool/runtime-control access is removed.
- `mock_response` as an ad-hoc runtime action is disabled; session-creation network mocks remain supported behind the egress guard.
- Ports other than 80/443 are denied unless the egress policy explicitly permits them.

These changes require staging compatibility validation before release.

## Remaining blockers before staging can become release evidence

1. Network-layer egress deny or resolver/IP pinning for full DNS-rebinding TOCTOU protection.
2. Staging proof that BrowserContext request interception covers required subresource/redirect/browser transport cases.
3. Staging proof of non-root Chromium readiness and warm pool `3/3`.
4. Real concurrent Base44 idempotency test proving conditional claim semantics.
5. Full gateway/MCP/Job capability black-box tests with keys intentionally missing each scope.
6. Railway read-only/tmpfs/cap-drop/no-new-privileges/resource-limit evidence.
7. Branch CI run of `ci/fortress-core-static.mjs` plus existing build/lint/typecheck/security checks.
8. Full Fortress 39-gate staging run, original V1 regressions, and three consecutive clean passes.
9. Production/main governance remains external; no release is authorized by this receipt.

## Gate posture

- **P0 source remediation:** substantially implemented, NOT runtime certified.
- **P1 source remediation:** partially implemented, NOT runtime certified.
- **Fortress 39/39:** NOT CLAIMED.
- **Production readiness:** NOT CLAIMED.
- **Staging deployment:** NOT EXECUTED.

The WAVE 1 validator remains intentionally fail/skip honest. This cycle does not turn source presence into an unearned PASS.

## Rollback

Branch rollback can be performed by reverting the individual commits above, or by resetting the development branch to WAVE 1 tip `8ee3d3802ca6e837bdacd75fd7b1477f8e9f63fa`. Production rollback is not involved because this cycle was not deployed.

## STOP

Core branch implementation is complete for this authorized cycle. Stop before any staging deployment, schema/RLS change, secret change, Railway setting change, PR, main merge, or production action without new operator authorization.
