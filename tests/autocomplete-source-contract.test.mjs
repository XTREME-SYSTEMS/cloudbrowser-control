import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

const continuous = read('base44/functions/runAutoCompleteContinuousCycle/entry.ts');
const validatorGateway = read('base44/functions/submitAutoCompleteValidationReceipt/entry.ts');
const repairIntegrity = read('base44/functions/enforceAutoCompleteRepairIntegrity/entry.ts');
const statusEndpoint = read('base44/functions/getAutoCompleteValidationStatus/entry.ts');
const bootstrap = read('base44/functions/bootstrapAutoCompleteControlPlane/entry.ts');
const preflight = read('base44/functions/autoCompletePreflight/entry.ts');
const wrapper = read('base44/functions/runAutoCompleteGovernedCycle/entry.ts');

const backendFunctionFiles = [
  'base44/functions/runAutoCompleteContinuousCycle/entry.ts',
  'base44/functions/runAutoCompleteGovernedCycle/entry.ts',
  'base44/functions/enforceAutoCompleteRepairIntegrity/entry.ts',
  'base44/functions/submitAutoCompleteValidationReceipt/entry.ts',
  'base44/functions/getAutoCompleteValidationStatus/entry.ts',
  'base44/functions/autoCompletePreflight/entry.ts',
  'base44/functions/bootstrapAutoCompleteControlPlane/entry.ts',
];

const schedulerFiles = [
  'base44/workflows/Governance Heartbeat.jsonc',
  'base44/workflows/System Health Monitor.jsonc',
  'base44/workflows/Fortress Engineer Cycle.jsonc',
  'base44/workflows/Architecture Health Monitor.jsonc',
  'base44/workflows/Railway Auto-Heal.jsonc',
];

test('AutoComplete backend function sources are TypeScript-syntax valid', () => {
  for (const path of backendFunctionFiles) {
    const source = read(path);
    const result = ts.transpileModule(source, {
      fileName: path,
      reportDiagnostics: true,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    });
    const errors = (result.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error);
    assert.equal(errors.length, 0, `${path} syntax diagnostics: ${errors.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join(' | ')}`);
  }
});

test('all AutoComplete hardening schedules delegate through governed wrapper', () => {
  for (const path of schedulerFiles) {
    const source = read(path);
    assert.match(source, /"function_name"\s*:\s*"runAutoCompleteGovernedCycle"/, `${path} must call governed wrapper`);
    assert.doesNotMatch(source, /"function_name"\s*:\s*"runAutoCompleteContinuousCycle"/, `${path} must not bypass postcondition wrapper`);
  }
});

test('governed wrapper always invokes repair-integrity postcondition', () => {
  assert.match(wrapper, /runAutoCompleteContinuousCycle/);
  assert.match(wrapper, /enforceAutoCompleteRepairIntegrity/);
  assert.match(wrapper, /protected_actions_remain_gated:\s*true/);
});

test('continuous orchestrator retains source, freshness, anti-replay, healing-budget and backpressure controls', () => {
  for (const required of [
    'MAX_CLOCK_SKEW_MS',
    'BENCHMARK_FRESH_MS',
    'HEAL_BUDGET_KEY',
    'ALLOWED_HEAL_TRIGGERS',
    'MAX_HEAL_RUNS_24H',
    'MAX_ACTIVE_JOBS',
    'MAX_QUEUED_JOBS',
    'MAX_UNRESOLVED_FLAGS',
    'CLEAN_EVIDENCE_PREFIX',
    'CLEAN_AT_PREFIX',
    'canonical_sha',
    'independent_validator',
    'validation_run_id',
  ]) {
    assert.ok(continuous.includes(required), `continuous orchestrator missing ${required}`);
  }
  assert.match(continuous, /delta\s*<\s*-MAX_CLOCK_SKEW_MS/);
  assert.match(continuous, /clean_streak/);
  assert.match(continuous, /verified_100/);
});

test('independent validator gateway fails closed on identity, run, timestamp, SHA and evidence', () => {
  for (const required of [
    'validation_run_id is required',
    'validator_agent_id is required',
    'observed_at is required',
    'source_sha is required',
    'source_sha does not match SystemManifest canonical_sha',
    'at least one concrete evidence field is required',
    'conflicting receipt already exists',
    'independent_validator: true',
    'validation_role: "independent_validator"',
    'evidence_hash',
    'repair_task_id',
    'failure_fingerprint',
  ]) {
    assert.ok(validatorGateway.includes(required), `validator gateway missing ${required}`);
  }
  assert.match(validatorGateway, /implementationAgentId\s*&&\s*implementationAgentId\s*===\s*validatorAgentId/);
});

test('repair closure requires independent receipt bound to exact SHA and repair/fingerprint', () => {
  for (const required of [
    'CONTRACT_VERSION',
    'independent_validator',
    'independent_validator"',
    'source_sha',
    'repair_task_id',
    'failure_fingerprint',
    'reopened_missing_independent_evidence',
    'reopened_regression',
    'resolution_receipt_id',
    'resolved_source_sha',
  ]) {
    assert.ok(repairIntegrity.includes(required), `repair integrity guard missing ${required}`);
  }
  assert.match(repairIntegrity, /receipt\.status\s*!==\s*"pass"/);
  assert.match(repairIntegrity, /data\.source_sha\s*!==\s*manifest\.canonical_sha/);
});

test('read-only certification status cannot report VERIFIED_100 with open repairs', () => {
  assert.match(statusEndpoint, /openRepairs\.length\s*===\s*0/);
  assert.match(statusEndpoint, /weightedScore\s*===\s*100/);
  assert.match(statusEndpoint, /streak\s*>=\s*3/);
  assert.match(statusEndpoint, /allPass\s*&&\s*allFresh/);
});

test('bootstrap is dry-run-first and protected', () => {
  assert.match(bootstrap, /body\.action\s*===\s*"apply"\s*\?\s*"apply"\s*:\s*"plan"/);
  assert.match(bootstrap, /BOOTSTRAP_AUTOCOMPLETE_CONTROL_PLANE/);
  assert.match(bootstrap, /protected_gate:\s*true/);
  assert.match(bootstrap, /explicit confirmation phrase required/);
});

test('preflight fails closed when control-plane entities or canonical source truth are missing', () => {
  for (const required of [
    'SystemManifest',
    'EvidenceReceipt',
    'RepairTask',
    'BenchmarkResult',
    'AuditLog',
    'Setting',
    'canonical_sha_not_pinned',
    'protected_gate_not_enabled',
  ]) {
    assert.ok(preflight.includes(required), `preflight missing ${required}`);
  }
});
