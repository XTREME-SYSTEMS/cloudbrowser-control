import { PROJECT } from './config.js';
import { isCleanValidation, sha256 } from './policy.js';

const REQUIRED_CHECK_NAMES = ['Code Quality Gate', 'Browser Engine Syntax', 'Security Audit'];

export const SUITE_SPECS = Object.freeze({
  runtime: { expected: 23, label: 'runTestSuite' },
  master: { expected: 47, label: 'runMasterReleaseSuite' },
  tenant: { expected: 18, label: 'runDeployedTenantIsolationTests' },
  mcp: { expected: 18, label: 'runMcpBlackBox' },
  context: { expected: 11, label: 'runContextBlackBox' },
});

async function fetchJson(url, token, init = {}) {
  if (!url) return null;
  const headers = { 'Content-Type': 'application/json', ...(init.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`Staging ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : {};
}

function normalizeSuite(name, payload) {
  const spec = SUITE_SPECS[name];
  if (!payload) return { name: spec.label, expected: spec.expected, total: 0, passed: 0, failed: 0, pass: false, reason: 'endpoint_missing' };
  if (payload.error) return { name: spec.label, expected: spec.expected, total: 0, passed: 0, failed: 0, pass: false, reason: payload.error };

  let total = Number(payload.total_tests ?? 0);
  let passed = Number(payload.passed ?? 0);
  let failed = Number(payload.failed ?? 0);
  let runtimeProof = true;

  if (name === 'master') {
    total = Number(payload.master_matrix?.total_tests ?? total);
    passed = Number(payload.master_matrix?.passed ?? passed);
    failed = Number(payload.master_matrix?.failed ?? failed);
    runtimeProof = payload.release_status === 'RELEASE GATE VERIFIED';
  } else if (name === 'runtime') {
    runtimeProof = payload.release_status === 'VERIFIED' && payload.engine_configured === true;
  } else if (name === 'tenant') {
    runtimeProof = payload.deployed_tenant_isolation_verified === true;
  } else if (name === 'mcp' || name === 'context') {
    runtimeProof = payload.engine_configured === true;
  }

  const pass = total === spec.expected && passed === spec.expected && failed === 0 && runtimeProof;
  return {
    name: spec.label,
    expected: spec.expected,
    total,
    passed,
    failed,
    pass,
    runtime_proof: runtimeProof,
    run_id: payload.run_id || null,
  };
}

export function scoreValidation({ checks, staging, legacySuites = [], critical = 0, high = 0, drift = 0, receiptIntegrity = true }) {
  const relevant = checks.filter((c) => REQUIRED_CHECK_NAMES.some((name) => c.name.includes(name)) || c.name.includes('Autonomy Worker'));
  const checksComplete = relevant.length >= REQUIRED_CHECK_NAMES.length && relevant.every((c) => c.status === 'completed');
  const checksPass = checksComplete && relevant.every((c) => ['success','neutral','skipped'].includes(c.conclusion));
  const stagingTotals = staging?.run?.totals || null;
  const stagingPass = Boolean(stagingTotals && stagingTotals.total > 0 && stagingTotals.fail === 0 && stagingTotals.blocked === 0 && stagingTotals.pass === stagingTotals.total && staging?.status?.engine?.connected === true);
  const legacyPass = legacySuites.length === Object.keys(SUITE_SPECS).length && legacySuites.every((suite) => suite.pass === true);
  const mandatory = checksPass && stagingPass && legacyPass;

  const legacyTotal = legacySuites.reduce((sum, suite) => sum + (suite.total || 0), 0);
  const legacyPassed = legacySuites.reduce((sum, suite) => sum + (suite.passed || 0), 0);
  const testTotal = relevant.length + (stagingTotals?.total || 0) + legacyTotal;
  const testPassed = relevant.filter((c) => ['success','neutral','skipped'].includes(c.conclusion)).length + (stagingTotals?.pass || 0) + legacyPassed;
  const passRate = testTotal ? Math.round((testPassed / testTotal) * 10000) / 100 : 0;
  const quality = mandatory && critical === 0 && high === 0 && drift === 0 && receiptIntegrity ? 100 : Math.min(99, Math.floor(passRate));

  const result = {
    quality_score: quality,
    pass_rate: mandatory ? 100 : passRate,
    critical_findings: critical,
    high_findings: high,
    drift,
    mandatory_gates_pass: mandatory,
    staging_health: stagingPass ? 'PASS' : 'FAIL',
    receipt_integrity: receiptIntegrity ? 'PASS' : 'FAIL',
    check_runs: relevant.map((c) => ({ name: c.name, status: c.status, conclusion: c.conclusion })),
    legacy_suites: legacySuites,
    staging: staging || null
  };
  result.clean_pass = isCleanValidation(result);
  result.signature = sha256(result);
  return result;
}

export async function collectValidation({ github, candidateSha, stagingStatusUrl, stagingRunUrl, stagingCertifyUrl, stagingToken, suiteUrls = {} }) {
  const [checks, combined, status] = await Promise.all([
    github.getCheckRuns(candidateSha),
    github.getCombinedStatus(candidateSha),
    fetchJson(stagingStatusUrl, stagingToken).catch((error) => ({ error: error.message }))
  ]);

  let run = null;
  if (stagingRunUrl && !status?.error) {
    run = await fetchJson(stagingRunUrl, stagingToken, { method: 'POST', body: JSON.stringify({ source_sha: candidateSha, environment: 'staging' }) }).catch((error) => ({ error: error.message }));
  }
  let certification = null;
  if (stagingCertifyUrl && run && !run.error) {
    certification = await fetchJson(stagingCertifyUrl, stagingToken, { method: 'POST', body: JSON.stringify({ source_sha: candidateSha, environment: 'staging' }) }).catch((error) => ({ error: error.message }));
  }

  const suiteEntries = await Promise.all(Object.keys(SUITE_SPECS).map(async (name) => {
    const url = suiteUrls?.[name] || null;
    const payload = url
      ? await fetchJson(url, stagingToken, { method: 'POST', body: JSON.stringify({ source_sha: candidateSha, environment: 'staging' }) }).catch((error) => ({ error: error.message }))
      : null;
    return normalizeSuite(name, payload);
  }));

  const drift = status?.exact_source_sha && !candidateSha.startsWith(status.exact_source_sha) && !status.exact_source_sha.startsWith(candidateSha.slice(0, 7)) ? 1 : 0;
  const result = scoreValidation({ checks, staging: { status, run, certification }, legacySuites: suiteEntries, critical: 0, high: 0, drift, receiptIntegrity: true });
  result.github_combined_status = combined?.state || 'unknown';
  result.candidate_sha = candidateSha;
  result.project_id = PROJECT.id;
  return result;
}

export function classifyFailure(validation) {
  if (!validation) return { type: 'INFRA_BLOCKED', signature: 'validation-missing' };
  if (validation.critical_findings > 0 || validation.high_findings > 0) return { type: 'SECURITY_FAIL', signature: validation.signature };
  if (validation.drift > 0) return { type: 'GOVERNANCE_BLOCKED', signature: validation.signature };
  if (validation.staging?.status?.error || validation.staging?.run?.error) return { type: 'INFRA_BLOCKED', signature: validation.signature };
  const missingSuite = validation.legacy_suites?.find((suite) => suite.reason === 'endpoint_missing');
  if (missingSuite) return { type: 'INFRA_BLOCKED', signature: `missing-suite:${missingSuite.name}` };
  const failedSuite = validation.legacy_suites?.find((suite) => !suite.pass);
  if (failedSuite) return { type: 'RUNTIME_FAIL', signature: `${failedSuite.name}:${failedSuite.passed}/${failedSuite.expected}` };
  const failedCheck = validation.check_runs.find((c) => c.status === 'completed' && !['success','neutral','skipped'].includes(c.conclusion));
  if (failedCheck) return { type: failedCheck.name.includes('Security') ? 'SECURITY_FAIL' : 'CODE_FAIL', signature: `${failedCheck.name}:${failedCheck.conclusion}` };
  if (validation.staging?.run?.totals?.fail > 0 || validation.staging?.run?.totals?.blocked > 0) return { type: 'RUNTIME_FAIL', signature: validation.signature };
  return { type: 'INFRA_BLOCKED', signature: validation.signature };
}
