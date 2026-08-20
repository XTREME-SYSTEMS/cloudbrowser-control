import test from 'node:test';
import assert from 'node:assert/strict';
import { assertBranchSafe, assertPathAllowed, isCleanValidation, redact } from '../src/policy.js';

test('protected branches are rejected', () => {
  assert.throws(() => assertBranchSafe('main'));
  assert.throws(() => assertBranchSafe('master'));
  assert.doesNotThrow(() => assertBranchSafe('autonomous/cloudbrowser-control-v1'));
});

test('work packet path allowlist is enforced', () => {
  assert.doesNotThrow(() => assertPathAllowed('src/a.js', ['src'], ['src/secrets']));
  assert.throws(() => assertPathAllowed('src/secrets/key.js', ['src'], ['src/secrets']));
  assert.throws(() => assertPathAllowed('package.json', ['src'], []));
});

test('clean validation requires every hard gate', () => {
  assert.equal(isCleanValidation({ quality_score: 100, pass_rate: 100, critical_findings: 0, high_findings: 0, drift: 0, mandatory_gates_pass: true, staging_health: 'PASS', receipt_integrity: 'PASS' }), true);
  assert.equal(isCleanValidation({ quality_score: 100, pass_rate: 100, critical_findings: 0, high_findings: 1, drift: 0, mandatory_gates_pass: true, staging_health: 'PASS', receipt_integrity: 'PASS' }), false);
});

test('receipt redaction strips secret-like keys and bearer strings', () => {
  const value = redact({ api_key: 'abc', nested: { message: 'Bearer abcdefghijklmnop' } });
  assert.equal(value.api_key, '[REDACTED]');
  assert.equal(value.nested.message, '[REDACTED]');
});
