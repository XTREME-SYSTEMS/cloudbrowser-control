import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { enginePost, engineDelete, engineGet, isEngineConfigured, setEngineClient } from "../../shared/engineClient.ts";
import { encrypt, decrypt, hashKey } from "../../shared/crypto.ts";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";

// ═══════════════════════════════════════════════
// MCP Tools — Governed MCP tool surface for browser automation
// Phase 14: MCP
// All tools use the SAME authorization, tenancy, runtime, telemetry,
// artifact architecture, and receipts as the rest of the platform.
// ═══════════════════════════════════════════════

// MCP tool → required API key scope mapping (C3 fix — scope enforcement)
const TOOL_SCOPES = {
  browser_start: "sessions:write",
  browser_end: "sessions:write",
  browser_navigate: "sessions:write",
  browser_act: "sessions:write",
  browser_observe: "sessions:read",
  browser_extract: "sessions:read",
  browser_screenshot: "sessions:read",
  browser_list_tabs: "sessions:read",
  browser_switch_tab: "sessions:write",
  context_create: "sessions:write",
  context_use: "sessions:read",
  context_delete: "sessions:write",
  artifact_get: "sessions:read",
};

function errorResponse(status, error, requestId) {
  return Response.json({ error, request_id: requestId, __v: DEPLOYMENT_VERSION }, { status });
}

export default async function (req) {
  const base44 = createClientFromRequest(req);
  setEngineClient(base44);
  const requestId = req.headers.get("x-request-id") || "mcp_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);

  try {
    const body = await req.json();
    const { tool, params = {}, api_key } = body;

    // ── Authenticate ──
    const apiKey = api_key || (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!apiKey) return errorResponse(401, "API key required", requestId);

    const keyHash = await hashKey(apiKey);
    const keys = await base44.asServiceRole.entities.ApiKey.filter({ key_hash: keyHash, active: true });
    if (!keys.length) return errorResponse(401, "Invalid API key", requestId);
    const keyRecord = keys[0];

    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
      return errorResponse(401, "API key expired", requestId);
    }

    // Update last_used
    base44.asServiceRole.entities.ApiKey.update(keyRecord.id, { last_used: new Date().toISOString() }).catch(() => {});

    // ── Scope enforcement (C3 fix) ──
    const requiredScope = TOOL_SCOPES[tool];
    if (requiredScope && !(keyRecord.scopes || []).includes(requiredScope)) {
      return errorResponse(403, `Insufficient scope for tool '${tool}'. Required: ${requiredScope}`, requestId);
    }

    // ── Route to tool handler ──
    const result = await handleTool(base44, tool, params, keyRecord, requestId);

    // ── Audit log ──
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
    return errorResponse(500, error.message, requestId);
  }
}

async function handleTool(base44, tool, params, keyRecord, requestId) {
  switch (tool) {
    // ── Browser lifecycle ──
    case "browser_start": {
      if (!await isEngineConfigured()) throw new Error("Browser engine not configured");
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
        metadata: { worker_id: engineRes.workerId, region: engineRes.region },
      });
      return { session_id: session.id, runtime_session_id: engineRes.sessionId, status: "idle" };
    }

    case "browser_end": {
      const session = await base44.asServiceRole.entities.Session.get(params.session_id);
      if (!session) throw new Error("Session not found");
      if (keyRecord.project_id && session.project_id !== keyRecord.project_id) throw new Error("Session not found");
      if (session.session_id && await isEngineConfigured()) {
        try { await engineDelete(`/sessions/${session.session_id}`); } catch (e) {}
      }
      await base44.asServiceRole.entities.Session.update(params.session_id, {
        status: "ended", ended_at: new Date().toISOString(),
      });
      return { success: true, session_id: params.session_id };
    }

    case "browser_navigate": {
      const session = await base44.asServiceRole.entities.Session.get(params.session_id);
      if (!session) throw new Error("Session not found");
      if (keyRecord.project_id && session.project_id !== keyRecord.project_id) throw new Error("Session not found");
      if (!await isEngineConfigured()) throw new Error("Engine not configured");
      const res = await enginePost(`/sessions/${session.session_id}/execute`, {
        action_type: "goto", value: params.url,
      });
      await base44.asServiceRole.entities.Session.update(params.session_id, {
        current_url: res.url, current_title: res.title,
      });
      return { url: res.url, title: res.title };
    }

    case "browser_act": {
      const session = await base44.asServiceRole.entities.Session.get(params.session_id);
      if (!session) throw new Error("Session not found");
      if (keyRecord.project_id && session.project_id !== keyRecord.project_id) throw new Error("Session not found");
      if (!await isEngineConfigured()) throw new Error("Engine not configured");
      const res = await enginePost(`/sessions/${session.session_id}/execute`, {
        action_type: params.action_type,
        selector: params.selector,
        value: params.value,
        options: params.options || {},
      });
      return { result: res };
    }

    case "browser_observe": {
      const session = await base44.asServiceRole.entities.Session.get(params.session_id);
      if (!session) throw new Error("Session not found");
      if (keyRecord.project_id && session.project_id !== keyRecord.project_id) throw new Error("Session not found");
      if (!await isEngineConfigured()) throw new Error("Engine not configured");
      const res = await enginePost(`/sessions/${session.session_id}/execute`, {
        action_type: "evaluate",
        options: { fn: params.fn || "() => ({ url: location.href, title: document.title })" },
      });
      return { observation: res.data };
    }

    case "browser_extract": {
      const session = await base44.asServiceRole.entities.Session.get(params.session_id);
      if (!session) throw new Error("Session not found");
      if (keyRecord.project_id && session.project_id !== keyRecord.project_id) throw new Error("Session not found");
      if (!await isEngineConfigured()) throw new Error("Engine not configured");
      const extractType = params.extract_type || "extract_text";
      const res = await enginePost(`/sessions/${session.session_id}/execute`, {
        action_type: extractType, selector: params.selector,
      });
      return { data: res.data };
    }

    case "browser_screenshot": {
      const session = await base44.asServiceRole.entities.Session.get(params.session_id);
      if (!session) throw new Error("Session not found");
      if (keyRecord.project_id && session.project_id !== keyRecord.project_id) throw new Error("Session not found");
      if (!await isEngineConfigured()) throw new Error("Engine not configured");
      const res = await enginePost(`/sessions/${session.session_id}/execute`, {
        action_type: "screenshot", options: { fullPage: params.full_page || false },
      });
      // Upload and create artifact
      if (res.base64) {
        const file = new File([Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0))], `mcp_screenshot.png`, { type: "image/png" });
        const uploadRes = await base44.integrations.Core.UploadFile({ file });
        return { screenshot_url: uploadRes.file_url, size: res.size };
      }
      return { error: "No screenshot captured" };
    }

    case "browser_list_tabs": {
      const session = await base44.asServiceRole.entities.Session.get(params.session_id);
      if (!session) throw new Error("Session not found");
      if (keyRecord.project_id && session.project_id !== keyRecord.project_id) throw new Error("Session not found");
      return { tabs: session.tabs || [], current_url: session.current_url };
    }

    case "browser_switch_tab": {
      const session = await base44.asServiceRole.entities.Session.get(params.session_id);
      if (!session) throw new Error("Session not found");
      if (keyRecord.project_id && session.project_id !== keyRecord.project_id) throw new Error("Session not found");
      if (!await isEngineConfigured()) throw new Error("Engine not configured");
      const res = await enginePost(`/sessions/${session.session_id}/execute`, {
        action_type: "switch_tab", value: String(params.tab_index),
      });
      return { url: res.url };
    }

    // ── Context management ──
    case "context_create": {
      const contextId = "ctx_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
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
      if (!contexts.length) throw new Error("Context not found");
      const ctx = contexts[0];
      if (keyRecord.project_id && ctx.project_id !== keyRecord.project_id) throw new Error("Context not found");
      if (ctx.revoked) throw new Error("Context has been revoked — access denied");
      // Lease the context
      await base44.asServiceRole.entities.BrowserContext.update(ctx.id, {
        is_locked: true,
        lease_owner: params.session_id || "mcp",
        lease_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        last_used: new Date().toISOString(),
      });
      // Decrypt state for engine use
      let cookies = null, storageState = null;
      if (ctx.cookies_encrypted) {
        const dec = await decrypt(ctx.cookies_encrypted);
        if (dec) cookies = JSON.parse(dec);
      }
      if (ctx.storage_state_encrypted) {
        const dec = await decrypt(ctx.storage_state_encrypted);
        if (dec) storageState = JSON.parse(dec);
      }
      return { cookies, storage_state: storageState, auth_state: ctx.auth_state };
    }

    case "context_delete": {
      const contexts = await base44.asServiceRole.entities.BrowserContext.filter({ context_id: params.context_id });
      if (!contexts.length) throw new Error("Context not found");
      if (keyRecord.project_id && contexts[0].project_id !== keyRecord.project_id) throw new Error("Context not found");
      await base44.asServiceRole.entities.BrowserContext.delete(contexts[0].id);
      return { success: true };
    }

    // ── Artifact access ──
    case "artifact_get": {
      const artifacts = await base44.asServiceRole.entities.Artifact.filter({ artifact_id: params.artifact_id });
      if (!artifacts.length) throw new Error("Artifact not found");
      const artifact = artifacts[0];
      // Check access policy — private artifacts require same project
      if (artifact.access_policy === "private" && keyRecord.project_id && artifact.project_id !== keyRecord.project_id) {
        throw new Error("Access denied — artifact belongs to different project");
      }
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
      throw new Error(`Unknown MCP tool: ${tool}`);
  }
}