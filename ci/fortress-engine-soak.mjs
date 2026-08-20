const BASE = process.env.FORTRESS_ENGINE_URL || 'http://127.0.0.1:8080';
const API_KEY = process.env.ENGINE_API_KEY;
if (!API_KEY) throw new Error('ENGINE_API_KEY is required');

async function req(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {};
  if (auth) headers['x-api-key'] = API_KEY;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const response = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  return { response, data };
}
function expect(condition, message) { if (!condition) throw new Error(message); }
async function waitPool(target = 3, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    const r = await req('/pool');
    last = r.data;
    if (r.response.ok && Number(r.data?.warmCount) >= target) return r.data;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`pool recovery failed: ${JSON.stringify(last)}`);
}
async function createSession(usePool = true) {
  const r = await req('/sessions', { method: 'POST', body: { usePool } });
  expect(r.response.ok && r.data?.sessionId, `create failed ${r.response.status}: ${JSON.stringify(r.data)}`);
  return r.data.sessionId;
}
async function closeSession(id) {
  const r = await req(`/sessions/${id}`, { method: 'DELETE' });
  expect(r.response.ok, `close failed ${r.response.status}: ${JSON.stringify(r.data)}`);
}
async function execute(id, action_type, value, options = {}) {
  const r = await req(`/sessions/${id}/execute`, { method: 'POST', body: { action_type, value, options } });
  expect(r.response.ok && r.data?.ok !== false, `execute failed ${r.response.status}: ${JSON.stringify(r.data)}`);
  return r.data;
}

const results = [];
async function check(name, fn) {
  const started = Date.now();
  try { const detail = await fn(); results.push({ name, status: 'PASS', ms: Date.now() - started, detail }); console.log(`PASS: ${name}`); }
  catch (error) { results.push({ name, status: 'FAIL', ms: Date.now() - started, detail: error.message }); console.error(`FAIL: ${name} :: ${error.message}`); }
}

await check('initial pool 3/3', async () => waitPool(3));
await check('six sequential pooled lifecycle cycles recover', async () => {
  for (let i = 0; i < 6; i++) {
    const id = await createSession(true);
    await execute(id, 'goto', 'https://example.com', { timeout: 20000 });
    await execute(id, 'evaluate', null, { fn: '() => document.title' });
    await closeSession(id);
    await waitPool(3);
  }
  return { cycles: 6 };
});
await check('four concurrent sessions isolate and close cleanly', async () => {
  const ids = await Promise.all(Array.from({ length: 4 }, () => createSession(true)));
  await Promise.all(ids.map((id) => execute(id, 'goto', 'https://example.com', { timeout: 20000 })));
  await Promise.all(ids.map((id) => execute(id, 'evaluate', null, { fn: '() => ({title:document.title,url:location.href})' })));
  await Promise.all(ids.map(closeSession));
  await waitPool(3);
  return { concurrent_sessions: ids.length };
});
await check('blocked navigation remains blocked after soak', async () => {
  const id = await createSession(true);
  try {
    const r = await req(`/sessions/${id}/execute`, { method: 'POST', body: { action_type: 'goto', value: 'http://169.254.169.254/latest/meta-data/' } });
    expect(!r.response.ok, `metadata unexpectedly allowed: ${JSON.stringify(r.data)}`);
    return { status: r.response.status, error: r.data?.error };
  } finally { await closeSession(id); await waitPool(3); }
});
await check('final health remains non-root and pool-ready', async () => {
  const health = await req('/health', { auth: false });
  expect(health.response.ok, `health ${health.response.status}`);
  expect(Number(health.data?.runtime_user?.uid) !== 0, `uid=${health.data?.runtime_user?.uid}`);
  const pool = await waitPool(3);
  return { runtime_user: health.data.runtime_user, pool };
});

const failed = results.filter((row) => row.status !== 'PASS');
console.log(JSON.stringify({ suite: 'fortress-engine-soak', total: results.length, pass: results.length - failed.length, fail: failed.length, results }, null, 2));
if (failed.length) process.exit(1);
