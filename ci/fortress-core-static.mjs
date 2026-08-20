import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isBlockedIp, validateEgressUrl, SSRF_LIMITATION } from "../browser-engine/ssrf.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  process.stdout.write(`PASS ${name}\n`);
}
async function checkAsync(name, fn) {
  await fn();
  passed++;
  process.stdout.write(`PASS ${name}\n`);
}

for (const ip of [
  "127.0.0.1", "10.0.0.1", "172.16.0.1", "192.168.1.1",
  "169.254.169.254", "100.64.0.1", "::1", "fd00::1", "fe80::1",
  "::ffff:127.0.0.1",
]) {
  check(`blocked-ip:${ip}`, () => assert.equal(isBlockedIp(ip), true));
}
check("public-ip-classification", () => assert.equal(isBlockedIp("8.8.8.8"), false));

for (const url of [
  "http://127.0.0.1/",
  "http://10.0.0.1/",
  "http://169.254.169.254/latest/meta-data/",
  "http://[::1]/",
  "file:///etc/passwd",
  "http://user:pass@example.com/",
  "https://example.com:444/",
]) {
  await checkAsync(`blocked-url:${url}`, async () => {
    const verdict = await validateEgressUrl(url);
    assert.equal(verdict.ok, false, JSON.stringify(verdict));
  });
}

const capabilities = read("base44/shared/capabilities.ts");
for (const [action, scope] of Object.entries({
  evaluate: "sessions:evaluate",
  extract_json: "sessions:evaluate",
  set_cookies: "sessions:storage",
  upload_file: "sessions:upload",
  download: "sessions:download",
  solve_captcha: "sessions:captcha",
  mock_response: "sessions:network_mock",
  crawl: "sessions:crawl",
})) {
  check(`capability:${action}`, () => assert.match(capabilities, new RegExp(`${action}:\\s*"${scope.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}"`)));
}

const gateway = read("base44/shared/gatewayCore.ts");
check("gateway-project-key", () => assert.match(gateway, /Project-scoped API key required/));
check("gateway-job-capability-check", () => assert.match(gateway, /missingActionCapabilities\(steps, scopes\)/));
check("gateway-auth-receipt", () => {
  assert.match(gateway, /authorization_key_id/);
  assert.match(gateway, /authorization_proof/);
  assert.match(gateway, /keyRecord\.key_hash/);
});

const runner = read("base44/shared/jobRunner.ts");
check("runner-auth-receipt-verification", () => {
  assert.match(runner, /authorization_key_id/);
  assert.match(runner, /authorization_proof/);
  assert.match(runner, /keyRecord\.key_hash.*job\.id/s);
});
check("runner-capability-ceiling", () => assert.match(runner, /assertCapabilityCeiling/));
check("runner-project-lineage", () => assert.match(runner, /project_id:\s*job\.project_id/));
check("runner-internal-webhook-dispatch", () => assert.match(runner, /dispatchWebhooks/));

const mcp = read("base44/functions/mcpTools/entry.ts");
check("mcp-project-key", () => assert.match(mcp, /Project-scoped API key required/));
check("mcp-action-capability", () => assert.match(mcp, /requiredCapability\(params\.action_type\)/));

for (const fn of ["triggerWebhook", "managePool", "engineAction"]) {
  const source = read(`base44/functions/${fn}/entry.ts`);
  check(`${fn}-admin-gate`, () => assert.match(source, /Admin role required/));
}
const resume = read("base44/functions/resumeSession/entry.ts");
check("resume-project-lineage", () => assert.match(resume, /project_id:\s*original\.project_id/));

const runtime = read("browser-engine/engine/runtime.js");
check("runtime-userDataDir-reject", () => assert.match(runtime, /userDataDir is prohibited/));
check("runtime-egress-guard", () => assert.match(runtime, /installEgressGuard\(context/));
check("runtime-extension-path-reject", () => assert.match(runtime, /Invalid extension identifier/));

const app = read("browser-engine/engine/app.js");
check("engine-degraded-health", () => assert.match(app, /healthStatus\(\)/));
check("engine-graceful-shutdown", () => assert.match(app, /Received \$\{signal\}; draining/));

const dockerfile = read("browser-engine/Dockerfile");
check("docker-shared-playwright-path", () => assert.match(dockerfile, /PLAYWRIGHT_BROWSERS_PATH=\/ms-playwright/));
check("docker-non-root", () => assert.match(dockerfile, /USER engine/));
check("docker-browser-ownership", () => assert.match(dockerfile, /chown -R engine:engine[^\n]*\/ms-playwright/));

check("dns-rebinding-not-self-certified", () => assert.match(SSRF_LIMITATION, /Network-layer private-range egress denial or resolver pinning/));

console.log(JSON.stringify({
  suite: "fortress-core-static",
  status: "PASS",
  passed,
  dns_rebinding_toctou: "EXTERNAL_EVIDENCE_REQUIRED",
  staging_required: true,
}, null, 2));
