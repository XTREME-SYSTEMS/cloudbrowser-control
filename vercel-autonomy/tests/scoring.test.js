import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreValidation } from '../src/validation.js';

const greenChecks = [
  { name: 'Code Quality Gate', status: 'completed', conclusion: 'success' },
  { name: 'Browser Engine Syntax', status: 'completed', conclusion: 'success' },
  { name: 'Security Audit', status: 'completed', conclusion: 'success' },
  { name: 'Autonomy Worker', status: 'completed', conclusion: 'success' }
];

const greenLegacy = [
  { name: 'runTestSuite', expected: 23, total: 23, passed: 23, failed: 0, pass: true },
  { name: 'runMasterReleaseSuite', expected: 47, total: 47, passed: 47, failed: 0, pass: true },
  { name: 'runDeployedTenantIsolationTests', expected: 18, total: 18, passed: 18, failed: 0, pass: true },
  { name: 'runMcpBlackBox', expected: 18, total: 18, passed: 18, failed: 0, pass: true },
  { name: 'runContextBlackBox', expected: 11, total: 11, passed: 11, failed: 0, pass: true }
];

test('quality is 100 only when code, staging, and every legacy suite are fully green', () => {
  const v = scoreValidation({ checks: greenChecks, legacySuites: greenLegacy, staging: { status: { engine: { connected: true } }, run: { totals: { total: 90, pass: 90, fail: 0, blocked: 0 } } } });
  assert.equal(v.quality_score, 100);
  assert.equal(v.clean_pass, true);
});

test('staging blocked check caps score below 100', () => {
  const v = scoreValidation({ checks: greenChecks, legacySuites: greenLegacy, staging: { status: { engine: { connected: false } }, run: { totals: { total: 90, pass: 89, fail: 0, blocked: 1 } } } });
  assert.ok(v.quality_score < 100);
  assert.equal(v.clean_pass, false);
});

test('a missing mandatory legacy suite prevents release readiness', () => {
  const v = scoreValidation({ checks: greenChecks, legacySuites: greenLegacy.slice(0, 4), staging: { status: { engine: { connected: true } }, run: { totals: { total: 90, pass: 90, fail: 0, blocked: 0 } } } });
  assert.ok(v.quality_score < 100);
  assert.equal(v.mandatory_gates_pass, false);
  assert.equal(v.clean_pass, false);
});
