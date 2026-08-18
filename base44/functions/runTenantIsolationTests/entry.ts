import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";
import { hashKey, genKey, callGateway, runTest as runTestShared } from "../../shared/testUtils.ts";

// ═══════════════════════════════════════════════
// Tenant Isolation Test Suite — Phase 4
// Adversarial tests proving Tenant A cannot access Tenant B's data.
// Tests are DESIGNED to run after RLS activation.
// Before RLS: tests will FAIL (expected — documents the gap).
// After RLS: tests must PASS (proves isolation).
// ═══════════════════════════════════════════════

async function runTest(base44, runId, testName, maxPoints, testFn) {
  return (await runTestShared(base44, runId, "Tenant Isolation Suite", testName, "Tenant Isolation", maxPoints, testFn)).pass;
}

export default async function (req) {
  const base44 = createClientFromRequest(req);

  try {
    const runId = "tenant_iso_" + Date.now();

    // Create two API keys with different project_ids (simulating two tenants)
    const tenantAKey = genKey();
    const tenantBKey = genKey();
    const tenantAHash = await hashKey(tenantAKey);
    const tenantBHash = await hashKey(tenantBKey);

    // Create two projects
    const projectA = await base44.asServiceRole.entities.Project.create({
      name: "Tenant A Project", status: "active",
    });
    const projectB = await base44.asServiceRole.entities.Project.create({
      name: "Tenant B Project", status: "active",
    });

    const keyA = await base44.asServiceRole.entities.ApiKey.create({
      name: "TENANT_A_" + runId, key_prefix: tenantAKey.slice(0, 12), key_hash: tenantAHash,
      scopes: ["sessions:read", "sessions:write", "jobs:read", "jobs:write", "projects:read"],
      active: true, project_id: projectA.id,
    });
    const keyB = await base44.asServiceRole.entities.ApiKey.create({
      name: "TENANT_B_" + runId, key_prefix: tenantBKey.slice(0, 12), key_hash: tenantBHash,
      scopes: ["sessions:read", "sessions:write", "jobs:read", "jobs:write", "projects:read"],
      active: true, project_id: projectB.id,
    });

    // ── Tenant A creates resources ──
    let tenantASessionId = null;
    let tenantAJobId = null;
    let tenantAArtifactId = null;
    let tenantAContextId = null;

    await runTest(base44, runId, "Setup: Tenant A creates session", 1, async () => {
      const r = await callGateway(base44, { api_key: tenantAKey, path: "/sessions", method: "POST", data: {} });
      if (!r.ok) return { error: `Tenant A session creation failed: ${r.error}` };
      tenantASessionId = r.data.control_plane_session_id;
      return true;
    });

    await runTest(base44, runId, "Setup: Tenant A creates job", 1, async () => {
      const r = await callGateway(base44, {
        api_key: tenantAKey, path: "/jobs", method: "POST",
        data: { name: "Tenant A Job", start_url: "https://example.com", steps: [] },
      });
      if (!r.ok) return { error: `Tenant A job creation failed: ${r.error}` };
      tenantAJobId = r.data.job.id;
      return true;
    });

    await runTest(base44, runId, "Setup: Tenant A creates artifact", 1, async () => {
      const art = await base44.asServiceRole.entities.Artifact.create({
        artifact_id: "tenant_a_art_" + runId, type: "json", storage_key: "tenant_a_key",
        content_hash: "abc123", access_policy: "private", retention_days: 30,
        project_id: projectA.id,
      });
      tenantAArtifactId = art.artifact_id;
      return true;
    });

    await runTest(base44, runId, "Setup: Tenant A creates context", 1, async () => {
      const ctx = await base44.asServiceRole.entities.BrowserContext.create({
        context_id: "tenant_a_ctx_" + runId, name: "Tenant A Context",
        project_id: projectA.id, auth_state: "authenticated",
      });
      tenantAContextId = ctx.context_id;
      return true;
    });

    // ═══════════════════════════════════════════════
    // NEGATIVE TESTS: Tenant B tries to access Tenant A's resources
    // These should FAIL (access denied) after RLS activation
    // ═══════════════════════════════════════════════

    await runTest(base44, runId, "NEG: Tenant B cannot read Tenant A session", 2, async () => {
      if (!tenantASessionId) return { error: "No Tenant A session" };
      const r = await callGateway(base44, { api_key: tenantBKey, path: `/sessions/${tenantASessionId}`, method: "GET" });
      // After RLS: should get 404 or empty result
      // Before RLS: will get 200 (the session data) — this is the security gap
      return r.status === 404 || !r.data?.session ? true : { error: `Tenant B accessed Tenant A session (status: ${r.status}) — RLS not active` };
    });

    await runTest(base44, runId, "NEG: Tenant B cannot execute action on Tenant A session", 2, async () => {
      if (!tenantASessionId) return { error: "No Tenant A session" };
      const r = await callGateway(base44, {
        api_key: tenantBKey, path: `/sessions/${tenantASessionId}/action`, method: "POST",
        data: { action_type: "screenshot" },
      });
      return r.status === 403 || r.status === 404 ? true : { error: `Tenant B executed action on Tenant A session (status: ${r.status}) — RLS not active` };
    });

    await runTest(base44, runId, "NEG: Tenant B cannot close Tenant A session", 2, async () => {
      if (!tenantASessionId) return { error: "No Tenant A session" };
      const r = await callGateway(base44, { api_key: tenantBKey, path: `/sessions/${tenantASessionId}`, method: "DELETE" });
      return r.status === 403 || r.status === 404 ? true : { error: `Tenant B closed Tenant A session (status: ${r.status}) — RLS not active` };
    });

    await runTest(base44, runId, "NEG: Tenant B cannot read Tenant A job", 2, async () => {
      if (!tenantAJobId) return { error: "No Tenant A job" };
      // Try to read job results via gateway
      const r = await callGateway(base44, { api_key: tenantBKey, path: `/jobs/${tenantAJobId}/results`, method: "GET" });
      // After RLS: should get 404 or empty
      return r.status === 404 || (r.data?.results?.length === 0) ? true : { error: `Tenant B accessed Tenant A job results — RLS not active` };
    });

    await runTest(base44, runId, "NEG: Tenant B cannot read Tenant A artifact", 2, async () => {
      if (!tenantAArtifactId) return { error: "No Tenant A artifact" };
      try {
        const r = await base44.asServiceRole.functions.invoke("mcpTools", {
          tool: "artifact_get", params: { artifact_id: tenantAArtifactId }, api_key: tenantBKey,
        });
        const data = r.data || r;
        return data?.error?.includes("denied") || data?.error?.includes("not found") ? true : { error: "Tenant B accessed Tenant A artifact — RLS not active" };
      } catch (e) {
        const data = e.data || {};
        return data.error?.includes("denied") || data.error?.includes("not found") ? true : { error: `Tenant B accessed artifact: ${data.error}` };
      }
    });

    await runTest(base44, runId, "NEG: Tenant B cannot use Tenant A context", 2, async () => {
      if (!tenantAContextId) return { error: "No Tenant A context" };
      try {
        const r = await base44.asServiceRole.functions.invoke("mcpTools", {
          tool: "context_use", params: { context_id: tenantAContextId }, api_key: tenantBKey,
        });
        const data = r.data || r;
        return data?.error?.includes("not found") || data?.error?.includes("denied") ? true : { error: "Tenant B used Tenant A context — RLS not active" };
      } catch (e) {
        const data = e.data || {};
        return data.error?.includes("not found") || data.error?.includes("denied") ? true : { error: `Tenant B used context: ${data.error}` };
      }
    });

    await runTest(base44, runId, "NEG: Tenant B cannot list Tenant A sessions", 1, async () => {
      const r = await callGateway(base44, { api_key: tenantBKey, path: "/sessions", method: "GET" });
      if (!r.ok) return { error: `Gateway error: ${r.error}` };
      const sessions = r.data?.sessions || [];
      // After RLS: Tenant B should only see their own sessions, not Tenant A's
      const hasTenantA = sessions.some((s) => s.id === tenantASessionId);
      return !hasTenantA ? true : { error: "Tenant B can see Tenant A sessions in list — RLS not active" };
    });

    await runTest(base44, runId, "NEG: Tenant B cannot list Tenant A jobs", 1, async () => {
      const r = await callGateway(base44, { api_key: tenantBKey, path: "/jobs", method: "GET" });
      if (!r.ok) return { error: `Gateway error: ${r.error}` };
      const jobs = r.data?.jobs || [];
      const hasTenantA = jobs.some((j) => j.id === tenantAJobId);
      return !hasTenantA ? true : { error: "Tenant B can see Tenant A jobs in list — RLS not active" };
    });

    // ═══════════════════════════════════════════════
    // POSITIVE TESTS: Same-tenant operations work
    // ═══════════════════════════════════════════════

    await runTest(base44, runId, "POS: Tenant A can read own session", 1, async () => {
      if (!tenantASessionId) return { error: "No Tenant A session" };
      const r = await callGateway(base44, { api_key: tenantAKey, path: `/sessions/${tenantASessionId}`, method: "GET" });
      return r.ok && r.data?.session ? true : { error: `Tenant A cannot read own session: ${r.error}` };
    });

    await runTest(base44, runId, "POS: Tenant A can list own sessions", 1, async () => {
      const r = await callGateway(base44, { api_key: tenantAKey, path: "/sessions", method: "GET" });
      if (!r.ok) return { error: `Gateway error: ${r.error}` };
      const sessions = r.data?.sessions || [];
      const hasOwn = sessions.some((s) => s.id === tenantASessionId);
      return hasOwn ? true : { error: "Tenant A cannot see own session in list" };
    });

    await runTest(base44, runId, "POS: Tenant A can list own jobs", 1, async () => {
      const r = await callGateway(base44, { api_key: tenantAKey, path: "/jobs", method: "GET" });
      if (!r.ok) return { error: `Gateway error: ${r.error}` };
      const jobs = r.data?.jobs || [];
      const hasOwn = jobs.some((j) => j.id === tenantAJobId);
      return hasOwn ? true : { error: "Tenant A cannot see own job in list" };
    });

    // ── Cleanup ──
    if (tenantASessionId) {
      await callGateway(base44, { api_key: tenantAKey, path: `/sessions/${tenantASessionId}`, method: "DELETE" });
    }
    if (tenantAJobId) await base44.asServiceRole.entities.Job.delete(tenantAJobId).catch(() => {});
    if (tenantAArtifactId) {
      const arts = await base44.asServiceRole.entities.Artifact.filter({ artifact_id: tenantAArtifactId });
      for (const a of arts) await base44.asServiceRole.entities.Artifact.delete(a.id).catch(() => {});
    }
    if (tenantAContextId) {
      const ctxs = await base44.asServiceRole.entities.BrowserContext.filter({ context_id: tenantAContextId });
      for (const c of ctxs) await base44.asServiceRole.entities.BrowserContext.delete(c.id).catch(() => {});
    }
    await base44.asServiceRole.entities.ApiKey.delete(keyA.id).catch(() => {});
    await base44.asServiceRole.entities.ApiKey.delete(keyB.id).catch(() => {});
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
      rls_active: negativePassed === negativeTests.length,
      __v: DEPLOYMENT_VERSION,
    });
  } catch (error) {
    return Response.json({ error: error.message, __v: DEPLOYMENT_VERSION }, { status: 500 });
  }
}