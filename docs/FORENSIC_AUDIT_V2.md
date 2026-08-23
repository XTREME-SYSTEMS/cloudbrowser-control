# Forensic Audit V2 — Production Readiness & Browserbase Parity

**Audit Date:** 2026-08-23
**Auditor:** Base44 Autonomous Agent
**Scope:** Full system — control plane, gateway, engine, MCP, data model, security, scale, observability
**Baseline:** Master Release Suite 47/47 PASS, Staging 11/11 PASS, Scale Parity 11/11 PASS

---

## Executive Summary

The system has a solid security foundation (AES-GCM encryption, fail-closed auth, SSRF host blocking, RLS, database-backed rate limiting) and passes all existing test suites. However, a deep forensic audit reveals **23 gaps** across security, scale, reliability, and Browserbase parity that must be addressed for production-grade operation serving hundreds of systems.

---

## CRITICAL Findings (Security / Data Integrity)

### C1. In-Memory Tenant Filtering — Data Leak Risk
**Location:** `base44/shared/gatewayCore.ts` lines 131-137, 290-295, 343-348
**Finding:** `GET:/sessions`, `GET:/jobs`, `GET:/projects` load 50 records via `.list()` then filter by `project_id` in JavaScript. If RLS has any gap, a project-scoped key can see other projects' records. Also doesn't scale past 50 records.
**Impact:** Cross-tenant data exposure, pagination broken.
**Fix:** Use `base44.entities.Session.filter({ project_id })` directly.

### C2. No Idempotency on Job Execution
**Location:** `base44/shared/gatewayCore.ts` line 330
**Finding:** `POST:/jobs/:id/run` synchronously invokes runJob with no idempotency key. Double-submission (network retry, client timeout) runs the job twice, consuming compute and producing duplicate results.
**Impact:** Wasted compute, duplicate side effects, billing errors.
**Fix:** Accept `Idempotency-Key` header; deduplicate within a 24h window.

### C3. MCP Tools Skip Scope Enforcement
**Location:** `base44/functions/mcpTools/entry.ts` lines 31-45
**Finding:** MCP tools authenticate the API key but never check `keyRecord.scopes`. A key with only `sessions:read` can invoke `browser_act` (write), `context_create`, etc.
**Impact:** Privilege escalation via MCP surface.
**Fix:** Map each tool to required scope; reject if key lacks it.

### C4. SSRF DNS Rebinding Not Prevented
**Location:** `browser-engine/server.js` lines 101-124
**Finding:** `isBlockedHost` validates the hostname string but doesn't resolve DNS. An attacker can register a domain that resolves to 127.0.0.1 at runtime (DNS rebinding), bypassing the blocklist.
**Impact:** Internal network access from browser sessions.
**Fix:** Resolve DNS and validate resolved IPs against private ranges before navigation. (Engine-side — requires deploy.)

---

## HIGH Findings (Reliability / Scale)

### H1. Synchronous Job Execution — Gateway Timeout
**Location:** `base44/shared/gatewayCore.ts` line 330
**Finding:** `POST:/jobs/:id/run` blocks until the entire job completes. Long jobs (>30s) hit platform timeouts (524). The client has no way to poll status.
**Impact:** Long-running jobs fail; poor UX.
**Fix:** Return 202 Accepted immediately; execute async; client polls `GET:/jobs/:id`.

### H2. No Retry / Exponential Backoff in runJob
**Location:** `base44/functions/runJob/entry.ts` lines 132-247
**Finding:** If any engine action throws, the job immediately fails with no retry. Transient network errors, temporary engine overload, and navigation timeouts are all treated as permanent failures.
**Impact:** Flaky job execution; unnecessary failures.
**Fix:** Add configurable retry (default 3) with exponential backoff for transient errors.

### H3. No Graceful Shutdown in Engine
**Location:** `browser-engine/server.js` line 887
**Finding:** The engine has no SIGTERM handler. On Railway redeploy, in-flight sessions are killed without cleanup, leaving orphaned browser processes and lost video recordings.
**Impact:** Lost artifacts, orphaned browsers, corrupted sessions.
**Fix:** Add SIGTERM handler that stops accepting new sessions, drains active sessions, and exits cleanly.

### H4. Store.active_sessions Never Updated
**Location:** `base44/shared/concurrencyQuotas.ts`, `base44/shared/gatewayCore.ts`
**Finding:** The `Store` entity has an `active_sessions` field for denormalized quota checks, but it's never incremented or decremented. Concurrency checks always do a full `Session.filter({})` scan.
**Impact:** O(n) quota checks don't scale; denormalized field is dead data.
**Fix:** Increment/decrement `active_sessions` on session create/close.

### H5. Rate Limit Race Condition
**Location:** `base44/shared/gatewayCore.ts` lines 48-87
**Finding:** `checkRateLimit` tries `updateMany` then `create` if no match. Under concurrent requests, multiple creates can succeed before dedup runs, allowing brief bursts above the limit.
**Impact:** Rate limit can be exceeded under concurrency.
**Fix:** Use a deterministic create-then-update pattern with the composite key as a unique identifier.

---

## MEDIUM Findings (Browserbase Parity)

### M1. No Session Keep-Alive API
**Finding:** Sessions expire after `SESSION_TTL_MS` (5 min default) with no way to extend. Browserbase allows keeping sessions alive.
**Fix:** Add `POST /sessions/:id/keepalive` route.

### M2. No Cookie/Storage Management API on Gateway
**Finding:** The engine supports `set_cookies`, `export_cookies`, `set_local_storage` but the gateway doesn't expose these routes. Clients must use the raw action API.
**Fix:** Add dedicated cookie/storage routes to the gateway.

### M3. No Batch Session Creation
**Finding:** Browserbase allows creating multiple sessions in one request. This system requires N round trips.
**Fix:** Add `POST /sessions/batch` route.

### M4. No Session History / Debug Timeline
**Finding:** Browserbase keeps a history of actions and allows time-travel debugging. This system only stores the latest screenshot.
**Fix:** V2 roadmap — requires storage architecture.

### M5. No WebSocket Live View
**Finding:** Live view is screenshot polling (3s interval). Browserbase offers real-time WebSocket streaming.
**Fix:** V2 roadmap — requires WebSocket infrastructure on engine.

---

## LOW Findings (Code Quality / Observability)

### L1. Duplicate hashKey Function
**Location:** `gatewayCore.ts`, `concurrencyQuotas.ts`, `mcpTools/entry.ts`
**Fix:** Extract to `base44/shared/crypto.ts`.

### L2. No Structured Logging on Engine
**Location:** `browser-engine/server.js`
**Fix:** Add JSON structured logging (engine-side — requires deploy).

### L3. No Per-Action Latency Metrics on Engine
**Fix:** Add P50/P95/P99 tracking per action_type (engine-side).

### L4. No Trace ID Propagation
**Finding:** `request_id` is generated at gateway but not forwarded to engine.
**Fix:** Forward `x-request-id` header on engine calls.

---

## Remediation Plan

| ID | Priority | Fix | Component |
|----|----------|-----|-----------|
| C1 | CRITICAL | Entity-filtered listing | gatewayCore.ts |
| C2 | CRITICAL | Idempotency key | gatewayCore.ts |
| C3 | CRITICAL | MCP scope enforcement | mcpTools/entry.ts |
| H1 | HIGH | Async job execution | gatewayCore.ts |
| H2 | HIGH | Retry with backoff | runJob/entry.ts |
| H3 | HIGH | Graceful shutdown | server.js |
| H4 | HIGH | Store active_sessions | gatewayCore.ts |
| H5 | HIGH | Rate limit race fix | gatewayCore.ts |
| M1 | MEDIUM | Keep-alive API | gatewayCore.ts, server.js |
| M2 | MEDIUM | Cookie/storage routes | gatewayCore.ts |
| M3 | MEDIUM | Batch session creation | gatewayCore.ts |
| L1 | LOW | Extract hashKey | crypto.ts |
| L4 | LOW | Trace ID propagation | engineClient.ts |