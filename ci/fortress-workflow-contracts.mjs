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
const writerPolicies = new Map([
  ['.github/workflows/fortress-dependency-remediation.yml', {
    job: 'safe-lockfile-remediation',
    paths: ['package-lock.json', 'docs/FORTRESS_DEPENDENCY_REMEDIATION_RECEIPT.md'],
  }],
  ['.github/workflows/fortress-enterprise-integration.yml', {
    job: 'aggregate',
    paths: ['docs/FORTRESS_ENTERPRISE_INTEGRATION_RECEIPT.md'],
  }],
  ['.github/workflows/fortress-enterprise-parallel.yml', {
    job: 'enterprise-gate',
    paths: ['docs/FORTRESS_ENTERPRISE_PARALLEL_RECEIPT.md'],
  }],
  ['.github/workflows/fortress-ephemeral-validation.yml', {
    job: 'validation-status',
    paths: ['docs/FORTRESS_EPHEMERAL_CI_RECEIPT.md'],
  }],
  ['.github/workflows/fortress-release-readiness.yml', {
    job: 'release-readiness',
    paths: ['docs/FORTRESS_RELEASE_READINESS_RECEIPT.md'],
  }],
  ['.github/workflows/fortress-rollback-rehearsal.yml', {
    job: 'receipt',
    paths: ['docs/FORTRESS_BRANCH_ROLLBACK_RECEIPT.md'],
  }],
]);
const broadPushWorkflows = workflows.filter((file) => !file.endsWith('fortress-dependency-remediation.yml'));
const checks = [];
function check(name, condition, detail = null) {
  checks.push({ name, status: condition ? 'PASS' : 'FAIL', detail });
  console[condition ? 'log' : 'error'](`${condition ? 'PASS' : 'FAIL'}: ${name}${detail ? ` - ${detail}` : ''}`);
}

function jobBlocks(text) {
  const lines = text.split('\n');
  const blocks = new Map();
  let inJobs = false;
  let current = null;
  for (const line of lines) {
    if (line === 'jobs:') {
      inJobs = true;
      current = null;
      continue;
    }
    if (!inJobs) continue;
    const jobMatch = line.match(/^  ([A-Za-z0-9_-]+):\s*$/);
    if (jobMatch) {
      current = jobMatch[1];
      blocks.set(current, []);
      continue;
    }
    if (current) blocks.get(current).push(line);
  }
  return blocks;
}

function checkoutPolicies(blockText) {
  const lines = blockText.split('\n');
  const results = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!/^\s*-\s+uses:\s+actions\/checkout@/.test(lines[i])) continue;
    let persist = null;
    for (let j = i + 1; j < Math.min(lines.length, i + 8); j += 1) {
      if (/^\s*-\s+/.test(lines[j])) break;
      const match = lines[j].match(/^\s+persist-credentials:\s*(true|false)\s*$/);
      if (match) {
        persist = match[1] === 'true';
        break;
      }
    }
    results.push(persist);
  }
  return results;
}

function gitAddCommands(blockText) {
  return [...blockText.matchAll(/^\s+(git add\s+.+?)\s*$/gm)].map((m) => m[1].trim());
}

for (const file of workflows) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  const actionUses = [...text.matchAll(/^\s*-\s+uses:\s+([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)@([^\s#]+)/gm)]
    .map((m) => ({ action: m[1], ref: m[2] }));
  const checkoutRefs = actionUses.filter((x) => x.action === 'actions/checkout').map((x) => x.ref);
  const setupRefs = actionUses.filter((x) => x.action === 'actions/setup-node').map((x) => x.ref);
  check(`${file} checkout pinned to immutable v7.0.1 SHA`, checkoutRefs.length > 0 && checkoutRefs.every((ref) => `${'actions/checkout@'}${ref}` === CHECKOUT_PIN), checkoutRefs.join(','));
  if (setupRefs.length > 0) {
    check(`${file} setup-node pinned to immutable v7.0.0 SHA`, setupRefs.every((ref) => `${'actions/setup-node@'}${ref}` === SETUP_NODE_PIN), setupRefs.join(','));
  }
  check(`${file} all external actions use full 40-char SHAs`, actionUses.length > 0 && actionUses.every((x) => /^[0-9a-f]{40}$/i.test(x.ref)), actionUses.map((x) => `${x.action}@${x.ref}`).join(','));
  check(`${file} has no mutable checkout/setup-node uses`, !actionUses.some((x) => (x.action === 'actions/checkout' || x.action === 'actions/setup-node') && /^v\d+/i.test(x.ref)));
  check(`${file} workflow default token is contents read`, /^permissions:\n  contents: read\s*$/m.test(text));

  const blocks = jobBlocks(text);
  const policy = writerPolicies.get(file);
  const writerJob = policy.job;
  const writerBlock = blocks.get(writerJob)?.join('\n') || '';
  check(`${file} writer job ${writerJob} alone receives contents write`, /^    permissions:\n      contents: write\s*$/m.test(writerBlock));

  let readOnlyCheckoutCount = 0;
  let readOnlyCheckoutSafe = true;
  let writerCheckoutCount = 0;
  let writerCheckoutSafe = true;
  for (const [jobName, lines] of blocks) {
    const policies = checkoutPolicies(lines.join('\n'));
    if (jobName === writerJob) {
      writerCheckoutCount += policies.length;
      writerCheckoutSafe = writerCheckoutSafe && policies.every((persist) => persist === true);
    } else {
      readOnlyCheckoutCount += policies.length;
      readOnlyCheckoutSafe = readOnlyCheckoutSafe && policies.every((persist) => persist === false);
      check(`${file} non-writer job ${jobName} has no contents write escalation`, !/^    permissions:\n      contents: write\s*$/m.test(lines.join('\n')));
    }
  }
  check(`${file} read-only checkouts disable persisted credentials`, readOnlyCheckoutCount === 0 || readOnlyCheckoutSafe, `count=${readOnlyCheckoutCount}`);
  check(`${file} writer checkout explicitly preserves push credential only in writer job`, writerCheckoutCount > 0 && writerCheckoutSafe, `count=${writerCheckoutCount}`);

  const addCommands = gitAddCommands(writerBlock);
  const expectedAdd = `git add ${policy.paths.join(' ')}`;
  check(`${file} writer stages only approved paths`, addCommands.length === 1 && addCommands[0] === expectedAdd, addCommands.join(' | '));
  check(`${file} writer has no broad git staging`, !/^\s*git add\s+(?:\.|-A|--all)(?:\s|$)/m.test(writerBlock));
  check(`${file} writer has no commit-all shortcut`, !/^\s*git commit\b[^\n]*(?:\s-a(?:\s|$)|--all(?:\s|$))/m.test(writerBlock));
  check(`${file} writer checkout is pinned to fortress/v1.1`, /\n\s+ref:\s+fortress\/v1\.1\s*(?:\n|$)/.test(writerBlock));
  check(`${file} writer pushes only HEAD to fortress/v1.1`, /git push origin HEAD:fortress\/v1\.1/.test(writerBlock) && !/^\s*git push\b[^\n]*(?:--force|-f(?:\s|$)|--mirror|--all|\bmain\b)/m.test(writerBlock));
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
