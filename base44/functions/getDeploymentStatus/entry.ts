import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { DEPLOYMENT_VERSION, DEPLOYED_AT, SCHEMA_VERSION, FUNCTION_REGISTRY } from "../../shared/deploymentVersion.ts";

// ═══════════════════════════════════════════════
// Deployment Status — detects stale function cache / drift
// Invokes each critical function and compares __v
// to the expected version from FUNCTION_REGISTRY.
// ═══════════════════════════════════════════════

async function invokeForVersion(base44, functionName, payload) {
  try {
    const res = await base44.asServiceRole.functions.invoke(functionName, payload);
    return { status: res.status, __v: res.data?.__v };
  } catch (e) {
    const data = e.data || e.response?.data || e.response?._data || {};
    return { status: e.status || e.response?.status || 500, __v: data.__v };
  }
}

const TEST_PAYLOADS = {
  apiGateway: { path: "/health", method: "GET", api_key: "deployment_check" },
  runJob: { jobId: "deployment_check_nonexistent" },
  engineAction: { action: "deployment_check" },
  managePool: {},
  receiveWebhook: {},
  engineHealth: {},
  resumeSession: { resume_token: "deployment_check" },
  updateEngineConfig: {},
};

export default async function (req) {
  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const matrix = {};
    let driftCount = 0;

    for (const [fnName, expectedVersion] of Object.entries(FUNCTION_REGISTRY)) {
      if (fnName === "getDeploymentStatus" || fnName === "runTestSuite") continue;
      const payload = TEST_PAYLOADS[fnName] || {};
      const result = await invokeForVersion(base44, fnName, payload);
      const invokedVersion = result.__v || "MISSING";
      const isCurrent = invokedVersion === expectedVersion;
      if (!isCurrent) driftCount++;
      matrix[fnName] = {
        expected: expectedVersion,
        invoked: invokedVersion,
        status: isCurrent ? "CURRENT" : "DRIFT",
        http_status: result.status,
      };
    }

    return Response.json({
      __v: DEPLOYMENT_VERSION,
      deployment_version: DEPLOYMENT_VERSION,
      deployed_at: DEPLOYED_AT,
      schema_version: SCHEMA_VERSION,
      matrix,
      drift_count: driftCount,
      overall_status: driftCount === 0 ? "NO_DRIFT" : "DEPLOYMENT_DRIFT",
    });
  } catch (error) {
    return Response.json({ error: error.message, __v: DEPLOYMENT_VERSION }, { status: 500 });
  }
}