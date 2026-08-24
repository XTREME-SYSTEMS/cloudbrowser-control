import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { stagingEnginePost, stagingEngineDelete, isStagingEngineConfigured, requireIsolatedFortressTestEnvironment, STAGING_ENGINE_CONFIGURATION_REQUIRED } from "../../shared/stagingEngineClient.ts";
import { encrypt, decrypt } from "../../shared/crypto.ts";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";
import { withCaptchaCredentials, getCaptchaCredentials } from "../../shared/captchaSolver.ts";

// ═══════════════════════════════════════════════
// mcpToolsStaging — STAGING MCP tool surface (Fortress v1.1)
// ADDITIVE: copy of mcpTools but uses STAGING engine client only.
// Fail-closed: refuses unless requireIsolatedFortressTestEnvironment().
// Production mcpTools is unchanged (diff=0).
// ═══════════════════════════════════════════════

async function hashKey(key) {
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function errorResponse(status, error, requestId) {
  return Response.json({ error, request_id: requestId, __v: DEPLOYMENT_VERSION, environment: "staging" }, { status });
}

export default async function (req) {
  if (!requireIsolatedFortressTestEnvironment()) {
    return errorResponse(503, STAGING_ENGINE_CONFIGURATION_REQUIRED, "staging_gate_off");
  }
  const base44 = createClientFromRequest(req);
  const requestId = "stg_mcp_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);

  try {
    const body = await req.json();
    const { tool, params = {}, api_key } = body;

    const apiKey = api_key || (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!apiKey) return errorResponse(401, "API key required", requestId);

    const keyHash = await hashKey(apiKey);
    const keys = await base44.asServiceRole.entities.ApiKey.filter({ key_hash: keyHash, active: true });
    if (!keys.length) return errorResponse(401, "Invalid API key", requestId);
    const keyRecord = keys[0];
    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
      return errorResponse(401, "API key expired", requestId);
    }
    base44.asServiceRole.entities.ApiKey.update(keyRecord.id, { last_used: new Date().toISOString() }).catch(() => {});

    const result = await handleTool(base44, tool, params, keyRecord, requestId);

    await base44.asServiceRole.entities.AuditLog.create({
      action: "run", entity_type: "mcp_tool_staging", entity_id: tool,
      description: `Staging MCP tool: ${tool}`,
      metadata: { request_id: requestId, project_id: keyRecord.project_id, environment: "staging" },
      timestamp: new Date().toISOString(),
    }).catch(() => {});

    return Response.json({ ...result, request_id: requestId, __v: DEPLOYMENT_VERSION, environment: "staging" });
  } catch (error) {
    return errorResponse(500, error.message, requestId);
  }
}

async function handleTool(base44, tool, params, keyRecord, requestId) {
  switch (tool) {
    case "browser_start": {
      if (!await isStagingEngineConfigured()) throw new Error("Staging engine not configured");
      let captchaSolver = null;
      if (params.captcha_solver === true) {
        captchaSolver = await getCaptchaCredentials(base44);
        if (!captchaSolver) throw new Error("captcha_solver: true was requested but CAPTCHA_SOLVER_API_KEY secret is not configured");
      }
      const engineRes = await stagingEnginePost("/sessions", {
        viewport: params.viewport, userAgent: params.user_agent, usePool: params.use_pool !== false, captchaSolver,
      });
      const session = await base44.asServiceRole.entities.Session.create({
        session_id: engineRes.sessionId, status: "idle", project_id: keyRecord.project_id,
        started_at: new Date().toISOString(), metadata: { worker_id: engineRes.workerId, region: engineRes.region, environment: "staging", captcha_solver_enabled: !!captchaSolver },
      });
      return { session_id: session.id, runtime_session_id: engineRes.sessionId, status: "idle", captcha_solver_enabled: !!captchaSolver, environment: "staging" };
    }
    case "browser_end": {
      const session = await base44.asServiceRole.entities.Session.get(params.session_id);
      if (!session) throw new Error("Session not found");
      if (keyRecord.project_id && session.project_id !== keyRecord.project_id) throw new Error("Session not found");
      if (session.session_id && await isStagingEngineConfigured()) {
        try { await stagingEngineDelete(`/sessions/${session.session_id}`); } catch (e) {}
      }
      await base44.asServiceRole.entities.Session.update(params.session_id, { status: "ended", ended_at: new Date().toISOString() });
      return { success: true, session_id: params.session_id, environment: "staging" };
    }
    case "browser_navigate": {
      const session = await base44.asServiceRole.entities.Session.get(params.session_id);
      if (!session) throw new Error("Session not found");
      if (keyRecord.project_id && session.project_id !== keyRecord.project_id) throw new Error("Session not found");
      if (!await isStagingEngineConfigured()) throw new Error("Staging engine not configured");
      const res = await stagingEnginePost(`/sessions/${session.session_id}/execute`, {
        action_type: "goto", value: params.url,
        options: { waitUntil: params.wait_until || "domcontentloaded", timeout: params.timeout || 60000 },
      });
      await base44.asServiceRole.entities.Session.update(params.session_id, { current_url: res.url, current_title: res.title });
      return { url: res.url, title: res.title, captcha: res.captcha || null, environment: "staging" };
    }
    case "solve_captcha": {
      const session = await base44.asServiceRole.entities.Session.get(params.session_id);
      if (!session) throw new Error("Session not found");
      if (keyRecord.project_id && session.project_id !== keyRecord.project_id) throw new Error("Session not found");
      if (!await isStagingEngineConfigured()) throw new Error("Staging engine not configured");
      const solveOptions = await withCaptchaCredentials(base44, {
        type: params.type, siteKey: params.site_key, provider: params.provider, maxWait: params.max_wait,
      });
      const res = await stagingEnginePost(`/sessions/${session.session_id}/execute`, {
        action_type: "solve_captcha", options: solveOptions,
      });
      return { result: res.data, captcha: res.data, environment: "staging" };
    }
    case "browser_act": {
      const session = await base44.asServiceRole.entities.Session.get(params.session_id);
      if (!session) throw new Error("Session not found");
      if (keyRecord.project_id && session.project_id !== keyRecord.project_id) throw new Error("Session not found");
      if (!await isStagingEngineConfigured()) throw new Error("Staging engine not configured");
      let actionOptions = params.options || {};
      if (params.action_type === "solve_captcha") {
        actionOptions = await withCaptchaCredentials(base44, actionOptions);
      }
      const res = await stagingEnginePost(`/sessions/${session.session_id}/execute`, {
        action_type: params.action_type, selector: params.selector, value: params.value, options: actionOptions,
      });
      return { result: res, environment: "staging" };
    }
    case "browser_observe": {
      const session = await base44.asServiceRole.entities.Session.get(params.session_id);
      if (!session) throw new Error("Session not found");
      if (keyRecord.project_id && session.project_id !== keyRecord.project_id) throw new Error("Session not found");
      if (!await isStagingEngineConfigured()) throw new Error("Staging engine not configured");
      const res = await stagingEnginePost(`/sessions/${session.session_id}/execute`, {
        action_type: "evaluate", options: { fn: params.fn || "() => ({ url: location.href, title: document.title })" },
      });
      return { observation: res.data, environment: "staging" };
    }
    case "browser_extract": {
      const session = await base44.asServiceRole.entities.Session.get(params.session_id);
      if (!session) throw new Error("Session not found");
      if (keyRecord.project_id && session.project_id !== keyRecord.project_id) throw new Error("Session not found");
      if (!await isStagingEngineConfigured()) throw new Error("Staging engine not configured");
      const extractType = params.extract_type || "extract_text";
      const res = await stagingEnginePost(`/sessions/${session.session_id}/execute`, { action_type: extractType, selector: params.selector });
      return { data: res.data, environment: "staging" };
    }
    case "browser_screenshot": {
      const session = await base44.asServiceRole.entities.Session.get(params.session_id);
      if (!session) throw new Error("Session not found");
      if (keyRecord.project_id && session.project_id !== keyRecord.project_id) throw new Error("Session not found");
      if (!await isStagingEngineConfigured()) throw new Error("Staging engine not configured");
      const res = await stagingEnginePost(`/sessions/${session.session_id}/execute`, {
        action_type: "screenshot", options: { fullPage: params.full_page || false },
      });
      if (res.base64) {
        const file = new File([Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0))], `stg_mcp_screenshot.png`, { type: "image/png" });
        const uploadRes = await base44.integrations.Core.UploadFile({ file });
        return { screenshot_url: uploadRes.file_url, size: res.size, environment: "staging" };
      }
      return { error: "No screenshot captured", environment: "staging" };
    }
    case "browser_list_tabs": {
      const session = await base44.asServiceRole.entities.Session.get(params.session_id);
      if (!session) throw new Error("Session not found");
      if (keyRecord.project_id && session.project_id !== keyRecord.project_id) throw new Error("Session not found");
      return { tabs: session.tabs || [], current_url: session.current_url, environment: "staging" };
    }
    case "browser_switch_tab": {
      const session = await base44.asServiceRole.entities.Session.get(params.session_id);
      if (!session) throw new Error("Session not found");
      if (keyRecord.project_id && session.project_id !== keyRecord.project_id) throw new Error("Session not found");
      if (!await isStagingEngineConfigured()) throw new Error("Staging engine not configured");
      const res = await stagingEnginePost(`/sessions/${session.session_id}/execute`, { action_type: "switch_tab", value: String(params.tab_index) });
      return { url: res.url, environment: "staging" };
    }
    case "context_create": {
      const contextId = "stg_ctx_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
      const cookiesEncrypted = params.cookies ? await encrypt(JSON.stringify(params.cookies)) : null;
      const storageEncrypted = params.storage_state ? await encrypt(JSON.stringify(params.storage_state)) : null;
      const ctx = await base44.asServiceRole.entities.BrowserContext.create({
        context_id: contextId, name: params.name || contextId, project_id: keyRecord.project_id,
        cookies_encrypted: cookiesEncrypted, storage_state_encrypted: storageEncrypted,
        auth_state: params.cookies ? "authenticated" : "anonymous", last_used: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), metadata: { environment: "staging" },
      });
      return { context_id: contextId, entity_id: ctx.id, environment: "staging" };
    }
    case "context_use": {
      const contexts = await base44.asServiceRole.entities.BrowserContext.filter({ context_id: params.context_id });
      if (!contexts.length) throw new Error("Context not found");
      const ctx = contexts[0];
      if (keyRecord.project_id && ctx.project_id !== keyRecord.project_id) throw new Error("Context not found");
      if (ctx.revoked) throw new Error("Context has been revoked — access denied");
      await base44.asServiceRole.entities.BrowserContext.update(ctx.id, {
        is_locked: true, lease_owner: params.session_id || "mcp_staging",
        lease_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), last_used: new Date().toISOString(),
      });
      let cookies = null, storageState = null;
      if (ctx.cookies_encrypted) { const dec = await decrypt(ctx.cookies_encrypted); if (dec) cookies = JSON.parse(dec); }
      if (ctx.storage_state_encrypted) { const dec = await decrypt(ctx.storage_state_encrypted); if (dec) storageState = JSON.parse(dec); }
      return { cookies, storage_state: storageState, auth_state: ctx.auth_state, environment: "staging" };
    }
    case "context_delete": {
      const contexts = await base44.asServiceRole.entities.BrowserContext.filter({ context_id: params.context_id });
      if (!contexts.length) throw new Error("Context not found");
      if (keyRecord.project_id && contexts[0].project_id !== keyRecord.project_id) throw new Error("Context not found");
      await base44.asServiceRole.entities.BrowserContext.delete(contexts[0].id);
      return { success: true, environment: "staging" };
    }
    case "artifact_get": {
      const artifacts = await base44.asServiceRole.entities.Artifact.filter({ artifact_id: params.artifact_id });
      if (!artifacts.length) throw new Error("Artifact not found");
      const artifact = artifacts[0];
      if (artifact.access_policy === "private" && keyRecord.project_id && artifact.project_id !== keyRecord.project_id) {
        throw new Error("Access denied — artifact belongs to different project");
      }
      return {
        artifact_id: artifact.artifact_id, type: artifact.type, storage_key: artifact.storage_key,
        content_hash: artifact.content_hash, size_bytes: artifact.size_bytes, mime_type: artifact.mime_type,
        access_policy: artifact.access_policy, environment: "staging",
      };
    }
    default:
      throw new Error(`Unknown MCP tool: ${tool}`);
  }
}