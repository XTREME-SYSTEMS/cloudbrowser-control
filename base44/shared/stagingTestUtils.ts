// ═══════════════════════════════════════════════
// Staging Test Utilities — staging-only test helpers.
// ADDITIVE: separate from production testUtils.ts (diff=0).
// callStagingGateway invokes the STAGING gateway (cloudBrowserGatewayStaging),
// which routes to the STAGING engine only. Production gateway is never touched.
// Shared primitives (hashKey/genKey/runTest) are imported directly from
// testUtils.ts by the suites that need them — not re-exported here.
// ═══════════════════════════════════════════════

export async function callStagingGateway(base44, payload) {
  try {
    const res = await base44.asServiceRole.functions.invoke("cloudBrowserGatewayStaging", payload);
    return { ok: res.status < 400, status: res.status, data: res.data, error: res.data?.error };
  } catch (e) {
    const status = e.status || e.response?.status || e.response?.statusCode || e.statusCode || 500;
    const data = e.data || e.response?.data || e.response?._data || {};
    return { ok: status < 400, status, data, error: data.error || e.message };
  }
}