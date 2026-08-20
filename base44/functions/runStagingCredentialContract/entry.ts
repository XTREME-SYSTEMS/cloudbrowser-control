import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { secrets } from "base44:runtime";
import { requireIsolatedFortressTestEnvironment } from "../../shared/liveTestGuard.ts";
import {
  getStagingEngineConfig,
  isStagingEngineConfigured,
  getStagingEngineKeyFingerprint,
  STAGING_ENGINE_CONFIGURATION_REQUIRED,
} from "../../shared/stagingEngineClient.ts";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";

export default async function (req) {
  createClientFromRequest(req);
  const results = [];
  const check = (name, pass, detail) => results.push({ name, status: pass ? "pass" : "fail", detail });

  const isolation = await requireIsolatedFortressTestEnvironment();
  const stagingMode = secrets.get("FORTRESS_STAGING_VALIDATION_MODE") === "true";
  const accessEnabled = isolation.ok === true && stagingMode;

  check(
    "canonical Fortress isolation guard is authoritative",
    typeof isolation.ok === "boolean" && isolation.environment !== undefined,
    `isolation_ok=${isolation.ok === true}`
  );

  check(
    "staging validation mode is an additional operator gate",
    typeof stagingMode === "boolean",
    `staging_mode=${stagingMode}`
  );

  let config = null;
  let configError = "";
  try { config = await getStagingEngineConfig(); } catch (error) { configError = error?.message || ""; }

  check(
    "staging config fails closed when access or credentials are unavailable",
    config !== null || configError === STAGING_ENGINE_CONFIGURATION_REQUIRED,
    config ? "staging config available" : `error=${configError}`
  );

  check(
    "staging path never falls back to production credentials",
    accessEnabled ? (config !== null || configError === STAGING_ENGINE_CONFIGURATION_REQUIRED) : (config === null && configError === STAGING_ENGINE_CONFIGURATION_REQUIRED),
    accessEnabled ? "isolated staging access enabled" : "blocked before staging credential use"
  );

  check(
    "staging URL is HTTPS when configured",
    config === null || (config.environment === "isolated-staging" && config.baseUrl.startsWith("https://")),
    config ? "HTTPS isolated-staging URL" : "not configured"
  );

  check(
    "staging key is strong when configured",
    config === null || (typeof config.key === "string" && config.key.length >= 32),
    config ? "key length requirement satisfied; value withheld" : "not configured"
  );

  const configured = await isStagingEngineConfigured();
  check(
    "configured-state helper matches staging config availability",
    configured === (config !== null),
    `configured=${configured}`
  );

  const fingerprint = await getStagingEngineKeyFingerprint();
  check(
    "fingerprint is gated and non-reversible",
    accessEnabled ? (fingerprint === null || /^sha256:[0-9a-f]{16}$/.test(fingerprint)) : fingerprint === null,
    fingerprint ? "non-reversible fingerprint present" : "fingerprint unavailable while gate/key absent"
  );

  const sanitized = results.map((result) => ({ ...result }));
  const reportText = JSON.stringify(sanitized);
  const secretPattern = /(cb_live_|cb_test_|fortress_stg_|sk-|sk_|Bearer\s+[A-Za-z0-9._-]+)/i;
  const noLeak = !secretPattern.test(reportText);
  if (!noLeak) {
    sanitized.push({ name: "report contains no secret values", status: "fail", detail: "secret-like value detected" });
  }

  const failed = sanitized.filter((result) => result.status === "fail");
  return Response.json({
    suite: "staging_credential_contract",
    overall: failed.length === 0 ? "PASS" : "FAIL",
    passed: sanitized.length - failed.length,
    failed: failed.length,
    access_enabled: accessEnabled,
    isolation_verified: isolation.ok === true,
    staging_mode_enabled: stagingMode,
    staging_configured: configured,
    results: sanitized,
    __v: DEPLOYMENT_VERSION,
  });
}
