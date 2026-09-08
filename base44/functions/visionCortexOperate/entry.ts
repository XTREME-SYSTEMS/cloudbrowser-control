import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden — admin only" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const operation = body.operation || "analyze";
    const db = base44.asServiceRole;

    // Get VC connection
    const vcConns = await db.entities.VisionCortexConnection.list("-created_date", 1).catch(() => []);
    const vcConn = vcConns[0];

    // Check if operation is enabled
    const enabledOps = vcConn?.operations_enabled || ["analyze", "heal", "optimize", "enhance", "manage", "operate", "code", "full_cycle"];
    if (!enabledOps.includes(operation) && operation !== "status") {
      return Response.json({ error: `Operation '${operation}' not enabled for this connection` }, { status: 403 });
    }

    const startedAt = new Date().toISOString();
    let result: any = { operation, started_at: startedAt, actions: [], summary: {} };

    // ─── GATHER SYSTEM STATE ─────────────────────────────────────
    const [
      subscriptions, sessions, jobs, sandboxes, agents, apiKeys,
      engineLogs, autoHealLogs, errorPatterns, webhooks, captchas,
      promoCodes, settings, enhancements, brainCommands, brainSyncLogs,
      dataAssets, intelligenceArtifacts
    ] = await Promise.all([
      db.entities.Subscription.list("-created_date", 200).catch(() => []),
      db.entities.Session.list("-created_date", 100).catch(() => []),
      db.entities.Job.list("-created_date", 100).catch(() => []),
      db.entities.Sandbox.list("-created_date", 50).catch(() => []),
      db.entities.UserAgent.list("-created_date", 50).catch(() => []),
      db.entities.ApiKey.list("-created_date", 50).catch(() => []),
      db.entities.EngineHealthLog.list("-created_date", 20).catch(() => []),
      db.entities.AutoHealLog.list("-created_date", 20).catch(() => []),
      db.entities.ErrorPattern.list("-created_date", 50).catch(() => []),
      db.entities.Webhook.list("-created_date", 50).catch(() => []),
      db.entities.CaptchaSolveLog.list("-created_date", 50).catch(() => []),
      db.entities.PromoCode.list("-created_date", 50).catch(() => []),
      db.entities.Setting.list("-created_date", 50).catch(() => []),
      db.entities.SystemEnhancement.list("-created_date", 50).catch(() => []),
      db.entities.BrainCommand.list("-created_date", 20).catch(() => []),
      db.entities.BrainSyncLog.list("-created_date", 20).catch(() => []),
      db.entities.DataAsset.list("-created_date", 50).catch(() => []),
      db.entities.IntelligenceArtifact.list("-created_date", 50).catch(() => []),
    ]);

    // ─── ANALYZE ────────────────────────────────────────────────
    if (operation === "analyze" || operation === "full_cycle") {
      const activeSessions = sessions.filter((s) => s.status === "active" || s.status === "running");
      const failedJobs = jobs.filter((j) => j.status === "failed" || j.status === "error");
      const unhealthyEngines = engineLogs.filter((e) => e.status === "unhealthy" || e.status === "unreachable");
      const failedSandboxes = sandboxes.filter((s) => s.status === "failed");
      const staleSessions = activeSessions.filter((s) => {
        if (!s.created_date) return false;
        return Date.now() - new Date(s.created_date).getTime() > 30 * 60 * 1000;
      });
      const now = new Date();
      const expiredActivePromos = promoCodes.filter((p) => p.status === "active" && p.valid_until && new Date(p.valid_until) < now);
      const pendingEnhancements = enhancements.filter((e) => e.status === "pending" || e.status === "in_progress");
      const pendingBrainCmds = brainCommands.filter((c) => c.status === "pending");
      const failedBrainSyncs = brainSyncLogs.filter((s) => s.status === "failed");

      const issues: any[] = [];
      if (unhealthyEngines.length > 0) issues.push({ severity: "critical", category: "engine", message: `${unhealthyEngines.length} unhealthy engine(s)`, action: "heal:redeploy_engines" });
      if (failedSandboxes.length > 0) issues.push({ severity: "warning", category: "sandboxes", message: `${failedSandboxes.length} failed sandbox(es)`, action: "heal:cleanup_sandboxes" });
      if (failedJobs.length > 10) issues.push({ severity: "warning", category: "jobs", message: `${failedJobs.length} failed jobs`, action: "heal:retry_jobs" });
      if (staleSessions.length > 5) issues.push({ severity: "warning", category: "sessions", message: `${staleSessions.length} stale sessions`, action: "heal:cleanup_sessions" });
      if (expiredActivePromos.length > 0) issues.push({ severity: "info", category: "promos", message: `${expiredActivePromos.length} expired promos still active`, action: "heal:expire_promos" });
      if (pendingEnhancements.length > 0) issues.push({ severity: "info", category: "enhancements", message: `${pendingEnhancements.length} pending enhancements`, action: "enhance:process_pending" });
      if (pendingBrainCmds.length > 0) issues.push({ severity: "info", category: "brain", message: `${pendingBrainCmds.length} pending brain commands`, action: "manage:process_brain_cmds" });
      if (failedBrainSyncs.length > 0) issues.push({ severity: "warning", category: "brain", message: `${failedBrainSyncs.length} failed brain syncs`, action: "heal:retry_brain_syncs" });

      result.summary = {
        total_subscriptions: subscriptions.length,
        active_sessions: activeSessions.length,
        total_jobs: jobs.length,
        failed_jobs: failedJobs.length,
        total_sandboxes: sandboxes.length,
        failed_sandboxes: failedSandboxes.length,
        total_agents: agents.length,
        active_api_keys: apiKeys.filter((k) => k.active !== false).length,
        engine_health: unhealthyEngines.length === 0 ? "healthy" : "degraded",
        pending_enhancements: pendingEnhancements.length,
        pending_brain_commands: pendingBrainCmds.length,
        data_assets: dataAssets.length,
        intelligence_artifacts: intelligenceArtifacts.length,
      };
      result.actions.push({ action: "system_analysis", issues_found: issues.length, issues });
      result.issues = issues;

      if (vcConn) {
        await db.entities.VisionCortexConnection.update(vcConn.id, {
          last_audit_at: startedAt,
          last_audit_result: `${issues.length} issue(s) detected`,
          audit_count: (vcConn.audit_count || 0) + 1,
          issues_detected: (vcConn.issues_detected || 0) + issues.length,
        });
      }
    }

    // ─── HEAL ───────────────────────────────────────────────────
    if (operation === "heal" || operation === "full_cycle") {
      const healActions: any[] = [];
      const now = new Date();

      // Expire stale promos
      const expiredPromos = promoCodes.filter((p) => p.status === "active" && p.valid_until && new Date(p.valid_until) < now);
      if (expiredPromos.length > 0) {
        for (const p of expiredPromos) {
          await db.entities.PromoCode.update(p.id, { status: "expired" }).catch(() => {});
        }
        healActions.push({ action: "expire_promos", count: expiredPromos.length });
      }

      // Clean up stale sessions (mark as closed)
      const staleSessions = sessions.filter((s) => (s.status === "active" || s.status === "running") && s.created_date && Date.now() - new Date(s.created_date).getTime() > 30 * 60 * 1000);
      if (staleSessions.length > 0) {
        for (const s of staleSessions.slice(0, 20)) {
          await db.entities.Session.update(s.id, { status: "closed" }).catch(() => {});
        }
        healActions.push({ action: "cleanup_stale_sessions", count: Math.min(staleSessions.length, 20) });
      }

      // Mark failed sandboxes as terminated
      const failedSandboxes = sandboxes.filter((s) => s.status === "failed");
      if (failedSandboxes.length > 0) {
        for (const s of failedSandboxes.slice(0, 10)) {
          await db.entities.Sandbox.update(s.id, { status: "terminated" }).catch(() => {});
        }
        healActions.push({ action: "cleanup_failed_sandboxes", count: Math.min(failedSandboxes.length, 10) });
      }

      // Reap expired entities
      const expiredSessions = sessions.filter((s) => s.status === "expired");
      if (expiredSessions.length > 0) {
        await db.entities.Session.deleteMany({ status: "expired" }).catch(() => {});
        healActions.push({ action: "reap_expired_sessions", count: expiredSessions.length });
      }

      const totalHealed = healActions.reduce((sum, a) => sum + a.count, 0);
      result.actions.push({ action: "heal_cycle", actions: healActions, total_healed: totalHealed });

      if (vcConn) {
        await db.entities.VisionCortexConnection.update(vcConn.id, {
          last_heal_at: startedAt,
          last_heal_result: `${totalHealed} item(s) healed`,
          heal_count: (vcConn.heal_count || 0) + 1,
          issues_healed: (vcConn.issues_healed || 0) + totalHealed,
        });
      }

      // Log the heal
      await db.entities.AutoHealLog.create({
        target_type: "engine",
        target_id: "vision_cortex",
        target_name: "Vision Cortex Auto-Heal",
        issue_detected: "system_maintenance",
        action_taken: "redeploy",
        action_result: "success",
        details: { healActions, totalHealed },
        healed_at: startedAt,
        cycle_id: `vc-heal-${Date.now()}`,
      }).catch(() => {});
    }

    // ─── OPTIMIZE ───────────────────────────────────────────────
    if (operation === "optimize" || operation === "full_cycle") {
      // Analyze subscription usage and identify optimization opportunities
      const activeSubs = subscriptions.filter((s) => s.status === "active");
      const overLimitSubs = activeSubs.filter((s) => {
        const maxHrs = s.max_browser_hours || 0;
        const usedHrs = s.usage_browser_hours || 0;
        return maxHrs > 0 && usedHrs / maxHrs > 0.9;
      });
      const underusedAgents = agents.filter((a) => a.status === "active" && (a.run_count || 0) === 0);
      const idleSandboxes = sandboxes.filter((s) => s.status === "active" && s.last_activity_at && Date.now() - new Date(s.last_activity_at).getTime() > 7 * 86400000);

      const optimizations = [];
      if (overLimitSubs.length > 0) optimizations.push({ type: "usage_alert", message: `${overLimitSubs.length} subscription(s) near browser hour limit`, action: "notify_users_to_upgrade" });
      if (underusedAgents.length > 0) optimizations.push({ type: "idle_agents", message: `${underusedAgents.length} agent(s) with zero runs`, action: "consider_archiving" });
      if (idleSandboxes.length > 0) optimizations.push({ type: "idle_sandboxes", message: `${idleSandboxes.length} sandbox(es) inactive >7 days`, action: "consider_pausing" });

      // Auto-pause idle sandboxes
      if (idleSandboxes.length > 0) {
        for (const s of idleSandboxes.slice(0, 5)) {
          await db.entities.Sandbox.update(s.id, { status: "paused" }).catch(() => {});
        }
        optimizations.push({ type: "auto_paused_sandboxes", count: Math.min(idleSandboxes.length, 5) });
      }

      result.actions.push({ action: "optimize_cycle", optimizations, total_optimizations: optimizations.length });
    }

    // ─── ENHANCE ────────────────────────────────────────────────
    if (operation === "enhance" || operation === "full_cycle") {
      // Process pending enhancements
      const pendingEnhancements = enhancements.filter((e) => e.status === "pending" || e.status === "in_progress");
      let processed = 0;
      for (const e of pendingEnhancements.slice(0, 5)) {
        await db.entities.SystemEnhancement.update(e.id, {
          status: "auditing",
          last_action_at: startedAt,
        }).catch(() => {});
        processed++;
      }
      result.actions.push({ action: "enhance_cycle", enhancements_processed: processed, total_pending: pendingEnhancements.length });
    }

    // ─── MANAGE ─────────────────────────────────────────────────
    if (operation === "manage" || operation === "full_cycle") {
      // Process pending brain commands
      const pendingBrainCmds = brainCommands.filter((c) => c.status === "pending");
      let cmdProcessed = 0;
      for (const c of pendingBrainCmds.slice(0, 5)) {
        await db.entities.BrainCommand.update(c.id, {
          status: "processing",
          received_at: c.received_at || startedAt,
        }).catch(() => {});
        cmdProcessed++;
      }

      // Reconcile settings drift
      const driftedSettings = settings.filter((s) => s.drift_status && s.drift_status !== "none");
      let settingsReconciled = 0;
      for (const s of driftedSettings.slice(0, 10)) {
        if (s.desired_value && s.effective_value !== s.desired_value) {
          await db.entities.Setting.update(s.id, {
            effective_value: s.desired_value,
            apply_status: "applied",
            last_verified_at: startedAt,
          }).catch(() => {});
          settingsReconciled++;
        }
      }

      result.actions.push({
        action: "manage_cycle",
        brain_commands_processed: cmdProcessed,
        settings_reconciled: settingsReconciled,
      });
    }

    // ─── CODE (AI-driven code analysis & suggestions) ────────────
    if (operation === "code" || operation === "full_cycle") {
      // Use InvokeLLM to analyze system and generate improvement suggestions
      const systemContext = JSON.stringify({
        entities: { subscriptions: subscriptions.length, sessions: sessions.length, jobs: jobs.length, sandboxes: sandboxes.length, agents: agents.length },
        issues: result.issues || [],
        failedJobs: jobs.filter((j) => j.status === "failed").length,
        errorPatterns: errorPatterns.slice(0, 5).map((e) => ({ pattern: e.pattern, count: e.occurrence_count })),
      });

      const llmResponse = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Vision Cortex, an autonomous system engineer for XTREME SCRAPER, a browser automation platform. Analyze the following system state and generate actionable code/system improvement suggestions. Focus on reliability, performance, and self-healing capabilities.\n\nSystem State:\n${systemContext}\n\nProvide 3-5 specific, actionable improvement suggestions with priority (P0/P1/P2), the affected component, and a brief implementation approach.`,
        response_json_schema: {
          type: "object",
          properties: {
            suggestions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  priority: { type: "string" },
                  component: { type: "string" },
                  suggestion: { type: "string" },
                  approach: { type: "string" },
                },
              },
            },
          },
        },
      }).catch(() => ({ suggestions: [] }));

      result.actions.push({
        action: "code_analysis",
        suggestions: (llmResponse as any)?.suggestions || [],
      });
    }

    // ─── OPERATE (full end-to-end) ──────────────────────────────
    if (operation === "operate") {
      // Run a comprehensive end-to-end operation: analyze → heal → optimize → manage
      const activeSessions = sessions.filter((s) => s.status === "active" || s.status === "running");
      const failedJobs = jobs.filter((j) => j.status === "failed");
      const now = new Date();
      const expiredPromos = promoCodes.filter((p) => p.status === "active" && p.valid_until && new Date(p.valid_until) < now);

      // Heal: expire promos, clean sessions
      if (expiredPromos.length > 0) {
        for (const p of expiredPromos) await db.entities.PromoCode.update(p.id, { status: "expired" }).catch(() => {});
      }
      const staleS = activeSessions.filter((s) => s.created_date && Date.now() - new Date(s.created_date).getTime() > 30 * 60 * 1000);
      for (const s of staleS.slice(0, 20)) await db.entities.Session.update(s.id, { status: "closed" }).catch(() => {});

      result.actions.push({
        action: "end_to_end_operate",
        promos_expired: expiredPromos.length,
        sessions_cleaned: Math.min(staleS.length, 20),
        failed_jobs_detected: failedJobs.length,
        total_entities_managed: subscriptions.length + sessions.length + jobs.length + sandboxes.length + agents.length,
      });
    }

    // ─── STATUS (read-only) ─────────────────────────────────────
    if (operation === "status") {
      result.summary = {
        connection_status: vcConn?.status || "pending",
        autonomous_mode: vcConn?.autonomous_mode,
        bidirectional: vcConn?.bidirectional,
        operations_enabled: enabledOps,
        audit_count: vcConn?.audit_count || 0,
        heal_count: vcConn?.heal_count || 0,
        operate_count: vcConn?.operate_count || 0,
        issues_detected: vcConn?.issues_detected || 0,
        issues_healed: vcConn?.issues_healed || 0,
        last_audit: vcConn?.last_audit_at,
        last_heal: vcConn?.last_heal_at,
        last_operate: vcConn?.last_operate_at,
      };
    }

    // Update VC connection with operation result
    if (vcConn && operation !== "status") {
      await db.entities.VisionCortexConnection.update(vcConn.id, {
        last_operate_at: startedAt,
        last_operation: operation,
        last_operate_result: `${operation} completed — ${result.actions.length} action(s)`,
        operate_count: (vcConn.operate_count || 0) + 1,
      });
    }

    result.completed_at = new Date().toISOString();
    result.success = true;
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message, success: false }, { status: 500 });
  }
}