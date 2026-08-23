import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";
import { hashKey, genKey, runTest } from "../../shared/testUtils.ts";
import { requireIsolatedFortressTestEnvironment, isStagingEngineConfigured } from "../../shared/stagingEngineClient.ts";
import { secrets } from "base44:runtime";

// ═══════════════════════════════════════════════
// Staging MCP Black-Box — Fortress v1.1
// ADDITIVE: calls mcpToolsStaging (staging engine) only.
// Fail-closed. Production mcpTools never invoked.
// ═══════════════════════════════════════════════

async function callStagingMcp(base44, tool, params, apiKey) {
  try {
    const res = await base44.asServiceRole.functions.invoke("mcpToolsStaging", { tool, params, api_key: apiKey });
    return { ok: res.status < 400, status: res.status, data: res.data, error: res.data?.error };
  } catch (e) {
    const status = e.status || e.response?.status || 500;
    const data = e.data || e.response?.data || {};
    return { ok: status < 400, status, data, error: data.error || e.message };
  }
}

export default async function (req) {
  if (!requireIsolatedFortressTestEnvironment()) {
    return Response.json({ suite: "Staging MCP Black-Box", overall: "SKIP", reason: "staging gate off", __v: DEPLOYMENT_VERSION }, { status: 503 });
  }
  const base44 = createClientFromRequest(req);
  const stagingConfigured = await isStagingEngineConfigured();

  try {
    const runId = "stg_mcp_bb_" + Date.now();
    const testKey = genKey();
    const testKeyHash = await hashKey(testKey);
    const keyRec = await base44.asServiceRole.entities.ApiKey.create({
      name: "STG_MCP_BB_" + runId, key_prefix: testKey.slice(0, 12), key_hash: testKeyHash,
      scopes: ["sessions:read", "sessions:write", "jobs:read", "jobs:write", "projects:read"], active: true,
    });

    let sessionId = null;
    let contextId = null;

    await runTest(base44, runId, "Staging MCP Black-Box Suite", "Staging MCP: Missing API key rejected (401)", "Staging MCP Auth", 2, async () => {
      const r = await callStagingMcp(base44, "browser_start", {}, "");
      return r.status === 401 ? true : { error: `Expected 401, got ${r.status}` };
    });
    await runTest(base44, runId, "Staging MCP Black-Box Suite", "Staging MCP: Invalid API key rejected (401)", "Staging MCP Auth", 2, async () => {
      const r = await callStagingMcp(base44, "browser_start", {}, "cb_live_invalid");
      return r.status === 401 ? true : { error: `Expected 401, got ${r.status}` };
    });
    await runTest(base44, runId, "Staging MCP Black-Box Suite", "Staging MCP: Unknown tool rejected", "Staging MCP Auth", 2, async () => {
      const r = await callStagingMcp(base44, "unknown_tool", {}, testKey);
      return r.status === 500 || r.error?.includes("Unknown") ? true : { error: `Expected unknown tool error, got ${r.status}` };
    });

    await runTest(base44, runId, "Staging MCP Black-Box Suite", "Staging MCP: browser_start creates session", "Staging MCP Lifecycle", 3, async () => {
      if (!stagingConfigured) return { error: "Staging engine not configured" };
      const r = await callStagingMcp(base44, "browser_start", {}, testKey);
      if (!r.ok) return { error: `browser_start failed: ${r.error}` };
      if (!r.data?.session_id) return { error: "No session_id returned" };
      sessionId = r.data.session_id;
      return r.data?.environment === "staging" ? true : { error: "environment not staging" };
    });
    await runTest(base44, runId, "Staging MCP Black-Box Suite", "Staging MCP: browser_navigate navigates real browser", "Staging MCP Lifecycle", 2, async () => {
      if (!stagingConfigured || !sessionId) return { error: "No session" };
      const r = await callStagingMcp(base44, "browser_navigate", { session_id: sessionId, url: "https://example.com" }, testKey);
      if (!r.ok) return { error: `navigate failed: ${r.error}` };
      if (!r.data?.url?.includes("example.com")) return { error: `URL mismatch: ${r.data?.url}` };
      return true;
    });
    await runTest(base44, runId, "Staging MCP Black-Box Suite", "Staging MCP: browser_act executes action", "Staging MCP Lifecycle", 2, async () => {
      if (!stagingConfigured || !sessionId) return { error: "No session" };
      const r = await callStagingMcp(base44, "browser_act", { session_id: sessionId, action_type: "evaluate", options: { fn: "() => 42" } }, testKey);
      if (!r.ok) return { error: `act failed: ${r.error}` };
      return true;
    });
    await runTest(base44, runId, "Staging MCP Black-Box Suite", "Staging MCP: browser_observe returns page state", "Staging MCP Lifecycle", 2, async () => {
      if (!stagingConfigured || !sessionId) return { error: "No session" };
      const r = await callStagingMcp(base44, "browser_observe", { session_id: sessionId }, testKey);
      if (!r.ok) return { error: `observe failed: ${r.error}` };
      if (!r.data?.observation) return { error: "No observation returned" };
      return true;
    });
    await runTest(base44, runId, "Staging MCP Black-Box Suite", "Staging MCP: browser_extract returns data", "Staging MCP Lifecycle", 2, async () => {
      if (!stagingConfigured || !sessionId) return { error: "No session" };
      const r = await callStagingMcp(base44, "browser_extract", { session_id: sessionId, extract_type: "extract_text", selector: "body" }, testKey);
      if (!r.ok) return { error: `extract failed: ${r.error}` };
      if (!r.data?.data) return { error: "No data returned" };
      return true;
    });
    await runTest(base44, runId, "Staging MCP Black-Box Suite", "Staging MCP: browser_screenshot produces image", "Staging MCP Lifecycle", 2, async () => {
      if (!stagingConfigured || !sessionId) return { error: "No session" };
      const r = await callStagingMcp(base44, "browser_screenshot", { session_id: sessionId }, testKey);
      if (!r.ok) return { error: `screenshot failed: ${r.error}` };
      if (!r.data?.screenshot_url) return { error: "No screenshot_url returned" };
      return true;
    });
    await runTest(base44, runId, "Staging MCP Black-Box Suite", "Staging MCP: browser_end closes session", "Staging MCP Lifecycle", 2, async () => {
      if (!stagingConfigured || !sessionId) return { error: "No session" };
      const r = await callStagingMcp(base44, "browser_end", { session_id: sessionId }, testKey);
      if (!r.ok) return { error: `browser_end failed: ${r.error}` };
      if (!r.data?.success) return { error: "No success flag" };
      sessionId = null;
      return true;
    });

    await runTest(base44, runId, "Staging MCP Black-Box Suite", "Staging MCP: context_create creates context", "Staging MCP Context", 2, async () => {
      const r = await callStagingMcp(base44, "context_create", { name: "STG_MCP_CTX", cookies: [{ name: "test", value: "abc", domain: "example.com" }] }, testKey);
      if (!r.ok) return { error: `context_create failed: ${r.error}` };
      if (!r.data?.context_id) return { error: "No context_id" };
      contextId = r.data.context_id;
      return true;
    });
    await runTest(base44, runId, "Staging MCP Black-Box Suite", "Staging MCP: context_use returns decrypted state", "Staging MCP Context", 2, async () => {
      if (!contextId) return { error: "No context" };
      const r = await callStagingMcp(base44, "context_use", { context_id: contextId }, testKey);
      if (!r.ok) return { error: `context_use failed: ${r.error}` };
      if (!r.data?.cookies) return { error: "No cookies returned — decrypt failed" };
      return true;
    });
    await runTest(base44, runId, "Staging MCP Black-Box Suite", "Staging MCP: context_delete removes context", "Staging MCP Context", 2, async () => {
      if (!contextId) return { error: "No context" };
      const r = await callStagingMcp(base44, "context_delete", { context_id: contextId }, testKey);
      if (!r.ok) return { error: `context_delete failed: ${r.error}` };
      const r2 = await callStagingMcp(base44, "context_use", { context_id: contextId }, testKey);
      return !r2.ok ? true : { error: "Context still accessible after deletion" };
    });

    if (sessionId) await callStagingMcp(base44, "browser_end", { session_id: sessionId }, testKey);
    await base44.asServiceRole.entities.ApiKey.delete(keyRec.id).catch(() => {});

    const results = await base44.asServiceRole.entities.TestResult.filter({ run_id: runId });
    const total = results.length;
    const passed = results.filter((r) => r.status === "pass").length;
    const failed = results.filter((r) => r.status === "fail").length;
    const score = total > 0 ? Math.round((passed / total) * 100) : 0;

    return Response.json({
      suite: "Staging MCP Black-Box", run_id: runId, total_tests: total, passed, failed, score,
      staging_engine_configured: stagingConfigured, environment: "staging", __v: DEPLOYMENT_VERSION,
    });
  } catch (error) {
    return Response.json({ error: error.message, __v: DEPLOYMENT_VERSION }, { status: 500 });
  }
}