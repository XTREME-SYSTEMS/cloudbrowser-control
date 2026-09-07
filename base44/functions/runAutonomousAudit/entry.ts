import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    const db = base44.asServiceRole;

    // Gather system state in parallel
    const [
      subscriptions, engineLogs, autoHealLogs, errorPatterns,
      webhooks, captchas, jobs, sessions, promoCodes, apiKeys,
      vcConnections, sandboxs, agents
    ] = await Promise.all([
      db.entities.Subscription.list('-created_date', 200).catch(() => []),
      db.entities.EngineHealthLog.list('-created_date', 20).catch(() => []),
      db.entities.AutoHealLog.list('-created_date', 20).catch(() => []),
      db.entities.ErrorPattern.list('-created_date', 50).catch(() => []),
      db.entities.Webhook.list('-created_date', 50).catch(() => []),
      db.entities.CaptchaSolveLog.list('-created_date', 50).catch(() => []),
      db.entities.Job.list('-created_date', 100).catch(() => []),
      db.entities.Session.list('-created_date', 100).catch(() => []),
      db.entities.PromoCode.list('-created_date', 50).catch(() => []),
      db.entities.ApiKey.list('-created_date', 50).catch(() => []),
      db.entities.VisionCortexConnection.list('-created_date', 5).catch(() => []),
      db.entities.Sandbox.list('-created_date', 50).catch(() => []),
      db.entities.UserAgent.list('-created_date', 50).catch(() => []),
    ]);

    // Analyze
    const activeSubs = subscriptions.filter(s => s.status === 'active');
    const payingSubs = activeSubs.filter(s => s.plan_tier !== 'free');
    const freeSubs = activeSubs.filter(s => s.plan_tier === 'free');
    const failedJobs = jobs.filter(j => j.status === 'failed' || j.status === 'error');
    const activeSessions = sessions.filter(s => s.status === 'active' || s.status === 'running');
    const unhealthyEngines = engineLogs.filter(e => e.status === 'unhealthy' || e.status === 'unreachable');
    const failedHeals = autoHealLogs.filter(h => h.action_result === 'failed');
    const activePromos = promoCodes.filter(p => p.status === 'active');
    const activeApiKeys = apiKeys.filter(k => k.active !== false);

    const issues: any[] = [];

    // Check engine health
    if (unhealthyEngines.length > 0) {
      issues.push({
        severity: 'critical',
        category: 'engine',
        message: `${unhealthyEngines.length} unhealthy engine(s) detected`,
        action: 'preflightHeal:redeploy_engines',
      });
    }

    // Check failed jobs
    if (failedJobs.length > 10) {
      issues.push({
        severity: 'warning',
        category: 'jobs',
        message: `${failedJobs.length} failed jobs in recent history`,
        action: 'preflightHeal:retry_failed_jobs',
      });
    }

    // Check auto-heal failures
    if (failedHeals.length > 3) {
      issues.push({
        severity: 'warning',
        category: 'autoheal',
        message: `${failedHeals.length} auto-heal actions failed`,
        action: 'preflightHeal:retry_failed_heals',
      });
    }

    // Check webhook delivery failures
    const failedWebhooks = webhooks.filter(w => w.delivery_status === 'failed');
    if (failedWebhooks.length > 0) {
      issues.push({
        severity: 'warning',
        category: 'webhooks',
        message: `${failedWebhooks.length} webhook delivery failures`,
        action: 'preflightHeal:retry_webhooks',
      });
    }

    // Check expired promo codes still active
    const now = new Date();
    const expiredActivePromos = activePromos.filter(p => p.valid_until && new Date(p.valid_until) < now);
    if (expiredActivePromos.length > 0) {
      issues.push({
        severity: 'info',
        category: 'promos',
        message: `${expiredActivePromos.length} promo codes expired but still marked active`,
        action: 'preflightHeal:expire_promos',
      });
    }

    // Check sandbox issues
    const failedSandboxes = sandboxs.filter(s => s.status === 'failed');
    if (failedSandboxes.length > 0) {
      issues.push({
        severity: 'warning',
        category: 'sandboxes',
        message: `${failedSandboxes.length} failed sandboxes`,
        action: 'preflightHeal:cleanup_sandboxes',
      });
    }

    // Check for stale sessions
    const staleSessions = activeSessions.filter(s => {
      if (!s.created_date) return false;
      const age = Date.now() - new Date(s.created_date).getTime();
      return age > 30 * 60 * 1000; // older than 30 min
    });
    if (staleSessions.length > 5) {
      issues.push({
        severity: 'warning',
        category: 'sessions',
        message: `${staleSessions.length} stale sessions (>30min old)`,
        action: 'preflightHeal:cleanup_stale_sessions',
      });
    }

    // Update VC connection with audit result
    if (vcConnections.length > 0) {
      const vc = vcConnections[0];
      await db.entities.VisionCortexConnection.update(vc.id, {
        last_audit_at: new Date().toISOString(),
        last_audit_result: `${issues.length} issue(s) detected`,
        audit_count: (vc.audit_count || 0) + 1,
        issues_detected: (vc.issues_detected || 0) + issues.length,
      });
    }

    const auditReport = {
      audited_at: new Date().toISOString(),
      audited_by: user.email,
      summary: {
        total_subscriptions: subscriptions.length,
        paying_subscriptions: payingSubs.length,
        free_subscriptions: freeSubs.length,
        active_sessions: activeSessions.length,
        total_jobs: jobs.length,
        failed_jobs: failedJobs.length,
        active_api_keys: activeApiKeys.length,
        active_promos: activePromos.length,
        total_sandboxes: sandboxs.length,
        total_agents: agents.length,
        engine_health: unhealthyEngines.length === 0 ? 'healthy' : 'degraded',
      },
      issues,
      issue_count: issues.length,
      recommendations: issues.map(i => i.action),
    };

    return Response.json(auditReport);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}