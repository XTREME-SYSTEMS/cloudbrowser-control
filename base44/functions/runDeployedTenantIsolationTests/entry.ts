import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";
import { hashKey, genKey, callGateway, runTest as runTestShared } from "../../shared/testUtils.ts";

// ═══════════════════════════════════════════════
// DEPLOYED Tenant Isolation Black-Box Test
// Tests the REAL deployed cloudBrowserGatewayV6.
// Service-role is used ONLY for setup/cleanup/evidence.
// All access-control execution goes through the deployed gateway.
// ═══════════════════════════════════════════════

async function runTest(base44, runId, testName, maxPoints, testFn) {
  return (await runTestShared(base44, runId, "Deployed Tenant Isolation", testName, "Deployed Tenant Isolation", maxPoints, testFn)).pass;
}

export default async function (req) {
  const base44 = createClientFromRequest(req);

  try {
    const runId = "deployed_tenant_" + Date.now();

    // ── Setup: Two projects, two API keys bound to different projects ──
    const projectA = await base44.asServiceRole.entities.Project.create({
      name: "DeployTenantA_" + runId, status: "active",
    });
    const projectB = await base44.asServiceRole.entities.Project.create({
      name: "DeployTenantB_" + runId, status: "active",
    });

    const keyA = genKey();
    const keyB = genKey();
    const hashA = await hashKey(keyA);
    const hashB = await hashKey(keyB);

    const keyRecA = await base44.asServiceRole.entities.ApiKey.create({
      name: "DEPLOY_TENANT_A_" + runId, key_prefix: keyA.slice(0, 12), key_hash: hashA,
      scopes: ["sessions:read", "sessions:write", "jobs:read", "jobs:write", "projects:read"],
      active: true, project_id: projectA.id,
    });
    const keyRecB = await base44.asServiceRole.entities.ApiKey.create({
      name: "DEPLOY_TENANT_B_" + runId, key_prefix: keyB.slice(0, 12), key_hash: hashB,
      scopes: ["sessions:read", "sessions:write", "jobs:read", "jobs:write", "projects:read"],
      active: true, project_id: projectB.id,
    });

    // ── Verify gateway identity is propagated ──
    await runTest(base44, runId, "Gateway identity propagated (V6)", 2, async () => {
      const r = await callGateway(base44, { api_key: keyA, path: "/health", method: "GET" });
      return r.data?.gateway === "cloudBrowserGatewayV6" ? true : { error: `Expected cloudBrowserGatewayV6, got ${r.data?.gateway || "MISSING"}` };
    });

    // ── Setup: Create sessions via service role (setup only, not access control) ──
    const sessionA = await base44.asServiceRole.entities.Session.create({
      status: "idle", project_id: projectA.id, target_url: "https://example.com",
      session_id: "runtime_test_a_" + runId,
    });
    const sessionB = await base44.asServiceRole.entities.Session.create({
      status: "idle", project_id: projectB.id, target_url: "https://example.com",
      session_id: "runtime_test_b_" + runId,
    });

    // ── Setup: Create jobs via the gateway (no engine needed for POST /jobs) ──
    let jobAId = null, jobBId = null;

    await runTest(base44, runId, "Setup: Key A creates Job A via gateway", 1, async () => {
      const r = await callGateway(base44, {
        api_key: keyA, path: "/jobs", method: "POST",
        data: { name: "Job A", start_url: "https://example.com", steps: [] },
      });
      if (r.ok && r.data?.job?.id) { jobAId = r.data.job.id; return true; }
      return { error: `Key A job creation failed: ${r.error}` };
    });

    await runTest(base44, runId, "Setup: Key B creates Job B via gateway", 1, async () => {
      const r = await callGateway(base44, {
        api_key: keyB, path: "/jobs", method: "POST",
        data: { name: "Job B", start_url: "https://example.com", steps: [] },
      });
      if (r.ok && r.data?.job?.id) { jobBId = r.data.job.id; return true; }
      return { error: `Key B job creation failed: ${r.error}` };
    });

    // ═══════════════════════════════════════════════
    // POSITIVE TESTS: Key A CAN access own resources via deployed gateway
    // ═══════════════════════════════════════════════

    await runTest(base44, runId, "POS: Key A can read own Session A", 2, async () => {
      const r = await callGateway(base44, { api_key: keyA, path: `/sessions/${sessionA.id}`, method: "GET" });
      return r.ok && r.data?.session ? true : { error: `Key A cannot read own session: ${r.error} (${r.status})` };
    });

    await runTest(base44, runId, "POS: Key A can list own sessions", 2, async () => {
      const r = await callGateway(base44, { api_key: keyA, path: "/sessions", method: "GET" });
      if (!r.ok) return { error: `Gateway error: ${r.error}` };
      const sessions = r.data?.sessions || [];
      const hasOwn = sessions.some((s) => s.id === sessionA.id);
      return hasOwn ? true : { error: "Key A cannot see own session in list" };
    });

    await runTest(base44, runId, "POS: Key A can read own Job A", 2, async () => {
      if (!jobAId) return { error: "No Job A" };
      const r = await callGateway(base44, { api_key: keyA, path: `/jobs/${jobAId}/results`, method: "GET" });
      return r.ok ? true : { error: `Key A cannot read own job: ${r.error} (${r.status})` };
    });

    await runTest(base44, runId, "POS: Key A can list own jobs", 1, async () => {
      const r = await callGateway(base44, { api_key: keyA, path: "/jobs", method: "GET" });
      if (!r.ok) return { error: `Gateway error: ${r.error}` };
      const jobs = r.data?.jobs || [];
      const hasOwn = jobs.some((j) => j.id === jobAId);
      return hasOwn ? true : { error: "Key A cannot see own job in list" };
    });

    await runTest(base44, runId, "POS: Key A can list own project", 1, async () => {
      const r = await callGateway(base44, { api_key: keyA, path: "/projects", method: "GET" });
      if (!r.ok) return { error: `Gateway error: ${r.error}` };
      const projects = r.data?.projects || [];
      const hasOwn = projects.some((p) => p.id === projectA.id);
      return hasOwn ? true : { error: "Key A cannot see own project" };
    });

    // ═══════════════════════════════════════════════
    // NEGATIVE TESTS: Key B CANNOT access Key A's resources via deployed gateway
    // ═══════════════════════════════════════════════

    await runTest(base44, runId, "NEG: Key B cannot read Session A (404)", 3, async () => {
      const r = await callGateway(base44, { api_key: keyB, path: `/sessions/${sessionA.id}`, method: "GET" });
      return r.status === 404 ? true : { error: `Expected 404, got ${r.status} — cross-tenant session read allowed` };
    });

    await runTest(base44, runId, "NEG: Key B cannot execute action on Session A (404)", 3, async () => {
      const r = await callGateway(base44, {
        api_key: keyB, path: `/sessions/${sessionA.id}/action`, method: "POST",
        data: { action_type: "screenshot" },
      });
      // Gateway must 404 BEFORE reaching the engine — project_id check happens first
      return r.status === 404 ? true : { error: `Expected 404, got ${r.status} — cross-tenant action allowed` };
    });

    await runTest(base44, runId, "NEG: Key B cannot delete Session A (404)", 3, async () => {
      const r = await callGateway(base44, { api_key: keyB, path: `/sessions/${sessionA.id}`, method: "DELETE" });
      return r.status === 404 ? true : { error: `Expected 404, got ${r.status} — cross-tenant delete allowed` };
    });

    await runTest(base44, runId, "NEG: Key B cannot read Job A results (404)", 3, async () => {
      if (!jobAId) return { error: "No Job A" };
      const r = await callGateway(base44, { api_key: keyB, path: `/jobs/${jobAId}/results`, method: "GET" });
      return r.status === 404 ? true : { error: `Expected 404, got ${r.status} — cross-tenant job read allowed` };
    });

    await runTest(base44, runId, "NEG: Key B cannot run Job A (404)", 3, async () => {
      if (!jobAId) return { error: "No Job A" };
      const r = await callGateway(base44, { api_key: keyB, path: `/jobs/${jobAId}/run`, method: "POST" });
      // Gateway must 404 BEFORE invoking runJob — project_id check happens first
      return r.status === 404 ? true : { error: `Expected 404, got ${r.status} — cross-tenant job run allowed` };
    });

    await runTest(base44, runId, "NEG: Key B cannot see Session A in listing", 2, async () => {
      const r = await callGateway(base44, { api_key: keyB, path: "/sessions", method: "GET" });
      if (!r.ok) return { error: `Gateway error: ${r.error}` };
      const sessions = r.data?.sessions || [];
      const leaked = sessions.some((s) => s.id === sessionA.id);
      return leaked ? { error: "Key B can see Session A in list — project filter failed" } : true;
    });

    await runTest(base44, runId, "NEG: Key B cannot see Job A in listing", 2, async () => {
      if (!jobAId) return { error: "No Job A" };
      const r = await callGateway(base44, { api_key: keyB, path: "/jobs", method: "GET" });
      if (!r.ok) return { error: `Gateway error: ${r.error}` };
      const jobs = r.data?.jobs || [];
      const leaked = jobs.some((j) => j.id === jobAId);
      return leaked ? { error: "Key B can see Job A in list — project filter failed" } : true;
    });

    await runTest(base44, runId, "NEG: Key B cannot see Project A in listing", 2, async () => {
      const r = await callGateway(base44, { api_key: keyB, path: "/projects", method: "GET" });
      if (!r.ok) return { error: `Gateway error: ${r.error}` };
      const projects = r.data?.projects || [];
      const leaked = projects.some((p) => p.id === projectA.id);
      return leaked ? { error: "Key B can see Project A in list — project filter failed" } : true;
    });

    // ═══════════════════════════════════════════════
    // REVERSE NEGATIVE: Key A cannot access Key B's resources
    // ═══════════════════════════════════════════════

    await runTest(base44, runId, "NEG: Key A cannot read Session B (404)", 2, async () => {
      const r = await callGateway(base44, { api_key: keyA, path: `/sessions/${sessionB.id}`, method: "GET" });
      return r.status === 404 ? true : { error: `Expected 404, got ${r.status} — reverse cross-tenant read allowed` };
    });

    await runTest(base44, runId, "NEG: Key A cannot read Job B results (404)", 2, async () => {
      if (!jobBId) return { error: "No Job B" };
      const r = await callGateway(base44, { api_key: keyA, path: `/jobs/${jobBId}/results`, method: "GET" });
      return r.status === 404 ? true : { error: `Expected 404, got ${r.status} — reverse cross-tenant job read allowed` };
    });

    // ── Cleanup ──
    await base44.asServiceRole.entities.Session.delete(sessionA.id).catch(() => {});
    await base44.asServiceRole.entities.Session.delete(sessionB.id).catch(() => {});
    if (jobAId) await base44.asServiceRole.entities.Job.delete(jobAId).catch(() => {});
    if (jobBId) await base44.asServiceRole.entities.Job.delete(jobBId).catch(() => {});
    await base44.asServiceRole.entities.ApiKey.delete(keyRecA.id).catch(() => {});
    await base44.asServiceRole.entities.ApiKey.delete(keyRecB.id).catch(() => {});
    await base44.asServiceRole.entities.Project.delete(projectA.id).catch(() => {});
    await base44.asServiceRole.entities.Project.delete(projectB.id).catch(() => {});

    // ── Score ──
    const results = await base44.asServiceRole.entities.TestResult.filter({ run_id: runId });
    const total = results.length;
    const passed = results.filter((r) => r.status === "pass").length;
    const failed = results.filter((r) => r.status === "fail").length;
    const negativeTests = results.filter((r) => r.test_name?.startsWith("NEG"));
    const negativePassed = negativeTests.filter((r) => r.status === "pass").length;
    const positiveTests = results.filter((r) => r.test_name?.startsWith("POS"));
    const positivePassed = positiveTests.filter((r) => r.status === "pass").length;

    return Response.json({
      run_id: runId, total_tests: total, passed, failed,
      negative_tests: { total: negativeTests.length, passed: negativePassed },
      positive_tests: { total: positiveTests.length, passed: positivePassed },
      deployed_tenant_isolation_verified: negativePassed === negativeTests.length && positivePassed === positiveTests.length,
      gateway_identity: "cloudBrowserGatewayV6",
      __v: DEPLOYMENT_VERSION,
    });
  } catch (error) {
    return Response.json({ error: error.message, __v: DEPLOYMENT_VERSION }, { status: 500 });
  }
}