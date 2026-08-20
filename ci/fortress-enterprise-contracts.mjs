import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const src = {
  capabilities: read('base44/shared/capabilities.ts'),
  gateway: read('base44/shared/gatewayCore.ts'),
  runner: read('base44/shared/jobRunner.ts'),
  mcp: read('base44/functions/mcpTools/entry.ts'),
  runJob: read('base44/functions/runJob/entry.ts'),
  ssrf: read('browser-engine/ssrf.js'),
  dockerfile: read('browser-engine/Dockerfile'),
  matrix: read('base44/functions/runFortressMatrix/entry.ts'),
};

const checks = [];
function check(name, condition, detail = '') {
  checks.push({ name, status: condition ? 'PASS' : 'FAIL', detail });
  console[condition ? 'log' : 'error'](`${condition ? 'PASS' : 'FAIL'}: ${name}${detail ? ` :: ${detail}` : ''}`);
}
const has = (text, needle) => text.includes(needle);

const actionCapabilities = {
  evaluate: 'sessions:evaluate',
  extract_json: 'sessions:evaluate',
  set_cookies: 'sessions:storage',
  import_cookies: 'sessions:storage',
  export_cookies: 'sessions:storage',
  set_local_storage: 'sessions:storage',
  save_state: 'sessions:storage',
  restore_state: 'sessions:storage',
  upload_file: 'sessions:upload',
  download: 'sessions:download',
  solve_captcha: 'sessions:captcha',
  mock_response: 'sessions:network_mock',
  crawl: 'sessions:crawl',
};
for (const [action, scope] of Object.entries(actionCapabilities)) {
  check(`capability map ${action} -> ${scope}`, src.capabilities.includes(`${action}: "${scope}"`) || src.capabilities.includes(`${action}: '${scope}'`));
}
check('CDP session capability exists', has(src.capabilities, 'enableCDP: "sessions:cdp"'));
check('proxy session capability exists', has(src.capabilities, 'proxy: "sessions:proxy"'));
check('extension session capability exists', has(src.capabilities, 'extensions: "sessions:extensions"'));

check('gateway requires project-scoped API keys', has(src.gateway, 'Project-scoped API key required'));
check('gateway action path uses requiredCapability', has(src.gateway, 'requiredCapability(data.action_type)'));
check('gateway Job creation enforces action capability ceiling', has(src.gateway, 'missingActionCapabilities(steps, scopes)'));
check('gateway Job creation enforces session capability ceiling', has(src.gateway, 'missingSessionCapabilities(requestedSession, scopes)'));
check('gateway strips caller authorization proof', has(src.gateway, 'delete sessionConfig.authorization_proof'));
check('gateway strips caller authorized scopes', has(src.gateway, 'delete sessionConfig.authorized_scopes'));
check('gateway derives Job authorization proof server-side', has(src.gateway, '`${keyRecord.key_hash}:${job.id}`'));

check('runJob authenticates caller', has(src.runJob, 'base44.auth.me()'));
check('runJob denies non-owner jobs', has(src.runJob, 'job.created_by_id !== user.id'));
check('runJob rejects non-admin projectless jobs', has(src.runJob, '!isAdmin && !job.project_id'));
check('runJob passes trusted Job project to runner', has(src.runJob, 'authorizedProjectId: job.project_id || null'));
check('runJob body does not accept project_id as authority', !/\{\s*jobId\s*,\s*project_id/.test(src.runJob) && !/body\.project_id/.test(src.runJob));

check('job runner rejects projectless non-platform jobs', has(src.runner, 'Project-scoped Job required'));
check('job runner enforces authorized project equality', has(src.runner, 'authorizedProjectId !== job.project_id'));
check('job runner binds Session to Job project', /Session\.create\([\s\S]*?project_id:\s*job\.project_id/.test(src.runner));
check('job runner uses persisted conditional idempotency claim', /Job\.updateMany\([\s\S]*?status:\s*\{\s*\$in:/.test(src.runner));
check('job runner fingerprints idempotency keys', has(src.runner, 'sha256(idempotencyKey || `job:${job.id}`)'));
check('job runner validates delayed key project', has(src.runner, 'keyRecord.project_id !== job.project_id'));
check('job runner validates delayed key expiry', has(src.runner, 'keyRecord.expires_at'));
check('job runner validates delayed authorization proof', has(src.runner, 'expected !== authProof'));
check('job runner enforces execution capability ceiling', has(src.runner, 'assertCapabilityCeiling(job, steps, scopes)'));

check('MCP requires project-scoped API key', has(src.mcp, 'Project-scoped API key required'));
check('MCP session lookup enforces project ownership', has(src.mcp, 'session.project_id !== keyRecord.project_id'));
check('MCP browser_act enforces action-specific capability', has(src.mcp, 'requiredCapability(params.action_type)'));
check('MCP browser_observe enforces evaluate capability', has(src.mcp, 'requiredCapability("evaluate")'));
check('MCP browser_extract enforces extraction capability', has(src.mcp, 'requiredCapability(extractType)'));
check('MCP artifact read enforces project ownership', has(src.mcp, 'artifact.project_id !== keyRecord.project_id'));

check('SSRF resolves all DNS answers verbatim', has(src.ssrf, 'dns.lookup(hostname, { all: true, verbatim: true })'));
check('SSRF rejects if any resolved address is blocked', has(src.ssrf, 'addresses.some((entry) => isBlockedIp(entry.address))'));
check('browser egress guard intercepts every request', has(src.ssrf, 'context.route("**/*"'));
check('DNS-rebinding TOCTOU limitation remains explicit', has(src.ssrf, 'Chromium resolves independently after route.continue()'));

check('container uses deterministic Playwright path', has(src.dockerfile, 'PLAYWRIGHT_BROWSERS_PATH=/ms-playwright'));
check('container creates fixed non-root UID 10001', /useradd[^\n]*--uid\s+10001[^\n]*engine/.test(src.dockerfile));
check('container runs as engine user', /^USER engine$/m.test(src.dockerfile));
check('Playwright browsers readable by runtime user', has(src.dockerfile, 'chmod -R a+rX /ms-playwright'));

check('Fortress matrix distinguishes SKIP', /SKIP/.test(src.matrix));
check('Fortress matrix names external evidence requirement', /EXTERNAL EVIDENCE REQUIRED/i.test(src.matrix));
check('Fortress matrix does not contain literal pass:true shortcut', !/pass\s*:\s*true/.test(src.matrix));

const failed = checks.filter((row) => row.status !== 'PASS');
console.log(JSON.stringify({ suite: 'fortress-enterprise-contracts', total: checks.length, pass: checks.length - failed.length, fail: failed.length, checks }, null, 2));
if (failed.length) process.exit(1);
