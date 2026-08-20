import fs from 'node:fs';

const runtime = fs.readFileSync('browser-engine/engine/runtime.js', 'utf8');
const app = fs.readFileSync('browser-engine/engine/app.js', 'utf8');
const config = fs.readFileSync('browser-engine/engine/config.js', 'utf8');
const soak = fs.readFileSync('ci/fortress-engine-soak.mjs', 'utf8');

const checks = [];
function check(name, condition) {
  checks.push({ name, status: condition ? 'PASS' : 'FAIL' });
  console[condition ? 'log' : 'error'](`${condition ? 'PASS' : 'FAIL'}: ${name}`);
}

check('warm pool has a single-flight promise guard', runtime.includes('if (warmPoolPromise) return warmPoolPromise'));
check('warm pool clears single-flight promise after completion', runtime.includes('finally(() => { warmPoolPromise = null; })'));
check('warm replenishment is debounced', runtime.includes('export function scheduleWarmPool(delayMs = 250)') && runtime.includes('warmPoolTimer'));
check('pool launch yields while another Chromium launch is active or queued', runtime.includes('browserLaunchActive > 0 || browserLaunchQueued > 0'));
check('dynamic warm target accounts for active sessions', runtime.includes('WARM_POOL_INSTANCE_BUDGET - active'));
check('dynamic warm target also respects MAX_SESSIONS', runtime.includes('MAX_SESSIONS - active'));
check('rebalance drains excess pooled sessions', runtime.includes('pool_rebalanced'));
check('fresh active sessions schedule pool rebalance', runtime.includes('if (status !== "pooled") scheduleWarmPool()'));
check('pooled checkout schedules rather than eagerly runs refill', app.includes('scheduleWarmPool();') && !app.includes('pooled) {\n          warmPool().catch'));
check('session close schedules rather than eagerly runs refill', app.includes('const closed = await closeSession(req.params.id, "ended");\n    scheduleWarmPool();'));
check('warm launches stop at dynamic desired target', runtime.includes('pool.length >= desired'));
check('warm launch failures are counted', runtime.includes('warmPoolLaunchFailures++'));
check('Chromium launches are serialized through a global launch queue', runtime.includes('async function launchChromium(options)') && runtime.includes('await previous') && runtime.includes('return await chromium.launch(options)'));
check('direct chromium.launch calls are centralized', (runtime.match(/chromium\.launch\(/g) || []).length === 1);
check('launch queue metrics are exposed', runtime.includes('launch_active: browserLaunchActive') && runtime.includes('launch_queued: browserLaunchQueued'));
check('scheduled refill metric is exposed', runtime.includes('replenish_scheduled: Boolean(warmPoolTimer)'));
check('pool metrics expose active, target, failures, and replenishing state', ['active_sessions:', 'warm_target:', 'launch_failures:', 'replenishing:'].every((needle) => runtime.includes(needle)));
check('health uses dynamic warm target instead of static pool size', runtime.includes('const target = desiredWarmCount()') && runtime.includes('pool.length < target'));
check('warm budget is separately configurable', config.includes('WARM_POOL_INSTANCE_BUDGET'));
check('default warm budget reserves active-session headroom', config.includes('POOL_SIZE + 1'));
check('warm budget is clamped to MAX_SESSIONS', config.includes('Math.min(MAX_SESSIONS'));
check('engine config rejects invalid pool sizing', config.includes('POOL_SIZE must be an integer between 0 and MAX_SESSIONS'));
check('soak requests have explicit timeout', soak.includes('AbortSignal.timeout(REQUEST_TIMEOUT_MS)'));
check('soak retains four-session concurrent test', soak.includes("four concurrent sessions isolate and close cleanly"));
check('soak still requires final pool 3/3', soak.includes("waitPool(3)"));

const failed = checks.filter((row) => row.status !== 'PASS');
console.log(JSON.stringify({ suite: 'fortress-capacity-contracts', total: checks.length, pass: checks.length - failed.length, fail: failed.length, checks }, null, 2));
if (failed.length) process.exit(1);
