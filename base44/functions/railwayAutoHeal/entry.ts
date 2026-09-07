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

    // Load recent heal logs for cooldown checking
    const recentLogs = await base44.asServiceRole.entities.AutoHealLog.list("-healed_at", 100);
    const now = Date.now();
    const isOnCooldown = (targetId: string) =>
      recentLogs.some(
        (l: any) =>
          l.target_id === targetId &&
          l.action_result === "success" &&
          l.healed_at &&
          now - new Date(l.healed_at).getTime() < COOLDOWN_MS
      );

    // ═══════════════════════════════════════════
    // 1. RAILWAY SERVICE HEALING
    // ═══════════════════════════════════════════
    const status = await getProjectStatus();
    const { environmentId } = await getProjectMeta();

    for (const service of status.services) {
      for (const instance of service.instances) {
        const dep = instance.latestDeployment;
        const targetId = service.id;
        const targetName = service.name;

        if (isOnCooldown(targetId)) continue;

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
    const engineKey = secrets.get("ENGINE_API_KEY");
    if (engineKey) {
      const urls = await getEngineUrls();
      if (urls.length > 0) {
        const probes = await Promise.all(urls.map((url, i) => probeEngine(url, engineKey)));
        probes.forEach((p, i) => { p.engine_label = deriveLabel(p.engine_url, i); });

        const primaryProbe = probes[0];
        const healthyBackups = probes.slice(1).filter((p) => p.ok);
        const defaultUrl = secrets.get("ENGINE_URL")?.replace(/\/$/, "");

        // Primary down → promote first healthy backup
        if (primaryProbe && !primaryProbe.ok && healthyBackups.length > 0) {
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