import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { enginePost, engineDelete, isEngineConfigured, setEngineClient } from "../../shared/engineClient.ts";
import { encrypt } from "../../shared/crypto.ts";
import { requiredCapability } from "../../shared/gatewayCore.ts";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";

async function hashKey(key) {
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

class McpToolError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "McpToolError";
    this.status = status;
  }
}

function errorResponse(status, error, requestId) {
  return Response.json({ error, request_id: requestId, __v: DEPLOYMENT_VERSION }, { status });
}

function requireScope(keyRecord, scope, label) {
  if (scope && !(keyRecord.scopes || []).includes(scope)) {
    throw new McpToolError(403, `Insufficient scope for ${label}. Required: ${scope}`);
  }
}

export default async function (req) {
  const base44 = createClientFromRequest(req);
  setEngineClient(base44);
  const requestId = req.headers.get("x-request-id") || `mcp_${crypto.randomUUID()}`;

  try {
    const body = await req.json();
    const { tool, params = {}, api_key } = body;

    const apiKey = api_key || (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!apiKey) return errorResponse(401, "API key required", requestId);

    const keyHash = await hashKey(apiKey);
    const keys = await base44.asServiceRole.entities.ApiKey.filter({ key_hash: keyHash, active: true });
    if (!keys.length) return errorResponse(401, "Invalid API key", requestId);
    const keyRecord = keys[0];

    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) return errorResponse(401, "API key expired", requestId);
    if (!keyRecord.project_id) return errorResponse(403, "Project-scoped API key required", requestId);

    base44.asServiceRole.entities.ApiKey.update(keyRecord.id, { last_used: new Date().toISOString() }).catch(() => {});

    const TOOL_SCOPES = {
      browser_start: "sessions:write",
      browser_end: "sessions:write",
      browser_navigate: "sessions:write",
      browser_act: "sessions:write",
      browser_observe: "sessions:evaluate",
      browser_extract: "sessions:write",
      browser_screenshot: "sessions:write",
      browser_list_tabs: "sessions:read",
      browser_switch_tab: "sessions:write",
      context_create: "contexts:write",
      context_use: "contexts:write",
      context_delete: "contexts:write",
      artifact_get: "artifacts:read",
    };
    requireScope(keyRecord, TOOL_SCOPES[tool], `tool ${tool}`);

    const result = await handleTool(base44, tool, params, keyRecord);

    await base44.asServiceRole.entities.AuditLog.create({
      action: "run",
      entity_type: "mcp_tool",
      entity_id: tool,
      description: `MCP tool: ${tool}`,
      metadata: { request_id: requestId, project_id: keyRecord.project_id },
      timestamp: new Date().toISOString(),
    }).catch(() => {});

    return Response.json({ ...result, request_id: requestId, __v: DEPLOYMENT_VERSION });
  } catch (error) {
    return errorResponse(error instanceof McpToolError ? error.status : 500, error.message, requestId);
  }
}

async function scopedSession(base44, sessionId, keyRecord) {
  const session = await base44.asServiceRole.entities.Session.get(sessionId);
  if (!session || session.project_id !== keyRecord.project_id) throw new McpToolError(404, "Session not found");
  return session;
}

async function handleTool(base44, tool, params, keyRecord) {
  switch (tool) {
    case "browser_start": {
      if (!await isEngineConfigured()) throw new McpToolError(503, "Browser engine not configured");
      const engineRes = await enginePost("/sessions", {
        viewport: params.viewport,
        userAgent: params.user_agent,
        usePool: params.use_pool !== false,
      });
      const session = await base44.asServiceRole.entities.Session.create({
        session_id: engineRes.sessionId,
        status: "idle",
        project_id: keyRecord.project_id,
        started_at: new Date().toISOString(),
        metadata: { worker_id: engineRes.workerId, region: engineRes.region, project_id: keyRecord.project_id },
      });
      return { session_id: session.id, runtime_session_id: engineRes.sessionId, status: "idle" };
    }

    case "browser_end": {
      const session = await scopedSession(base44, params.session_id, keyRecord);
      if (session.session_id && await isEngineConfigured()) {
        try { await engineDelete(`/sessions/${session.session_id}`); } catch (e) {}
      }
      await base44.asServiceRole.entities.Session.update(params.session_id, { status: "ended", ended_at: new Date().toISOString() });
      return { success: true, session_id: params.session_id };
    }

    case "browser_navigate": {
      const session = await scopedSession(base44, params.session_id, keyRecord);
      if (!await isEngineConfigured()) throw new McpToolError(503, "Engine not configured");
      const res = await enginePost(`/sessions/${session.session_id}/execute`, { action_type: "goto", value: params.url });
      await base44.asServiceRole.entities.Session.update(params.session_id, { current_url: res.url, current_title: res.title });
      return { url: res.url, title: res.title };
    }

    case "browser_act": {
      const session = await scopedSession(base44, params.session_id, keyRecord);
      if (!await isEngineConfigured()) throw new McpToolError(503, "Engine not configured");
      const capability = requiredCapability(params.action_type);
      requireScope(keyRecord, capability, `action ${params.action_type}`);
      const res = await enginePost(`/sessions/${session.session_id}/execute`, {
        action_type: params.action_type,
        selector: params.selector,
        value: params.value,
        options: params.options || {},
      });
      return { result: res };
    }

    case "browser_observe": {
      const session = await scopedSession(base44, params.session_id, keyRecord);
      if (!await isEngineConfigured()) throw new McpToolError(503, "Engine not configured");
      requireScope(keyRecord, requiredCapability("evaluate"), "browser_observe evaluate");
      const res = await enginePost(`/sessions/${session.session_id}/execute`, {
        action_type: "evaluate",
        options: { fn: params.fn || "() => ({ url: location.href, title: document.title })" },
      });
      return { observation: res.data };
    }

    case "browser_extract": {
      const session = await scopedSession(base44, params.session_id, keyRecord);
      if (!await isEngineConfigured()) throw new McpToolError(503, "Engine not configured");
      const extractType = params.extract_type || "extract_text";
      requireScope(keyRecord, requiredCapability(extractType), `extract ${extractType}`);
      const res = await enginePost(`/sessions/${session.session_id}/execute`, { action_type: extractType, selector: params.selector });
      return { data: res.data };
    }

    case "browser_screenshot": {
      const session = await scopedSession(base44, params.session_id, keyRecord);
      if (!await isEngineConfigured()) throw new McpToolError(503, "Engine not configured");
      const res = await enginePost(`/sessions/${session.session_id}/execute`, {
        action_type: "screenshot", options: { fullPage: params.full_page || false },
      });
      if (res.base64) {
        const file = new File([Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0))], "mcp_screenshot.png", { type: "image/png" });
        const uploadRes = await base44.integrations.Core.UploadFile({ file });
        return { screenshot_url: uploadRes.file_url, size: res.size };
      }
      throw new McpToolError(502, "No screenshot captured");
    }

    case "browser_list_tabs": {
      const session = await scopedSession(base44, params.session_id, keyRecord);
      return { tabs: session.tabs || [], current_url: session.current_url };
    }

    case "browser_switch_tab": {
      const session = await scopedSession(base44, params.session_id, keyRecord);
      if (!await isEngineConfigured()) throw new McpToolError(503, "Engine not configured");
      const res = await enginePost(`/sessions/${session.session_id}/execute`, { action_type: "switch_tab", value: String(params.tab_index) });
      return { url: res.url };
    }

    case "context_create": {
      const contextId = `ctx_${crypto.randomUUID()}`;
      const cookiesEncrypted = params.cookies ? await encrypt(JSON.stringify(params.cookies)) : null;
      const storageEncrypted = params.storage_state ? await encrypt(JSON.stringify(params.storage_state)) : null;
      const ctx = await base44.asServiceRole.entities.BrowserContext.create({
        context_id: contextId,
        name: params.name || contextId,
        project_id: keyRecord.project_id,
        cookies_encrypted: cookiesEncrypted,
        storage_state_encrypted: storageEncrypted,
        auth_state: params.cookies ? "authenticated" : "anonymous",
        last_used: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
      return { context_id: contextId, entity_id: ctx.id };
    }

    case "context_use": {
      const contexts = await base44.asServiceRole.entities.BrowserContext.filter({ context_id: params.context_id });
      if (!contexts.length || contexts[0].project_id !== keyRecord.project_id) throw new McpToolError(404, "Context not found");
      const ctx = contexts[0];
      if (ctx.revoked) throw new McpToolError(403, "Context has been revoked — access denied");
      const leaseExpiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      await base44.asServiceRole.entities.BrowserContext.update(ctx.id, {
        is_locked: true,
        lease_owner: params.session_id || "mcp",
        lease_expires_at: leaseExpiresAt,
        last_used: new Date().toISOString(),
      });
      return { auth_state: ctx.auth_state, lease_owner: params.session_id || "mcp", lease_expires_at: leaseExpiresAt };
    }

    case "context_delete": {
      const contexts = await base44.asServiceRole.entities.BrowserContext.filter({ context_id: params.context_id });
      if (!contexts.length || contexts[0].project_id !== keyRecord.project_id) throw new McpToolError(404, "Context not found");
      await base44.asServiceRole.entities.BrowserContext.delete(contexts[0].id);
      return { success: true };
    }

    case "artifact_get": {
      const artifacts = await base44.asServiceRole.entities.Artifact.filter({ artifact_id: params.artifact_id });
      if (!artifacts.length) throw new McpToolError(404, "Artifact not found");
      const artifact = artifacts[0];
      if (artifact.access_policy !== "public" && artifact.project_id !== keyRecord.project_id) throw new McpToolError(404, "Artifact not found");
      return {
        artifact_id: artifact.artifact_id,
        type: artifact.type,
        storage_key: artifact.storage_key,
        content_hash: artifact.content_hash,
        size_bytes: artifact.size_bytes,
        mime_type: artifact.mime_type,
        access_policy: artifact.access_policy,
      };
    }

    default:
      throw new McpToolError(400, `Unknown MCP tool: ${tool}`);
  }
}
