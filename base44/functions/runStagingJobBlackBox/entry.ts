import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";
import { hashKey, genKey, runTest } from "../../shared/testUtils.ts";
import { callStagingGateway } from "../../shared/stagingTestUtils.ts";
import { requireIsolatedFortressTestEnvironment, isStagingEngineConfigured } from "../../shared/stagingEngineClient.ts";

// ═══════════════════════════════════════════════
// Staging Job Black-Box — Fortress v1.1
// ADDITIVE: creates a job + steps, runs via staging gateway (→ runJobStaging),
// verifies completed status + real screenshots. Fail-closed.
// ═══════════════════════════════════════════════

export default async function (req) {
  if (!requireIsolatedFortressTestEnvironment()) {
    return Response.json({ suite: "Staging Job Black-Box", overall: "SKIP", reason: "staging gate off", __v: DEPLOYMENT_VERSION }, { status: 503 });
  }
  const base44 = createClientFromRequest(req);
  const stagingConfigured = await isStagingEngineConfigured();

  try {
    const runId = "stg_job_bb_" + Date.now();
    const testKey = genKey();
    const testKeyHash = await hashKey(testKey);
    const keyRec = await base44.asServiceRole.entities.ApiKey.create({
      name: "STG_JOB_BB_" + runId, key_prefix: testKey.slice(0, 12), key_hash: testKeyHash,
      scopes: ["sessions:read", "sessions:write", "jobs:read", "jobs:write"], active: true,
    });

    let createdJobId = null;

    await runTest(base44, runId, "Staging Job Black-Box Suite", "Staging Job: POST /jobs creates job with steps", "Staging Jobs", 2, async () => {
      const r = await callStagingGateway(base44, { api_key: testKey, path: "/jobs", method: "POST", data: {
        name: "Staging Test Job", start_url: "https://example.com",
        steps: [{ action_type: "goto", value: "https://example.com" }, { action_type: "screenshot" }],
      }});
      if (r.ok && r.data?.job?.id) { createdJobId = r.data.job.id; return true; }
      return { error: `Expected job.id, got ${r.error || r.status}` };
    });

    await runTest(base44, runId, "Staging Job Black-Box Suite", "Staging Job: POST /jobs/:id/run executes real browser job end-to-end", "Staging Jobs", 5, async () => {
      if (!stagingConfigured) return { error: "Staging engine not configured" };
      if (!createdJobId) return { error: "No job to run" };
      const r = await callStagingGateway(base44, { api_key: testKey, path: `/jobs/${createdJobId}/run`, method: "POST" });
      if (!r.ok) return { error: `Job run failed (${r.status}): ${r.error}` };
      const job = await base44.asServiceRole.entities.Job.get(createdJobId);
      if (!job) return { error: "Job not found after run" };
      if (job.status !== "completed") return { error: `Job did not complete — status: ${job.status}, error: ${job.error_message || "none"}` };
      if (!job.session_id) return { error: "No session_id on job — real staging browser session was not created" };
      const session = await base44.asServiceRole.entities.Session.get(job.session_id);
      if (!session) return { error: "Session entity not found" };
      if (!session.session_id) return { error: "No runtime session ID — staging engine did not create a real browser" };
      const screenshots = await base44.asServiceRole.entities.Screenshot.filter({ job_id: createdJobId });
      if (screenshots.length === 0) return { error: "No screenshots produced — staging job did not execute real browser actions" };
      if (session.status !== "ended") return { error: `Staging session not cleaned up — status: ${session.status}` };
      return true;
    });

    await runTest(base44, runId, "Staging Job Black-Box Suite", "Staging Job: GET /jobs/:id/results returns results array", "Staging Jobs", 1, async () => {
      if (!createdJobId) return { error: "No job" };
      const r = await callStagingGateway(base44, { api_key: testKey, path: `/jobs/${createdJobId}/results`, method: "GET" });
      return r.ok && Array.isArray(r.data?.results) ? true : { error: `Expected results array, got ${r.error}` };
    });

    // Cleanup
    if (createdJobId) {
      const steps = await base44.asServiceRole.entities.Step.filter({ job_id: createdJobId });
      for (const s of steps) await base44.asServiceRole.entities.Step.delete(s.id).catch(() => {});
      const screenshots = await base44.asServiceRole.entities.Screenshot.filter({ job_id: createdJobId });
      for (const sc of screenshots) await base44.asServiceRole.entities.Screenshot.delete(sc.id).catch(() => {});
      const results = await base44.asServiceRole.entities.Result.filter({ job_id: createdJobId });
      for (const rs of results) await base44.asServiceRole.entities.Result.delete(rs.id).catch(() => {});
      const job = await base44.asServiceRole.entities.Job.get(createdJobId);
      if (job?.session_id) await base44.asServiceRole.entities.Session.delete(job.session_id).catch(() => {});
      await base44.asServiceRole.entities.Job.delete(createdJobId).catch(() => {});
    }
    await base44.asServiceRole.entities.ApiKey.delete(keyRec.id).catch(() => {});

    const allResults = await base44.asServiceRole.entities.TestResult.filter({ run_id: runId });
    const total = allResults.length, passed = allResults.filter((r) => r.status === "pass").length;
    const failed = allResults.filter((r) => r.status === "fail").length;
    const score = total > 0 ? Math.round((passed / total) * 100) : 0;
    return Response.json({ suite: "Staging Job Black-Box", run_id: runId, total_tests: total, passed, failed, score, environment: "staging", __v: DEPLOYMENT_VERSION });
  } catch (error) {
    return Response.json({ error: error.message, __v: DEPLOYMENT_VERSION }, { status: 500 });
  }
}