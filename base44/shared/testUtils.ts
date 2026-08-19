// ═══════════════════════════════════════════════
// Shared Test Utilities — used by all test suites
// ═══════════════════════════════════════════════

export async function hashKey(key) {
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function genKey() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return "cb_live_" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hmacSha256(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function callGateway(base44, payload) {
  try {
    const res = await base44.asServiceRole.functions.invoke("cloudBrowserGatewayV6", payload);
    return { ok: res.status < 400, status: res.status, data: res.data, error: res.data?.error };
  } catch (e) {
    const status = e.status || e.response?.status || e.response?.statusCode || e.statusCode || 500;
    const data = e.data || e.response?.data || e.response?._data || {};
    return { ok: status < 400, status, data, error: data.error || e.message };
  }
}

export async function runTest(base44, runId, suite, testName, category, maxPoints, testFn) {
  const start = Date.now();
  try {
    const result = await testFn();
    const duration = Date.now() - start;
    const passed = result === true || result?.pass === true;
    await base44.asServiceRole.entities.TestResult.create({
      suite, test_name: testName,
      status: passed ? "pass" : "fail",
      duration_ms: duration,
      error_message: passed ? "" : (result?.error || "Test returned false"),
      score_category: category,
      score_points: passed ? maxPoints : 0,
      max_points: maxPoints,
      run_id: runId,
    });
    return { pass: passed, duration, error: passed ? null : (result?.error || "failed") };
  } catch (e) {
    const duration = Date.now() - start;
    await base44.asServiceRole.entities.TestResult.create({
      suite, test_name: testName,
      status: "fail",
      duration_ms: duration,
      error_message: e.message,
      score_category: category,
      score_points: 0,
      max_points: maxPoints,
      run_id: runId,
    });
    return { pass: false, duration, error: e.message };
  }
}

export function percentile(sortedArr, p) {
  if (!sortedArr.length) return 0;
  const idx = Math.ceil((p / 100) * sortedArr.length) - 1;
  return sortedArr[Math.max(0, Math.min(idx, sortedArr.length - 1))];
}