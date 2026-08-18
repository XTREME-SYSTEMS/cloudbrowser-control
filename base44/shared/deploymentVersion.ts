// ═══════════════════════════════════════════════
// Deployment Version Registry — v4.0.0
// Every critical function imports DEPLOYMENT_VERSION
// and includes it in responses as __v.
// getDeploymentStatus compares expected vs invoked __v
// to detect stale function cache / deployment drift.
// ═══════════════════════════════════════════════

export const DEPLOYMENT_VERSION = "v4.0.0";
export const DEPLOYED_AT = "2026-08-18T16:37:00Z";
export const SCHEMA_VERSION = "v3.0";

export const FUNCTION_REGISTRY = {
  apiGateway: "v4.0.0",
  runJob: "v4.0.0",
  engineAction: "v4.0.0",
  managePool: "v4.0.0",
  receiveWebhook: "v4.0.0",
  engineHealth: "v4.0.0",
  resumeSession: "v4.0.0",
  updateEngineConfig: "v4.0.0",
  runTestSuite: "v4.0.0",
  getDeploymentStatus: "v4.0.0",
};