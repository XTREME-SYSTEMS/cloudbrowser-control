import assert from 'node:assert/strict';
import { isBlockedIp, validateEgressUrl, SSRF_LIMITATION } from '../browser-engine/ssrf.js';

const checks = [];
async function check(name, fn) {
  try {
    const detail = await fn();
    checks.push({ name, status: 'PASS', detail: detail ?? null });
    console.log(`PASS: ${name}`);
  } catch (error) {
    checks.push({ name, status: 'FAIL', detail: error.message });
    console.error(`FAIL: ${name} :: ${error.message}`);
  }
}

const blockedIps = [
  '0.0.0.0','10.0.0.1','127.0.0.1','100.64.0.1','169.254.169.254',
  '172.16.0.1','172.31.255.255','192.168.1.1','224.0.0.1','255.255.255.255',
  '::','::1','fd00:ec2::254','fe80::1','fc00::1','fd12:3456::1','::ffff:127.0.0.1'
];
for (const ip of blockedIps) await check(`blocked IP ${ip}`, async () => assert.equal(isBlockedIp(ip), true));
for (const ip of ['1.1.1.1','8.8.8.8','93.184.216.34']) await check(`public IP ${ip} not classified private`, async () => assert.equal(isBlockedIp(ip), false));

const blockedUrls = [
  'file:///etc/passwd','gopher://127.0.0.1/','ftp://example.com/file',
  'http://user:pass@example.com/','http://127.0.0.1/','http://10.1.2.3/',
  'http://169.254.169.254/latest/meta-data/','http://[::1]/','http://metadata.google.internal/',
  'http://localhost/','http://foo.local/','http://vault.internal/','http://2130706433/',
  'http://017700000001/','http://0x7f000001/','https://8.8.8.8:22/'
];
for (const url of blockedUrls) {
  await check(`blocked URL ${url}`, async () => {
    const verdict = await validateEgressUrl(url);
    assert.equal(verdict.ok, false, JSON.stringify(verdict));
    return verdict.error;
  });
}

await check('public literal IP allowed on 443', async () => {
  const verdict = await validateEgressUrl('https://8.8.8.8/');
  assert.equal(verdict.ok, true, JSON.stringify(verdict));
  assert.equal(verdict.port, 443);
  return verdict.addresses;
});
await check('domain allowlist blocks non-member host', async () => {
  const verdict = await validateEgressUrl('https://8.8.8.8/', { allowed_domains: ['1.1.1.1'] });
  assert.equal(verdict.ok, false, JSON.stringify(verdict));
  assert.match(verdict.error, /Domain not allowed/);
});
await check('HTTPS enforcement rejects HTTP', async () => {
  const verdict = await validateEgressUrl('http://8.8.8.8/', { enforce_https: true });
  assert.equal(verdict.ok, false, JSON.stringify(verdict));
  assert.match(verdict.error, /HTTPS required/);
});
await check('custom port requires explicit allowlist', async () => {
  const blocked = await validateEgressUrl('https://8.8.8.8:8443/');
  assert.equal(blocked.ok, false);
  const allowed = await validateEgressUrl('https://8.8.8.8:8443/', { allowed_ports: [8443] });
  assert.equal(allowed.ok, true, JSON.stringify(allowed));
});
await check('DNS-rebinding status is explicit and evidence-scoped', async () => {
  if (/Final outbound TCP connections are DNS-pinned/i.test(SSRF_LIMITATION)) {
    assert.match(SSRF_LIMITATION, /network-layer destination denial remains recommended/i);
    assert.match(SSRF_LIMITATION, /separately verified/i);
  } else {
    assert.match(SSRF_LIMITATION, /Chromium resolves independently/i);
    assert.match(SSRF_LIMITATION, /Network-layer private-range egress denial or resolver pinning/i);
  }
});

const failed = checks.filter((row) => row.status !== 'PASS');
console.log(JSON.stringify({ suite: 'fortress-ssrf-adversarial', total: checks.length, pass: checks.length - failed.length, fail: failed.length, checks }, null, 2));
if (failed.length) process.exit(1);
