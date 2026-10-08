import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { runGatewayAgent } from "../../shared/gatewayAgent.ts";
import { GATEWAY_AGENTS } from "../../shared/gatewayAgents.ts";
import {
  APEX_CONNECTOR_VERSION,
  APEX_AGENT_ALLOWLIST,
  createRequestId,
  isApexOperation,
  normalizeMessages,
} from "../../shared/apexConnectorContract.ts";

function json(status: number, body: Record<string, unknown>) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-apex-connector-version": APEX_CONNECTOR_VERSION,
    },
  });
}

export default async function(req: Request) {
  const requestId = req.headers.get("x-request-id") || createRequestId();
  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me();
    if (!user) {
      return json(401, {
        ok: false,
        error: "Authentication required.",
        request_id: requestId,
      });
    }

    const body = await req.json().catch(() => ({}));
    const operation = body.operation;

    if (!isApexOperation(operation)) {
      return json(400, {
        ok: false,
        error: "Unknown or missing operation.",
        supported_operations: [
          "health",
          "discover_capabilities",
          "list_agents",
          "agent_task",
          "browser_task",
          "get_job",
          "get_receipt",
        ],
        request_id: requestId,
      });
    }

    if (operation === "health") {
      return json(200, {
        ok: true,
        connector: "apex-cloudbrowser",
        version: APEX_CONNECTOR_VERSION,
        runtime: "xtreme-cloud-browser",
        builder_dependency: false,
        request_id: requestId,
      });
    }

    if (operation === "discover_capabilities") {
      const records = await base44.entities.CapabilityRegistry.filter({}, { sort: "capability_id", limit: 500 });
      return json(200, {
        ok: true,
        capabilities: records.items || records,
        request_id: requestId,
      });
    }

    if (operation === "list_agents") {
      return json(200, {
        ok: true,
        agents: APEX_AGENT_ALLOWLIST.map((name) => ({
          name,
          enabled: Object.hasOwn(GATEWAY_AGENTS, name),
          task_type: GATEWAY_AGENTS[name]?.taskType || null,
        })),
        request_id: requestId,
      });
    }

    if (operation === "agent_task") {
      const agentName = String(body.agent_name || "");
      if (!(APEX_AGENT_ALLOWLIST as readonly string[]).includes(agentName)) {
        return json(400, { ok: false, error: "Agent is not allowed.", request_id: requestId });
      }

      const messages = normalizeMessages(body.messages ?? body.prompt);
      if (!messages.length) {
        return json(400, { ok: false, error: "A prompt or messages array is required.", request_id: requestId });
      }

      const result = await runGatewayAgent(base44, { agentName, messages });

      await base44.entities.AuditLog.create({
        action: "run",
        entity_type: "apex_connector",
        entity_id: agentName,
        description: `Apex connector dispatched ${agentName}`,
        metadata: {
          request_id: requestId,
          connector_version: APEX_CONNECTOR_VERSION,
          builder_dependency: false,
          tool_receipt_count: result.tool_calls?.length || 0,
        },
        timestamp: new Date().toISOString(),
      }).catch(() => {});

      return json(200, {
        ok: true,
        request_id: requestId,
        agent: agentName,
        result,
      });
    }

    if (operation === "browser_task") {
      const task = body.task;
      if (!task || typeof task !== "object") {
        return json(400, { ok: false, error: "task object is required.", request_id: requestId });
      }

      const response = await base44.functions.invoke("runAutonomousBrowserTask", task);
      return json(200, {
        ok: true,
        request_id: requestId,
        result: response?.data ?? response,
      });
    }

    if (operation === "get_job") {
      const jobId = String(body.job_id || "");
      if (!jobId) return json(400, { ok: false, error: "job_id is required.", request_id: requestId });
      const job = await base44.entities.Job.get(jobId);
      if (!job) return json(404, { ok: false, error: "Job not found.", request_id: requestId });
      return json(200, { ok: true, job, request_id: requestId });
    }

    if (operation === "get_receipt") {
      const receiptId = String(body.receipt_id || "");
      if (!receiptId) return json(400, { ok: false, error: "receipt_id is required.", request_id: requestId });
      const matches = await base44.entities.EvidenceReceipt.filter({ receipt_id: receiptId }, { limit: 1 });
      const receipt = matches.items?.[0] || matches[0];
      if (!receipt) return json(404, { ok: false, error: "Receipt not found.", request_id: requestId });
      return json(200, { ok: true, receipt, request_id: requestId });
    }

    return json(501, { ok: false, error: "Operation not implemented.", request_id: requestId });
  } catch (error: any) {
    return json(500, {
      ok: false,
      error: error?.message || "Connector execution failed.",
      request_id: requestId,
    });
  }
}
