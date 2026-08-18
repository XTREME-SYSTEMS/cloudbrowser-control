# Vercel Workflow Governance Heartbeat — Deployment Handoff

## Status: BLOCKED — Cannot deploy Vercel Workflow from Base44

## Requirement

Strategic Minds governance requires a 5-minute validation/reconciliation heartbeat using Vercel Workflow.

## Current Approximation

A Base44 scheduled workflow (`Governance Heartbeat.jsonc`) runs every 5 minutes, invoking:
1. `engineHealth` — worker heartbeat check
2. `checkSchedules` — stale session/lease detection
3. `reconcileSettings` — config drift reconciliation
4. `logAudit` — evidence receipt

This is functionally equivalent but runs on Base44's workflow engine, not Vercel.

## Vercel Workflow Deployment Specification

### File: `api/cron/governance-heartbeat.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";

export const config = {
  runtime: "edge",
  schedule: "*/5 * * * *",
};

export default async function handler(req: NextRequest) {
  const BASE44_APP_ID = "6a837c8e995cc4824aabf594";
  const BASE44_FUNCTION_TOKEN = process.env.BASE44_FUNCTION_TOKEN;

  const checks = {
    worker_heartbeat: await invokeBase44("engineHealth", {}),
    stale_sessions: await invokeBase44("checkSchedules", {}),
    config_drift: await invokeBase44("reconcileSettings", { action: "reconcile" }),
    queue_health: await invokeBase44("getMetrics", {}),
    timestamp: new Date().toISOString(),
  };

  // Log evidence
  await invokeBase44("logAudit", {
    action: "governance_heartbeat",
    entity_type: "governance",
    description: `Vercel 5-min heartbeat: ${JSON.stringify(checks)}`,
  });

  return NextResponse.json({ ok: true, checks });
}

async function invokeBase44(functionName: string, payload: any) {
  const res = await fetch(`https://api.base44.com/apps/${BASE44_APP_ID}/functions/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${BASE44_FUNCTION_TOKEN}`,
    },
    body: JSON.stringify(payload),
  });
  return res.json();
}
```

### Required Environment Variables (Vercel)

- `BASE44_FUNCTION_TOKEN` — service token for Base44 function invocation
- `BASE44_APP_ID` — `6a837c8e995cc4824aabf594`

### Deployment Steps (operator)

1. Create Vercel project linked to `XTREME-SYSTEMS/cloudbrowser-control`
2. Add environment variables
3. Deploy `api/cron/governance-heartbeat.ts`
4. Verify cron fires every 5 minutes
5. Verify evidence receipts appear in AuditLog

## Why Not Deploy From Here

Base44 cannot create files in `api/` directories or configure Vercel cron schedules. This specification is the exact handoff — an operator with Vercel access must deploy it.