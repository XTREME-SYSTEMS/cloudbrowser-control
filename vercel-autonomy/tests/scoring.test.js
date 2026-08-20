import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreValidation } from '../src/validation.js';

const greenChecks = [
  { name: 'Code Quality Gate', status: 'completed', conclusion: 'success' },
  { name: 'Browser Engine Syntax', status: 'completed', conclusion: 'success' },
  { name: 'Security Audit', status: 'completed', conclusion: 'success' },
  { name: 'Autonomy Worker', status: 'completed', conclusion: 'success' }
];

test('quality is 100 only when code and staging are fully green', () => {
  const v = scoreValidation({ checks: greenChecks, staging: { status: { engine: { connected: true } }, run: { totals: { total: 90, pass: 90, fail: 0, blocked: 0 } } } });
  assert.equal(v.quality_score, 100);
  assert.equal(v.clean_pass, true);
});

test('staging blocked check caps score below 100', () => {
  const v = scoreValidation({ checks: greenChecks, staging: { status: { engine: { connected: false } }, run: { totals: { total: 90, pass: 89, fail: 0, blocked: 1 } } } });
  assert.ok(v.quality_score < 100);
  assert.equal(v.clean_pass, false);
});
