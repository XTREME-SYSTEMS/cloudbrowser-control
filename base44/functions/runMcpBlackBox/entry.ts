import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";
import { hashKey, genKey, runTest as runTestShared } from "../../shared/testUtils.ts";

// ═══════════════════════════════════════════════
// MCP Black-Box Tests — Phase 12
// Tests every active MCP tool for auth, authorization, runtime action,
// expected response, telemetry, cleanup, and failure behavior.
// ═══════════════════════════════════════════════

async function callMcp(base44, tool, params, apiKey) {
  try {
    const res = await base44.asServiceRole.functions.invoke("mcpTools", { tool, params, api_key: apiKey });
    return { ok: res.status < 400, status: res.status, data: res.data, error: res.data?.error };
  } catch (e) {
    const status = e.status || e.response?.status || 500;
    const data = e.data || e.response?.data || {};
    return { ok: status < 400, status, data, error: data.error || e.message };
  }
}

async function runTest(base44, runId, testName, maxPoints, testFn) {
  return (await runTestShared(base44, runId, "MCP Black-Box Suite", testName, "MCP Black-Box", maxPoints, testFn)).pass;
}

export default async function (req) {
  const base44 = createClientFromRequest(req);
  const { secrets } = await import("base44:runtime");
  const engineConfigured = !!(secrets.get("ENGINE_URL") && secrets.get("ENGINE_API_KEY"));

  try {
    const runId = "mcp_bb_" + Date.now();

    // Create test API key
    const testKey = genKey();
    const testKeyHash = await hashKey(testKey);
    const keyRec = await base44.asServiceRole.entities.ApiKey.create({
      name: "MCP_BB_" + runId, key_prefix: testKey.slice(0, 12), key_hash: testKeyHash,
      scopes: ["sessions:read", "sessions:write", "jobs:read", "jobs:write", "projects:read"], active: true,
    });

    let sessionId = null;
    let contextId = null;
    let artifactId = null;

    // ── Auth tests ──
    await runTest(base44, runId, "MCP: Missing API key rejected (401)", 2, async () => {
      const r = await callMcp(base44, "browser_start", {}, "");
      return r.status === 401 ? true : { error: `Expected 401, got ${r.status}` };
    });

    await runTest(base44, runId, "MCP: Invalid API key rejected (401)", 2, async () => {
      const r = await callMcp(base44, "browser_start", {}, "cb_live_invalid");
      return r.status === 401 ? true : { error: `Expected 401, got ${r.status}` };
    });

    await runTest(base44, runId, "MCP: Unknown tool rejected", 2, async () => {
      const r = await callMcp(base44, "unknown_tool", {}, testKey);
      return r.status === 500 || r.error?.includes("Unknown") ? true : { error: `Expected unknown tool error, got ${r.status}` };
    });

    // ── Browser lifecycle tests ──
    await runTest(base44, runId, "MCP: browser_start creates session", 3, async () => {
      if (!engineConfigured) return { error: "Engine not configured" };
      const r = await callMcp(base44, "browser_start", {}, testKey);
      if (!r.ok) return { error: `browser_start failed: ${r.error}` };
      if (!r.data?.session_id) return { error: "No session_id returned" };
      sessionId = r.data.session_id;
      return true;
    });

    await runTest(base44, runId, "MCP: browser_navigate navigates real browser", 2, async () => {
      if (!engineConfigured || !sessionId) return { error: "No session" };
      const r = await callMcp(base44, "browser_navigate", { session_id: sessionId, url: "https://example.com" }, testKey);
      if (!r.ok) return { error: `navigate failed: ${r.error}` };
      if (!r.data?.url?.includes("example.com")) return { error: `URL mismatch: ${r.data?.url}` };
      return true;
    });

    await runTest(base44, runId, "MCP: browser_act executes action", 2, async () => {
      if (!engineConfigured || !sessionId) return { error: "No session" };
      const r = await callMcp(base44, "browser_act", {
        session_id: sessionId, action_type: "evaluate", options: { fn: "() => 42" }
      }, testKey);
      if (!r.ok) return { error: `act failed: ${r.error}` };
      return true;
    });

    await runTest(base44, runId, "MCP: browser_observe returns page state", 2, async () => {
      if (!engineConfigured || !sessionId) return { error: "No session" };
      const r = await callMcp(base44, "browser_observe", { session_id: sessionId }, testKey);
      if (!r.ok) return { error: `observe failed: ${r.error}` };
      if (!r.data?.observation) return { error: "No observation returned" };
      return true;
    });

    await runTest(base44, runId, "MCP: browser_extract returns data", 2, async () => {
      if (!engineConfigured || !sessionId) return { error: "No session" };
      const r = await callMcp(base44, "browser_extract", {
        session_id: sessionId, extract_type: "extract_text", selector: "body"
      }, testKey);
      if (!r.ok) return { error: `extract failed: ${r.error}` };
      if (!r.data?.data) return { error: "No data returned" };
      return true;
    });

    await runTest(base44, runId, "MCP: browser_screenshot produces image", 2, async () => {
      if (!engineConfigured || !sessionId) return { error: "No session" };
      const r = await callMcp(base44, "browser_screenshot", { session_id: sessionId }, testKey);
      if (!r.ok) return { error: `screenshot failed: ${r.error}` };
      if (!r.data?.screenshot_url) return { error: "No screenshot_url returned" };
      return true;
    });

    await runTest(base44, runId, "MCP: browser_list_tabs returns tabs", 1, async () => {
      if (!sessionId) return { error: "No session" };
      const r = await callMcp(base44, "browser_list_tabs", { session_id: sessionId }, testKey);
      if (!r.ok) return { error: `list_tabs failed: ${r.error}` };
      return Array.isArray(r.data?.tabs) ? true : { error: "No tabs array" };
    });

    await runTest(base44, runId, "MCP: browser_end closes session", 2, async () => {
      if (!engineConfigured || !sessionId) return { error: "No session" };
      const r = await callMcp(base44, "browser_end", { session_id: sessionId }, testKey);
      if (!r.ok) return { error: `browser_end failed: ${r.error}` };
      if (!r.data?.success) return { error: "No success flag" };
      sessionId = null;
      return true;
    });

    // ── Context tests ──
    await runTest(base44, runId, "MCP: context_create creates context", 2, async () => {
      const r = await callMcp(base44, "context_create", {
        name: "MCP_TEST_CTX", cookies: [{ name: "test", value: "abc", domain: "example.com" }]
      }, testKey);
      if (!r.ok) return { error: `context_create failed: ${r.error}` };
      if (!r.data?.context_id) return { error: "No context_id" };
      contextId = r.data.context_id;
      return true;
    });

    await runTest(base44, runId, "MCP: context_use returns decrypted state", 2, async () => {
      if (!contextId) return { error: "No context" };
      const r = await callMcp(base44, "context_use", { context_id: contextId }, testKey);
      if (!r.ok) return { error: `context_use failed: ${r.error}` };
      if (!r.data?.cookies) return { error: "No cookies returned — decrypt failed" };
      if (!Array.isArray(r.data.cookies)) return { error: "Cookies not an array" };
      return true;
    });

    await runTest(base44, runId, "MCP: context_use on nonexistent context fails", 1, async () => {
      const r = await callMcp(base44, "context_use", { context_id: "nonexistent_ctx" }, testKey);
      return !r.ok && r.error?.includes("not found") ? true : { error: "Should fail on nonexistent context" };
    });

    await runTest(base44, runId, "MCP: context_delete removes context", 2, async () => {
      if (!contextId) return { error: "No context" };
      const r = await callMcp(base44, "context_delete", { context_id: contextId }, testKey);
      if (!r.ok) return { error: `context_delete failed: ${r.error}` };
      // Verify it's gone
      const r2 = await callMcp(base44, "context_use", { context_id: contextId }, testKey);
      return !r2.ok ? true : { error: "Context still accessible after deletion" };
    });

    // ── Artifact test ──
    await runTest(base44, runId, "MCP: artifact_get returns artifact metadata", 2, async () => {
      // Create a test artifact first
      const art = await base44.asServiceRole.entities.Artifact.create({
        artifact_id: "mcp_test_" + runId, type: "json", storage_key: "test_key",
        content_hash: "abc123", access_policy: "private", retention_days: 30,
        project_id: keyRec.project_id,
      });
      artifactId = art.artifact_id;
      const r = await callMcp(base44, "artifact_get", { artifact_id: artifactId }, testKey);
      await base44.asServiceRole.entities.Artifact.delete(art.id).catch(() => {});
      if (!r.ok) return { error: `artifact_get failed: ${r.error}` };
      if (!r.data?.artifact_id) return { error: "No artifact_id returned" };
      if (!r.data?.content_hash) return { error: "No content_hash returned" };
      return true;
    });

    await runTest(base44, runId, "MCP: artifact_get on nonexistent fails", 1, async () => {
      const r = await callMcp(base44, "artifact_get", { artifact_id: "nonexistent" }, testKey);
      return !r.ok ? true : { error: "Should fail on nonexistent artifact" };
    });

    // ── Telemetry test ──
    await runTest(base44, runId, "MCP: AuditLog created for tool call", 2, async () => {
      // The mcpTools function creates an AuditLog entry for each call
      const logs = await base44.asServiceRole.entities.AuditLog.filter({
        entity_type: "mcp_tool",
      });
      const mcpLogs = logs.filter((l) => l.created_date && new Date(l.created_date) > new Date(Date.now() - 5 * 60 * 1000));
      return mcpLogs.length > 0 ? true : { error: "No recent MCP audit logs found" };
    });

    // ── Cleanup ──
    if (sessionId) {
      await callMcp(base44, "browser_end", { session_id: sessionId }, testKey);
    }
    await base44.asServiceRole.entities.ApiKey.delete(keyRec.id).catch(() => {});

    // ── Score ──
    const results = await base44.asServiceRole.entities.TestResult.filter({ run_id: runId });
    const total = results.length;
    const passed = results.filter((r) => r.status === "pass").length;
    const failed = results.filter((r) => r.status === "fail").length;
    const score = total > 0 ? Math.round((passed / total) * 100) : 0;

    return Response.json({
      run_id: runId, total_tests: total, passed, failed, score,
      engine_configured: engineConfigured,
      __v: DEPLOYMENT_VERSION,
    });
  } catch (error) {
    return Response.json({ error: error.message, __v: DEPLOYMENT_VERSION }, { status: 500 });
  }
}