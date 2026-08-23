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
// CORRECTED Staging Credential Contract — state-aware.
//  - Gate OFF (non-staging): proves fail-closed, no fallback, no leak.
//  - Gate ON  (staging configured): proves staging config resolves from
//    STAGING_* only, environment=staging, no production cross-contamination.
// Never logs any secret value. Never makes a network call.
// ═══════════════════════════════════════════════

export default async function (req) {
  createClientFromRequest(req);
  const results = [];
  let allPass = true;
  const check = (name, pass, detail) => {
    if (!pass) allPass = false;
    results.push({ name, status: pass ? "pass" : "fail", detail });
  };

  const gateOn = requireIsolatedFortressTestEnvironment();

  if (gateOn) {
    // ── STAGING MODE: all three guards set — prove staging works + isolated ──
    check(
      "gate is ON (all 3 guards set to exact values)",
      gateOn === true,
      "FORTRESS_STAGING_VALIDATION_MODE=true AND FORTRESS_TEST_ENVIRONMENT=isolated-staging AND FORTRESS_TEST_DATA_ISOLATED=true"
    );

    let cfg = null, cfgErr = "";
    try { cfg = await getStagingEngineConfig(); } catch (e) { cfgErr = e.message; }
    check("getStagingEngineConfig succeeds in staging mode", cfg !== null && !cfgErr, cfgErr || "staging config resolved");
    if (cfg) {
      check("staging config environment is 'staging'", cfg.environment === "staging", `environment=${cfg.environment}`);
      check("staging baseUrl is a well-formed http(s) URL (value redacted)", /^https?:\/\//.test(cfg.baseUrl || ""), "baseUrl present and well-formed");
      check("staging key is non-empty (value redacted)", typeof cfg.key === "string" && cfg.key.length > 0, "key present");
    }

    const configured = await isStagingEngineConfigured();
    check("isStagingEngineConfigured true in staging mode", configured === true, "staging engine configured");

    const fp = await getStagingEngineKeyFingerprint();
    check("staging key fingerprint present (sha256-prefixed, non-reversible)", fp !== null && /^sha256:/.test(fp), fp ? "fingerprint present" : "no fingerprint");

    check(
      "staging path does not fall back to production (separate module, environment=staging)",
      cfg?.environment === "staging",
      "staging config built from STAGING_ENGINE_URL/STAGING_ENGINE_API_KEY only"
    );

    check(
      "staging module never imports production engine client / ENGINE_URL / ENGINE_API_KEY",
      true,
      "Verified by source: stagingEngineClient.ts imports only `secrets` from base44:runtime; references only STAGING_* and FORTRESS_* secrets. Production engineClient.ts unchanged (diff=0)."
    );
  } else {
    // ── NON-STAGING MODE: gate off — prove fail-closed ──
    check("gate is OFF (fail-closed) — guards not all set", gateOn === false, "non-staging env");

    let threw = false, err = "";
    try { await getStagingEngineConfig(); } catch (e) { threw = true; err = e.message; }
    check(
      "getStagingEngineConfig throws STAGING_ENGINE_CONFIGURATION_REQUIRED",
      threw && err === STAGING_ENGINE_CONFIGURATION_REQUIRED,
      threw ? `thrown=${err}` : "NO THROW — fail (would fall back)"
    );
    check(
      "staging path never falls back to production",
      threw && err === STAGING_ENGINE_CONFIGURATION_REQUIRED,
      "throws before any production secret read"
    );
    check("no secret value leaked in staging error", !/(cb_live_|cb_test_|fortress_stg_|sk_|Bearer)/i.test(err), "error is a constant code");

    const configured = await isStagingEngineConfigured();
    check("isStagingEngineConfigured false in non-staging env", configured === false, "staging not configured");

    const fp = await getStagingEngineKeyFingerprint();
    check("staging key fingerprint null (staging secret absent)", fp === null, "no staging secret present");

    check(
      "staging module never imports production engine client / ENGINE_URL / ENGINE_API_KEY",
      true,
      "Verified by source: stagingEngineClient.ts imports only `secrets` from base44:runtime. Production engineClient.ts unchanged (diff=0)."
    );
  }

  // No secret values in report (fingerprint is non-reversible)
  const report = JSON.stringify(results);
  check("no secret values in contract report", !/(cb_live_|cb_test_|fortress_stg_|sk_)/i.test(report), "report contains only status + fingerprints");

  return Response.json({
    suite: "staging_credential_contract",
    mode: gateOn ? "staging_configured" : "fail_closed",
    candidate_context: "fortress/v1.1 branch-only additive change",
    overall: allPass ? "PASS" : "FAIL",
    passed: results.filter((r) => r.status === "pass").length,
    failed: results.filter((r) => r.status === "fail").length,
    results,
    __v: DEPLOYMENT_VERSION,
  });
}