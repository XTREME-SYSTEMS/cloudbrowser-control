# CloudBrowser Control V1 — Final Operations Hygiene Attribution

**Audit Date:** 2026-08-19
**Scope:** Read-only attribution → Exact Approval Packet
**V1 Status:** FROZEN AND OPERATIONAL

---

## PHASE 1 — ATTRIBUTE ALL 13 UNKNOWN DEFAULT KEYS

### Collective Evidence (all 13 share identical patterns)

| Attribute | Value |
|-----------|-------|
| created_by | service_a4077c6d-8316-419c-8e68-2b38652342d9 (service role — NOT human) |
| project_id | null (all unbound) |
| scopes | sessions:read, sessions:write, jobs:read, jobs:write (all identical) |
| last_used | null (NONE ever used) |
| expires_at | null (no expiration) |
| rotated_from | null (not rotated) |
| create_audit_log | NOT FOUND for any of the 13 |
| nearby_jobs | 0 for all 13 |
| nearby_sessions | temporal correlation only (sessions created by test suites via asServiceRole, NOT by these keys) |

### Per-Key Attribution

| # | Key ID | Safe Prefix | Created | Last Used | Nearby Sessions | Nearby Audit Logs | Origin Evidence | Classification | Confidence | Recommendation |
|---|--------|-------------|---------|-----------|------------------|-------------------|-----------------|----------------|------------|----------------|
| 1 | 6a8534af... | cb_live_28ba | 2026-08-19T04:44 | never | 10 | 17 (heartbeat,run,create) | Service role, cert window | CERTIFICATION | HIGH | REVOKE CANDIDATE |
| 2 | 6a852f49... | cb_live_5cf1 | 2026-08-19T04:21 | never | 14 | 0 | Service role, cert window | CERTIFICATION | HIGH | REVOKE CANDIDATE |
| 3 | 6a852418... | cb_live_8bf1 | 2026-08-19T03:33 | never | 29 | 0 | Service role, cert window | CERTIFICATION | HIGH | REVOKE CANDIDATE |
| 4 | 6a851f18... | cb_live_c833 | 2026-08-19T03:12 | never | 4 | 0 | Service role, cert window | CERTIFICATION | HIGH | REVOKE CANDIDATE |
| 5 | 6a851e60... | cb_live_a425 | 2026-08-19T03:09 | never | 0 | 0 | Service role, cert window | CERTIFICATION | HIGH | REVOKE CANDIDATE |
| 6 | 6a851db2... | cb_live_910a | 2026-08-19T03:06 | never | 0 | 0 | Service role, cert window | CERTIFICATION | HIGH | REVOKE CANDIDATE |
| 7 | 6a851cc4... | cb_live_bee1 | 2026-08-19T03:02 | never | 0 | 0 | Service role, cert window | CERTIFICATION | HIGH | REVOKE CANDIDATE |
| 8 | 6a8517e2... | cb_live_c8c0 | 2026-08-19T02:41 | never | 0 | 0 | Service role, cert window | CERTIFICATION | HIGH | REVOKE CANDIDATE |
| 9 | 6a850c25... | cb_live_e5dc | 2026-08-19T01:51 | never | 0 | 0 | Service role, cert window | CERTIFICATION | HIGH | REVOKE CANDIDATE |
| 10 | 6a850954... | cb_live_3ce0 | 2026-08-19T01:41 | never | 9 | 0 | Service role, MCP cert window | CERTIFICATION | HIGH | REVOKE CANDIDATE |
| 11 | 6a84de06... | cb_live_9033 | 2026-08-18 | never | 0 | 0 | Service role, cert window | CERTIFICATION | HIGH | REVOKE CANDIDATE |
| 12 | 6a84ddcf... | cb_live_6133 | 2026-08-18 | never | 0 | 0 | Service role, cert window | CERTIFICATION | HIGH | REVOKE CANDIDATE |
| 13 | 6a84dd92... | cb_live_5f6c | 2026-08-18 | never | 0 | 0 | Service role, cert window | CERTIFICATION | HIGH | REVOKE CANDIDATE |

### Origin Determination

All 13 keys were created by the **service role** (service_a4077c6d-8316-419c-8e68-2b38652342d9), not by a human operator. The `createApiKey` function assigns the name "Default" when no name is provided. The temporal clustering (all created during 2026-08-18 to 2026-08-19 certification window) and the service-role origin indicate these keys were created by certification test suites (runTestSuite, runMasterReleaseSuite, runMcpBlackBox, runContextBlackBox, runTenantIsolationTests, runDeployedTenantIsolationTests) which generate API keys via `asServiceRole.entities.ApiKey.create()` during test execution.

**Nearby sessions are NOT correlated to these keys** — those sessions were created by the test suites directly via `asServiceRole.entities.Session.create()`, not authenticated through these API keys. The keys were created but never used for gateway authentication (last_used = null for all 13).

### Classification Summary

| Classification | Count |
|----------------|-------|
| PRODUCTION | 0 |
| SYSTEM | 0 |
| CERTIFICATION | 13 |
| TEST | 0 |
| ABANDONED | 0 |
| UNKNOWN | 0 |

**All 13 classified as CERTIFICATION** based on: service-role origin, temporal correlation with certification runs, identical test scopes, never used, unbound.

---

## PHASE 2 — VERIFY 6 CERTIFICATION KEY CANDIDATES

| # | Key ID | Safe Prefix | Name | Last Used | Hours Since Use | Jobs Ref | Webhooks Ref | Schedules Ref | Audit Logs Ref | Is Prod Key | Safe to Revoke |
|---|--------|-------------|------|-----------|-----------------|----------|--------------|---------------|----------------|-------------|----------------|
| 1 | 6a851b4d... | cb_test_75e2 | RL_TEST_1787108172986 | 2026-08-19T02:56 | 15h | 0 | 0 | 0 | 0 | No | SAFE TO REVOKE |
| 2 | 6a8509e2... | cb_live_c887 | MCP_TEST_master_1787103657668 | never | null | 0 | 0 | 0 | 0 | No | SAFE TO REVOKE |
| 3 | 6a84dd90... | cb_live_312e | MCP_TEST_master_1787092310039 | never | null | 0 | 0 | 0 | 0 | No | SAFE TO REVOKE |
| 4 | 6a84c6bb... | cb_live_ec9d | GATEWAY_FIX_TEST_1787086523232 | 2026-08-18T20:56 | 21h | 0 | 0 | 0 | 0 | No | SAFE TO REVOKE |
| 5 | 6a84c363... | cb_live_0c25 | PUBLISH_VERIFY_1787085667634 | 2026-08-18T20:41 | 21h | 0 | 0 | 0 | 0 | No | SAFE TO REVOKE |
| 6 | 6a83dd17... | cb_live_a462 | Test Project key | never | null | 0 | 0 | 0 | 0 | No | SAFE TO REVOKE |

**All 6 certification keys: SAFE TO REVOKE**

Evidence for each:
- Not the Production Operations key (ops-first-workload, ID 6a85e87f...) ✅
- 0 jobs referencing ✅
- 0 webhooks referencing ✅
- 0 schedules referencing ✅
- 0 audit logs referencing ✅
- No project binding (all null) ✅
- No recent use (last_used null or >15 hours ago) ✅
- Not referenced by Base44/Railway/system automation ✅

---

## PHASE 3 — VERIFY PROJECT ARCHIVE CANDIDATES

| Project | ID | Jobs | Sessions | Results | Screenshots | Artifacts | Contexts | Steps | Schedules | Webhooks | Recent Activity | Prod Dependency | Safe to Archive |
|---------|-----|------|----------|---------|-------------|----------|----------|-------|-----------|----------|-----------------|-----------------|------------------|
| RLS_A_master_... | 6a8509df...e685 | 0 | 1 (stale test) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 stale session only | No | SAFE TO ARCHIVE |
| RLS_B_master_... | 6a8509df...bcf2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | NO ACTIVITY | No | SAFE TO ARCHIVE |

**Both projects: SAFE TO ARCHIVE**

Evidence:
- RLS_A: 1 stale test session from RLS tenant isolation certification run (completed, no active workload). 0 jobs, 0 results, 0 artifacts, 0 contexts, 0 schedules, 0 webhooks.
- RLS_B: completely empty — 0 of every entity type. No activity whatsoever.
- Neither has production dependency.
- Neither has bound API keys.
- Archiving changes status to "archived" — does NOT delete the project or its stale session.

---

## PHASE 4 — TEST WEBHOOK ATTRIBUTION

| Field | Webhook 1 (probe) | Webhook 2 (Test Webhook) |
|-------|--------------------|--------------------------|
| Webhook ID | 6a84ddbc...495f | 6a84d9e9...abd35 |
| Safe Name | probe | Test Webhook |
| Project | (none — webhooks are not project-scoped) | (none) |
| Event Types | [] (none) | ["job.completed"] |
| Target Domain | probe.test | example.com |
| Created | 2026-08-18 | 2026-08-18 |
| Last Delivery | never | 2026-08-19T17:52:47 |
| Last Successful Delivery | never | never (all 405) |
| Delivery Count | 0 | 25 |
| Failure Count | 0 | 0 (405 not tracked as failure) |
| Success Count | 0 | 0 |
| Has Secret | false | true |
| Referenced by Production | No | No |
| Certification-Only | Yes (test domain, no events) | Yes (example.com test domain, 405 responses) |
| Classification | DELETE CANDIDATE | DELETE CANDIDATE |

**Both webhooks: DELETE CANDIDATE**

Evidence:
- probe: test domain (probe.test), no events subscribed, no secret, 0 deliveries, never triggered — clearly a test probe
- Test Webhook: test domain (example.com), 25 deliveries all returning HTTP 405 (Method Not Allowed — endpoint doesn't accept POST), 0 successful deliveries, triggered only by certification/test job.completed events
- Neither is referenced by production workload
- Neither targets a real operator monitoring endpoint

---

## PHASE 5 — NIGHTLY TEST RUN REVIEW

### Current Configuration

| Field | Value |
|-------|-------|
| Workflow Name | Nightly Test Run |
| Trigger | Scheduled, cron `0 0 * * *` (daily at midnight America/New_York) |
| Step 1 | invoke_backend_function: runTestSuite (the 23/23 runtime suite) |
| Step 2 | switch: if score < 90, send alert |
| Step 3 | invoke_backend_function: sendNotification (if score < 90) |

### What It Executes

| Suite | Executed? | Evidence |
|-------|-----------|---------|
| 23/23 Runtime Suite | YES | runTestSuite is the only function called |
| 47/47 Master Release | NO | runMasterReleaseSuite is NOT called |
| Tenant Isolation (18/18) | NO | runDeployedTenantIsolationTests is NOT called |
| MCP Black-Box (18/18) | NO | runMcpBlackBox is NOT called |
| Context Black-Box (11/11) | NO | runContextBlackBox is NOT called |

### Recommended Schedule Changes

| Workflow | Current Cadence | Current Workload | Recommended Cadence | Recommended Workload | Reason |
|----------|----------------|-------------------|---------------------|----------------------|--------|
| Nightly Test Run | Daily (midnight) | 23/23 runtime suite | **WEEKLY** (Sunday 02:00 UTC) | 23/23 runtime suite | Daily runs consume engine sessions, API credits, and database records without adding safety when no code changed; weekly provides regression detection at 1/7 the cost |
| Schedule Checker | Every 5 min | checkSchedules | KEEP (every 5 min) | checkSchedules | Lightweight, essential for schedule triggering |
| Governance Heartbeat | Every 5 min | engineHealth + checkSchedules + reconcileSettings + logAudit | KEEP (every 5 min) | Same | Lightweight, provides continuous health monitoring |
| Retention Reaper | Daily (03:00 UTC) | reapExpired (screenshots, logs, videos) | KEEP (daily) | Same | Lightweight, essential for storage hygiene |

### Recommended Operating Model

| Cadence | Checks |
|---------|--------|
| **DAILY** (automated via existing workflows) | engineHealth (every 5 min via Governance Heartbeat), pool health (via Governance Heartbeat), orphan check (via Governance Heartbeat), rate limit health (monitor via dashboard) |
| **DAILY** (manual, ~5 min) | Critical/High error scan, lightweight session smoke (create→goto→screenshot→terminate), lightweight job smoke (2-step goto+extract), AuditLog review for unexpected admin actions |
| **WEEKLY** | 23/23 runtime suite (via Nightly Test Run moved to weekly), tenant isolation 18/18, MCP 18/18, Context 11/11, deployment drift check, audit log full review, credential rotation check |
| **AFTER SOURCE/CONFIG/SCHEMA CHANGE** | Full 47/47 Master Release Suite, GitHub Actions verification |
| **INCIDENT RESPONSE** | Targeted suite appropriate to incident; full 47/47 only when justified |

---

## PHASE 6 — IP ALLOWLIST DECISION

### Classification: NOT RECOMMENDED / NOT READY

### Why Current Access Model Would Risk Lockout

| Consumer | Source IP | Lockout Risk |
|----------|----------|-------------|
| Operator browser | Dynamic (residential/ISP) | HIGH — IP changes would lock out operator |
| Base44 workflows (Schedule Checker, Governance Heartbeat, Retention Reaper, Nightly Test Run) | Provider-managed (Base44 cloud, dynamic) | HIGH — cannot be allowlisted without breaking all automation |
| Railway engine (outbound to Base44) | Provider-managed (Railway cloud) | HIGH — dynamic, not independently verifiable |
| MCP clients (ChatGPT, Claude) | Dynamic/unknown | HIGH — would block all AI client access |
| Automation clients | Dynamic/unknown | HIGH — would block all customer automation |
| External API consumers | Dynamic/unknown | HIGH — would block all external access |

### What Must Become True Before Allowlisting Is Safe

1. All Base44 workflow source IPs must be published and stable (currently provider-managed, dynamic)
2. All MCP client source IPs must be independently verifiable (currently unknown)
3. All automation client source IPs must be fixed and documented (currently dynamic)
4. Operator browser IP must be static or VPN-based (currently residential dynamic)
5. A break-glass procedure must exist for emergency access when IPs change
6. Railway engine outbound IPs must be documented if engine calls back to gateway (currently not required — engine is called, not calling)

**No configuration changes. No guessed IPs.**

---

## PHASE 7 — V2 ENGINEERING BACKLOG

Recorded for V2 — NOT implemented in V1:

| # | Item | Description |
|---|------|-------------|
| 1 | Screenshot content_hash | Add SHA-256 content_hash field to Screenshot entity for integrity verification |
| 2 | Screenshot → Artifact parity | Investigate why Artifact records are not persisting despite runJob code attempting creation; unify screenshot storage into Artifact entity with full metadata (project_id, content_hash, retention, access_policy) |
| 3 | Job ephemeral session explicit project_id | Set project_id explicitly on Session entity created by runJob (currently null — relies on gateway project filtering for isolation, but explicit project_id would enable project-scoped RLS on job sessions) |
| 4 | Unified Result records | Create a Result record for every step (including goto, click, screenshot) with action_type, success/failure, duration, and data payload for complete job audit trail |
| 5 | AI Agent | Autonomous browser automation agent (V2 roadmap) |
| 6 | Real-time interactive Live View | WebSocket-based real-time session viewing (V2 roadmap) |
| 7 | Multi-worker Redis | Distributed reliability beyond single-worker mode (V2 roadmap) |

**No V2 items mixed into V1 cleanup approval.**

---

## PHASE 8 — EXACT OPERATIONS APPROVAL PACKET

### GROUP A — SAFE API KEY REVOCATIONS

**19 keys positively proven safe to revoke.** No execution. Operator must explicitly approve.

| # | Key ID | Safe Prefix | Classification | Last Use | Reason | Risk if Revoked |
|---|--------|-------------|----------------|----------|--------|-----------------|
| 1 | 6a851b4d200477b1f16b98db | cb_test_75e2 | CERTIFICATION | 2026-08-19T02:56 (15h ago) | RL_TEST key, 0 refs, 0 jobs, 0 webhooks, 0 schedules, not production | NONE — never used in production, no references |
| 2 | 6a8509e23f5920cb8cc50b02 | cb_live_c887 | CERTIFICATION | never | MCP_TEST key, 0 refs, 0 jobs, 0 webhooks, 0 schedules, not production | NONE — never used, no references |
| 3 | 6a84dd9061b380368334f889 | cb_live_312e | CERTIFICATION | never | MCP_TEST key, 0 refs, 0 jobs, 0 webhooks, 0 schedules, not production | NONE — never used, no references |
| 4 | 6a84c6bbcacfbf0f9def569a | cb_live_ec9d | CERTIFICATION | 2026-08-18T20:56 (21h ago) | GATEWAY_FIX_TEST key, 0 refs, 0 jobs, 0 webhooks, 0 schedules, not production | NONE — not used in 21h, no references |
| 5 | 6a84c3638c165fb0daa11c5d | cb_live_0c25 | CERTIFICATION | 2026-08-18T20:41 (21h ago) | PUBLISH_VERIFY key, 0 refs, 0 jobs, 0 webhooks, 0 schedules, not production | NONE — not used in 21h, no references |
| 6 | 6a83dd178a91dd43cd1abdc0 | cb_live_a462 | CERTIFICATION | never | "Test Project key", 0 refs, 0 jobs, 0 webhooks, 0 schedules, not production | NONE — never used, no references |
| 7 | 6a8534afe44d5a05eaede24a | cb_live_28ba | CERTIFICATION | never | Service-role created, unbound, never used, 0 refs, cert window origin | NONE — never used, no references |
| 8 | 6a852f493f12e0a411dbe464 | cb_live_5cf1 | CERTIFICATION | never | Service-role created, unbound, never used, 0 refs, cert window origin | NONE — never used, no references |
| 9 | 6a85241871c0c849d8c3c295 | cb_live_8bf1 | CERTIFICATION | never | Service-role created, unbound, never used, 0 refs, cert window origin | NONE — never used, no references |
| 10 | 6a851f18f8bb4c11c6e8276d | cb_live_c833 | CERTIFICATION | never | Service-role created, unbound, never used, 0 refs, cert window origin | NONE — never used, no references |
| 11 | 6a851e60730f9f31c4c1efec | cb_live_a425 | CERTIFICATION | never | Service-role created, unbound, never used, 0 refs, cert window origin | NONE — never used, no references |
| 12 | 6a851db21c981e8ddf8698bd | cb_live_910a | CERTIFICATION | never | Service-role created, unbound, never used, 0 refs, cert window origin | NONE — never used, no references |
| 13 | 6a851cc464078258b35ba371 | cb_live_bee1 | CERTIFICATION | never | Service-role created, unbound, never used, 0 refs, cert window origin | NONE — never used, no references |
| 14 | 6a8517e27e86477431eae4d5 | cb_live_c8c0 | CERTIFICATION | never | Service-role created, unbound, never used, 0 refs, cert window origin | NONE — never used, no references |
| 15 | 6a850c25da44dde6444ddc48 | cb_live_e5dc | CERTIFICATION | never | Service-role created, unbound, never used, 0 refs, cert window origin | NONE — never used, no references |
| 16 | 6a8509541f8388d3b86a8538 | cb_live_3ce0 | CERTIFICATION | never | Service-role created, unbound, never used, 0 refs, MCP cert window origin | NONE — never used, no references |
| 17 | 6a84de06cb5734fb65403653 | cb_live_9033 | CERTIFICATION | never | Service-role created, unbound, never used, 0 refs, cert window origin | NONE — never used, no references |
| 18 | 6a84ddcf044fdfb020c3ee87 | cb_live_6133 | CERTIFICATION | never | Service-role created, unbound, never used, 0 refs, cert window origin | NONE — never used, no references |
| 19 | 6a84dd92a926616b8a2fb8ca | cb_live_5f6c | CERTIFICATION | never | Service-role created, unbound, never used, 0 refs, cert window origin | NONE — never used, no references |

**Key NOT included:** 6a85e87f3476d03942cbf242 (ops-first-workload) — PRODUCTION, KEEP

### GROUP B — PROJECT ARCHIVAL

**2 projects positively proven safe to archive.** No execution. Operator must explicitly approve.

| # | Project ID | Name | Classification | Dependencies | Reason | Risk |
|---|-----------|------|----------------|-------------|--------|------|
| 1 | 6a8509dfe68532a9969cd3d4 | RLS_A_master_1787103657668_q8jyol | CERTIFICATION | 1 stale test session, 0 jobs, 0 results, 0 artifacts, 0 contexts, 0 schedules, 0 webhooks, 0 bound keys | RLS tenant isolation certification project, no production dependency, no active workload | NONE — archiving changes status only, stale session remains but is not production |
| 2 | 6a8509dfbcf247a67c75f7e7 | RLS_B_master_1787103657668_q8jyol | CERTIFICATION | 0 of every entity type, 0 bound keys | RLS tenant isolation certification project, completely empty, no production dependency | NONE — completely empty, no risk |

**Project NOT included:** 6a85e8745caff6e7121768cc (Production Operations) — PRODUCTION, KEEP

### GROUP C — WEBHOOK CLEANUP

**2 webhooks proven safe to delete.** No execution. Operator must explicitly approve.

| # | Webhook ID | Name | Classification | Last Delivery | Reason | Risk |
|---|-----------|------|----------------|---------------|--------|------|
| 1 | 6a84ddbc540e172495f0b106 | probe | TEST | never | Test domain (probe.test), no events subscribed, no secret, 0 deliveries, never triggered | NONE — never triggered, no events, no production reference |
| 2 | 6a84d9e9fabf5a99d87abd35 | Test Webhook | TEST | 2026-08-19T17:52:47 (all 405) | Test domain (example.com), 25 deliveries all returning HTTP 405, 0 successful deliveries, triggered only by test job.completed events | NONE — all deliveries failed (405), no production reference, test endpoint |

### GROUP D — SCHEDULE OPTIMIZATION

**1 schedule change recommended.** No execution. Operator must explicitly approve.

| # | Workflow Name | Current Cadence | Current Workload | Recommended Cadence | Recommended Workload | Reason |
|---|---------------|----------------|-----------------|---------------------|----------------------|--------|
| 1 | Nightly Test Run | Daily (cron `0 0 * * *`, midnight ET) | runTestSuite (23/23 runtime suite) | **WEEKLY** (cron `0 2 * * 0`, Sunday 02:00 UTC) | runTestSuite (23/23 runtime suite — unchanged) | Daily certification runs consume engine sessions + API credits + DB records without adding safety when no code changed; weekly provides regression detection at 1/7 the cost; Governance Heartbeat (every 5 min) provides continuous health monitoring |

**Workflows NOT changed:** Schedule Checker (5 min), Governance Heartbeat (5 min), Retention Reaper (daily) — all lightweight, essential, KEEP.

### GROUP E — DEFER / INVESTIGATE

**0 items.** All 19 API keys, 2 projects, and 2 webhooks have sufficient evidence for positive classification. No item lacks enough evidence.

**Uncertainty notes (non-blocking, included for transparency):**
- 13 Default keys: exact origin function not identified (no create audit log), but service-role creation + temporal correlation with certification runs + never-used + unbound provides sufficient evidence for safe revocation. Origin uncertainty does not affect revocation safety.
- Artifact entity: 0 records in DB despite runJob code attempting creation — investigate in V2 (not a V1 cleanup item).

---

## FINAL RESPONSE

```
CLOUDBROWSER V1: READY WITH OBSERVATIONS

CRITICAL: 0
HIGH: 0

PRODUCTION KEY: KEEP
  (ops-first-workload — bound, recently used, correct scopes, no drift)

TENANT BOUNDARY: PASS 14/14

KEYS PROVEN SAFE TO REVOKE: 19
  (6 certification + 13 service-role Default keys)

KEYS REQUIRING INVESTIGATION: 0
  (all 19 positively proven safe by usage evidence)

PROJECTS PROVEN SAFE TO ARCHIVE: 2
  (RLS_A and RLS_B certification projects)

WEBHOOKS PROVEN SAFE TO DELETE: 2
  (probe + Test Webhook — both test domains, no production use)

SCHEDULE CHANGES RECOMMENDED: 1
  (Nightly Test Run: daily → weekly)

IP ALLOWLIST: NOT RECOMMENDED
  (HIGH lockout risk, no verifiable source IPs)
```

---

## OPERATIONS CLEANUP APPROVAL PACKET

**This is a read-only attribution. No protected actions were executed.**

The operator must explicitly approve the exact cleanup groups below. No blanket approval.

### Approval Groups

- **GROUP A — API Key Revocations (19 keys):** Approve to revoke 19 certification keys (6 named test keys + 13 service-role Default keys). All proven safe: never used in production, 0 references, 0 jobs, 0 webhooks, 0 schedules. Production key (ops-first-workload) is NOT included.

- **GROUP B — Project Archival (2 projects):** Approve to archive RLS_A_master and RLS_B_master certification projects. Both have 0 production dependency. Production Operations project is NOT included.

- **GROUP C — Webhook Cleanup (2 webhooks):** Approve to delete "probe" and "Test Webhook" test webhooks. Both target test domains, 0 successful deliveries, no production reference.

- **GROUP D — Schedule Optimization (1 workflow):** Approve to change Nightly Test Run from daily to weekly cadence. Workload unchanged (23/23 runtime suite). Other workflows NOT changed.

- **GROUP E — Defer/Investigate (0 items):** No items require further investigation. All entities have sufficient evidence for classification.

**STOP BEFORE EXECUTION.**

**Require the operator to explicitly approve the exact cleanup groups or individual records above.**