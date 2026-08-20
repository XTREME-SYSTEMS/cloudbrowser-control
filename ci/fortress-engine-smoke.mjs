const BASE = process.env.FORTRESS_ENGINE_URL || "http://127.0.0.1:8080";
const API_KEY = process.env.ENGINE_API_KEY;
if (!API_KEY) throw new Error("ENGINE_API_KEY is required for smoke tests");

const results = [];

async function request(path, { method = "GET", body, auth = true, origin } = {}) {
  const headers = {};
  if (auth) headers["x-api-key"] = API_KEY;
  if (body !== undefined) headers["content-type"] = "application/json";
  if (origin) headers.origin = origin;
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  return { response, data };
}

async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, status: "PASS", detail: detail ?? null });
    console.log(`PASS: ${name}${detail ? ` :: ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`);
  } catch (error) {
    results.push({ name, status: "FAIL", detail: error.message });
    console.error(`FAIL: ${name} :: ${error.message}`);
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForPool(target = 3, timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    const { response, data } = await request("/pool");
    if (response.ok) {
      last = data;
      if (Number(data.poolSize) >= target && Number(data.warmCount) >= target) return data;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`Pool did not reach ${target}/${target}; last=${JSON.stringify(last)}`);
}

await check("liveness endpoint responds", async () => {
  const { response, data } = await request("/liveness", { auth: false });
  expect(response.ok && data?.ok === true, `status=${response.status} body=${JSON.stringify(data)}`);
  return data;
});

await check("readiness launches Chromium", async () => {
  const { response, data } = await request("/readiness", { auth: false });
  expect(response.ok && data?.browser_launch === "verified", `status=${response.status} body=${JSON.stringify(data)}`);
  return data;
});

await check("runtime identity is non-root", async () => {
  const { response, data } = await request("/health", { auth: false });
  expect(response.ok, `health status=${response.status} body=${JSON.stringify(data)}`);
  expect(Number(data?.runtime_user?.uid) !== 0, `runtime uid=${data?.runtime_user?.uid}`);
  return data.runtime_user;
});

await check("warm pool reaches 3/3", async () => waitForPool(3));

await check("authenticated endpoint rejects missing key", async () => {
  const { response } = await request("/pool", { auth: false });
  expect(response.status === 401, `expected 401, got ${response.status}`);
  return `status=${response.status}`;
});

await check("CORS fails closed for untrusted origin", async () => {
  const { response } = await request("/health", { auth: false, origin: "https://evil.invalid" });
  expect(response.status >= 400, `expected rejection, got ${response.status}`);
  return `status=${response.status}`;
});

await check("CORS allows configured origin", async () => {
  const { response } = await request("/health", { auth: false, origin: "https://allowed.invalid" });
  expect(response.ok, `status=${response.status}`);
  expect(response.headers.get("access-control-allow-origin") === "https://allowed.invalid", `allow-origin=${response.headers.get("access-control-allow-origin")}`);
  return response.headers.get("access-control-allow-origin");
});

await check("userDataDir is rejected", async () => {
  const { response, data } = await request("/sessions", { method: "POST", body: { usePool: false, userDataDir: "/tmp/escape" } });
  expect(response.status === 400 && /prohibited/i.test(data?.error || ""), `status=${response.status} body=${JSON.stringify(data)}`);
  return data;
});

await check("extension filesystem path is rejected", async () => {
  const { response, data } = await request("/sessions", { method: "POST", body: { usePool: false, extensions: ["../../etc"] } });
  expect(response.status === 400 && /extension/i.test(data?.error || ""), `status=${response.status} body=${JSON.stringify(data)}`);
  return data;
});

let sessionId = null;
await check("fresh browser session can be created", async () => {
  const { response, data } = await request("/sessions", { method: "POST", body: { usePool: false } });
  expect(response.ok && data?.sessionId, `status=${response.status} body=${JSON.stringify(data)}`);
  sessionId = data.sessionId;
  return { sessionId: data.sessionId, workerId: data.workerId };
});

if (sessionId) {
  await check("public navigation control succeeds", async () => {
    const { response, data } = await request(`/sessions/${sessionId}/execute`, {
      method: "POST",
      body: { action_type: "goto", value: "https://example.com", options: { timeout: 20000 } },
    });
    expect(response.ok && data?.ok === true, `status=${response.status} body=${JSON.stringify(data)}`);
    expect(String(data?.url || "").startsWith("https://example.com"), `unexpected url=${data?.url}`);
    return { url: data.url, title: data.title };
  });

  await check("loopback navigation is blocked", async () => {
    const { response, data } = await request(`/sessions/${sessionId}/execute`, {
      method: "POST",
      body: { action_type: "goto", value: "http://127.0.0.1:8080/health" },
    });
    expect(!response.ok && /rejected|blocked/i.test(data?.error || ""), `status=${response.status} body=${JSON.stringify(data)}`);
    return data;
  });

  await check("metadata navigation is blocked", async () => {
    const { response, data } = await request(`/sessions/${sessionId}/execute`, {
      method: "POST",
      body: { action_type: "goto", value: "http://169.254.169.254/latest/meta-data/" },
    });
    expect(!response.ok && /rejected|blocked/i.test(data?.error || ""), `status=${response.status} body=${JSON.stringify(data)}`);
    return data;
  });

  await check("page-side fetch to loopback is blocked", async () => {
    const fn = `(async () => { try { await fetch('http://127.0.0.1:8080/health'); return 'UNEXPECTED_ALLOWED'; } catch { return 'BLOCKED'; } })`;
    const { response, data } = await request(`/sessions/${sessionId}/execute`, {
      method: "POST",
      body: { action_type: "evaluate", options: { fn } },
    });
    expect(response.ok && data?.data === "BLOCKED", `status=${response.status} body=${JSON.stringify(data)}`);
    return data.data;
  });

  await check("image subresource to loopback is blocked", async () => {
    const fn = `() => new Promise((resolve) => { const img = new Image(); const timer = setTimeout(() => resolve('TIMEOUT'), 4000); img.onload = () => { clearTimeout(timer); resolve('UNEXPECTED_ALLOWED'); }; img.onerror = () => { clearTimeout(timer); resolve('BLOCKED'); }; img.src = 'http://127.0.0.1:8080/health'; document.body.appendChild(img); })`;
    const { response, data } = await request(`/sessions/${sessionId}/execute`, {
      method: "POST",
      body: { action_type: "evaluate", options: { fn } },
    });
    expect(response.ok && data?.data === "BLOCKED", `status=${response.status} body=${JSON.stringify(data)}`);
    return data.data;
  });

  await check("iframe subresource to loopback is blocked", async () => {
    const fn = `() => new Promise((resolve) => { const frame = document.createElement('iframe'); const timer = setTimeout(() => resolve('BLOCKED_OR_TIMEOUT'), 4000); frame.onload = () => { clearTimeout(timer); try { resolve(frame.contentWindow.location.href.includes('127.0.0.1') ? 'UNEXPECTED_ALLOWED' : 'BLOCKED'); } catch { resolve('BLOCKED'); } }; frame.onerror = () => { clearTimeout(timer); resolve('BLOCKED'); }; frame.src = 'http://127.0.0.1:8080/health'; document.body.appendChild(frame); })`;
    const { response, data } = await request(`/sessions/${sessionId}/execute`, {
      method: "POST",
      body: { action_type: "evaluate", options: { fn } },
    });
    expect(response.ok && ["BLOCKED", "BLOCKED_OR_TIMEOUT"].includes(data?.data), `status=${response.status} body=${JSON.stringify(data)}`);
    return data.data;
  });

  await check("runtime mock_response cannot bypass authoritative egress guard", async () => {
    const { response, data } = await request(`/sessions/${sessionId}/execute`, {
      method: "POST",
      body: { action_type: "mock_response", options: { url: "**/*", body: "{}" } },
    });
    expect(!response.ok && /disabled/i.test(data?.error || ""), `status=${response.status} body=${JSON.stringify(data)}`);
    return data;
  });

  await check("session close is idempotent", async () => {
    const first = await request(`/sessions/${sessionId}`, { method: "DELETE" });
    const second = await request(`/sessions/${sessionId}`, { method: "DELETE" });
    expect(first.response.ok && second.response.ok, `first=${first.response.status} second=${second.response.status}`);
    return { first: first.data, second: second.data };
  });
}

const failed = results.filter((result) => result.status !== "PASS");
console.log(JSON.stringify({
  suite: "fortress-engine-smoke",
  passed: results.length - failed.length,
  failed: failed.length,
  total: results.length,
  results,
}, null, 2));

if (failed.length) process.exit(1);
