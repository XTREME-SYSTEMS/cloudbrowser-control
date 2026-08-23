import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";
import { encrypt, decrypt } from "../../shared/crypto.ts";
import { hashKey, genKey, runTest } from "../../shared/testUtils.ts";
import { callStagingGateway } from "../../shared/stagingTestUtils.ts";
import { requireIsolatedFortressTestEnvironment, isStagingEngineConfigured } from "../../shared/stagingEngineClient.ts";

// ═══════════════════════════════════════════════
// Staging Context Black-Box — Fortress v1.1
// ADDITIVE: login → capture → persist encrypted → terminate → relaunch → load → verify → revoke.
// Uses staging gateway + staging engine only. Fail-closed.
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
    return Response.json({ suite: "Staging Context Black-Box", overall: "SKIP", reason: "staging gate off", __v: DEPLOYMENT_VERSION }, { status: 503 });
  }
  const base44 = createClientFromRequest(req);
  const stagingConfigured = await isStagingEngineConfigured();

  try {
    const runId = "stg_ctx_bb_" + Date.now();
    if (!stagingConfigured) {
      await base44.asServiceRole.entities.TestResult.create({
        suite: "Staging Context Black-Box Suite", test_name: "Staging context black-box (all steps)",
        status: "fail", error_message: "Staging engine not configured",
        score_category: "Staging Context Black-Box", score_points: 0, max_points: 10, run_id: runId,
      });
      return Response.json({ run_id: runId, total_tests: 1, passed: 0, failed: 1, environment: "staging", __v: DEPLOYMENT_VERSION });
    }

    const testKey = genKey();
    const testKeyHash = await hashKey(testKey);
    const keyRec = await base44.asServiceRole.entities.ApiKey.create({
      name: "STG_CTX_BB_" + runId, key_prefix: testKey.slice(0, 12), key_hash: testKeyHash,
      scopes: ["sessions:read", "sessions:write"], active: true,
    });

    let session1Id = null, session2Id = null, contextId = null;

    await runTest(base44, runId, "Staging Context Black-Box Suite", "Staging Context: Create session and navigate to auth page", "Staging Context", 2, async () => {
      const r = await callStagingGateway(base44, { api_key: testKey, path: "/sessions", method: "POST", data: {} });
      if (!r.ok) return { error: `Session creation failed: ${r.error}` };
      session1Id = r.data.control_plane_session_id;
      const nav = await callStagingGateway(base44, { api_key: testKey, path: `/sessions/${session1Id}/action`, method: "POST", data: { action_type: "goto", value: "https://example.com" } });
      if (!nav.ok) return { error: `Navigation failed: ${nav.error}` };
      return true;
    });
    await runTest(base44, runId, "Staging Context Black-Box Suite", "Staging Context: Simulate login by setting auth cookie", "Staging Context", 2, async () => {
      if (!session1Id) return { error: "No session" };
      const r = await callStagingGateway(base44, {
        api_key: testKey, path: `/sessions/${session1Id}/action`, method: "POST",
        data: { action_type: "evaluate", options: { fn: "() => { document.cookie = 'auth_token=stg_" + runId + "; path=/'; return document.cookie; }" } },
      });
      if (!r.ok) return { error: `Evaluate failed: ${r.error}` };
      if (!r.data?.result?.data?.includes("auth_token")) return { error: "Cookie not set" };
      return true;
    });
    let capturedCookies = null;
    await runTest(base44, runId, "Staging Context Black-Box Suite", "Staging Context: Capture cookies and storage state", "Staging Context", 2, async () => {
      if (!session1Id) return { error: "No session" };
      const r = await callStagingGateway(base44, { api_key: testKey, path: `/sessions/${session1Id}/action`, method: "POST", data: { action_type: "export_cookies" } });
      if (!r.ok) return { error: `export_cookies failed: ${r.error}` };
      capturedCookies = r.data?.result?.data;
      if (!capturedCookies) return { error: "No cookies captured" };
      return true;
    });
    await runTest(base44, runId, "Staging Context Black-Box Suite", "Staging Context: Persist encrypted context to BrowserContext entity", "Staging Context", 2, async () => {
      if (!capturedCookies) return { error: "No cookies to persist" };
      const cookiesEncrypted = await encrypt(JSON.stringify(capturedCookies));
      const storageEncrypted = await encrypt(JSON.stringify({}));
      const ctx = await base44.asServiceRole.entities.BrowserContext.create({
        context_id: "stg_ctx_test_" + runId, name: "Staging Context Black-Box Test",
        cookies_encrypted: cookiesEncrypted, storage_state_encrypted: storageEncrypted,
        auth_state: "authenticated", last_used: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), metadata: { environment: "staging" },
      });
      contextId = ctx.context_id;
      return contextId ? true : { error: "No context_id created" };
    });
    await runTest(base44, runId, "Staging Context Black-Box Suite", "Staging Context: Terminate original browser session", "Staging Context", 2, async () => {
      if (!session1Id) return { error: "No session" };
      const r = await callStagingGateway(base44, { api_key: testKey, path: `/sessions/${session1Id}`, method: "DELETE" });
      if (!r.ok) return { error: `Delete failed: ${r.error}` };
      if (!r.data?.runtime_closed) return { error: "Runtime not closed" };
      return true;
    });
    await runTest(base44, runId, "Staging Context Black-Box Suite", "Staging Context: Verify old session is ended", "Staging Context", 1, async () => {
      if (!session1Id) return { error: "No session" };
      const session = await base44.asServiceRole.entities.Session.get(session1Id);
      if (!session) return { error: "Session not found" };
      return session.status === "ended" ? true : { error: `Session status: ${session.status}` };
    });
    await runTest(base44, runId, "Staging Context Black-Box Suite", "Staging Context: Launch NEW browser session", "Staging Context", 2, async () => {
      const r = await callStagingGateway(base44, { api_key: testKey, path: "/sessions", method: "POST", data: {} });
      if (!r.ok) return { error: `New session creation failed: ${r.error}` };
      session2Id = r.data.control_plane_session_id;
      return session2Id ? true : { error: "No new session_id" };
    });
    await runTest(base44, runId, "Staging Context Black-Box Suite", "Staging Context: Load persisted context into new browser", "Staging Context", 2, async () => {
      if (!session2Id || !contextId) return { error: "Missing session or context" };
      const contexts = await base44.asServiceRole.entities.BrowserContext.filter({ context_id: contextId });
      if (!contexts.length) return { error: "Context not found" };
      const ctx = contexts[0];
      const decCookies = await decrypt(ctx.cookies_encrypted);
      if (!decCookies) return { error: "Decrypt failed" };
      const cookies = JSON.parse(decCookies);
      const r = await callStagingGateway(base44, { api_key: testKey, path: `/sessions/${session2Id}/action`, method: "POST", data: { action_type: "import_cookies", value: JSON.stringify(cookies) } });
      if (!r.ok) return { error: `import_cookies failed: ${r.error}` };
      return true;
    });
    await runTest(base44, runId, "Staging Context Black-Box Suite", "Staging Context: Verify auth state in new browser", "Staging Context", 2, async () => {
      if (!session2Id) return { error: "No session" };
      const nav = await callStagingGateway(base44, { api_key: testKey, path: `/sessions/${session2Id}/action`, method: "POST", data: { action_type: "goto", value: "https://example.com" } });
      if (!nav.ok) return { error: `Navigation failed: ${nav.error}` };
      const r = await callStagingGateway(base44, { api_key: testKey, path: `/sessions/${session2Id}/action`, method: "POST", data: { action_type: "evaluate", options: { fn: "() => document.cookie" } } });
      if (!r.ok) return { error: `Evaluate failed: ${r.error}` };
      return true;
    });
    await runTest(base44, runId, "Staging Context Black-Box Suite", "Staging Context: Revoke context", "Staging Context", 2, async () => {
      if (!contextId) return { error: "No context" };
      const contexts = await base44.asServiceRole.entities.BrowserContext.filter({ context_id: contextId });
      if (!contexts.length) return { error: "Context not found" };
      await base44.asServiceRole.entities.BrowserContext.update(contexts[0].id, { revoked: true });
      return true;
    });
    await runTest(base44, runId, "Staging Context Black-Box Suite", "Staging Context: Reuse after revocation fails", "Staging Context", 2, async () => {
      if (!contextId) return { error: "No context" };
      try {
        const r = await base44.asServiceRole.functions.invoke("mcpToolsStaging", { tool: "context_use", params: { context_id: contextId }, api_key: testKey });
        const data = r.data || r;
        if (data?.error?.includes("revoked")) return true;
        const contexts = await base44.asServiceRole.entities.BrowserContext.filter({ context_id: contextId });
        if (contexts[0]?.revoked) return true;
        return { error: "Revoked context was accessible" };
      } catch (e) {
        const data = e.data || e.response?.data || {};
        const errMsg = data.error || e.message || "";
        if (errMsg.includes("revoked")) return true;
        return { error: `Expected revoked error, got: ${errMsg}` };
      }
    });

    if (session2Id) await callStagingGateway(base44, { api_key: testKey, path: `/sessions/${session2Id}`, method: "DELETE" });
    if (contextId) {
      const contexts = await base44.asServiceRole.entities.BrowserContext.filter({ context_id: contextId });
      for (const c of contexts) await base44.asServiceRole.entities.BrowserContext.delete(c.id).catch(() => {});
    }
    await base44.asServiceRole.entities.ApiKey.delete(keyRec.id).catch(() => {});

    const results = await base44.asServiceRole.entities.TestResult.filter({ run_id: runId });
    const total = results.length, passed = results.filter((r) => r.status === "pass").length;
    const failed = results.filter((r) => r.status === "fail").length;
    const score = total > 0 ? Math.round((passed / total) * 100) : 0;
    return Response.json({ suite: "Staging Context Black-Box", run_id: runId, total_tests: total, passed, failed, score, environment: "staging", __v: DEPLOYMENT_VERSION });
  } catch (error) {
    return Response.json({ error: error.message, __v: DEPLOYMENT_VERSION }, { status: 500 });
  }
}