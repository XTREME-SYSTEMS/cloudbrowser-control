# Fortress Containment Receipt — Private Capital Intelligence Fallback Deactivation

- **Action:** Deactivate scheduled workflow `Private Capital Intelligence Fallback`
- **Scope:** SINGLE scoped containment action. No other production mutation performed.
- **Authorized by:** App owner (explicit, scoped authorization)
- **Executed at:** 2026-08-20 18:43 UTC (America/New_York local 14:43)
- **Executed via:** `manage_workflow` platform tool — `action: "deactivate"`
- **Platform result:** `Workflow transitioned to inactive`

## Verification

- **Platform status:** INACTIVE (confirmed by `manage_workflow` return).
- **Last scheduled run (pre-deactivation):** `56eec503-f458-4a8e-af8e-06bd8342391b` at **2026-08-20 18:40:06.348 UTC** — `[ok]` workflow layer, `IntelligenceRun.status = failed` (consistent with all prior runs; 0 signals ever produced).
- **Empirical proof point:** The `*/5 * * * *` cadence would next fire at **18:45:00 UTC**. That slot and all subsequent slots must show NO new run. Re-check `get_workflow_run("Private Capital Intelligence Fallback")` after 18:50 UTC to confirm the 18:45 and 18:50 slots are absent.

## What was preserved (nothing deleted, nothing reverted)

- All code preserved: `runIntelligenceCycle/entry.ts`, the 5 `Intelligence*` entity schemas, and the workflow definition file remain on disk and on `main` (`b1bb5af`) unchanged.
- All records preserved: `IntelligenceRun`, `IntelligenceSnapshot`, `IntelligenceEvent`, `IntelligenceSignal`, `IntelligenceSource` rows untouched.
- All logs preserved: workflow run history and `AuditLog` entries untouched.
- `main` NOT reverted (still `b1bb5af`).
- `fortress/v1.1` NOT merged (still `e319bbf`, absent the Intelligence system).
- V1.1 NOT deployed.
- No production secrets, schema, RLS, customer data, or traffic changed.

## Why this containment was scoped

Source-truth audit (same session) established that the Private Capital Intelligence subsystem was committed directly to production `main` via 2 "External agent changes" commits (`324ce82`, `b1bb5af`) at 06:54 UTC, bypassing `fortress/v1.1`, CODEOWNERS, and the 39-gate Fortress release matrix. The system is absent from the Fortress candidate branch and has never been certified. The `runIntelligenceCycle` function performs raw `fetch(source.url, { redirect: "follow" })` with no SSRF egress guard — an ungoverned outbound-fetch surface in production outside the hardened `browser-engine/ssrf.js` egress guard. Every `IntelligenceRun` to date has `status: failed` (0 signals created), so deactivation loses no production value.

## State after containment

```
PRODUCTION main:               b1bb5af  (unchanged)
FORTRESS/v1.1:                 e319bbf  (unchanged, not merged)
Private Capital Intel workflow: INACTIVE (scheduler stopped)
Intelligence code/records/logs: PRESERVED
Secrets / schema / RLS / data / traffic: UNCHANGED
RELEASE GATE:                  STILL BLOCKED — staging boundary + live certification remain operator-owned
```

## Next required action (operator-only)

Provision the Railway staging boundary (see staging packet delivered to operator) and run the 8-category live certification to three consecutive complete passes. Do NOT re-activate the Intelligence heartbeat until the subsystem is ported onto `fortress/v1.1`, given the 39-gate matrix, and its raw-`fetch` path is wrapped with `validateEgressUrl` SSRF protection.

## STOP

No further production mutation performed. Awaiting operator action.