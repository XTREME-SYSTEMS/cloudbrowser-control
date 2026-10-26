# Five-Minute Cron Contract

## Purpose
Provide the permanent validator heartbeat for the autonomous CloudBrowser engineering loop. The cron is intentionally more frequent than the engineering cycle so failures, stale leases, drift, and health changes are detected quickly.

## Owner
Strategic Minds operator. Vercel is the scheduler; the workflow is the executor.

## Required schedule
`*/5 * * * *`

## Required route
`/api/cron/auto-builder`

## Required Vercel configuration
```json
{
  "crons": [
    {
      "path": "/api/cron/auto-builder",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

## Request validation
1. Require HTTPS.
2. Validate `CRON_SECRET` when configured.
3. Validate Vercel cron schedule metadata/header when available and require it to represent `*/5 * * * *`.
4. Reject arbitrary browser/user calls to the cron endpoint.
5. Do not log authorization values.

## Inputs
No operator payload is required. Project targets are loaded from durable autonomy state. Manual debug invocation, if later supported, must be explicitly authenticated and must default to read-only validation.

## Outputs
A compact status response containing only non-secret operational metadata:
- heartbeat receipt ID
- project count examined
- leases claimed/skipped
- validations completed
- blockers detected
- next due engineering timestamp

## Heartbeat behavior
Every invocation may perform:
- worker/engine health checks
- stale session/job checks
- branch/SHA verification
- deployment drift checks
- unresolved failure checks
- due-schedule checks
- receipt reconciliation
- lease expiry/recovery
- full validation when policy marks it due

Every invocation MUST NOT automatically perform engineering work unless the hourly engineering lease is due and successfully claimed.

## Hourly engineering rule
`engineering_due = now >= next_engineering_run_at`

The cron remains five-minute; engineering cadence is represented in durable state. Do not create a second hourly cron.

## Failure semantics
- 401/403: authentication failure; no state mutation except security receipt when safely possible.
- 409: active lease conflict; safe NOOP.
- 423: project approval/block gate; monitor only.
- 5xx: infrastructure failure; retry according to Vercel Workflow policy.
- product/test failures return a successful workflow transport response with state `VALIDATION_FAILED`; they are not infrastructure errors.

## Gates
Cron execution itself never authorizes production or main-branch mutation.

## Validation receipts
Each five-minute bucket requires exactly one canonical heartbeat receipt per project after idempotent deduplication.

## Rollback path
If the cron causes instability, disable engineering dispatch first while retaining read-only health monitoring. If necessary, disable the cron configuration and restore the previous known-good workflow after operator approval.
