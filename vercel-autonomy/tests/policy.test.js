import test from 'node:test';
import assert from 'node:assert/strict';
import { assertBranchSafe, assertPathAllowed, isCleanValidation, redact, validateWorkPacket } from '../src/policy.js';

test('protected branches are rejected', () => {
  assert.throws(() => assertBranchSafe('main'));
  assert.throws(() => assertBranchSafe('master'));
  assert.doesNotThrow(() => assertBranchSafe('autonomous/cloudbrowser-control-v1'));
});

test('work packet path allowlist and immutable governance paths are enforced', () => {
  assert.doesNotThrow(() => assertPathAllowed('src/a.js', ['src'], ['src/secrets']));
  assert.throws(() => assertPathAllowed('src/secrets/key.js', ['src'], ['src/secrets']));
  assert.throws(() => assertPathAllowed('package.json', ['src'], []));
  assert.throws(() => assertPathAllowed('vercel-autonomy/src/policy.js', ['vercel-autonomy'], []));
  assert.throws(() => assertPathAllowed('.github/workflows/autonomy-validation.yml', ['.github'], []));
});

test('safe work packet accepts explicit false secret-change policy', () => {
  const packet = {
    work_packet_id: 'WP-test-001',
    project_id: 'cloudbrowser-control',
    goal: 'Fix a bounded UI regression',
    starting_sha: 'abc123',
    working_branch: 'autonomous/cloudbrowser-control-v1',
    allowed_paths: ['src/pages'],
    forbidden_paths: ['src/secrets'],
    acceptance_criteria: ['existing failing test passes'],
    required_tests: ['npm test'],
    regression_scope: ['src/pages'],
    max_files_changed: 2,
    max_attempts: 2,
    rollback_reference: 'abc123',
    deployment_allowed: false,
    main_write_allowed: false,
    production_allowed: false,
    secret_change_allowed: false,
    operator_approval_required: false
  };
  assert.doesNotThrow(() => validateWorkPacket(packet));
});

test('work packet cannot target autonomy governance controls', () => {
  const packet = {
    work_packet_id: 'WP-test-002', project_id: 'cloudbrowser-control', goal: 'Alter policy', starting_sha: 'abc123', working_branch: 'autonomous/cloudbrowser-control-v1',
    allowed_paths: ['vercel-autonomy/src/policy.js'], forbidden_paths: [], acceptance_criteria: ['change policy'], required_tests: [], regression_scope: [], max_files_changed: 1, max_attempts: 1, rollback_reference: 'abc123',
    deployment_allowed: false, main_write_allowed: false, production_allowed: false, secret_change_allowed: false, operator_approval_required: false
  };
  assert.throws(() => validateWorkPacket(packet));
});

test('clean validation requires every hard gate', () => {
  assert.equal(isCleanValidation({ quality_score: 100, pass_rate: 100, critical_findings: 0, high_findings: 0, drift: 0, mandatory_gates_pass: true, staging_health: 'PASS', receipt_integrity: 'PASS' }), true);
  assert.equal(isCleanValidation({ quality_score: 100, pass_rate: 100, critical_findings: 0, high_findings: 1, drift: 0, mandatory_gates_pass: true, staging_health: 'PASS', receipt_integrity: 'PASS' }), false);
});

test('receipt redaction strips secret-like keys and bearer strings but preserves false policy flags', () => {
  const value = redact({ api_key: 'abc', secret_change_allowed: false, nested: { message: 'Bearer abcdefghijklmnop' } });
  assert.equal(value.api_key, '[REDACTED]');
  assert.equal(value.secret_change_allowed, false);
  assert.equal(value.nested.message, '[REDACTED]');
});
