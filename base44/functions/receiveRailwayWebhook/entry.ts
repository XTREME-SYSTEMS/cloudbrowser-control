import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { logAudit } from "../../shared/auditLogger.ts";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";
// Railway deployment webhook handler
// Register in Railway: POST https://cloud-browser.base44.app/functions/receiveRailwayWebhook

export default async function(req) {
  // Return 200 immediately — Railway needs fast ack
  const ackResponse = Response.json({ ok: true, received: true, __v: DEPLOYMENT_VERSION });

  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const { event, deploymentId, status, commitHash, service } = body;

    // Determine event type — Railway sends different payload shapes
    const eventType = event || body.type || body.evt;
    const deploymentStatus = status || body.status || body.deploymentStatus;
    const commit = commitHash || body.commitHash || body.commit?.hash || body.meta?.commitHash;
    const deployId = deploymentId || body.deploymentId || body.id;
    const serviceName = service || body.service || body.meta?.serviceName || "cloudbrowser-control";

    // Map Railway events to engine status
    let engineStatus = "unknown";
    let notificationType = "info";
    let notificationTitle = "Railway Deployment";

    if (eventType?.includes("deployed") || deploymentStatus === "deployed" || deploymentStatus === "success") {
      engineStatus = "online";
      notificationTitle = "Engine Back Online";
    } else if (eventType?.includes("failed") || deploymentStatus === "failed") {
      engineStatus = "degraded";
      notificationType = "warning";
      notificationTitle = "Engine Deployment Failed";
    } else if (eventType?.includes("crashed") || deploymentStatus === "crashed") {
      engineStatus = "offline";
      notificationType = "error";
      notificationTitle = "Engine Crashed";
    } else {
      // Unknown event — log but don't alert
      return ackResponse;
    }

    // Update engine.status Setting using the live Setting schema.
    try {
      const now = new Date().toISOString();
      const existing = await base44.asServiceRole.entities.Setting.filter({ setting_key: "engine.status" });
      const runtimeState = {
        effective_value: engineStatus,
        actual_runtime_value: engineStatus,
        runtime_target: "engine",
        apply_status: "verified",
        drift_status: "none",
        changed_by: "railway",
        changed_at: now,
        last_verified_at: now,
      };

      if (existing.length > 0) {
        await base44.asServiceRole.entities.Setting.update(existing[0].id, runtimeState);
      } else {
        await base44.asServiceRole.entities.Setting.create({
          setting_key: "engine.status",
          category: "deployment",
          scope_type: "platform",
          ...runtimeState,
        });
      }
    } catch (e) {
      console.error("Failed to update engine.status setting:", e.message);
    }

    // Create audit log entry with deployment history
    try {
      await logAudit(base44, { id: "railway", full_name: "Railway Webhook" }, "deploy", "engine", null,
        `Railway ${eventType || deploymentStatus}: ${serviceName} — status=${engineStatus}, commit=${commit || "unknown"}`);
    } catch (e) {
      console.error("Audit log failed:", e.message);
    }

    // Store deployment history using the live AuditLog schema.
    try {
      const now = new Date().toISOString();
      await base44.asServiceRole.entities.AuditLog.create({
        action: "run",
        entity_type: "engine",
        entity_id: deployId || "unknown",
        description: `Railway ${eventType || deploymentStatus}: ${serviceName} — status=${engineStatus}, commit=${commit || "unknown"}`,
        metadata: {
          source: "railway",
          event: eventType || deploymentStatus,
          deploymentId: deployId,
          status: engineStatus,
          commitHash: commit,
          serviceName,
        },
        timestamp: now,
      });
    } catch (e) {
      console.error("Deployment history log failed:", e.message);
    }

    // Create notification for admins on degraded/offline
    if (engineStatus !== "online") {
      try {
        await base44.asServiceRole.entities.Notification.create({
          type: notificationType,
          category: "deployment",
          title: notificationTitle,
          message: `Railway deployment ${deployId || "unknown"} ${deploymentStatus || eventType}. Engine status: ${engineStatus}. Commit: ${commit || "unknown"}`,
          read: false,
          created_at: new Date().toISOString(),
        });
      } catch (e) {
        console.error("Notification creation failed:", e.message);
      }
    } else {
      // Clear any offline alerts when engine comes back online
      try {
        const offlineAlerts = await base44.asServiceRole.entities.Notification.filter({
          category: "deployment",
          read: false,
        });
        for (const alert of offlineAlerts) {
          await base44.asServiceRole.entities.Notification.update(alert.id, {
            read: true,
            read_at: new Date().toISOString(),
          });
        }
      } catch (e) {
        console.error("Alert cleanup failed:", e.message);
      }
    }
  } catch (error) {
    console.error("Railway webhook error:", error.message);
  }

  // Always return 200 — Railway needs fast ack regardless of processing
  return ackResponse;
}
