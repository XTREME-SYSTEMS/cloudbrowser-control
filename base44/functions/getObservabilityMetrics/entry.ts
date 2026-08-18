import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";

// ═══════════════════════════════════════════════
// Observability Metrics — Phase 10
// Computes P50, P95, P99 latencies and operational metrics
// from real runtime data (sessions, jobs, logs, health checks).
// ═══════════════════════════════════════════════

function percentile(sortedArr, p) {
  if (!sortedArr.length) return 0;
  const idx = Math.ceil((p / 100) * sortedArr.length) - 1;
  return sortedArr[Math.max(0, Math.min(idx, sortedArr.length - 1))];
}

export default async function (req) {
  const base44 = createClientFromRequest(req);

  try {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // ── Session metrics ──
    const sessions = await base44.asServiceRole.entities.Session.list("-created_date", 200);
    const recentSessions = sessions.filter((s) => s.created_date && new Date(s.created_date) > last24h);
    const sessionDurations = recentSessions
      .filter((s) => s.started_at && s.ended_at)
      .map((s) => new Date(s.ended_at).getTime() - new Date(s.started_at).getTime())
      .sort((a, b) => a - b);
    const sessionsByStatus = {};
    for (const s of recentSessions) {
      sessionsByStatus[s.status] = (sessionsByStatus[s.status] || 0) + 1;
    }

    // ── Job metrics ──
    const jobs = await base44.asServiceRole.entities.Job.list("-created_date", 200);
    const recentJobs = jobs.filter((j) => j.created_date && new Date(j.created_date) > last24h);
    const jobDurations = recentJobs
      .filter((j) => j.started_at && j.completed_at)
      .map((j) => new Date(j.completed_at).getTime() - new Date(j.started_at).getTime())
      .sort((a, b) => a - b);
    const jobsByStatus = {};
    for (const j of recentJobs) {
      jobsByStatus[j.status] = (jobsByStatus[j.status] || 0) + 1;
    }

    // ── Engine health metrics ──
    const healthLogs = await base44.asServiceRole.entities.EngineHealthLog.list("-created_date", 100);
    const recentHealth = healthLogs.filter((h) => h.created_date && new Date(h.created_date) > last24h);
    const healthByStatus = {};
    for (const h of recentHealth) {
      healthByStatus[h.status] = (healthByStatus[h.status] || 0) + 1;
    }
    const responseTimes = recentHealth.map((h) => h.response_time_ms || 0).filter((t) => t > 0).sort((a, b) => a - b);

    // ── Error patterns ──
    const errorPatterns = await base44.asServiceRole.entities.ErrorPattern.list("-created_date", 50);
    const recentErrors = errorPatterns.filter((e) => e.last_seen && new Date(e.last_seen) > last24h);
    const errorsByCategory = {};
    for (const e of recentErrors) {
      errorsByCategory[e.category] = (errorsByCategory[e.category] || 0) + (e.count || 1);
    }

    // ── Log entries (action-level metrics) ──
    const logEntries = await base44.asServiceRole.entities.LogEntry.list("-created_date", 500);
    const recentLogs = logEntries.filter((l) => l.created_date && new Date(l.created_date) > last24h);
    const actionDurations = recentLogs
      .filter((l) => l.duration_ms && l.duration_ms > 0)
      .map((l) => l.duration_ms)
      .sort((a, b) => a - b);
    const logsByLevel = {};
    for (const l of recentLogs) {
      logsByLevel[l.level || "info"] = (logsByLevel[l.level || "info"] || 0) + 1;
    }

    // ── Rate limit rejects ──
    const rateLimitEntries = await base44.asServiceRole.entities.RateLimitEntry.list("-created_date", 100);
    const recentRateLimits = rateLimitEntries.filter((r) => r.created_date && new Date(r.created_date) > last24h);
    const totalRateLimitCount = recentRateLimits.reduce((sum, r) => sum + (r.count || 0), 0);

    // ── Artifacts ──
    const artifacts = await base44.asServiceRole.entities.Artifact.list("-created_date", 200);
    const recentArtifacts = artifacts.filter((a) => a.created_date && new Date(a.created_date) > last24h);
    const artifactsByType = {};
    for (const a of recentArtifacts) {
      artifactsByType[a.type] = (artifactsByType[a.type] || 0) + 1;
    }

    // ── Orphan/recovery metrics ──
    const orphanSessions = recentSessions.filter((s) => s.status === "errored" || s.status === "timed_out");
    const stuckJobs = recentJobs.filter((j) => j.status === "retrying" || (j.status === "running" && j.started_at && (now - new Date(j.started_at)) > 60 * 60 * 1000));

    // ── Webhook delivery metrics ──
    const webhookDeliveries = await base44.asServiceRole.entities.WebhookDelivery.list("-created_date", 100);
    const recentDeliveries = webhookDeliveries.filter((d) => d.created_date && new Date(d.created_date) > last24h);
    const webhookSuccessCount = recentDeliveries.filter((d) => d.status_code >= 200 && d.status_code < 300).length;
    const webhookFailCount = recentDeliveries.length - webhookSuccessCount;

    // ── Cost metrics ──
    const costEntries = await base44.asServiceRole.entities.CostEntry.list("-created_date", 200);
    const recentCosts = costEntries.filter((c) => c.created_date && new Date(c.created_date) > last24h);
    const totalCost24h = recentCosts.reduce((sum, c) => sum + (c.cost_usd || 0), 0);

    return Response.json({
      period: "24h",
      timestamp: now.toISOString(),
      session_metrics: {
        total_24h: recentSessions.length,
        by_status: sessionsByStatus,
        launch_p50_ms: percentile(sessionDurations, 50),
        launch_p95_ms: percentile(sessionDurations, 95),
        launch_p99_ms: percentile(sessionDurations, 99),
        crashes: sessionsByStatus.errored || 0,
        timeouts: sessionsByStatus.timed_out || 0,
        orphan_count: orphanSessions.length,
      },
      job_metrics: {
        total_24h: recentJobs.length,
        by_status: jobsByStatus,
        duration_p50_ms: percentile(jobDurations, 50),
        duration_p95_ms: percentile(jobDurations, 95),
        duration_p99_ms: percentile(jobDurations, 99),
        stuck_count: stuckJobs.length,
        retry_count: jobsByStatus.retrying || 0,
      },
      action_metrics: {
        total_24h: recentLogs.length,
        duration_p50_ms: percentile(actionDurations, 50),
        duration_p95_ms: percentile(actionDurations, 95),
        duration_p99_ms: percentile(actionDurations, 99),
        by_level: logsByLevel,
      },
      engine_health: {
        checks_24h: recentHealth.length,
        by_status: healthByStatus,
        response_time_p50_ms: percentile(responseTimes, 50),
        response_time_p95_ms: percentile(responseTimes, 95),
        response_time_p99_ms: percentile(responseTimes, 99),
      },
      errors: {
        patterns_24h: recentErrors.length,
        by_category: errorsByCategory,
      },
      rate_limiting: {
        entries_24h: recentRateLimits.length,
        total_requests_24h: totalRateLimitCount,
      },
      artifacts: {
        total_24h: recentArtifacts.length,
        by_type: artifactsByType,
      },
      webhooks: {
        deliveries_24h: recentDeliveries.length,
        success_count: webhookSuccessCount,
        fail_count: webhookFailCount,
      },
      cost: {
        total_usd_24h: Math.round(totalCost24h * 100) / 100,
      },
      recovery: {
        orphan_sessions: orphanSessions.length,
        stuck_jobs: stuckJobs.length,
      },
      __v: DEPLOYMENT_VERSION,
    });
  } catch (error) {
    return Response.json({ error: error.message, __v: DEPLOYMENT_VERSION }, { status: 500 });
  }
}