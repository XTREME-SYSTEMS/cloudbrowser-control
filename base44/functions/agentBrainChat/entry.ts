import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";

/**
 * agentBrainChat — Bidirectional Communication Channel between the Autonomous Agent and Vision Cortex Brain (V-1)
 *
 * Enables the autonomous agent to:
 * 1. Send messages/reports/state to the Vision Cortex Brain
 * 2. Receive commands, strategies, and guidance from the Brain
 * 3. Log all communications to BrainSyncLog for auditability
 */

export default async function (req) {
  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { message, message_type, context, conversation_id } = body;

    if (!message) return Response.json({ error: "message is required" }, { status: 400 });

    const brainUrl = process.env.VISION_CORTEX_BRAIN_URL;
    const brainApiKey = process.env.VISION_CORTEX_BRAIN_API_KEY;

    if (!brainUrl || !brainApiKey) {
      return Response.json({
        error: "Brain connection not configured — VISION_CORTEX_BRAIN_URL and VISION_CORTEX_BRAIN_API_KEY secrets required",
      }, { status: 503 });
    }

    // 1. SEND: Forward agent message to the Brain
    const payload = {
      source: "autonomous_agent_v2",
      message_type: message_type || "agent_update",
      message,
      context: context || {},
      conversation_id: conversation_id || null,
      agent_user_id: user.id,
      timestamp: new Date().toISOString(),
    };

    let brainResponse = null;
    let httpStatus = 0;
    let brainError = null;

    try {
      const response = await fetch(`${brainUrl}/api/agent-message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${brainApiKey}`,
          "X-Source": "cloud-browser-v2",
        },
        body: JSON.stringify(payload),
      });

      httpStatus = response.status;

      if (response.ok) {
        brainResponse = await response.json();
      } else {
        brainError = `Brain returned ${response.status}`;
        try {
          const errBody = await response.text();
          brainError += `: ${errBody.substring(0, 500)}`;
        } catch {}
      }
    } catch (err) {
      brainError = `Network error: ${err.message}`;
    }

    // 2. LOG: Record the communication in BrainSyncLog
    const syncLog = await base44.entities.BrainSyncLog.create({
      direction: "eyes_to_brain",
      source_type: "agent_message",
      payload_summary: `[${message_type || "agent_update"}] ${message.substring(0, 200)}`,
      status: brainResponse ? "success" : "failed",
      http_status: httpStatus,
      brain_response: brainResponse ? JSON.stringify(brainResponse).substring(0, 2000) : null,
      error_message: brainError,
      synced_at: new Date().toISOString(),
    });

    // 3. PROCESS: If the Brain issued commands, create BrainCommand records
    let commandsCreated = 0;
    if (brainResponse?.commands && Array.isArray(brainResponse.commands)) {
      for (const cmd of brainResponse.commands) {
        await base44.entities.BrainCommand.create({
          command_type: cmd.command_type || "custom",
          payload: cmd.payload || {},
          brain_command_id: cmd.brain_command_id || null,
          priority: cmd.priority || 5,
          status: "pending",
          brain_agent: cmd.brain_agent || "Primus",
          received_at: new Date().toISOString(),
        });
        commandsCreated++;
      }
    }

    // 4. RESPOND: Return the Brain's reply to the agent
    return Response.json({
      ok: brainResponse ? true : false,
      brain_response: brainResponse?.response || null,
      brain_guidance: brainResponse?.guidance || null,
      brain_strategy: brainResponse?.strategy || null,
      commands_issued: commandsCreated,
      sync_log_id: syncLog.id,
      error: brainError,
      __v: DEPLOYMENT_VERSION,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}