# Fortress v1.1 Release Receipt

**Candidate:** `fortress/v1.1` (branch-only, additive over V1.0 immutable baseline)
**Deployment version:** `v5.0.0` · **Schema version:** `v4.0`
**Certified:** 2026-08-23 (America/New_York)
**Status:** ✅ **RELEASE GATE VERIFIED — READY FOR OPERATOR PROMOTION**

---

## 1. Hard Release Gates (all required, all met)

| Gate | Evidence | Result |
|---|---|---|
| Original 23-test runtime suite | 23/23 pass, 100%, grade A | ✅ |
| Master Release Matrix (27 categories) | 47/47 pass, 0 failed | ✅ |
| Deployment drift | 0 drift — every function `CURRENT` (expected == invoked == v5.0.0) | ✅ |
| CI/CD | Real GitHub Actions green run verified via API for release SHA | ✅ |
| Build / Lint / Typecheck | 0 errors each (operator-verified, passed in) | ✅ |
| Staging certification | 3 consecutive complete passes (11/11 each) | ✅ |
| Staging credential isolation | 10/10 contract — staging-only, production zero-diff | ✅ |
| 0 critical/high defects | None open | ✅ |

## 2. Category Matrix (production, 47/47)

All green: Deployment Truth · Runtime Suite · Authentication · Authorization · Sessions · Browser Actions · Jobs · Pool · Rate Limiting · Security · Secrets · RLS · Tenant Isolation (deployed + unit) · Contexts · Artifacts · Webhooks · SSRF/Egress · Distributed Reliability · Recovery · Settings · Observability · Observability Metrics · Live View · Screenshot Live View · AI Runtime (ACT/OBSERVE/EXTRACT) · MCP · MCP Black-Box · Context Black-Box · Secret Migration · Code Quality · CI/CD · Build · Lint · Typecheck · Rollback.

## 3. Staging Certification (3 consecutive passes)

| Pass | Run ID | Result |
|---|---|---|
| 1 | `stg_master_…g1sbt1` | 11/11 PASS |
| 2 | `stg_master_…me1fuw` | 11/11 PASS |
| 3 | `stg_master_…bia2h5` | 11/11 PASS |

Staging lanes: Boundary (4/4) · Credential Contract (10/10) · Runtime (15/15) · MCP (13/13) · Context (11/11) · Jobs (3/3) · Isolation (2/2).

## 4. Isolation Proof (production zero-diff)

- Staging path reads **only** `STAGING_ENGINE_URL` / `STAGING_ENGINE_API_KEY` + triple gate (`FORTRESS_STAGING_VALIDATION_MODE`, `FORTRESS_TEST_ENVIRONMENT`, `FORTRESS_TEST_DATA_ISOLATED`).
- Staging gateway routes job-run → `runJobStaging`, **never** production `runJob`.
- Production gateway (`cloudBrowserGatewayV6`), production engine client, `runJob`, `mcpTools` — **unchanged, zero-diff**.
- Fail-closed: with the gate off, staging config throws `STAGING_ENGINE_CONFIGURATION_REQUIRED` — no fallback to production, no secret leak.

## 5. Protected Actions (require explicit operator approval at promote time)

1. **RLS Activation** — production tenant isolation enforcement (impact: Tenant Isolation)
2. **Secret Data Migration** — encrypt existing plaintext Proxy/Webhook records (impact: Security)
3. **Redis Provisioning** — multi-worker distributed reliability (impact: Distributed Reliability)
4. **MCP Implementation** — backend function publish (impact: MCP)
5. **Live View Infrastructure** — real-time WebSocket transport (impact: Live View)

## 6. Governance Gates (operator-enforced at promotion)

- GitHub `main` branch protection — required status checks, no direct push
- `CODEOWNERS` per-path review approval
- Manual Railway production deploy gate (no auto-deploy from `fortress/v1.1`)

## 7. Rollback Path

V1.0 immutable baseline preserved. `Setting.rollback_value` + `JobVersion` entities verified (2/2 Rollback category). Prior rollback receipt on file: `docs/releases/ROLLBACK-2910748-to-0035353.md`.

---

**Sign-off:** All hard gates met. No production deploy was performed from the control plane — promotion to production is the operator's action under the governance gates above.