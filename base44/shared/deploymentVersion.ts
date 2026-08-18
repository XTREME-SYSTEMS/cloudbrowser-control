// ═══════════════════════════════════════════════
// Deployment Version Registry — v4.1.0
// Every critical function imports DEPLOYMENT_VERSION
// and includes it in responses as __v.
// getDeploymentStatus compares expected vs invoked __v
// to detect stale function cache / deployment drift.
//
// v4.1.0 changes:
//   - apiGateway: JWT-vs-API-key auth fix (only treat Authorization as
//     API key when it has cb_live_/cb_test_ prefix; otherwise use body.api_key)
//   - apiGateway: database-backed rate limiting via RateLimitEntry entity
//     (replaces in-memory Map that didn't persist across invocations)
// ═══════════════════════════════════════════════

export const DEPLOYMENT_VERSION = "v4.1.0";
export const DEPLOYED_AT = "2026-08-18T16:37:00Z";
export const SCHEMA_VERSION = "v3.1";

export const FUNCTION_REGISTRY = {
  apiGateway: "v4.1.0",
  runJob: "v4.0.0",
  engineAction: "v4.0.0",
  managePool: "v4.0.0",
  receiveWebhook: "v4.0.0",
  engineHealth: "v4.0.0",
  resumeSession: "v4.0.0",
  updateEngineConfig: "v4.0.0",
  runTestSuite: "v4.1.0",
  getDeploymentStatus: "v4.1.0",
};