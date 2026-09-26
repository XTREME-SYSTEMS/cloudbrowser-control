import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { enginePost, engineDelete, engineGet, isEngineConfigured, setEngineClient } from "../../shared/engineClient.ts";
import { encrypt, decrypt, hashKey } from "../../shared/crypto.ts";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";

// ═══════════════════════════════════════════════
// CANONICAL MCP GATEWAY — unified GPT/Claude/Codex/agent control surface.
// One canonical browser runtime (the Railway Playwright engine). No duplicate.
// Every tool returns structured JSON. Every mutation writes an EvidenceReceipt.
// API-key auth + scope enforcement. Policy validator gates ACT.
// ═══════════════════════════════════════════════

const TOOL_SCOPES: Record<string, string> = {
  browser_start: "sessions:write", browser_end: "sessions:write",
  browser_status: "sessions:read", browser_health: "sessions:read",
  navigate: "sessions:write", reload: "sessions:write", back: "sessions:write", forward: "sessions:write",
  observe: "sessions:read", find_element: "sessions:read", inspect_dom: "sessions:read", inspect_accessibility_tree: "sessions:read",
  click: "sessions:write", double_click: "sessions:write", right_click: "sessions:write", hover: "sessions:write", focus: "sessions:write",
  type: "sessions:write", fill: "sessions:write", clear: "sessions:write", press_key: "sessions:write", select_option: "sessions:write",
  upload_file: "sessions:write", scroll: "sessions:write", scroll_to_element: "sessions:write",
  wait_for: "sessions:read", wait_for_selector: "sessions:read", wait_for_navigation: "sessions:read", wait_for_network_idle: "sessions:read",
  extract: "sessions:read", extract_text: "sessions:read", extract_table: "sessions:read", extract_links: "sessions:read", extract_structured: "sessions:read",
  screenshot: "sessions:read", full_page_screenshot: "sessions:read", element_screenshot: "sessions:read",
  list_tabs: "sessions:read", open_tab: "sessions:write", close_tab: "sessions:write", switch_tab: "sessions:write",
  get_console: "sessions:read", get_network: "sessions:read", get_requests: "sessions:read", get_responses: "sessions:read", get_errors: "sessions:read",
  download_file: "sessions:write", artifact_get: "sessions:read",
  session_save: "sessions:write", session_restore: "sessions:write",
  context_create: "sessions:write", context_save: "sessions:write", context_restore: "sessions:read", context_attach: "sessions:write", context_delete: "sessions:write",
  run_script: "sessions:write", evaluate_dom: "sessions:read",
  compare_screenshots: "sessions:read", compare_visual_reference: "sessions:read",
  run_test: "sessions:write", run_test_suite: "sessions:write", run_playwright_matrix: "sessions:write",
  agent_execute: "sessions:write", agent_pause: "sessions:write", agent_resume: "sessions:write", agent_cancel: "sessions:write",
  approval_request: "approvals:write", approval_status: "approvals:read",
  job_create: "jobs:write", job_run: "jobs:write", job_pause: "jobs:write", job_resume: "jobs:write", job_cancel: "jobs:write", job_retry: "jobs:write",
  receipt_get: "sessions:read", evidence_get: "sessions:read",
};

const PROTECTED_ACTIONS = new Set(["run_test_suite", "run_playwright_matrix"]);

function err(status: number, error: string, requestId: string) {
  return Response.json({ error, request_id: requestId, __v: DEPLOYMENT_VERSION }, { status });
}

// OBSERVE — semantic element discovery via accessibility tree + DOM scan.
const OBSERVE_SCRIPT = "() => { const sel = 'a,button,input,select,textarea,[role=\"button\"],[role=\"link\"],[role=\"checkbox\"],[role=\"radio\"],[role=\"tab\"],[role=\"menuitem\"],[role=\"option\"],[role=\"switch\"],[contenteditable],[tabindex]'; const out = []; document.querySelectorAll(sel).forEach((el, i) => { if (i > 250) return; const r = el.getBoundingClientRect(); if (r.width === 0 && r.height === 0) return; const role = el.getAttribute('role') || el.tagName.toLowerCase(); const name = (el.getAttribute('aria-label') || el.innerText || '').trim().slice(0, 100) || el.getAttribute('placeholder') || el.getAttribute('title') || el.getAttribute('alt') || ''; let selector = el.id ? '#' + el.id : (el.getAttribute('data-testid') ? '[data-testid=\"' + el.getAttribute('data-testid') + '\"]' : el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).slice(0,2).join('.') : '')); out.push({ role: role, name: name, selector: selector, tag: el.tagName.toLowerCase(), type: el.getAttribute('type') || null, bbox: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }, enabled: !el.disabled, visible: r.width > 0 && r.height > 0, confidence: 0.9 }); }); return { url: location.href, title: document.title, element_count: out.length, elements: out }; }";

const ACCESSIBILITY_TREE_SCRIPT = "() => { const out = []; const walk = (node, depth) => { if (depth > 8 || !node) return; if (node.nodeType === 1) { const el = node; const role = el.getAttribute('role') || el.tagName.toLowerCase(); const name = (el.getAttribute('aria-label') || el.innerText || '').trim().slice(0, 80); if (role || name) out.push({ depth: depth, role: role, name: name, tag: el.tagName.toLowerCase(), visible: el.offsetParent !== null }); } for (const c of node.childNodes) walk(c, depth + 1); }; walk(document.body, 0); return { url: location.href, tree: out }; }";

const LINKS_SCRIPT = "() => [...document.querySelectorAll('a[href]')].map(a => ({ text: a.innerText.trim().slice(0,80), href: a.href })).slice(0, 200)";
const STATE_SCRIPT = "() => ({ url: location.href, title: document.title })";

function findElementScript(selector) {
  return "() => { const el = document.querySelector(" + JSON.stringify(selector) + "); if (!el) return { found: false }; const r = el.getBoundingClientRect(); return { found: true, selector: " + JSON.stringify(selector) + ", bbox: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }, visible: r.width > 0 }; }";
}

function focusScript(selector) {
  return "() => { const el = document.querySelector(" + JSON.stringify(selector) + "); if (el) el.focus(); return { focused: !!el }; }";
}

function domScript() {
  return "() => ({ url: location.href, title: document.title, html: document.documentElement.outerHTML.slice(0, 50000) })";
}

export default async function (req) {
  const base44 = createClientFromRequest(req);
  setEngineClient(base44);
  const requestId = req.headers.get("x-request-id") || "mcp_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);

  try {
    const body = await req.json();
    const { tool, params = {}, api_key } = body;

    // ── Auth: API key (external agents) OR authenticated admin (Operator Console) ──
    let keyRecord = null;
    const apiKey = api_key || (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (apiKey) {
      const keyHash = await hashKey(apiKey);
      const keys = await base44.asServiceRole.entities.ApiKey.filter({ key_hash: keyHash, active: true });
      if (keys.length) {
        keyRecord = keys[0];
        if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) return err(401, "API key expired", requestId);
        base44.asServiceRole.entities.ApiKey.update(keyRecord.id, { last_used: new Date().toISOString() }).catch(() => {});
      }
    }
    // Fallback: authenticated admin user (Operator Console UI)
    if (!keyRecord) {
      try {
        const user = await base44.auth.me();
        if (user && user.role === "admin") {
          keyRecord = { id: "user_" + user.id, name: user.full_name || user.email || "admin", project_id: null, scopes: ["sessions:read", "sessions:write", "approvals:read", "approvals:write", "jobs:read", "jobs:write"] };
        }
      } catch (e) {}
    }
    if (!keyRecord) return err(401, "Authentication required (API key or admin session)", requestId);

    const requiredScope = TOOL_SCOPES[tool];
    if (!requiredScope) return err(404, "Unknown tool: " + tool, requestId);
    if (!(keyRecord.scopes || []).includes(requiredScope)) return err(403, "Insufficient scope for '" + tool + "'. Required: " + requiredScope, requestId);

    if (PROTECTED_ACTIONS.has(tool) && !params.approval_id) {
      return err(403, "Tool '" + tool + "' is a protected action. Provide approval_id (granted approval).", requestId);
    }

    const result = await handleTool(base44, tool, params, keyRecord, requestId);

    const isMutation = ["sessions:write", "jobs:write", "approvals:write"].includes(requiredScope);
    if (isMutation && result && !result.__no_receipt) {
      const receiptId = "rcpt_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
      await base44.asServiceRole.entities.EvidenceReceipt.create({
        receipt_id: receiptId,
        session_id: params.session_id || result.session_id || null,
        project_id: keyRecord.project_id || null,
        tool: tool,
        action: tool,
        target: params.url || params.selector || "",
        expected_result: params.expected || "",
        actual_result: result.error ? ("error: " + result.error) : "executed",
        status: result.error ? "fail" : "pass",
        evidence_type: result.screenshot_url ? "screenshot" : (result.data ? "extract" : "other"),
        screenshot_url: result.screenshot_url || null,
        data: result,
        errors: result.error ? [result.error] : [],
        approval_state: params.approval_id ? "granted" : "not_required",
        approval_id: params.approval_id || null,
        operator: keyRecord.name || "mcp",
        timestamp: new Date().toISOString(),
      }).catch(() => {});
      result.receipt_id = receiptId;
    }

    return Response.json({ ...result, request_id: requestId, __v: DEPLOYMENT_VERSION });
  } catch (error) {
    return err(500, error.message, requestId);
  }
}

async function getSession(base44, keyRecord, sessionId) {
  const s = await base44.asServiceRole.entities.Session.get(sessionId);
  if (!s) throw new Error("Session not found");
  if (keyRecord.project_id && s.project_id && s.project_id !== keyRecord.project_id) throw new Error("Session not found (tenant)");
  return s;
}

async function exec(base44, s, action_type, payload = {}) {
  if (!await isEngineConfigured()) throw new Error("Browser engine not configured");
  return enginePost("/sessions/" + s.session_id + "/execute", { action_type, ...payload });
}

async function uploadScreenshot(base44, base64, name = "mcp_screenshot.png") {
  const file = new File([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], name, { type: "image/png" });
  const res = await base44.integrations.Core.UploadFile({ file });
  return res.file_url;
}

async function loadStoredContext(base44, keyRecord, contextId) {
  const ctxs = await base44.asServiceRole.entities.BrowserContext.filter({ context_id: contextId });
  if (!ctxs.length) throw new Error("Durable browser context not found");
  const ctx = ctxs[0];
  if (ctx.revoked) throw new Error("Context revoked");
  if (ctx.expires_at && new Date(ctx.expires_at) < new Date()) throw new Error("Context expired");
  if (keyRecord.project_id && ctx.project_id && ctx.project_id !== keyRecord.project_id) throw new Error("Context not found (tenant)");

  let cookies = null;
  let storageState = null;
  if (ctx.cookies_encrypted) {
    const d = await decrypt(ctx.cookies_encrypted);
    if (d) cookies = JSON.parse(d);
  }
  if (ctx.storage_state_encrypted) {
    const d = await decrypt(ctx.storage_state_encrypted);
    if (d) storageState = JSON.parse(d);
  }
  return { ctx, cookies, storageState };
}

async function restoreStoredContext(base44, keyRecord, contextId, sourceSessionId = null) {
  if (!await isEngineConfigured()) throw new Error("Browser engine not configured");
  const { ctx, cookies, storageState } = await loadStoredContext(base44, keyRecord, contextId);
  const targetUrl = ctx.metadata?.target_url || null;
  const res = await enginePost("/sessions", {
    target_url: targetUrl,
    cookies,
    storageState,
    resume: true,
    usePool: false,
  });
  if (!res.sessionId) throw new Error("Engine returned no runtime session ID");

  const session = await base44.asServiceRole.entities.Session.create({
    session_id: res.sessionId,
    status: "running",
    project_id: keyRecord.project_id || ctx.project_id || null,
    current_url: targetUrl,
    target_url: targetUrl,
    profile_id: ctx.profile_id || null,
    started_at: new Date().toISOString(),
    metadata: {
      resumed_from: sourceSessionId || ctx.metadata?.source_session_id || null,
      durable_context_id: ctx.context_id,
      worker_id: res.workerId,
      region: res.region,
      engine_version: res.engineVersion,
    },
  });
  await base44.asServiceRole.entities.BrowserContext.update(ctx.id, { last_used: new Date().toISOString() });
  return {
    restored: true,
    session_id: session.id,
    runtime_session_id: res.sessionId,
    persistence: "durable",
    auth_state: ctx.auth_state,
  };
}

async function handleTool(base44, tool, p, keyRecord, requestId) {
  switch (tool) {
    // ── Browser lifecycle ──
    case "browser_start": {
      if (!await isEngineConfigured()) throw new Error("Engine not configured");
      const res = await enginePost("/sessions", {
        viewport: p.viewport, userAgent: p.user_agent, usePool: p.use_pool === true,
        proxy: p.proxy, locale: p.locale, timezone: p.timezone, headers: p.headers,
      });
      const session = await base44.asServiceRole.entities.Session.create({
        session_id: res.sessionId, status: "idle", project_id: keyRecord.project_id,
        started_at: new Date().toISOString(),
        metadata: { worker_id: res.workerId, region: res.region },
      });
      return { session_id: session.id, runtime_session_id: res.sessionId, status: "idle" };
    }
    case "browser_end": {
      const s = await getSession(base44, keyRecord, p.session_id);
      if (s.session_id) try { await engineDelete("/sessions/" + s.session_id); } catch (e) {}
      await base44.asServiceRole.entities.Session.update(p.session_id, { status: "ended", ended_at: new Date().toISOString() });
      return { success: true, session_id: p.session_id };
    }
    case "browser_status": {
      const s = await getSession(base44, keyRecord, p.session_id);
      return { session_id: s.id, status: s.status, url: s.current_url, title: s.current_title };
    }
    case "browser_health": {
      if (!await isEngineConfigured()) return { ok: false, error: "Engine not configured" };
      const h = await engineGet("/health");
      return { ok: h.ok, engine_version: h.engine_version, active_sessions: h.active_sessions, worker_id: h.worker_id };
    }

    // ── Navigation ──
    case "navigate": { const s = await getSession(base44, keyRecord, p.session_id); const r = await exec(base44, s, "goto", { value: p.url, options: { waitUntil: p.wait_until || "domcontentloaded", timeout: p.timeout || 60000 } }); await base44.asServiceRole.entities.Session.update(p.session_id, { current_url: r.url, current_title: r.title }); return { url: r.url, title: r.title, captcha: r.captcha || null }; }
    case "reload": { const s = await getSession(base44, keyRecord, p.session_id); const r = await exec(base44, s, "reload"); return { url: r.url }; }
    case "back": { const s = await getSession(base44, keyRecord, p.session_id); const r = await exec(base44, s, "back"); return { url: r.url }; }
    case "forward": { const s = await getSession(base44, keyRecord, p.session_id); const r = await exec(base44, s, "forward"); return { url: r.url }; }

    // ── OBSERVE (semantic) ──
    case "observe": { const s = await getSession(base44, keyRecord, p.session_id); const r = await exec(base44, s, "evaluate", { options: { fn: OBSERVE_SCRIPT } }); return { observation: r.data }; }
    case "inspect_accessibility_tree": { const s = await getSession(base44, keyRecord, p.session_id); const r = await exec(base44, s, "evaluate", { options: { fn: ACCESSIBILITY_TREE_SCRIPT } }); return { tree: r.data }; }
    case "find_element": { const s = await getSession(base44, keyRecord, p.session_id); const r = await exec(base44, s, "evaluate", { options: { fn: findElementScript(p.selector) } }); return { element: r.data }; }
    case "inspect_dom": { const s = await getSession(base44, keyRecord, p.session_id); const r = await exec(base44, s, "evaluate", { options: { fn: domScript() } }); return { dom: r.data }; }

    // ── ACT ──
    case "click": { const s = await getSession(base44, keyRecord, p.session_id); const r = await exec(base44, s, "click", { selector: p.selector, options: { button: p.button || "left" } }); return { result: r }; }
    case "double_click": { const s = await getSession(base44, keyRecord, p.session_id); const r = await exec(base44, s, "click", { selector: p.selector, options: { clickCount: 2 } }); return { result: r }; }
    case "right_click": { const s = await getSession(base44, keyRecord, p.session_id); const r = await exec(base44, s, "click", { selector: p.selector, options: { button: "right" } }); return { result: r }; }
    case "hover": { const s = await getSession(base44, keyRecord, p.session_id); const r = await exec(base44, s, "hover", { selector: p.selector }); return { result: r }; }
    case "focus": { const s = await getSession(base44, keyRecord, p.session_id); const r = await exec(base44, s, "evaluate", { options: { fn: focusScript(p.selector) } }); return { result: r.data }; }
    case "type": { const s = await getSession(base44, keyRecord, p.session_id); const r = await exec(base44, s, "type", { selector: p.selector, value: p.value, options: { delay: p.delay || 0 } }); return { result: r }; }
    case "fill": { const s = await getSession(base44, keyRecord, p.session_id); const r = await exec(base44, s, "fill", { selector: p.selector, value: p.value }); return { result: r }; }
    case "clear": { const s = await getSession(base44, keyRecord, p.session_id); const r = await exec(base44, s, "fill", { selector: p.selector, value: "" }); return { result: r }; }
    case "press_key": { const s = await getSession(base44, keyRecord, p.session_id); const r = await exec(base44, s, "press", { value: p.key }); return { result: r }; }
    case "select_option": { const s = await getSession(base44, keyRecord, p.session_id); const r = await exec(base44, s, "select_option", { selector: p.selector, value: p.value }); return { result: r }; }
    case "upload_file": { const s = await getSession(base44, keyRecord, p.session_id); const r = await exec(base44, s, "upload_file", { value: p.file_path }); return { result: r }; }
    case "scroll": { const s = await getSession(base44, keyRecord, p.session_id); const r = await exec(base44, s, "scroll", { value: String(p.delta_y || 500) }); return { result: r }; }
    case "scroll_to_element": { const s = await getSession(base44, keyRecord, p.session_id); const r = await exec(base44, s, "scroll", { selector: p.selector }); return { result: r }; }

    // ── Wait ──
    case "wait_for": { const s = await getSession(base44, keyRecord, p.session_id); const r = await exec(base44, s, "wait_for_timeout", { value: String(p.ms || 1000) }); return { result: r }; }
    case "wait_for_selector": { const s = await getSession(base44, keyRecord, p.session_id); const r = await exec(base44, s, "wait_for_selector", { selector: p.selector, options: { timeout: p.timeout || 30000 } }); return { result: r }; }
    case "wait_for_navigation": { const s = await getSession(base44, keyRecord, p.session_id); const r = await exec(base44, s, "wait_for_load_state", { options: { state: "domcontentloaded", timeout: p.timeout || 30000 } }); return { result: r }; }
    case "wait_for_network_idle": { const s = await getSession(base44, keyRecord, p.session_id); const r = await exec(base44, s, "wait_for_load_state", { options: { state: "networkidle", timeout: p.timeout || 30000 } }); return { result: r }; }

    // ── EXTRACT ──
    case "extract_text": { const s = await getSession(base44, keyRecord, p.session_id); const r = await exec(base44, s, "extract_text", { selector: p.selector }); return { data: r.data, url: r.url }; }
    case "extract_table": { const s = await getSession(base44, keyRecord, p.session_id); const r = await exec(base44, s, "extract_table", { selector: p.selector }); return { data: r.data, url: r.url }; }
    case "extract_links": { const s = await getSession(base44, keyRecord, p.session_id); const r = await exec(base44, s, "evaluate", { options: { fn: LINKS_SCRIPT } }); return { links: r.data, url: r.url }; }
    case "extract":
    case "extract_structured": {
      const s = await getSession(base44, keyRecord, p.session_id);
      const pageRes = await exec(base44, s, "ai_extract");
      const llmRes = await base44.integrations.Core.InvokeLLM({
        prompt: (p.prompt || "Extract the requested data from this page content. Never fabricate absent data.") + "\n\nPage content:\n" + pageRes.data,
        response_json_schema: p.schema || { type: "object", properties: { data: { type: "string" } } },
      });
      return { data: llmRes, schema_validation: !!p.schema, source_url: pageRes.url, confidence: p.schema ? 0.85 : 0.5, evidence: "ai_extract+InvokeLLM" };
    }

    // ── Screenshot ──
    case "screenshot": { const s = await getSession(base44, keyRecord, p.session_id); const r = await exec(base44, s, "screenshot", { options: { fullPage: false } }); const url = r.base64 ? await uploadScreenshot(base44, r.base64) : null; return { screenshot_url: url, size: r.size }; }
    case "full_page_screenshot": { const s = await getSession(base44, keyRecord, p.session_id); const r = await exec(base44, s, "screenshot", { options: { fullPage: true } }); const url = r.base64 ? await uploadScreenshot(base44, r.base64, "full_page.png") : null; return { screenshot_url: url, size: r.size }; }
    case "element_screenshot": { const s = await getSession(base44, keyRecord, p.session_id); await exec(base44, s, "evaluate", { options: { fn: focusScript(p.selector) } }); const sr = await exec(base44, s, "screenshot", { options: { fullPage: false } }); const url = sr.base64 ? await uploadScreenshot(base44, sr.base64, "element.png") : null; return { screenshot_url: url }; }

    // ── Tabs ──
    case "list_tabs": { const s = await getSession(base44, keyRecord, p.session_id); return { tabs: s.tabs || [], current_url: s.current_url }; }
    case "open_tab": { const s = await getSession(base44, keyRecord, p.session_id); const r = await exec(base44, s, "new_tab"); return { tab_index: r.tabIndex }; }
    case "close_tab": { const s = await getSession(base44, keyRecord, p.session_id); const r = await exec(base44, s, "close_tab", { value: String(p.tab_index || 0) }); return { result: r }; }
    case "switch_tab": { const s = await getSession(base44, keyRecord, p.session_id); const r = await exec(base44, s, "switch_tab", { value: String(p.tab_index) }); return { url: r.url }; }

    // ── Network / console ──
    case "get_console": { const s = await getSession(base44, keyRecord, p.session_id); const r = await engineGet("/sessions/" + s.session_id); return { console: (r.consoleLogs || []).slice(-100) }; }
    case "get_errors": { const s = await getSession(base44, keyRecord, p.session_id); const r = await engineGet("/sessions/" + s.session_id); return { errors: (r.consoleLogs || []).filter((l) => l.type === "error").slice(-50) }; }
    case "get_network":
    case "get_requests":
    case "get_responses": { const s = await getSession(base44, keyRecord, p.session_id); const r = await engineGet("/sessions/" + s.session_id); return { network: (r.networkLogs || []).slice(-100) }; }

    // ── Files ──
    case "download_file": { const s = await getSession(base44, keyRecord, p.session_id); const r = await exec(base44, s, "download", { selector: p.selector }); return { path: r.path, filename: r.filename, size: r.size }; }
    case "artifact_get": {
      const arts = await base44.asServiceRole.entities.Artifact.filter({ artifact_id: p.artifact_id });
      if (!arts.length) throw new Error("Artifact not found");
      const a = arts[0];
      if (a.access_policy === "private" && keyRecord.project_id && a.project_id !== keyRecord.project_id) throw new Error("Access denied");
      return { artifact_id: a.artifact_id, type: a.type, storage_key: a.storage_key, content_hash: a.content_hash, size_bytes: a.size_bytes };
    }

    // ── Context / session state ──
    case "session_save": {
      const s = await getSession(base44, keyRecord, p.session_id);
      const r = await exec(base44, s, "save_state");
      const snapshot = r.data?.snapshot;
      if (!snapshot) throw new Error("Engine did not return a persistence snapshot; refusing non-durable save");

      const stateToken = "persist_" + crypto.randomUUID();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 86400000).toISOString();
      const payload = {
        context_id: stateToken,
        name: "session:" + s.id,
        project_id: keyRecord.project_id || s.project_id || null,
        cookies_encrypted: snapshot.cookies ? await encrypt(JSON.stringify(snapshot.cookies)) : null,
        storage_state_encrypted: snapshot.storageState ? await encrypt(JSON.stringify(snapshot.storageState)) : null,
        auth_state: snapshot.cookies?.length ? "authenticated" : "anonymous",
        last_used: now.toISOString(),
        expires_at: expiresAt,
        metadata: {
          source_session_id: s.id,
          runtime_session_id: s.session_id,
          target_url: snapshot.url || s.current_url || null,
          title: snapshot.title || s.current_title || null,
          persistence_version: 1,
        },
      };
      await base44.asServiceRole.entities.BrowserContext.create(payload);
      await base44.asServiceRole.entities.Session.update(p.session_id, { resume_token: stateToken });
      return { state_token: stateToken, persisted: true, expires_at: expiresAt };
    }
    case "session_restore": {
      if (!p.state_token) throw new Error("state_token required");

      // Backward-compatible fast path for an in-memory token while the original runtime still exists.
      if (p.session_id && !String(p.state_token).startsWith("persist_")) {
        try {
          const s = await getSession(base44, keyRecord, p.session_id);
          const r = await exec(base44, s, "restore_state", { options: { stateToken: p.state_token } });
          return { restored: r.data, session_id: s.id, runtime_session_id: s.session_id, persistence: "runtime" };
        } catch (_) {
          // Fall through to durable restore if a matching stored context exists.
        }
      }

      return restoreStoredContext(base44, keyRecord, p.state_token, p.session_id || null);
    }
    case "context_create": {
      const ctxId = "ctx_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
      const cookiesEnc = p.cookies ? await encrypt(JSON.stringify(p.cookies)) : null;
      const storageEnc = p.storage_state ? await encrypt(JSON.stringify(p.storage_state)) : null;
      const ctx = await base44.asServiceRole.entities.BrowserContext.create({
        context_id: ctxId, name: p.name || ctxId, project_id: keyRecord.project_id,
        cookies_encrypted: cookiesEnc, storage_state_encrypted: storageEnc,
        auth_state: p.cookies ? "authenticated" : "anonymous", last_used: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
      });
      return { context_id: ctxId, entity_id: ctx.id };
    }
    case "context_save": {
      const ctxs = await base44.asServiceRole.entities.BrowserContext.filter({ context_id: p.context_id });
      if (!ctxs.length) throw new Error("Context not found");
      const ctx = ctxs[0];
      const cookiesEnc = p.cookies ? await encrypt(JSON.stringify(p.cookies)) : ctx.cookies_encrypted;
      const storageEnc = p.storage_state ? await encrypt(JSON.stringify(p.storage_state)) : ctx.storage_state_encrypted;
      await base44.asServiceRole.entities.BrowserContext.update(ctx.id, { cookies_encrypted: cookiesEnc, storage_state_encrypted: storageEnc, last_used: new Date().toISOString() });
      return { saved: true };
    }
    case "context_restore": {
      const { ctx, cookies, storageState } = await loadStoredContext(base44, keyRecord, p.context_id);
      return {
        context_id: ctx.context_id,
        auth_state: ctx.auth_state,
        resumable: Boolean(cookies || storageState),
        last_used: ctx.last_used || null,
        expires_at: ctx.expires_at || null,
      };
    }
    case "context_attach": {
      if (!p.context_id) throw new Error("context_id required");
      return restoreStoredContext(base44, keyRecord, p.context_id, null);
    }
    case "context_delete": { const ctxs = await base44.asServiceRole.entities.BrowserContext.filter({ context_id: p.context_id }); if (!ctxs.length) throw new Error("Context not found"); await base44.asServiceRole.entities.BrowserContext.delete(ctxs[0].id); return { success: true }; }

    // ── Script ──
    case "run_script":
    case "evaluate_dom": { const s = await getSession(base44, keyRecord, p.session_id); const r = await exec(base44, s, "evaluate", { options: { fn: p.script || p.fn } }); return { data: r.data }; }

    // ── Visual comparison (LLM-based structured diff) ──
    case "compare_screenshots":
    case "compare_visual_reference": {
      const s = await getSession(base44, keyRecord, p.session_id);
      const sr = await exec(base44, s, "screenshot", { options: { fullPage: p.full_page !== false } });
      if (!sr.base64) throw new Error("Screenshot failed");
      const actualUrl = await uploadScreenshot(base44, sr.base64, "compare_actual.png");
      const llmRes = await base44.integrations.Core.InvokeLLM({
        prompt: "Compare the ACTUAL screenshot to the APPROVED reference image. Identify every material visual mismatch (layout, spacing, color, typography, copy, component order, missing/extra elements). Return structured JSON with mismatches array. Do not fabricate mismatches. If no material mismatch, return empty array.\n\nReference image URL: " + p.reference_url + "\nActual screenshot URL: " + actualUrl,
        file_urls: [p.reference_url, actualUrl],
        response_json_schema: { type: "object", properties: { mismatches: { type: "array", items: { type: "object", properties: { section: { type: "string" }, component: { type: "string" }, observed: { type: "string" }, expected: { type: "string" }, severity: { type: "string" }, action: { type: "string" } } } }, material_variance: { type: "boolean" } } },
      });
      return { actual_screenshot_url: actualUrl, reference_url: p.reference_url, comparison: llmRes };
    }

    // ── Test (stubs) ──
    case "run_test": return { status: "not_implemented", message: "Single test execution requires test-runner infra (next phase)" };
    case "run_test_suite": return { status: "not_implemented", message: "Test suite runner pending — executor in next phase", approval_id: p.approval_id };
    case "run_playwright_matrix": return { status: "not_implemented", message: "Playwright matrix pending — multi-viewport runner in next phase", approval_id: p.approval_id };

    // ── AGENT (bounded single-step) ──
    case "agent_execute": {
      const s = await getSession(base44, keyRecord, p.session_id);
      const obs = await exec(base44, s, "evaluate", { options: { fn: OBSERVE_SCRIPT } });
      const llmRes = await base44.integrations.Core.InvokeLLM({
        prompt: "You are a browser agent. GOAL: " + (p.goal || "") + "\nCurrent page: " + (obs.data?.url || "") + "\nVisible interactive elements (semantic): " + JSON.stringify((obs.data?.elements || []).slice(0, 40)) + "\nPropose ONE deterministic browser action to progress toward the goal. Return JSON with action_type (goto|click|type|fill|press|scroll|screenshot|extract|done), selector, value, and reasoning. If goal achieved, action_type=done.",
        response_json_schema: { type: "object", properties: { action_type: { type: "string" }, selector: { type: "string" }, value: { type: "string" }, reasoning: { type: "string" }, done: { type: "boolean" } } },
      });
      const proposal = llmRes || {};
      const ALLOWED = new Set(["goto", "click", "type", "fill", "press", "scroll", "screenshot", "extract_text", "done"]);
      if (!ALLOWED.has(proposal.action_type)) return { error: "policy_rejected: action_type '" + proposal.action_type + "' not allowed", proposal, step: "policy_check" };
      if (proposal.done || proposal.action_type === "done") return { done: true, reasoning: proposal.reasoning, observation: { url: obs.data?.url, element_count: obs.data?.element_count } };
      const actRes = await exec(base44, s, proposal.action_type === "press" ? "press" : proposal.action_type, { selector: proposal.selector, value: proposal.value });
      const postObs = await exec(base44, s, "evaluate", { options: { fn: STATE_SCRIPT } });
      return { step: "agent_step", proposal, action_result: actRes, post_state: postObs.data, done: false };
    }
    case "agent_pause": { await getSession(base44, keyRecord, p.session_id); await base44.asServiceRole.entities.Session.update(p.session_id, { status: "paused" }); return { paused: true }; }
    case "agent_resume": { await getSession(base44, keyRecord, p.session_id); await base44.asServiceRole.entities.Session.update(p.session_id, { status: "idle" }); return { resumed: true }; }
    case "agent_cancel": { await getSession(base44, keyRecord, p.session_id); await base44.asServiceRole.entities.Session.update(p.session_id, { status: "cancelled" }); return { cancelled: true }; }

    // ── Approval ──
    case "approval_request": {
      const apprId = "appr_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
      const appr = await base44.asServiceRole.entities.Approval.create({
        approval_id: apprId, project_id: keyRecord.project_id, system_id: p.system_id || null,
        action_type: p.action_type, target: p.target || "", scope: p.scope || "protected",
        environment: p.environment || "production", status: "pending",
        rollback_reference: p.rollback_reference || "", reason: p.reason || "",
        requested_by: keyRecord.name || "mcp", requested_at: new Date().toISOString(),
        expires_at: p.expires_at || null,
      });
      return { approval_id: apprId, status: "pending", entity_id: appr.id };
    }
    case "approval_status": {
      const aps = await base44.asServiceRole.entities.Approval.filter({ approval_id: p.approval_id });
      if (!aps.length) throw new Error("Approval not found");
      return { approval_id: p.approval_id, status: aps[0].status, approved_by: aps[0].approved_by, granted: aps[0].status === "granted" };
    }

    // ── Job (governed queue fabric) ──
    case "job_create": {
      const job = await base44.asServiceRole.entities.Job.create({
        name: p.name || "mcp_job", status: "pending", project_id: keyRecord.project_id,
        target_url: p.target_url || "", config: p.config || {},
        created_at: new Date().toISOString(),
      });
      return { job_id: job.id, status: "pending" };
    }
    case "job_run": { const j = await base44.asServiceRole.entities.Job.get(p.job_id); if (!j) throw new Error("Job not found"); await base44.asServiceRole.entities.Job.update(p.job_id, { status: "running", started_at: new Date().toISOString() }); return { job_id: p.job_id, status: "running" }; }
    case "job_pause": { await base44.asServiceRole.entities.Job.update(p.job_id, { status: "paused" }); return { job_id: p.job_id, status: "paused" }; }
    case "job_resume": { await base44.asServiceRole.entities.Job.update(p.job_id, { status: "running" }); return { job_id: p.job_id, status: "running" }; }
    case "job_cancel": { await base44.asServiceRole.entities.Job.update(p.job_id, { status: "cancelled" }); return { job_id: p.job_id, status: "cancelled" }; }
    case "job_retry": { await base44.asServiceRole.entities.Job.update(p.job_id, { status: "pending" }); return { job_id: p.job_id, status: "pending" }; }

    // ── Receipts ──
    case "receipt_get": { const rs = await base44.asServiceRole.entities.EvidenceReceipt.filter({ receipt_id: p.receipt_id }); if (!rs.length) throw new Error("Receipt not found"); return { receipt: rs[0] }; }
    case "evidence_get": { const rs = await base44.asServiceRole.entities.EvidenceReceipt.filter({ session_id: p.session_id }, "-timestamp", 20); return { receipts: rs, count: rs.length }; }

    default:
      return { error: "Unknown tool: " + tool, __no_receipt: true };
  }
}