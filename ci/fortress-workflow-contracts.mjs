import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const CHECKOUT_PIN = 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1';
const SETUP_NODE_PIN = 'actions/setup-node@820762786026740c76f36085b0efc47a31fe5020';
const workflows = [
  '.github/workflows/fortress-dependency-remediation.yml',
  '.github/workflows/fortress-enterprise-integration.yml',
  '.github/workflows/fortress-enterprise-parallel.yml',
  '.github/workflows/fortress-ephemeral-validation.yml',
  '.github/workflows/fortress-release-readiness.yml',
  '.github/workflows/fortress-rollback-rehearsal.yml',
];
const broadPushWorkflows = workflows.filter((file) => !file.endsWith('fortress-dependency-remediation.yml'));
const checks = [];
function check(name, condition, detail = null) {
  checks.push({ name, status: condition ? 'PASS' : 'FAIL', detail });
  console[condition ? 'log' : 'error'](`${condition ? 'PASS' : 'FAIL'}: ${name}${detail ? ` - ${detail}` : ''}`);
}

for (const file of workflows) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  const checkoutRefs = [...text.matchAll(/actions\/checkout@([^\s#]+)/g)].map((m) => m[1]);
  const setupRefs = [...text.matchAll(/actions\/setup-node@([^\s#]+)/g)].map((m) => m[1]);
  check(`${file} checkout pinned to immutable v7.0.1 SHA`, checkoutRefs.length > 0 && checkoutRefs.every((ref) => `${'actions/checkout@'}${ref}` === CHECKOUT_PIN), checkoutRefs.join(','));
  if (setupRefs.length > 0) {
    check(`${file} setup-node pinned to immutable v7.0.0 SHA`, setupRefs.every((ref) => `${'actions/setup-node@'}${ref}` === SETUP_NODE_PIN), setupRefs.join(','));
  }
  const actionRefs = [...text.matchAll(/uses:\s+[^\s@]+@([^\s#]+)/g)].map((m) => m[1]);
  check(`${file} all external actions use full 40-char SHAs`, actionRefs.length > 0 && actionRefs.every((ref) => /^[0-9a-f]{40}$/i.test(ref)), actionRefs.join(','));
  check(`${file} has no mutable checkout/setup-node major tags`, !/actions\/(?:checkout|setup-node)@v\d+/i.test(text));
}

for (const file of broadPushWorkflows) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  check(`${file} ignores Fortress receipt-only commits`, text.includes('docs/FORTRESS_*_RECEIPT.md'));
}
const remediation = fs.readFileSync(path.join(root, '.github/workflows/fortress-dependency-remediation.yml'), 'utf8');
check('dependency remediation remains positive-path triggered', remediation.includes('paths:') && remediation.includes('ci/fortress-dependency-remediation-trigger.txt'));

const failed = checks.filter((x) => x.status === 'FAIL');
console.log(JSON.stringify({ suite: 'fortress-workflow-contracts', total: checks.length, pass: checks.length - failed.length, fail: failed.length, checks }, null, 2));
if (failed.length) process.exit(1);
