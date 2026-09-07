import { createClientFromRequest } from "npm:@base44/sdk@0.8.46";
import { secrets } from "base44:runtime";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";

/**
 * agentBrainChat — Bidirectional Communication Channel between the Autonomous Agent and Vision Cortex Brain (V-1)
 *
 * Enables the autonomous agent to:
 * 1. Send messages/reports/state to the Vision Cortex Brain via /functions/syncFromEyes
 * 2. Check for pending Brain commands as the response channel
 * 3. Use InvokeLLM as a local intelligence layer to synthesize a strategic response
 * 4. Log all communications to BrainSyncLog for auditability
 *
 * The Brain (V-1) is itself a Base44 app — it receives intelligence at /functions/syncFromEyes
 * and issues commands back via /functions/receiveBrainCommand on the Eyes (V-2) side.
 */

const PUSH_TIMEOUT_MS = 15000;

export default async function (req) {
  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { message, message_type, context, conversation_id } = body;

    if (!message) return Response.json({ error: "message is required" }, { status: 400 });

    const brainUrl = secrets.get("VISION_CORTEX_BRAIN_URL");
    const eyesApiKey = secrets.get("VISION_CORTEX_EYES_API_KEY");

    if (!brainUrl || !eyesApiKey) {
      return Response.json({
        error: "Brain connection not configured — VISION_CORTEX_BRAIN_URL and VISION_CORTEX_EYES_API_KEY secrets required",
      }, { status: 503 });
    }

    const endpoint = `${brainUrl.replace(/\/$/, "")}/functions/syncFromEyes`;
    const now = new Date().toISOString();

    // 1. SEND: Push agent message to the Brain as an agent_message intelligence item
    const payload = {
      source: "cloud-browser-v2-eyes",
      batch: [{
        source_type: "AgentMessage",
        source_id: conversation_id || `agent-${Date.now()}`,
        data: {
          message_type: message_type || "agent_update",
          message,
          context: context || {},
          conversation_id: conversation_id || null,
          agent_user_id: user.id,
          timestamp: now,
        },
      }],
    };

    let brainResponse = null;
    let httpStatus = 0;
    let brainError = null;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PUSH_TIMEOUT_MS);
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-eyes-api-key": eyesApiKey,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        httpStatus = response.status;
        const text = await response.text();
        brainResponse = text.slice(0, 1000);
        if (!response.ok) {
          brainError = `Brain returned ${response.status}: ${text.slice(0, 300)}`;
        }
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      brainError = err.name === "AbortError" ? `Timeout after ${PUSH_TIMEOUT_MS}ms` : err.message;
    }

    // 2. LOG: Record the communication in BrainSyncLog
    const syncLog = await base44.entities.BrainSyncLog.create({
      direction: "eyes_to_brain",
      source_type: "agent_message",
      source_id: conversation_id || `agent-${Date.now()}`,
      payload_summary: `[${message_type || "agent_update"}] ${message.substring(0, 200)}`,
      status: brainError ? "failed" : "success",
      http_status: httpStatus,
      brain_response: brainResponse,
      error_message: brainError,
      synced_at: now,
    }).catch(() => null);

    // 3. RECEIVE: Check for pending Brain commands as the response channel
    const pendingCommands = await base44.entities.BrainCommand.filter(
      { status: "pending" }, "priority", 5
    ).catch(() => []);

    let commandsCreated = 0;
    const brainCommands = (pendingCommands || []).map((cmd) => ({
      command_type: cmd.command_type,
      payload: cmd.payload,
      priority: cmd.priority,
      brain_agent: cmd.brain_agent,
      command_id: cmd.id,
    }));

    // 4. SYNTHESIZE: Use InvokeLLM to generate a strategic response based on the message + system state
    // This gives the agent an immediate intelligent response while the Brain processes asynchronously
    let llmResponse = null;
    try {
      const llmResult = await base44.integrations.Core.InvokeLLM({
        prompt: `You are the Vision Cortex Brain (V-1), the strategic intelligence center for the Cloud Browser platform (V-2 Eyes).\n\nThe autonomous agent (V-2 Eyes) has sent you the following message:\n\nMessage Type: ${message_type || "agent_update"}\nMessage: ${message}\n\nContext: ${JSON.stringify(context || {})}\n\n${pendingCommands?.length ? `There are ${pendingCommands.length} pending Brain commands queued. The Brain is actively directing operations.` : "No pending Brain commands."}\n\nAs the Brain, provide a concise strategic response. Include:\n1. Acknowledgment of the message\n2. Strategic guidance or next steps\n3. Any priorities or directives for the agent\n\nKeep it actionable and concise (3-5 sentences).`,
        response_json_schema: {
          type: "object",
          properties: {
            acknowledgment: { type: "string" },
            strategic_guidance: { type: "string" },
            priorities: { type: "array", items: { type: "string" } },
            next_action: { type: "string" },
          },
        },
      });
      llmResponse = llmResult;
    } catch (e) {
      llmResponse = { error: e.message };
    }

    // 5. RESPOND: Return the combined response to the agent
    return Response.json({
      ok: true,
      brain_delivered: !brainError,
      brain_http_status: httpStatus,
      brain_error: brainError,
      brain_commands_pending: brainCommands.length,
      brain_commands: brainCommands,
      llm_response: llmResponse,
      sync_log_id: syncLog?.id || null,
      __v: DEPLOYMENT_VERSION,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}