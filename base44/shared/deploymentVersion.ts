// ═══════════════════════════════════════════════
// Deployment Version Registry — v4.1.1
// Every critical function imports DEPLOYMENT_VERSION
// and includes it in responses as __v.
// getDeploymentStatus compares expected vs invoked __v
// to detect stale function cache / deployment drift.
//
// v4.1.1 changes:
//   - apiGateway: fix circular JSON in POST /jobs/:id/run — spread result.data
//     instead of full response object (which contained non-serializable ClientRequest)
//
// v4.1.0 changes:
//   - apiGateway: JWT-vs-API-key auth fix (only treat Authorization as
//     API key when it has cb_live_/cb_test_ prefix; otherwise use body.api_key)
//   - apiGateway: database-backed rate limiting via RateLimitEntry entity
//     (replaces in-memory Map that didn't persist across invocations)
// ═══════════════════════════════════════════════

export const DEPLOYMENT_VERSION = "v4.1.1";
export const DEPLOYED_AT = "2026-08-18T20:55:00Z";
export const SCHEMA_VERSION = "v3.1";

export const FUNCTION_REGISTRY = {
  apiGateway: "v4.1.1",
  runJob: "v4.1.1",
  engineAction: "v4.1.1",
  managePool: "v4.1.1",
  receiveWebhook: "v4.1.1",
  engineHealth: "v4.1.1",
  resumeSession: "v4.1.1",
  updateEngineConfig: "v4.1.1",
  runTestSuite: "v4.1.1",
  getDeploymentStatus: "v4.1.1",
};