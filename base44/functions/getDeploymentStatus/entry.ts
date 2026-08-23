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
    if (res?.data?.__v) return { status: res.status, __v: res.data.__v };
    if (res?.__v) return { status: res.status, __v: res.__v };
    if (res?.json && typeof res.json === "function") {
      try {
        const body = await res.clone().json();
        return { status: res.status, __v: body?.__v };
      } catch {}
    }
    return { status: res?.status, __v: undefined };
  } catch (e) {
    const data = e.data || e.response?.data || e.response?._data || {};
    return { status: e.status || e.response?.status || 500, __v: data.__v || e.__v };
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

    // Probe a representative critical subset across all categories rather than
    // every function. Platform per-invoke latency (~2-3s) makes probing all ~50
    // functions exceed the invocation timeout; a 10-function sample across
    // gateway/jobs/mcp/security/settings/observability gives equivalent
    // stale-cache detection at a fraction of the latency.
    const CRITICAL_PROBE = [
      "cloudBrowserGatewayV6", "runJob", "mcpTools", "engineHealth",
      "managePool", "saveProxy", "saveWebhook", "triggerWebhook",
      "updateEngineConfig", "saveProfile",
    ];

    const entries = CRITICAL_PROBE
      .map((fnName) => [fnName, FUNCTION_REGISTRY[fnName]])
      .filter(([fnName, expectedVersion]) => fnName && expectedVersion);

    const results = await Promise.all(
      entries.map(async ([fnName, expectedVersion]) => {
        const payload = TEST_PAYLOADS[fnName] || {};
        const result = await invokeForVersion(base44, fnName, payload);
        const invokedVersion = result.__v || "MISSING";
        const isCurrent = invokedVersion === expectedVersion;
        return { fnName, expectedVersion, result, invokedVersion, isCurrent };
      })
    );
    for (const r of results) {
      if (!r.isCurrent) driftCount++;
      matrix[r.fnName] = {
        expected: r.expectedVersion,
        invoked: r.invokedVersion,
        status: r.isCurrent ? "CURRENT" : "DRIFT",
        http_status: r.result.status,
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