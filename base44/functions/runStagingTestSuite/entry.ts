import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";
import {
  requireIsolatedFortressTestEnvironment, isStagingEngineConfigured, getStagingEngineKeyFingerprint,
} from "../../shared/stagingEngineClient.ts";
import { hashKey, genKey, runTest } from "../../shared/testUtils.ts";
import { callStagingGateway } from "../../shared/stagingTestUtils.ts";
import { secrets } from "base44:runtime";

// ═══════════════════════════════════════════════
// Staging Runtime Test Suite — Fortress v1.1
// ADDITIVE: runs the browser session-lifecycle lane against the STAGING engine
// via the staging gateway only. Production gateway + production engine are
// never invoked. Job/MCP/context lanes are deferred (require additive staging
// runJob/mcpTools).
// ═══════════════════════════════════════════════

export default async function (req) {
  const base44 = createClientFromRequest(req);

  // Fail-closed: refuse to run unless staging gate is on.
  if (!requireIsolatedFortressTestEnvironment()) {
    return Response.json({
      suite: "Staging Runtime Suite",
      overall: "SKIP",
      reason: "Staging gate OFF — requireIsolatedFortressTestEnvironment() false",
      __v: DEPLOYMENT_VERSION,
    }, { status: 503 });
  }

  const stagingConfigured = await isStagingEngineConfigured();
  const stagingFp = await getStagingEngineKeyFingerprint();

  try {
    const runId = "stg_run_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    const suite = "Staging Runtime Suite";
    const skipReason = stagingConfigured ? null : "Staging engine not configured — STAGING_ENGINE_URL/STAGING_ENGINE_API_KEY required";

    // ── Setup: full-scope test API key (control-plane only; used for staging gateway auth) ──
    const testKey = genKey();
    const testKeyHash = await hashKey(testKey);
    const keyRecord = await base44.asServiceRole.entities.ApiKey.create({
      name: "STG_TEST_" + runId, key_prefix: testKey.slice(0, 12), key_hash: testKeyHash,
      scopes: ["sessions:read", "sessions:write", "jobs:read", "jobs:write", "projects:read"], active: true,
    });

    // ═══════════════════════════════════════════════
    // SECTION 1 — Staging credential boundary
    // ═══════════════════════════════════════════════
    await runTest(base44, runId, suite, "Staging gate is ON (operator guards set)", "Staging Boundary", 2, async () => {
      return requireIsolatedFortressTestEnvironment() ? true : { error: "gate off" };
    });
    await runTest(base44, runId, suite, "Staging engine configured (STAGING_* secrets present)", "Staging Boundary", 2, async () => {
      return stagingConfigured ? true : { error: skipReason };
    });
    await runTest(base44, runId, suite, "Staging key fingerprint present (non-reversible)", "Staging Boundary", 1, async () => {
      return stagingFp && /^sha256:/.test(stagingFp) ? true : { error: "no staging fingerprint" };
    });

    // ═══════════════════════════════════════════════
    // SECTION 2 — Staging gateway access control
    // ═══════════════════════════════════════════════
    await runTest(base44, runId, suite, "Staging GET /health returns ok", "Staging Gateway", 2, async () => {
      const r = await callStagingGateway(base44, { api_key: testKey, path: "/health", method: "GET" });
      return r.ok && r.data?.status === "ok" && r.data?.gateway === "cloudBrowserGatewayStaging"
        ? true : { error: `Expected ok/cloudBrowserGatewayStaging, got ${r.error || r.status} | gateway=${r.data?.gateway}` };
    });
    await runTest(base44, runId, suite, "Staging missing API key rejected (401)", "Staging Gateway", 2, async () => {
      const r = await callStagingGateway(base44, { path: "/sessions", method: "GET" });
      return r.status === 401 ? true : { error: `Expected 401, got ${r.status}` };
    });
    await runTest(base44, runId, suite, "Staging invalid API key rejected (401)", "Staging Gateway", 2, async () => {
      const r = await callStagingGateway(base44, { api_key: "cb_live_invalid", path: "/sessions", method: "GET" });
      return r.status === 401 ? true : { error: `Expected 401, got ${r.status}` };
    });
    await runTest(base44, runId, suite, "Staging job-run routes through staging gateway (no production runJob cross-contamination)", "Staging Gateway", 2, async () => {
      // The job-run route is handled by the staging gateway → runJobStaging, never production runJob.
      // Proof: the response carries the staging gateway identity. A bogus job ID yields 404/500 but
      // must still come from cloudBrowserGatewayStaging.
      const r = await callStagingGateway(base44, { api_key: testKey, path: "/jobs/block_test/run", method: "POST" });
      return r.data?.gateway === "cloudBrowserGatewayStaging" ? true : { error: `Expected staging gateway identity, got gateway=${r.data?.gateway} status=${r.status}` };
    });

    // ═══════════════════════════════════════════════
    // SECTION 3 — Staging runtime session lifecycle (real staging Chromium)
    // ═══════════════════════════════════════════════
    let controlPlaneSessionId = null;

    await runTest(base44, runId, suite, "Staging POST /sessions creates real browser (non-null runtime_session_id)", "Staging Session", 4, async () => {
      if (!stagingConfigured) return { error: skipReason };
      const r = await callStagingGateway(base44, { api_key: testKey, path: "/sessions", method: "POST", data: { target_url: "https://example.com" } });
      if (!r.ok) return { error: `Gateway error: ${r.error}` };
      const rtId = r.data?.runtime_session_id;
      const cpId = r.data?.control_plane_session_id;
      if (!rtId) return { error: "runtime_session_id is null — no real staging browser created" };
      controlPlaneSessionId = cpId;
      return true;
    });

    await runTest(base44, runId, suite, "Staging action goto navigates real Chromium", "Staging Session", 4, async () => {
      if (!stagingConfigured || !controlPlaneSessionId) return { error: skipReason || "No session" };
      const r = await callStagingGateway(base44, {
        api_key: testKey, path: `/sessions/${controlPlaneSessionId}/action`, method: "POST",
        data: { action_type: "goto", value: "https://example.com" },
      });
      if (!r.ok) return { error: `Action failed: ${r.error}` };
      const url = r.data?.result?.url;
      if (!url || !url.includes("example.com")) return { error: `Navigation did not reach example.com — got url: ${url}` };
      return true;
    });

    await runTest(base44, runId, suite, "Staging screenshot produces artifact base64", "Staging Session", 3, async () => {
      if (!stagingConfigured || !controlPlaneSessionId) return { error: skipReason || "No session" };
      const r = await callStagingGateway(base44, {
        api_key: testKey, path: `/sessions/${controlPlaneSessionId}/action`, method: "POST",
        data: { action_type: "screenshot" },
      });
      if (!r.ok) return { error: `Screenshot failed: ${r.error}` };
      const b64 = r.data?.result?.base64;
      if (!b64 || b64.length < 100) return { error: "No screenshot base64 returned from staging browser" };
      return true;
    });

    await runTest(base44, runId, suite, "Staging evaluate executes JavaScript in Chromium", "Staging Session", 3, async () => {
      if (!stagingConfigured || !controlPlaneSessionId) return { error: skipReason || "No session" };
      const r = await callStagingGateway(base44, {
        api_key: testKey, path: `/sessions/${controlPlaneSessionId}/action`, method: "POST",
        data: { action_type: "evaluate", options: { fn: "() => 1 + 1" } },
      });
      if (!r.ok) return { error: `Evaluate failed: ${r.error}` };
      if (r.data?.result?.data !== 2) return { error: `Expected 2, got ${r.data?.result?.data}` };
      return true;
    });

    await runTest(base44, runId, suite, "Staging extract_text returns page text", "Staging Session", 3, async () => {
      if (!stagingConfigured || !controlPlaneSessionId) return { error: skipReason || "No session" };
      const r = await callStagingGateway(base44, {
        api_key: testKey, path: `/sessions/${controlPlaneSessionId}/action`, method: "POST",
        data: { action_type: "extract_text", selector: "body" },
      });
      if (!r.ok) return { error: `Extract failed: ${r.error}` };
      if (!r.data?.result?.data || r.data.result.data.length < 10) return { error: "No real text extracted from staging browser" };
      return true;
    });

    await runTest(base44, runId, suite, "Staging DELETE closes real browser (idempotent)", "Staging Session", 3, async () => {
      if (!stagingConfigured || !controlPlaneSessionId) return { error: skipReason || "No session" };
      const r = await callStagingGateway(base44, { api_key: testKey, path: `/sessions/${controlPlaneSessionId}`, method: "DELETE" });
      if (!r.ok) return { error: `Delete failed: ${r.error}` };
      if (!r.data?.runtime_closed) return { error: "Staging runtime was not closed" };
      const r2 = await callStagingGateway(base44, { api_key: testKey, path: `/sessions/${controlPlaneSessionId}`, method: "DELETE" });
      return r2.ok ? true : { error: "Second delete not idempotent on staging" };
    });

    // ═══════════════════════════════════════════════
    // SECTION 4 — Staging SSRF protection
    // ═══════════════════════════════════════════════
    await runTest(base44, runId, suite, "Staging SSRF: goto to localhost rejected by staging engine", "Staging Security", 3, async () => {
      if (!stagingConfigured) return { error: skipReason };
      const sr = await callStagingGateway(base44, { api_key: testKey, path: "/sessions", method: "POST", data: {} });
      if (!sr.ok) return { error: "Cannot create staging session for SSRF test" };
      const cpId = sr.data.control_plane_session_id;
      const r = await callStagingGateway(base44, {
        api_key: testKey, path: `/sessions/${cpId}/action`, method: "POST",
        data: { action_type: "goto", value: "http://127.0.0.1:8080/health" },
      });
      await callStagingGateway(base44, { api_key: testKey, path: `/sessions/${cpId}`, method: "DELETE" });
      if (r.ok && r.data?.result?.url?.includes("127.0.0.1")) return { error: "SSRF: localhost navigation was allowed on staging engine" };
      return true;
    });

    // ═══════════════════════════════════════════════
    // SECTION 5 — Staging capability truth
    // ═══════════════════════════════════════════════
    await runTest(base44, runId, suite, "Staging capability truth: evaluate returns expected value", "Staging Capability", 2, async () => {
      if (!stagingConfigured) return { error: skipReason };
      const sr = await callStagingGateway(base44, { api_key: testKey, path: "/sessions", method: "POST", data: {} });
      if (!sr.ok) return { error: "Cannot create staging session" };
      const cpId = sr.data.control_plane_session_id;
      const r = await callStagingGateway(base44, {
        api_key: testKey, path: `/sessions/${cpId}/action`, method: "POST",
        data: { action_type: "evaluate", options: { fn: "() => 'capability_verified_staging'" } },
      });
      await callStagingGateway(base44, { api_key: testKey, path: `/sessions/${cpId}`, method: "DELETE" });
      if (!r.ok || r.data?.result?.data !== "capability_verified_staging") return { error: "evaluate action not implemented in staging runtime" };
      return true;
    });

    // ── Cleanup ──
    await base44.asServiceRole.entities.ApiKey.delete(keyRecord.id).catch(() => {});

    // ── Score ──
    const results = await base44.asServiceRole.entities.TestResult.filter({ run_id: runId });
    const total = results.length;
    const passed = results.filter((r) => r.status === "pass").length;
    const failed = results.filter((r) => r.status === "fail").length;
    const pointsEarned = results.reduce((s, r) => s + (r.score_points || 0), 0);
    const maxPoints = results.reduce((s, r) => s + (r.max_points || 0), 0);
    const score = maxPoints > 0 ? Math.round((pointsEarned / maxPoints) * 100) : 0;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

    const categories = {};
    for (const r of results) {
      if (!categories[r.score_category]) categories[r.score_category] = { total: 0, passed: 0 };
      categories[r.score_category].total++;
      if (r.status === "pass") categories[r.score_category].passed++;
    }

    return Response.json({
      suite, run_id: runId, total_tests: total, passed, failed,
      pass_rate: passRate, score,
      staging_engine_configured: stagingConfigured,
      staging_key_fingerprint: stagingFp,
      environment: "staging",
      categories,
      __v: DEPLOYMENT_VERSION,
    });
  } catch (error) {
    return Response.json({ error: error.message, __v: DEPLOYMENT_VERSION }, { status: 500 });
  }
}