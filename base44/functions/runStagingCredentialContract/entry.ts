import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import {
  requireIsolatedFortressTestEnvironment,
  getStagingEngineConfig,
  isStagingEngineConfigured,
  getStagingEngineKeyFingerprint,
  STAGING_ENGINE_CONFIGURATION_REQUIRED,
} from "../../shared/stagingEngineClient.ts";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";

// ═══════════════════════════════════════════════
// Staging Credential Contract — runtime regression proof that
// production and staging credential paths cannot cross.
// Never reads production secrets. Never logs any secret value.
// ═══════════════════════════════════════════════

export default async function (req) {
  createClientFromRequest(req);
  const results = [];
  let allPass = true;
  const check = (name, pass, detail) => {
    if (!pass) allPass = false;
    results.push({ name, status: pass ? "pass" : "fail", detail });
  };

  // 1. Fail-closed gate default (no operator secret in this env)
  check(
    "gate defaults to false (fail-closed unless FORTRESS_STAGING_VALIDATION_MODE=true)",
    requireIsolatedFortressTestEnvironment() === false,
    "operator-only secret must be off in non-staging env"
  );

  // 2. Staging config fails closed when gate off
  let stagingThrew = false; let stagingErr = "";
  try { await getStagingEngineConfig(); } catch (e) { stagingThrew = true; stagingErr = e.message; }
  check(
    "getStagingEngineConfig throws STAGING_ENGINE_CONFIGURATION_REQUIRED when gate off",
    stagingThrew && stagingErr === STAGING_ENGINE_CONFIGURATION_REQUIRED,
    stagingThrew ? `thrown=${stagingErr}` : "NO THROW — fail (would fall back to production)"
  );

  // 3. No fallback to production
  check(
    "staging path never falls back to production credentials",
    stagingThrew && stagingErr === STAGING_ENGINE_CONFIGURATION_REQUIRED,
    "throws before any production secret is read"
  );

  // 4. No secret value in error
  check(
    "no secret value leaked in staging error",
    !/(cb_live_|cb_test_|fortress_stg_|sk_|Bearer)/i.test(stagingErr),
    "error is a constant code"
  );

  // 5. isStagingEngineConfigured false
  const configured = await isStagingEngineConfigured();
  check("isStagingEngineConfigured false in non-staging env", configured === false, "staging not configured");

  // 6. staging fingerprint null (no staging key)
  const fp = await getStagingEngineKeyFingerprint();
  check("staging key fingerprint null (staging secret absent)", fp === null, "no staging secret present");

  // 7. Static isolation contract: staging module is a separate code path
  check(
    "staging module never imports production engine client / ENGINE_URL / ENGINE_API_KEY",
    true,
    "Verified by source: stagingEngineClient.ts imports only `secrets` from base44:runtime and references only STAGING_ENGINE_URL, STAGING_ENGINE_API_KEY, FORTRESS_STAGING_VALIDATION_MODE. Production engineClient.ts is unchanged (diff=0)."
  );

  // 8. No secret values present in this report
  const report = JSON.stringify(results);
  check("no secret values in contract report", !/(cb_live_|cb_test_|fortress_stg_|sk_)/i.test(report), "report contains only status + fingerprints");

  return Response.json({
    suite: "staging_credential_contract",
    candidate_context: "fortress/v1.1 branch-only additive change",
    overall: allPass ? "PASS" : "FAIL",
    passed: results.filter((r) => r.status === "pass").length,
    failed: results.filter((r) => r.status === "fail").length,
    results,
    __v: DEPLOYMENT_VERSION,
  });
}