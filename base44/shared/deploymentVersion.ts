// ═══════════════════════════════════════════════
// Deployment Version Registry — v5.0.0
// Every critical function imports DEPLOYMENT_VERSION
// and includes it in responses as __v.
// getDeploymentStatus compares expected vs invoked __v
// to detect stale function cache / deployment drift.
//
// v5.0.0 changes (Master Release Hardening):
//   - Secret migration: Proxy.password → password_encrypted (AES-GCM)
//   - Secret migration: Webhook.secret → secret_encrypted (AES-GCM)
//   - New saveProxy function: encrypts password server-side
//   - New saveWebhook function: encrypts secret server-side
//   - triggerWebhook v2: decrypts secret before HMAC signing
//   - receiveWebhook v5: decrypts secret before HMAC verification
//   - New BrowserContext entity: durable encrypted browser contexts
//   - New recoverOrphans function: orphan/stale resource cleanup
//   - New runMasterReleaseSuite function: 27-category release matrix
//   - Artifact records created in runJob for screenshots/PDFs
//   - RLS rules prepared (docs/RLS_RULES_PROPOSAL.md) — activation is protected
//
// v4.1.1 changes:
//   - apiGateway: fix circular JSON in POST /jobs/:id/run
//
// v4.1.0 changes:
//   - apiGateway: JWT-vs-API-key auth fix
//   - apiGateway: database-backed rate limiting via RateLimitEntry entity
// ═══════════════════════════════════════════════

export const DEPLOYMENT_VERSION = "v5.0.0";
export const DEPLOYED_AT = "2026-08-18T22:15:00Z";
export const SCHEMA_VERSION = "v4.0";

export const FUNCTION_REGISTRY = {
  apiGateway: "v5.0.0",
  cloudBrowserGatewayV6: "v5.0.0",
  runJob: "v5.0.0",
  engineAction: "v5.0.0",
  managePool: "v5.0.0",
  receiveWebhook: "v5.0.0",
  triggerWebhook: "v5.0.0",
  engineHealth: "v5.0.0",
  resumeSession: "v5.0.0",
  updateEngineConfig: "v5.0.0",
  runTestSuite: "v5.0.0",
  getDeploymentStatus: "v5.0.0",
  saveProxy: "v5.0.0",
  saveWebhook: "v5.0.0",
  saveProfile: "v5.0.0",
  mcpTools: "v5.0.0",
  migrateSecrets: "v5.0.0",
  runMcpBlackBox: "v5.0.0",
  runContextBlackBox: "v5.0.0",
  runTenantIsolationTests: "v5.0.0",
  getObservabilityMetrics: "v5.0.0",
  recoverOrphans: "v5.0.0",
  runMasterReleaseSuite: "v5.0.0",
  reapExpired: "v5.0.0",
  reconcileSettings: "v5.0.0",
  calculateCost: "v5.0.0",
  createApiKey: "v5.0.0",
  createProject: "v5.0.0",
  aiBuildSteps: "v5.0.0",
  checkSchedules: "v5.0.0",
  runScheduledJob: "v5.0.0",
  sendNotification: "v5.0.0",
  exportResults: "v5.0.0",
  diffScreenshots: "v5.0.0",
  generateInvoice: "v5.0.0",
  getMetrics: "v5.0.0",
  checkCompliance: "v5.0.0",
  estimateCost: "v5.0.0",
  forecastCost: "v5.0.0",
  calculateScore: "v5.0.0",
  logAudit: "v5.0.0",
};