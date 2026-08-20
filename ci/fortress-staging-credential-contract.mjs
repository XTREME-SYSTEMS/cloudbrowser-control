import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const stagingPath = 'base44/shared/stagingEngineClient.ts';
const runtimeContractPath = 'base44/functions/runStagingCredentialContract/entry.ts';
const staging = read(stagingPath);
const production = read('base44/shared/engineClient.ts');
const liveGuard = read('base44/shared/liveTestGuard.ts');
const runtimeContract = read(runtimeContractPath);

const checks = [];
function check(name, pass, detail = '') {
  checks.push({ name, status: pass ? 'PASS' : 'FAIL', detail });
  console[pass ? 'log' : 'error'](`${pass ? 'PASS' : 'FAIL'}: ${name}${detail ? ` (${detail})` : ''}`);
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(rel));
    else if (/\.(?:ts|tsx|js|jsx)$/.test(entry.name)) out.push(rel);
  }
  return out;
}

check('canonical live guard still requires isolated-staging environment', liveGuard.includes('FORTRESS_TEST_ENVIRONMENT') && liveGuard.includes('isolated-staging'));
check('canonical live guard still requires isolated data proof', liveGuard.includes('FORTRESS_TEST_DATA_ISOLATED') && liveGuard.includes('isolatedData === "true"'));
check('staging client imports canonical live guard', staging.includes('import { requireIsolatedFortressTestEnvironment } from "./liveTestGuard.ts"'));
check('staging access awaits canonical live guard', staging.includes('await requireIsolatedFortressTestEnvironment()'));
check('staging access additionally requires operator validation mode', staging.includes('FORTRESS_STAGING_VALIDATION_MODE') && staging.includes('isolation.ok === true && stagingMode'));
check('staging client reads only staging URL secret', staging.includes('secrets.get("STAGING_ENGINE_URL")') && !staging.includes('secrets.get("ENGINE_URL")'));
check('staging client reads only staging API key secret', staging.includes('secrets.get("STAGING_ENGINE_API_KEY")') && !staging.includes('secrets.get("ENGINE_API_KEY")'));
check('staging client never imports production engine client', !/from\s+["'][^"']*engineClient\.ts["']/.test(staging));
check('staging config never falls back with production secret expression', !/STAGING_ENGINE_(?:URL|API_KEY)[\s\S]{0,160}\|\|[\s\S]{0,80}ENGINE_(?:URL|API_KEY)/.test(staging));
check('staging configuration fails with constant code', staging.includes('STAGING_ENGINE_CONFIGURATION_REQUIRED'));
check('staging key minimum length is enforced', staging.includes('stagingKey.length < 32'));
check('staging URL is HTTPS-only', staging.includes('parsed.protocol !== "https:"'));
check('staging URL blocks private/loopback/metadata hostnames', staging.includes('169.254.169.254') && staging.includes('/^10\\./') && staging.includes('/^192\\.168\\./'));
check('staging fetch has 30 second abort timeout', staging.includes('setTimeout(() => controller.abort(), 30000)'));
check('staging API key header cannot be overridden by caller headers', staging.indexOf('...(options.headers || {})') < staging.indexOf('"x-api-key": key'));
check('staging client has no console logging', !/console\.(?:log|info|warn|error|debug)/.test(staging));
check('production engine client has no staging credential references', !production.includes('STAGING_ENGINE_URL') && !production.includes('STAGING_ENGINE_API_KEY') && !production.includes('FORTRESS_STAGING_VALIDATION_MODE'));
check('runtime contract imports canonical live guard', runtimeContract.includes('from "../../shared/liveTestGuard.ts"'));
check('runtime contract imports staging client only', runtimeContract.includes('from "../../shared/stagingEngineClient.ts"') && !runtimeContract.includes('../../shared/engineClient.ts'));
check('runtime contract never reads production engine secrets', !runtimeContract.includes('secrets.get("ENGINE_URL")') && !runtimeContract.includes('secrets.get("ENGINE_API_KEY")'));
check('runtime contract never emits secret values', !/config\.key\s*[,}]/.test(runtimeContract) && !/console\./.test(runtimeContract));

const consumers = walk('base44')
  .filter((file) => file !== stagingPath)
  .filter((file) => read(file).includes('stagingEngineClient'));
check(
  'only approved Fortress runtime contract imports staging engine client',
  consumers.length === 1 && consumers[0] === runtimeContractPath,
  consumers.join(', ') || 'none'
);

for (const file of [
  'base44/shared/gatewayCore.ts',
  'base44/shared/jobRunner.ts',
  'base44/functions/runJob/entry.ts',
  'base44/functions/mcpTools/entry.ts',
]) {
  const source = read(file);
  check(`${file} cannot select staging credentials`, !source.includes('STAGING_ENGINE_') && !source.includes('stagingEngineClient'));
}

const failed = checks.filter((item) => item.status === 'FAIL');
console.log(JSON.stringify({
  suite: 'fortress-staging-credential-contract',
  total: checks.length,
  pass: checks.length - failed.length,
  fail: failed.length,
  checks,
}, null, 2));

if (failed.length) process.exit(1);
