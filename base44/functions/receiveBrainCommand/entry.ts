import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { secrets } from "base44:runtime";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";

// Brain → Eyes webhook receiver
// The Vision Cortex Brain (V-1) calls this endpoint to push commands to the Eyes (V-2).
// Commands are queued as BrainCommand records for processing by processBrainCommands.
//
// The Brain calls: POST https://cloud-browser.base44.app/functions/receiveBrainCommand
// Headers: x-brain-api-key: <VISION_CORTEX_INBOUND_API_KEY>
// Body: { command_type, payload, brain_command_id, priority, brain_agent }

export default async function (req) {
  const base44 = createClientFromRequest(req);
  const inboundKey = secrets.get("VISION_CORTEX_INBOUND_API_KEY");

  if (!inboundKey) {
    return Response.json({ ok: false, error: "Inbound Brain key not configured", __v: DEPLOYMENT_VERSION }, { status: 200 });
  }

  // Authenticate
  const providedKey = req.headers.get("x-brain-api-key") || req.headers.get("X-Brain-Api-Key");
  if (providedKey !== inboundKey) {
    return Response.json({ ok: false, error: "Unauthorized — invalid Brain API key", __v: DEPLOYMENT_VERSION }, { status: 401 });
  }

  // Parse body
  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    if (!body || typeof body !== "object") throw new Error("invalid body");
  } catch (e) {
    return Response.json({ ok: false, error: `Invalid JSON body: ${e.message}`, __v: DEPLOYMENT_VERSION }, { status: 400 });
  }

  const { command_type, payload, brain_command_id, priority, brain_agent } = body;
  if (!command_type) {
    return Response.json({ ok: false, error: "command_type is required", __v: DEPLOYMENT_VERSION }, { status: 400 });
  }

  // Queue the command
  const cmd = await base44.asServiceRole.entities.BrainCommand.create({
    command_type,
    payload: payload || {},
    brain_command_id: brain_command_id || null,
    priority: priority || 5,
    status: "pending",
    brain_agent: brain_agent || "unknown",
    received_at: new Date().toISOString(),
  }).catch((e) => {
    return Response.json({ ok: false, error: `Failed to queue command: ${e.message}`, __v: DEPLOYMENT_VERSION }, { status: 500 });
  });

  if (cmd.error) return cmd;

  // Log the inbound sync
  await base44.asServiceRole.entities.BrainSyncLog.create({
    direction: "brain_to_eyes",
    source_type: "command",
    source_id: cmd.id,
    payload_summary: `${command_type} from ${brain_agent || "brain"}`,
    status: "success",
    brain_response: `Queued as ${cmd.id}`,
    synced_at: new Date().toISOString(),
  }).catch(() => {});

  return Response.json({
    ok: true,
    message: "Command queued",
    command_id: cmd.id,
    command_type,
    status: "pending",
    process_endpoint: "processBrainCommands",
    __v: DEPLOYMENT_VERSION,
  }, { status: 200 });
}