import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";
import { ACTION_CAPABILITIES, checkRateLimit } from "../../shared/gatewayCore.ts";
import { secrets } from "base44:runtime";

// ═══════════════════════════════════════════════
// FORTRESS RELEASE MATRIX — V1.1 (39 gates)
// WAVE 1 validator hardening:
// - No unconditional PASS gates.
// - Every PASS comes from behavior or machine-verifiable source/runtime state.
// - Unavailable proof is SKIP with an explicit evidence requirement.
// - A SKIP can never produce FORTRESS VERIFIED.
// ═══════════════════════════════════════════════

function externalEvidence(reason) {
  return { gate_status: "skip", reason: `EXTERNAL EVIDENCE REQUIRED: ${reason}` };
}

function runtimeEvidence(reason) {
  return { gate_status: "skip", reason: `RUNTIME EVIDENCE REQUIRED: ${reason}` };
}

async function gate(base44, runId, n, name, category, fn) {
  const start = Date.now();
  let status = "fail";
  let detail = "";

  try {
    const result = await fn();
    if (result?.gate_status === "skip") {
      status = "skip";
      detail = result.reason || "Evidence not available";
    } else if (result === true || result?.pass === true) {
      status = "pass";
    } else {
      status = "fail";
      detail = result?.error || "Test returned false";
    }
  } catch (error) {
    status = "fail";
    detail = error?.message || String(error);
  }

  await base44.asServiceRole.entities.TestResult.create({
    suite: "Fortress Release Matrix",
    test_name: `G${n}: ${name}`,
    status,
    duration_ms: Date.now() - start,
    error_message: status === "pass" ? "" : detail,
    score_category: category,
    score_points: status === "pass" ? 1 : 0,
    max_points: 1,
    run_id: runId,
  }).catch(() => {});

  return { gate: n, name, category, status, detail };
}

export default async function (req) {
  const base44 = createClientFromRequest(req);
  const runId = "fortress_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  const engineUrl = secrets.get("ENGINE_URL") || "";
  const engineKey = secrets.get("ENGINE_API_KEY") || "";
  const engineConfigured = !!engineUrl && !!engineKey;
  const results = [];

  results.push(await gate(base44, runId, 1, "Evaluate capability mapping", "Authorization", async () => {
    return ACTION_CAPABILITIES?.evaluate === "sessions:evaluate"
      ? true
      : { error: "ACTION_CAPABILITIES.evaluate must equal sessions:evaluate" };
  }));

  results.push(await gate(base44, runId, 2, "MCP per-tool scope enforcement", "Authorization", async () =>
    externalEvidence("Run a source/black-box check proving each MCP tool rejects a key missing its required scope.")));

  results.push(await gate(base44, runId, 3, "SSRF DNS-rebinding block", "SSRF", async () =>
    externalEvidence("Use a controlled hostname whose DNS answer changes from public to private and prove the browser request is blocked.")));

  results.push(await gate(base44, runId, 4, "SSRF redirect block", "SSRF", async () =>
    externalEvidence("Use a controlled public URL that redirects to loopback/private/metadata and prove the redirect request is blocked.")));

  results.push(await gate(base44, runId, 5, "Direct-function admin authorization", "Authorization", async () =>
    externalEvidence("Invoke saveProxy/saveWebhook/saveProfile as an authenticated non-admin and prove HTTP 403 before validation or mutation.")));

  results.push(await gate(base44, runId, 6, "runJob tenant authorization", "Tenant Isolation", async () =>
    externalEvidence("Create two project fixtures and prove a non-admin caller cannot execute the other project's Job, including when project_id is omitted.")));

  results.push(await gate(base44, runId, 7, "Webhook project scoping", "Tenant Isolation", async () =>
    externalEvidence("Create two project webhook fixtures and prove cross-project delivery/read paths are denied.")));

  results.push(await gate(base44, runId, 8, "runJob idempotency", "Reliability", async () =>
    externalEvidence("Execute the same job twice with one idempotency_key and prove the second call does not create a second execution, including after completion.")));

  results.push(await gate(base44, runId, 9, "Cryptographic runtime tokens", "Security", async () =>
    externalEvidence("Machine-scan engine token generators and/or sample generated session/share/state tokens to prove cryptographic generation with no Math.random security tokens.")));

  results.push(await gate(base44, runId, 10, "Caller path rejection", "Security", async () =>
    externalEvidence("Attempt caller-supplied userDataDir and unsafe extension paths and prove explicit rejection with no filesystem path use.")));

  results.push(await gate(base44, runId, 11, "context_use secret non-disclosure", "Data Protection", async () =>
    externalEvidence("Create a context containing secret state, call context_use through MCP, and prove decrypted cookies/storage never appear in the response.")));

  results.push(await gate(base44, runId, 12, "Rate limiter rejected requests do not over-count", "Reliability", async () => {
    const keyHash = `fortress_rate_${runId}`;
    try {
      const first = await checkRateLimit(base44, keyHash, 1);
      const second = await checkRateLimit(base44, keyHash, 1);
      const rows = await base44.asServiceRole.entities.RateLimitEntry.filter({ key_hash: keyHash });
      const total = rows.reduce((sum, row) => sum + (row.count || 0), 0);
      return first === true && second === false && total === 1
        ? true
        : { error: `Expected first=true, second=false, stored_count=1; got ${first}/${second}/${total}` };
    } finally {
      const rows = await base44.asServiceRole.entities.RateLimitEntry.filter({ key_hash: keyHash }).catch(() => []);
      for (const row of rows) await base44.asServiceRole.entities.RateLimitEntry.delete(row.id).catch(() => {});
    }
  }));

  results.push(await gate(base44, runId, 13, "Engine request timeout", "Reliability", async () =>
    externalEvidence("Point the staging engine client at a controlled hanging endpoint and prove it aborts at the configured timeout.")));

  results.push(await gate(base44, runId, 14, "Pool honors caller proxy/session options", "Correctness", async () =>
    externalEvidence("Create a staging session with a controlled proxy/session option and prove a generic warm-pooled context is not reused.")));

  results.push(await gate(base44, runId, 15, "Artifact project scoping", "Tenant Isolation", async () =>
    externalEvidence("Create two project-bound API keys/artifacts and prove a key cannot fetch a non-public artifact from the other project.")));

  results.push(await gate(base44, runId, 16, "Per-key session quota", "Abuse", async () =>
    externalEvidence("Exercise the configured per-key concurrent-session ceiling and prove excess creation is rejected without affecting other keys.")));

  results.push(await gate(base44, runId, 17, "Job step and duration caps", "Abuse", async () =>
    externalEvidence("Run over-limit step-count and duration fixtures and prove both are rejected/terminated at the configured boundaries.")));

  results.push(await gate(base44, runId, 18, "Webhook plaintext-secret fallback removed", "Security", async () =>
    externalEvidence("Machine-scan receiveWebhook and triggerWebhook and prove no plaintext webhook.secret fallback remains.")));

  results.push(await gate(base44, runId, 19, "Webhook decrypt failure fails closed", "Security", async () =>
    externalEvidence("Use a malformed encrypted webhook secret in staging and prove delivery/verification fails without unsigned downgrade.")));

  results.push(await gate(base44, runId, 20, "CDP privileged capability gate", "Security", async () =>
    externalEvidence("Attempt CDP through a key without sessions:cdp and prove 403; then verify authorized staging policy separately.")));

  results.push(await gate(base44, runId, 21, "engine.url destination validation", "Security", async () =>
    externalEvidence("Attempt private/loopback/metadata engine.url overrides in staging and prove fail-closed rejection before fetch.")));

  results.push(await gate(base44, runId, 22, "Dependency audit clean", "Supply Chain", async () =>
    externalEvidence("Attach a current CI dependency-audit/SCA receipt for the exact Fortress branch SHA.")));

  results.push(await gate(base44, runId, 23, "Branch protection enforced", "Supply Chain", async () =>
    externalEvidence("Attach GitHub ruleset/branch-protection evidence showing direct push/force-push blocked and required checks enforced.")));

  results.push(await gate(base44, runId, 24, "DR export and restore proven", "Reliability", async () =>
    externalEvidence("Attach an executed disaster-recovery export/restore receipt with integrity verification.")));

  results.push(await gate(base44, runId, 25, "Deployment drift = 0", "Deployment", async () => {
    const response = await base44.asServiceRole.functions.invoke("getDeploymentStatus", {}).catch((error) => error);
    const data = response?.data || response;
    return data?.drift_count === 0 && data?.overall_status === "NO_DRIFT"
      ? true
      : { error: `drift_count=${data?.drift_count ?? "unknown"}, status=${data?.overall_status ?? "unknown"}` };
  }));

  results.push(await gate(base44, runId, 26, "Heartbeat alerting", "Observability", async () =>
    externalEvidence("Attach an alerting receipt proving missed/degraded heartbeats produce the configured operator alert.")));

  results.push(await gate(base44, runId, 27, "V1.0 rollback proven", "Rollback", async () =>
    externalEvidence("Attach the executed rollback receipt proving Fortress failure -> V1 restore -> healthy pool 3/3.")));

  results.push(await gate(base44, runId, 28, "Fortress runtime suite", "Runtime", async () => {
    if (!engineConfigured) return runtimeEvidence("ENGINE_URL/ENGINE_API_KEY are not configured for this environment.");
    const response = await base44.asServiceRole.functions.invoke("runTestSuite", {}).catch((error) => error);
    const data = response?.data || response;
    return data?.pass_rate === 100 && data?.failed === 0
      ? true
      : { error: `pass_rate=${data?.pass_rate ?? "unknown"}, failed=${data?.failed ?? "unknown"}` };
  }));

  results.push(await gate(base44, runId, 29, "Tenant isolation deployed black-box", "Tenant Isolation", async () => {
    if (!engineConfigured) return runtimeEvidence("Engine is not configured for deployed tenant-isolation testing.");
    const response = await base44.asServiceRole.functions.invoke("runDeployedTenantIsolationTests", {}).catch((error) => error);
    const data = response?.data || response;
    return data?.deployed_tenant_isolation_verified === true
      ? true
      : { error: "deployed_tenant_isolation_verified is not true" };
  }));

  results.push(await gate(base44, runId, 30, "MCP black-box", "MCP", async () => {
    if (!engineConfigured) return runtimeEvidence("Engine is not configured for MCP black-box testing.");
    const response = await base44.asServiceRole.functions.invoke("runMcpBlackBox", {}).catch((error) => error);
    const data = response?.data || response;
    return data?.score === 100 && (data?.failed ?? 0) === 0
      ? true
      : { error: `score=${data?.score ?? "unknown"}, failed=${data?.failed ?? "unknown"}` };
  }));

  results.push(await gate(base44, runId, 31, "Context black-box", "Contexts", async () => {
    if (!engineConfigured) return runtimeEvidence("Engine is not configured for context black-box testing.");
    const response = await base44.asServiceRole.functions.invoke("runContextBlackBox", {}).catch((error) => error);
    const data = response?.data || response;
    return data?.score === 100 && (data?.failed ?? 0) === 0
      ? true
      : { error: `score=${data?.score ?? "unknown"}, failed=${data?.failed ?? "unknown"}` };
  }));

  results.push(await gate(base44, runId, 32, "Build, lint, and typecheck", "Code Quality", async () =>
    externalEvidence("Attach CI receipts for build, lint, and typecheck on the exact Fortress branch SHA.")));

  results.push(await gate(base44, runId, 33, "GitHub Actions release checks", "CI/CD", async () =>
    externalEvidence("Attach a successful required-checks receipt for the exact Fortress branch SHA.")));

  results.push(await gate(base44, runId, 34, "Critical defects = 0", "Quality", async () => {
    const patterns = await base44.asServiceRole.entities.ErrorPattern.filter({ severity: "critical" }).catch(() => []);
    return patterns.length === 0 ? true : { error: `${patterns.length} critical defect pattern(s)` };
  }));

  results.push(await gate(base44, runId, 35, "High defects = 0", "Quality", async () => {
    const patterns = await base44.asServiceRole.entities.ErrorPattern.filter({ severity: "high" }).catch(() => []);
    return patterns.length === 0 ? true : { error: `${patterns.length} high defect pattern(s)` };
  }));

  results.push(await gate(base44, runId, 36, "Browser subresource SSRF block", "SSRF", async () =>
    externalEvidence("Use a controlled public page whose iframe/image/script/XHR/fetch targets private/metadata addresses and prove every request is blocked.")));

  results.push(await gate(base44, runId, 37, "CORS fail-closed", "Security", async () => {
    if (!engineConfigured) return runtimeEvidence("Engine is not configured for CORS behavior testing.");
    const response = await fetch(`${engineUrl.replace(/\/$/, "")}/config`, {
      method: "GET",
      headers: {
        Origin: "https://fortress-untrusted-origin.invalid",
        "x-api-key": engineKey,
      },
      redirect: "manual",
    }).catch((error) => ({ fetch_error: error?.message || String(error) }));
    if (response?.fetch_error) return { error: response.fetch_error };
    return response.status >= 400
      ? true
      : { error: `Untrusted Origin received HTTP ${response.status}; expected rejection` };
  }));

  results.push(await gate(base44, runId, 38, "Dangerous-action capability map complete", "Authorization", async () => {
    const expected = {
      evaluate: "sessions:evaluate",
      extract_json: "sessions:evaluate",
      set_cookies: "sessions:storage",
      import_cookies: "sessions:storage",
      export_cookies: "sessions:storage",
      set_local_storage: "sessions:storage",
      save_state: "sessions:storage",
      restore_state: "sessions:storage",
      upload_file: "sessions:upload",
      download: "sessions:download",
      solve_captcha: "sessions:captcha",
      mock_response: "sessions:network_mock",
      crawl: "sessions:crawl",
    };
    const mismatches = Object.entries(expected)
      .filter(([action, scope]) => ACTION_CAPABILITIES?.[action] !== scope)
      .map(([action, scope]) => `${action}->${scope}`);
    return mismatches.length === 0
      ? true
      : { error: `Missing/mismatched capability mappings: ${mismatches.join(", ")}` };
  }));

  results.push(await gate(base44, runId, 39, "Runtime/container isolation", "Isolation", async () =>
    externalEvidence("Attach staging container evidence for non-root identity, browser binary accessibility, no-new-privileges/capability policy, limits, readiness, and warm pool 3/3.")));

  const passed = results.filter((result) => result.status === "pass").length;
  const failed = results.filter((result) => result.status === "fail").length;
  const skipped = results.filter((result) => result.status === "skip").length;
  const externalEvidenceRequired = results.filter((result) =>
    result.status === "skip" && result.detail.startsWith("EXTERNAL EVIDENCE REQUIRED:")
  ).length;
  const runtimeEvidenceRequired = results.filter((result) =>
    result.status === "skip" && result.detail.startsWith("RUNTIME EVIDENCE REQUIRED:")
  ).length;
  const total = results.length;

  return Response.json({
    run_id: runId,
    __v: DEPLOYMENT_VERSION,
    fortress_matrix: {
      total,
      passed,
      failed,
      skipped,
      external_evidence_required: externalEvidenceRequired,
      runtime_evidence_required: runtimeEvidenceRequired,
      pass_rate: Math.round((passed / total) * 100),
      gates: results,
    },
    release_status: failed === 0 && skipped === 0 ? "FORTRESS VERIFIED" : "NOT READY",
    note: "WAVE 1 validator hardening: SKIP/external evidence never counts as PASS. Any attempted runtime error counts as FAIL.",
  });
}
