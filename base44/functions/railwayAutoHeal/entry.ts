import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";
import { getProjectStatus, getProjectMeta, railwayGraphQL } from "../../shared/railwayClient.ts";
import { getEngineUrls, setEngineClient } from "../../shared/engineClient.ts";
import { probeEngine, deriveLabel } from "../../shared/engineProbe.ts";
import { secrets } from "base44:runtime";

// Auto-heal brain — detects Railway failures & engine outages, remediates automatically.
// Runs on a 5-minute workflow schedule. Promotes backup engines when primary is down.

const COOLDOWN_MS = 5 * 60 * 1000;        // Don't re-heal the same target within 5 min
const STUCK_THRESHOLD_MS = 10 * 60 * 1000; // RUNNING > 10 min = stuck deployment

async function logAction(
  base44: any,
  cycleId: string,
  targetType: string,
  targetId: string,
  targetName: string,
  issue: string,
  action: string,
  result: string,
  errorMessage = "",
  details: any = {}
) {
  try {
    await base44.asServiceRole.entities.AutoHealLog.create({
      target_type: targetType,
      target_id: targetId,
      target_name: targetName || "",
      issue_detected: issue,
      action_taken: action,
      action_result: result,
      error_message: errorMessage || undefined,
      details,
      healed_at: new Date().toISOString(),
      cycle_id: cycleId,
    });
  } catch (e) {
    console.error("AutoHealLog persist failed:", e.message);
  }
}

export default async function (req) {
  const base44 = createClientFromRequest(req);
  setEngineClient(base44);

  const cycleId = `heal-${Date.now()}`;
  const actions: any[] = [];
  const skipped: any[] = [];

  try {
    // Check if auto-heal is enabled (default: enabled)
    const settings = await base44.asServiceRole.entities.Setting.filter({ setting_key: "autoheal.enabled" });
    const autoHealEnabled = settings.length === 0 || settings[0].effective_value !== "false";

    if (!autoHealEnabled) {
      return Response.json({
        ok: true,
        enabled: false,
        message: "Auto-heal is disabled",
        cycle_id: cycleId,
        __v: DEPLOYMENT_VERSION,
      }, { status: 200 });
    }

    // Load recent heal logs for cooldown + failure-cap checking
    const recentLogs = await base44.asServiceRole.entities.AutoHealLog.list("-healed_at", 500);
    const now = Date.now();

    // Don't re-heal the same target within COOLDOWN_MS of a successful action
    const isOnCooldown = (targetId: string) =>
      recentLogs.some(
        (l: any) =>
          l.target_id === targetId &&
          l.action_result === "success" &&
          l.healed_at &&
          now - new Date(l.healed_at).getTime() < COOLDOWN_MS
      );

    // Failure cap: stop redeploy loops — max 5 redeploy-type actions per target per 24h.
    // Prevents infinite redeploy cycling on chronically-failing deployments.
    const MAX_REDEPLOYS_PER_DAY = 5;
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const redeployCount = (targetId: string) =>
      recentLogs.filter(
        (l: any) =>
          l.target_id === targetId &&
          ["redeploy", "cancel_and_redeploy", "deploy_latest"].includes(l.action_taken) &&
          l.healed_at &&
          now - new Date(l.healed_at).getTime() < ONE_DAY_MS
      ).length;

    const loggedRecently = (issue: string, windowMs: number) =>
      recentLogs.some(
        (l: any) =>
          l.issue_detected === issue &&
          l.healed_at &&
          now - new Date(l.healed_at).getTime() < windowMs
      );

    // A Railway token that has gone bad fails every cycle. On a 10-minute schedule
    // that is 144 identical rows a day, which buries the real healing history and
    // bloats the 500-row read above that the cooldown logic depends on. One row an
    // hour is enough to see it; every cycle is not.
    const RAILWAY_UNREACHABLE_LOG_INTERVAL_MS = 60 * 60 * 1000;

    // ═══════════════════════════════════════════
    // 1. RAILWAY SERVICE HEALING
    // ═══════════════════════════════════════════
    // A Railway auth failure must never stop the engine healing in step 2 below.
    // The engine checks used to sit behind this call, so a rejected project token
    // silently disabled engine failover as well as service restarts — which is why
    // a degraded engine could sit there for days with nothing acting on it.
    let railwayServices: any[] = [];
    let environmentId = "";
    try {
      const status = await getProjectStatus();
      railwayServices = status.services;
      environmentId = (await getProjectMeta()).environmentId;
    } catch (railwayError: any) {
      if (!loggedRecently("railway_unreachable", RAILWAY_UNREACHABLE_LOG_INTERVAL_MS)) {
        await logAction(base44, cycleId, "railway_project", "project", "railway", "railway_unreachable", "none", "failed", railwayError.message);
      }
      actions.push({
        target_type: "railway_project", target_id: "project", target_name: "railway",
        issue: "railway_unreachable", action: "none", result: "failed", error: railwayError.message,
      });
    }

    // ═══════════════════════════════════════════
    // 0. ENGINE PROBE — READ BEFORE ANY RAILWAY SERVICE ACTION
    // ═══════════════════════════════════════════
    // A Railway deployment marked FAILED is NOT an outage. Railway keeps the previous
    // instance serving while a new build fails, so the service can be entirely healthy.
    // Acting on that status alone restarted two working engines on every cycle —
    // destroying their warm browser pool and any live session — while every probe
    // reported the fleet healthy. Read the fleet first, and never restart a service
    // that is demonstrably still serving browser work.
    const engineKey = secrets.get("ENGINE_API_KEY");
    const engineUrls = engineKey ? await getEngineUrls() : [];
    const probes = engineUrls.length > 0
      ? await Promise.all(engineUrls.map((url, i) => probeEngine(url, engineKey)))
      : [];
    probes.forEach((p, i) => { p.engine_label = deriveLabel(p.engine_url, i); });

    // ═══════════════════════════════════════════
    // 0b. DEGRADED ENGINE — REBUILD ITS BROWSER POOL
    // ═══════════════════════════════════════════
    // An engine that answers /health but cannot launch a browser is degraded, and
    // nothing else here acts on it: its Railway deployment is not FAILED (the old
    // instance is up), and it cannot self-restart either — its own
    // exit-on-launch-failure guard stands down while the pool still lists warm
    // browsers. That is how a container which can spawn nothing keeps reporting
    // "healthy" to everything that only reads /health, while every job routed to it
    // fails. Measured, not theoretical: the primary sat degraded with a full pool
    // reading 3/3 until its pool was rebuilt by hand.
    //
    // Recycling the pool drops those pooled handles and re-warms from scratch. It
    // runs entirely inside the container, so it needs no restart and takes no live
    // session with it — the only safe lever on an engine that may still be serving
    // work. One that still cannot launch after the rebuild is left for a human:
    // restarting it would cost live sessions and the next cycle would find the same
    // thing again.
    if (engineKey) {
      const MAX_POOL_RECYCLES_PER_DAY = 6;
      const poolRecycleCount = (targetId: string) =>
        recentLogs.filter(
          (l: any) =>
            l.target_id === targetId &&
            l.action_taken === "recycle_pool" &&
            l.healed_at &&
            now - new Date(l.healed_at).getTime() < ONE_DAY_MS
        ).length;

      for (const probe of probes) {
        if (probe.ok || probe.status !== "degraded" || !probe.readiness) continue;
        const targetId = probe.engine_url;
        if (isOnCooldown(targetId)) continue;
        if (poolRecycleCount(targetId) >= MAX_POOL_RECYCLES_PER_DAY) continue;

        const before = String(probe.error_message || "browser launch failed").slice(0, 200);
        try {
          const res = await fetch(`${String(targetId).replace(/\/$/, "")}/pool/recycle`, {
            method: "POST",
            headers: { "x-api-key": engineKey, "Content-Type": "application/json" },
            signal: AbortSignal.timeout(30000),
          });
          if (!res.ok) throw new Error(`pool recycle returned HTTP ${res.status}`);

          // Re-read this engine so the rest of the cycle works from the healed
          // state — an engine that is serving again must not then be restarted.
          const fresh = await probeEngine(probe.engine_url, engineKey);
          Object.assign(probe, fresh);

          await logAction(base44, cycleId, "engine", targetId, probe.engine_label, "engine_degraded", "recycle_pool",
            probe.ok ? "success" : "failed",
            probe.ok ? "" : String(probe.error_message || "still cannot launch a browser after a pool rebuild"),
            { before_error: before, status_after: probe.status });
          actions.push({
            target_type: "engine", target_id: targetId, target_name: probe.engine_label,
            issue: "engine_degraded", action: "recycle_pool",
            result: probe.ok ? "success" : "failed",
            error: probe.ok ? undefined : String(probe.error_message || "still cannot launch a browser"),
          });
        } catch (e: any) {
          await logAction(base44, cycleId, "engine", targetId, probe.engine_label, "engine_degraded", "recycle_pool", "failed", e.message, { before_error: before });
          actions.push({ target_type: "engine", target_id: targetId, target_name: probe.engine_label, issue: "engine_degraded", action: "recycle_pool", result: "failed", error: e.message });
        }
      }
    }

    // Railway serves a service at <service-name>-<environment>.up.railway.app, and one
    // engine service name is a prefix of another ("cloudbrowser-engine" against
    // "cloudbrowser-engine-2"), so resolve the LONGEST service name the host starts
    // with. Taking the first match would let engine-1's name claim engine-2's probe.
    const servingService = (serviceName: string) => {
      const name = String(serviceName || "").toLowerCase();
      if (!name) return false;
      return probes.some((p) => {
        if (!p.ok || typeof p.engine_url !== "string") return false;
        let host = "";
        try { host = new URL(p.engine_url).hostname.toLowerCase(); } catch { return false; }
        const matched = railwayServices
          .map((s: any) => String(s.name || "").toLowerCase())
          .filter((sn: string) => sn && (host === sn || host.startsWith(`${sn}-`)))
          .sort((a: string, b: string) => b.length - a.length)[0];
        return matched === name;
      });
    };

    for (const service of railwayServices) {
      for (const instance of service.instances) {
        const dep = instance.latestDeployment;
        const targetId = service.id;
        const targetName = service.name;

        if (isOnCooldown(targetId)) continue;
        if (redeployCount(targetId) >= MAX_REDEPLOYS_PER_DAY) continue;

        // Never restart a service that is still answering and still launching browsers.
        // The FAILED deployment is reported, not acted on: a restart here costs the warm
        // pool and every live session, and gains nothing while the old instance serves.
        if (servingService(targetName)) {
          if (dep?.status === "FAILED") {
            skipped.push({
              target_type: "railway_service", target_id: targetId, target_name: targetName,
              issue: "failed_deployment", reason: "engine is still serving browser work",
            });
          }
          continue;
        }

        // FAILED deployment → redeploy
        if (dep?.status === "FAILED" && dep.canRedeploy) {
          try {
            await railwayGraphQL(
              `mutation($environmentId: String!, $serviceId: String!) {
                serviceInstanceRedeploy(environmentId: $environmentId, serviceId: $serviceId)
              }`,
              { environmentId, serviceId: service.id }
            );
            await logAction(base44, cycleId, "railway_service", targetId, targetName, "failed_deployment", "redeploy", "success");
            actions.push({ target_type: "railway_service", target_id: targetId, target_name: targetName, issue: "failed_deployment", action: "redeploy", result: "success" });
          } catch (e: any) {
            await logAction(base44, cycleId, "railway_service", targetId, targetName, "failed_deployment", "redeploy", "failed", e.message);
            actions.push({ target_type: "railway_service", target_id: targetId, target_name: targetName, issue: "failed_deployment", action: "redeploy", result: "failed", error: e.message });
          }
        }

        // STUCK deployment (RUNNING > 10 min) → cancel + redeploy
        else if (dep?.status === "RUNNING" && dep.statusUpdatedAt) {
          const stuckMs = now - new Date(dep.statusUpdatedAt).getTime();
          if (stuckMs > STUCK_THRESHOLD_MS) {
            try {
              await railwayGraphQL(
                `mutation($deploymentId: String!) { deploymentCancel(id: $deploymentId) }`,
                { deploymentId: dep.id }
              );
              await railwayGraphQL(
                `mutation($environmentId: String!, $serviceId: String!) {
                  serviceInstanceRedeploy(environmentId: $environmentId, serviceId: $serviceId)
                }`,
                { environmentId, serviceId: service.id }
              );
              await logAction(base44, cycleId, "railway_service", targetId, targetName, "stuck_deployment", "cancel_and_redeploy", "success", "", { stuck_duration_ms: stuckMs });
              actions.push({ target_type: "railway_service", target_id: targetId, targetName, issue: "stuck_deployment", action: "cancel_and_redeploy", result: "success", stuck_ms: stuckMs });
            } catch (e: any) {
              await logAction(base44, cycleId, "railway_service", targetId, targetName, "stuck_deployment", "cancel_and_redeploy", "failed", e.message);
              actions.push({ target_type: "railway_service", target_id: targetId, targetName, issue: "stuck_deployment", action: "cancel_and_redeploy", result: "failed", error: e.message });
            }
          }
        }

        // NOT DEPLOYED → deploy latest
        else if (!instance.deployed && instance.updatable) {
          try {
            await railwayGraphQL(
              `mutation($environmentId: String!, $serviceId: String!) {
                serviceInstanceDeploy(latestCommit: true, environmentId: $environmentId, serviceId: $serviceId)
              }`,
              { environmentId, serviceId: service.id }
            );
            await logAction(base44, cycleId, "railway_service", targetId, targetName, "not_deployed", "deploy_latest", "success");
            actions.push({ target_type: "railway_service", target_id: targetId, targetName, issue: "not_deployed", action: "deploy_latest", result: "success" });
          } catch (e: any) {
            await logAction(base44, cycleId, "railway_service", targetId, targetName, "not_deployed", "deploy_latest", "failed", e.message);
            actions.push({ target_type: "railway_service", target_id: targetId, targetName, issue: "not_deployed", action: "deploy_latest", result: "failed", error: e.message });
          }
        }
      }
    }

    // ═══════════════════════════════════════════
    // 2. ENGINE FAILOVER — PROMOTE BACKUP IF PRIMARY DOWN
    // ═══════════════════════════════════════════
    if (engineKey) {
      const urls = engineUrls;
      if (urls.length > 0) {
        // `probes` was read before the Railway actions above, so this failover decision
        // and the restart gate use one reading of the fleet rather than two.
        const primaryProbe = probes[0];
        const healthyBackups = probes.slice(1).filter((p) => p.ok);
        const defaultUrl = secrets.get("ENGINE_URL")?.replace(/\/$/, "");

        // Only a hard outage moves traffic off the primary. A primary that answers but
        // cannot launch a browser is reported by engineHealth and left where it is,
        // never routed around: sessions are process-local and the primary holds the
        // deployment's volume, so promoting a backup would strand live sessions.
        const primaryOut = primaryProbe && !primaryProbe.ok && primaryProbe.status !== "degraded";

        // Primary down → promote first healthy backup
        if (primaryOut && healthyBackups.length > 0) {
          const backup = healthyBackups[0];
          const newPrimaryUrl = backup.engine_url.replace(/\/$/, "");

          if (!isOnCooldown(primaryProbe.engine_url)) {
            try {
              const existing = await base44.asServiceRole.entities.Setting.filter({ setting_key: "engine.url" });
              if (existing.length > 0) {
                await base44.asServiceRole.entities.Setting.update(existing[0].id, {
                  desired_value: newPrimaryUrl,
                  effective_value: newPrimaryUrl,
                  apply_status: "applied",
                  changed_at: new Date().toISOString(),
                  change_reason: `Auto-heal: primary ${primaryProbe.engine_label} down (${primaryProbe.status}), promoted ${backup.engine_label}`,
                });
              } else {
                await base44.asServiceRole.entities.Setting.create({
                  setting_key: "engine.url",
                  category: "system",
                  scope_type: "platform",
                  desired_value: newPrimaryUrl,
                  effective_value: newPrimaryUrl,
                  apply_status: "applied",
                });
              }
              await logAction(base44, cycleId, "engine", primaryProbe.engine_url, primaryProbe.engine_label,
                primaryProbe.status === "unreachable" ? "engine_down" : "engine_degraded",
                "promote_backup_engine", "success", "",
                { promoted_url: newPrimaryUrl, promoted_label: backup.engine_label, primary_error: primaryProbe.error_message });
              actions.push({
                target_type: "engine", target_id: primaryProbe.engine_url, target_name: primaryProbe.engine_label,
                issue: "engine_down", action: "promote_backup_engine", result: "success",
                promoted_to: backup.engine_label,
              });
            } catch (e: any) {
              await logAction(base44, cycleId, "engine", primaryProbe.engine_url, primaryProbe.engine_label, "engine_down", "promote_backup_engine", "failed", e.message);
              actions.push({ target_type: "engine", target_id: primaryProbe.engine_url, target_name: primaryProbe.engine_label, issue: "engine_down", action: "promote_backup_engine", result: "failed", error: e.message });
            }
          }
        }

        // Primary recovered → revert to default
        if (primaryProbe?.ok && defaultUrl) {
          try {
            const existing = await base44.asServiceRole.entities.Setting.filter({ setting_key: "engine.url" });
            const currentOverride = existing[0]?.effective_value;
            if (currentOverride && currentOverride !== defaultUrl) {
              await base44.asServiceRole.entities.Setting.update(existing[0].id, {
                desired_value: defaultUrl,
                effective_value: defaultUrl,
                apply_status: "applied",
                changed_at: new Date().toISOString(),
                change_reason: "Auto-heal: primary engine recovered, reverting to default",
              });
              await logAction(base44, cycleId, "engine", defaultUrl, "engine-1", "primary_recovered", "revert_to_primary", "success");
              actions.push({ target_type: "engine", target_id: defaultUrl, target_name: "engine-1", issue: "primary_recovered", action: "revert_to_primary", result: "success" });
            }
          } catch (e: any) {
            // Non-critical — don't fail the cycle
          }
        }
      }
    }

    // ═══════════════════════════════════════════
    // SUMMARY
    // ═══════════════════════════════════════════
    const healed = actions.filter((a) => a.result === "success");
    const failed = actions.filter((a) => a.result === "failed");

    return Response.json({
      ok: true,
      enabled: true,
      cycle_id: cycleId,
      checked_at: new Date().toISOString(),
      summary: {
        total_actions: actions.length,
        healed: healed.length,
        failed: failed.length,
      },
      actions,
      skipped,
      __v: DEPLOYMENT_VERSION,
    }, { status: 200 });
  } catch (error) {
    return Response.json({
      ok: false,
      error: error.message,
      cycle_id: cycleId,
      actions,
      __v: DEPLOYMENT_VERSION,
    }, { status: 500 });
  }
}