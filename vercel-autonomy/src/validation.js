import { PROJECT } from './config.js';
import { isCleanValidation, sha256 } from './policy.js';

const REQUIRED_CHECK_NAMES = ['Code Quality Gate', 'Browser Engine Syntax', 'Security Audit'];

async function fetchJson(url, token, init = {}) {
  if (!url) return null;
  const headers = { 'Content-Type': 'application/json', ...(init.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`Staging ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : {};
}

export function scoreValidation({ checks, staging, critical = 0, high = 0, drift = 0, receiptIntegrity = true }) {
  const relevant = checks.filter((c) => REQUIRED_CHECK_NAMES.some((name) => c.name.includes(name)) || c.name.includes('Autonomy Worker'));
  const checksComplete = relevant.length >= REQUIRED_CHECK_NAMES.length && relevant.every((c) => c.status === 'completed');
  const checksPass = checksComplete && relevant.every((c) => ['success','neutral','skipped'].includes(c.conclusion));
  const stagingTotals = staging?.run?.totals || null;
  const stagingPass = Boolean(stagingTotals && stagingTotals.total > 0 && stagingTotals.fail === 0 && stagingTotals.blocked === 0 && stagingTotals.pass === stagingTotals.total);
  const mandatory = checksPass && stagingPass;
  const testTotal = (relevant.length || 0) + (stagingTotals?.total || 0);
  const testPassed = relevant.filter((c) => ['success','neutral','skipped'].includes(c.conclusion)).length + (stagingTotals?.pass || 0);
  const passRate = testTotal ? Math.round((testPassed / testTotal) * 10000) / 100 : 0;
  const quality = mandatory && critical === 0 && high === 0 && drift === 0 && receiptIntegrity ? 100 : Math.min(99, Math.floor(passRate));
  const result = {
    quality_score: quality,
    pass_rate: mandatory ? 100 : passRate,
    critical_findings: critical,
    high_findings: high,
    drift,
    mandatory_gates_pass: mandatory,
    staging_health: staging?.status?.engine?.connected === false ? 'FAIL' : (stagingPass ? 'PASS' : 'FAIL'),
    receipt_integrity: receiptIntegrity ? 'PASS' : 'FAIL',
    check_runs: relevant.map((c) => ({ name: c.name, status: c.status, conclusion: c.conclusion })),
    staging: staging || null
  };
  result.clean_pass = isCleanValidation(result);
  result.signature = sha256(result);
  return result;
}

export async function collectValidation({ github, candidateSha, stagingStatusUrl, stagingRunUrl, stagingCertifyUrl, stagingToken }) {
  const [checks, combined, status] = await Promise.all([
    github.getCheckRuns(candidateSha),
    github.getCombinedStatus(candidateSha),
    fetchJson(stagingStatusUrl, stagingToken).catch((error) => ({ error: error.message }))
  ]);

  let run = null;
  if (stagingRunUrl && !status?.error) {
    run = await fetchJson(stagingRunUrl, stagingToken, { method: 'POST', body: JSON.stringify({ source_sha: candidateSha }) }).catch((error) => ({ error: error.message }));
  }
  let certification = null;
  if (stagingCertifyUrl && run && !run.error) {
    certification = await fetchJson(stagingCertifyUrl, stagingToken, { method: 'POST', body: JSON.stringify({ source_sha: candidateSha }) }).catch((error) => ({ error: error.message }));
  }

  const drift = status?.exact_source_sha && !candidateSha.startsWith(status.exact_source_sha) && !status.exact_source_sha.startsWith(candidateSha.slice(0, 7)) ? 1 : 0;
  const result = scoreValidation({ checks, staging: { status, run, certification }, critical: 0, high: 0, drift, receiptIntegrity: true });
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
  const failedCheck = validation.check_runs.find((c) => c.status === 'completed' && !['success','neutral','skipped'].includes(c.conclusion));
  if (failedCheck) return { type: failedCheck.name.includes('Security') ? 'SECURITY_FAIL' : 'CODE_FAIL', signature: `${failedCheck.name}:${failedCheck.conclusion}` };
  if (validation.staging?.run?.totals?.fail > 0) return { type: 'RUNTIME_FAIL', signature: validation.signature };
  return { type: 'INFRA_BLOCKED', signature: validation.signature };
}
