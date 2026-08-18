import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { engineDelete, isEngineConfigured, setEngineClient } from "../../shared/engineClient.ts";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";

// ═══════════════════════════════════════════════
// Recovery — detects and cleans up orphaned resources
// Phase 7: Failure + Recovery
// ═══════════════════════════════════════════════

export default async function (req) {
  const base44 = createClientFromRequest(req);
  setEngineClient(base44);
  try {
    const results = {
      orphaned_sessions: 0,
      stale_sessions_closed: 0,
      stale_leases_released: 0,
      failed_jobs_marked: 0,
      duplicate_webhooks_deduped: 0,
      errors: [],
      __v: DEPLOYMENT_VERSION,
    };

    // ── 1. Detect orphaned sessions (running > 30 min, no activity) ──
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const runningSessions = await base44.asServiceRole.entities.Session.filter({ status: "running" });
    for (const s of runningSessions) {
      if (s.started_at && s.started_at < thirtyMinAgo) {
        results.orphaned_sessions++;
        // Try to close on engine
        if (s.session_id && await isEngineConfigured()) {
          try { await engineDelete(`/sessions/${s.session_id}`); } catch (e) { /* tolerate */ }
        }
        // Mark as errored in control plane
        await base44.asServiceRole.entities.Session.update(s.id, {
          status: "errored",
          error_message: "Orphaned session — recovered by cleanup",
          ended_at: new Date().toISOString(),
        });
        results.stale_sessions_closed++;
      }
    }

    // ── 2. Detect stale leases on BrowserContexts ──
    const now = new Date().toISOString();
    const lockedContexts = await base44.asServiceRole.entities.BrowserContext.filter({ is_locked: true });
    for (const ctx of lockedContexts) {
      if (ctx.lease_expires_at && ctx.lease_expires_at < now) {
        await base44.asServiceRole.entities.BrowserContext.update(ctx.id, {
          is_locked: false,
          lease_owner: null,
          lease_expires_at: null,
        });
        results.stale_leases_released++;
      }
    }

    // ── 3. Mark jobs stuck in "running" > 60 min as failed ──
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const runningJobs = await base44.asServiceRole.entities.Job.filter({ status: "running" });
    for (const job of runningJobs) {
      if (job.started_at && job.started_at < oneHourAgo) {
        await base44.asServiceRole.entities.Job.update(job.id, {
          status: "failed",
          error_message: "Job timed out — recovered by cleanup",
          completed_at: new Date().toISOString(),
        });
        results.failed_jobs_marked++;
      }
    }

    // ── 4. Detect and clean up jobs in "retrying" > 30 min ──
    const retryingJobs = await base44.asServiceRole.entities.Job.filter({ status: "retrying" });
    for (const job of retryingJobs) {
      if (job.started_at && job.started_at < thirtyMinAgo) {
        await base44.asServiceRole.entities.Job.update(job.id, {
          status: "failed",
          error_message: "Retry exhausted — recovered by cleanup",
          completed_at: new Date().toISOString(),
        });
        results.failed_jobs_marked++;
      }
    }

    // ── 5. Clean up orphaned RateLimitEntry records (older than 2 minutes) ──
    const twoMinAgo = Date.now() - 2 * 60 * 1000;
    const rlEntries = await base44.asServiceRole.entities.RateLimitEntry.list("-created_date", 100);
    for (const entry of rlEntries) {
      if (entry.window_start && entry.window_start < twoMinAgo) {
        await base44.asServiceRole.entities.RateLimitEntry.delete(entry.id).catch(() => {});
      }
    }

    // ── Receipt ──
    await base44.asServiceRole.entities.AuditLog.create({
      action: "config",
      entity_type: "system",
      description: `Recovery cleanup: ${results.stale_sessions_closed} sessions, ${results.stale_leases_released} leases, ${results.failed_jobs_marked} jobs`,
      timestamp: new Date().toISOString(),
    });

    return Response.json(results);
  } catch (error) {
    return Response.json({ error: error.message, __v: DEPLOYMENT_VERSION }, { status: 500 });
  }
}