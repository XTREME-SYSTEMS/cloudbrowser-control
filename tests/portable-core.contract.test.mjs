// Portable-core contract tests.
//
// Scope: the pure decision logic and published contracts of the portable
// services (api/, worker/, shared/, db/). These tests import only modules with
// no external runtime dependency, so they run in CI without installing the
// service dependencies.
//
// They also enforce the migration invariant: no portable-layer file may
// reference the Base44 platform SDK. Coupling can only come back by breaking
// the build.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  newRequestId,
  parseApiKeyHeader,
  hashApiKey,
  safeEqualHex,
  normalizeError,
  problemJson,
  RateLimiter,
  parseLimit,
  parseStatusFilter,
  parseIsoTimestamp,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  UpstreamError,
} from "../api/lib/http.js";

import {
  validateCreateJobInput,
  ALLOWED_JOB_TYPES,
  JOB_STATUSES,
  TERMINAL_JOB_STATUSES,
  isTerminalStatus,
  canCancelStatus,
  MAX_ATTEMPTS_CEILING,
} from "../api/lib/jobs.js";

import {
  computeBackoff,
  decideOutcome,
  classifyFailure,
  isRetryableFailure,
  isLeaseExpired,
  partitionByLease,
} from "../worker/lib/queue-logic.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readRepo = (relative) => readFileSync(path.join(repoRoot, relative), "utf8");

// ── Request identity ────────────────────────────────────────────────────
test("request ids are unique, prefixed, and URL-safe", () => {
  const ids = new Set();
  for (let i = 0; i < 500; i += 1) ids.add(newRequestId());
  assert.equal(ids.size, 500);
  for (const id of ids) assert.match(id, /^req_[a-f0-9]{32}$/);
});

// ── API key parsing ─────────────────────────────────────────────────────
test("api key parsing accepts well-formed live and test keys", () => {
  const live = parseApiKeyHeader("cb_live_abcd1234_" + "A".repeat(30));
  assert.equal(live?.environment, "cb_live");
  assert.equal(live?.prefix, "abcd1234");
  assert.equal(live?.secret.length, 30);

  const testKey = parseApiKeyHeader("cb_test_zzzz9999_" + "b".repeat(40));
  assert.equal(testKey?.environment, "cb_test");
});

test("api key parsing strips a Bearer prefix", () => {
  const parsed = parseApiKeyHeader("Bearer cb_live_abcd1234_" + "c".repeat(24));
  assert.equal(parsed?.environment, "cb_live");
});

test("api key parsing rejects malformed, short, and missing keys", () => {
  assert.equal(parseApiKeyHeader(undefined), null);
  assert.equal(parseApiKeyHeader(null), null);
  assert.equal(parseApiKeyHeader(""), null);
  assert.equal(parseApiKeyHeader("cb_live_abcd1234_short"), null);
  assert.equal(parseApiKeyHeader("cb_prod_abcd1234_" + "d".repeat(30)), null);
  assert.equal(parseApiKeyHeader("cb_live_ABCD1234_" + "e".repeat(30)), null);
});

test("key hashing is deterministic per pepper and diverges across peppers", () => {
  const a = hashApiKey("s".repeat(30), "pepper-one");
  const b = hashApiKey("s".repeat(30), "pepper-one");
  const c = hashApiKey("s".repeat(30), "pepper-two");
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^[a-f0-9]{64}$/);
});

test("constant-time hex comparison only matches identical digests", () => {
  const digest = hashApiKey("s".repeat(30), "pepper");
  assert.equal(safeEqualHex(digest, digest), true);
  assert.equal(safeEqualHex(digest, digest.slice(0, -1) + "0"), false);
  assert.equal(safeEqualHex(digest, digest.slice(1)), false);
  assert.equal(safeEqualHex("", ""), false);
  assert.equal(safeEqualHex(undefined, digest), false);
});

// ── Error normalization ─────────────────────────────────────────────────
test("every declared error maps to its documented status and code", () => {
  const cases = [
    [new ValidationError("bad"), 400, "invalid_request", false],
    [new UnauthorizedError(), 401, "unauthorized", false],
    [new ForbiddenError(), 403, "forbidden", false],
    [new NotFoundError(), 404, "not_found", false],
    [new ConflictError(), 409, "conflict", false],
    [new RateLimitError(), 429, "rate_limited", true],
    [new UpstreamError("engine down"), 502, "upstream_failure", true],
  ];
  for (const [err, status, code, retryable] of cases) {
    const normalized = normalizeError(err);
    assert.equal(normalized.status, status, code);
    assert.equal(normalized.code, code);
    assert.equal(normalized.retryable, retryable);
  }
});

test("unknown failures are redacted to a generic 500", () => {
  const normalized = normalizeError(new Error("connection string postgres://user:pw@host"));
  assert.equal(normalized.status, 500);
  assert.equal(normalized.code, "internal_error");
  assert.equal(normalized.message, "Internal server error");
  assert.equal(normalized.message.includes("pw@host"), false);
});

test("error envelope carries the request id and never a stack", () => {
  const body = problemJson({
    requestId: "req_x",
    status: 404,
    code: "not_found",
    message: "Job not found",
    retryable: false,
  });
  assert.deepEqual(Object.keys(body).sort(), ["error", "request_id", "status"]);
  assert.equal(body.request_id, "req_x");
  assert.equal(JSON.stringify(body).includes("stack"), false);
});

// ── Rate limiting ───────────────────────────────────────────────────────
test("rate limiter allows exactly the configured budget per window", () => {
  let now = 1_000;
  const limiter = new RateLimiter({ limit: 3, windowMs: 60_000, now: () => now });

  assert.equal(limiter.check("t1").allowed, true);
  assert.equal(limiter.check("t1").allowed, true);
  assert.equal(limiter.check("t1").allowed, true);
  const blocked = limiter.check("t1");
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);

  now += 60_000;
  assert.equal(limiter.check("t1").allowed, true);
});

test("rate limiter budgets are independent per key", () => {
  const limiter = new RateLimiter({ limit: 1, windowMs: 60_000, now: () => 1 });
  assert.equal(limiter.check("tenant-a").allowed, true);
  assert.equal(limiter.check("tenant-a").allowed, false);
  assert.equal(limiter.check("tenant-b").allowed, true);
});

test("rate limiter rejects invalid configuration instead of guessing", () => {
  assert.throws(() => new RateLimiter({ limit: 0, windowMs: 1000 }), ValidationError);
  assert.throws(() => new RateLimiter({ limit: 5, windowMs: 0 }), ValidationError);
});

// ── Query coercion ──────────────────────────────────────────────────────
test("limit falls back, coerces, and is capped", () => {
  assert.equal(parseLimit(undefined), 25);
  assert.equal(parseLimit(""), 25);
  assert.equal(parseLimit("10"), 10);
  assert.equal(parseLimit("5000"), 100);
  assert.throws(() => parseLimit("0"), ValidationError);
  assert.throws(() => parseLimit("-3"), ValidationError);
  assert.throws(() => parseLimit("abc"), ValidationError);
  assert.throws(() => parseLimit("1.5"), ValidationError);
});

test("status filter splits, de-duplicates, and rejects unknown values", () => {
  assert.deepEqual(parseStatusFilter(undefined, JOB_STATUSES), []);
  assert.deepEqual(parseStatusFilter("queued,leased", JOB_STATUSES), ["queued", "leased"]);
  assert.deepEqual(parseStatusFilter("queued,queued", JOB_STATUSES), ["queued"]);
  assert.throws(() => parseStatusFilter("queued,nonsense", JOB_STATUSES), ValidationError);
});

test("cursor timestamps must be parseable ISO-8601", () => {
  assert.equal(parseIsoTimestamp(undefined), null);
  assert.equal(parseIsoTimestamp("2026-10-20T00:00:00.000Z"), "2026-10-20T00:00:00.000Z");
  assert.throws(() => parseIsoTimestamp("not-a-date"), ValidationError);
});

// ── Job submission rules ────────────────────────────────────────────────
test("job creation normalizes defaults", () => {
  const job = validateCreateJobInput({ type: "engine.health" });
  assert.deepEqual(job, {
    type: "engine.health",
    payload: {},
    idempotencyKey: null,
    priority: 5,
    maxAttempts: 5,
  });
});

test("job creation rejects unknown types and malformed input", () => {
  assert.throws(() => validateCreateJobInput({}), ValidationError);
  assert.throws(() => validateCreateJobInput({ type: "" }), ValidationError);
  assert.throws(() => validateCreateJobInput({ type: "rm -rf" }), ValidationError);
  assert.throws(() => validateCreateJobInput({ type: "engine.health", payload: [] }), ValidationError);
  assert.throws(() => validateCreateJobInput({ type: "engine.health", priority: 0 }), ValidationError);
  assert.throws(() => validateCreateJobInput({ type: "engine.health", priority: 10 }), ValidationError);
  assert.throws(() => validateCreateJobInput({ type: "engine.health", priority: 2.5 }), ValidationError);
});

test("max_attempts is bounded by the documented ceiling", () => {
  assert.equal(
    validateCreateJobInput({ type: "artifact.prune", max_attempts: MAX_ATTEMPTS_CEILING }).maxAttempts,
    MAX_ATTEMPTS_CEILING,
  );
  assert.throws(
    () => validateCreateJobInput({ type: "artifact.prune", max_attempts: MAX_ATTEMPTS_CEILING + 1 }),
    ValidationError,
  );
});

test("idempotency keys must be meaningful strings", () => {
  assert.equal(
    validateCreateJobInput({ type: "engine.health", idempotency_key: "  abcdefgh  " }).idempotencyKey,
    "abcdefgh",
  );
  assert.throws(
    () => validateCreateJobInput({ type: "engine.health", idempotency_key: "short" }),
    ValidationError,
  );
  assert.throws(
    () => validateCreateJobInput({ type: "engine.health", idempotency_key: 42 }),
    ValidationError,
  );
});

test("only the two registered job types are accepted", () => {
  assert.deepEqual([...ALLOWED_JOB_TYPES].sort(), ["artifact.prune", "engine.health"]);
});

test("status helpers classify terminal and cancellable states correctly", () => {
  for (const status of TERMINAL_JOB_STATUSES) assert.equal(isTerminalStatus(status), true);
  assert.equal(isTerminalStatus("queued"), false);
  assert.equal(isTerminalStatus("leased"), false);

  assert.equal(canCancelStatus("queued"), true);
  assert.equal(canCancelStatus("leased"), true);
  for (const status of TERMINAL_JOB_STATUSES) assert.equal(canCancelStatus(status), false);
});

// ── Queue decisions ─────────────────────────────────────────────────────
test("backoff grows exponentially and never exceeds the ceiling", () => {
  const noJitter = { baseMs: 1000, maxMs: 60_000, jitter: 0 };
  assert.equal(computeBackoff(1, noJitter), 1000);
  assert.equal(computeBackoff(2, noJitter), 2000);
  assert.equal(computeBackoff(3, noJitter), 4000);
  assert.equal(computeBackoff(6, noJitter), 32_000);
  assert.equal(computeBackoff(20, noJitter), 60_000);

  for (let attempt = 1; attempt <= 25; attempt += 1) {
    const delay = computeBackoff(attempt, { baseMs: 1000, maxMs: 60_000, jitter: 0.2, random: () => 1 });
    assert.ok(delay <= 60_000, `attempt ${attempt} exceeded ceiling: ${delay}`);
    assert.ok(delay >= 0);
  }
});

test("backoff jitter stays inside the configured band", () => {
  const low = computeBackoff(4, { baseMs: 1000, maxMs: 1_000_000, jitter: 0.2, random: () => 0 });
  const high = computeBackoff(4, { baseMs: 1000, maxMs: 1_000_000, jitter: 0.2, random: () => 1 });
  assert.equal(low, 6400); // 8000 - 20%
  assert.equal(high, 9600); // 8000 + 20%
});

test("backoff rejects nonsensical bounds", () => {
  assert.throws(() => computeBackoff(1, { baseMs: 0 }), /baseMs/);
  assert.throws(() => computeBackoff(1, { baseMs: 100, maxMs: 0 }), /maxMs/);
});

test("failure classification covers timeout, network, validation and auth", () => {
  assert.equal(classifyFailure(new Error("request timeout after 30s")), "timeout");
  assert.equal(classifyFailure(new Error("socket hang up")), "network");
  assert.equal(classifyFailure(new Error("validation: grace_days must be >= 0")), "validation");
  assert.equal(classifyFailure(new Error("401 unauthorized")), "auth");
  assert.equal(classifyFailure(new Error("something else entirely")), "unknown");
  assert.equal(classifyFailure(null), "unknown");
});

test("validation and auth failures are never retried", () => {
  assert.equal(isRetryableFailure(new Error("validation: bad input")), false);
  assert.equal(isRetryableFailure(new Error("403 forbidden")), false);
  assert.equal(isRetryableFailure(new Error("socket hang up")), true);
  assert.equal(isRetryableFailure(new Error("ambiguous failure")), true);
});

test("outcome decision retries within budget, then dead-letters", () => {
  const transient = new Error("socket hang up");
  assert.equal(decideOutcome({ attempt: 1, maxAttempts: 3, err: transient }).outcome, "retry");
  assert.equal(decideOutcome({ attempt: 2, maxAttempts: 3, err: transient }).outcome, "retry");
  assert.equal(decideOutcome({ attempt: 3, maxAttempts: 3, err: transient }).outcome, "dead_letter");

  const permanent = new Error("validation: bad input");
  assert.equal(decideOutcome({ attempt: 1, maxAttempts: 5, err: permanent }).outcome, "failed");
  assert.equal(decideOutcome({ attempt: 1, maxAttempts: 5, err: permanent }).failureKind, "validation");

  assert.equal(decideOutcome({ attempt: 1, maxAttempts: 5, err: null }).outcome, "succeeded");
});

test("a single-attempt job dead-letters on its first transient failure", () => {
  const decision = decideOutcome({ attempt: 1, maxAttempts: 1, err: new Error("timeout") });
  assert.equal(decision.outcome, "dead_letter");
  assert.equal(decision.failureKind, "timeout");
});

test("lease expiry is fail-closed on missing or invalid timestamps", () => {
  const now = Date.parse("2026-10-20T12:00:00.000Z");
  assert.equal(isLeaseExpired({ lease_expires_at: new Date(now + 1000).toISOString() }, now), false);
  assert.equal(isLeaseExpired({ lease_expires_at: new Date(now).toISOString() }, now), true);
  assert.equal(isLeaseExpired({ lease_expires_at: null }, now), true);
  assert.equal(isLeaseExpired({}, now), true);
  assert.equal(isLeaseExpired(null, now), true);
  assert.equal(isLeaseExpired({ lease_expires_at: "garbage" }, now), true);
});

test("lease partitioning separates live work from orphaned work", () => {
  const now = Date.parse("2026-10-20T12:00:00.000Z");
  const { held, expired } = partitionByLease(
    [
      { id: "a", lease_expires_at: new Date(now + 60_000).toISOString() },
      { id: "b", lease_expires_at: new Date(now - 60_000).toISOString() },
      { id: "c" },
    ],
    now,
  );
  assert.deepEqual(held.map((job) => job.id), ["a"]);
  assert.deepEqual(expired.map((job) => job.id), ["b", "c"]);
});

// ── Published API contract ──────────────────────────────────────────────
test("the OpenAPI document is valid and describes the implemented surface", () => {
  const doc = JSON.parse(readRepo("api/openapi.json"));
  assert.match(doc.openapi, /^3\.1\./);
  assert.equal(doc.info.version, "1.0.0");
  assert.equal(doc.components.securitySchemes.ApiKeyAuth.name, "x-api-key");

  const required = [
    "/health",
    "/openapi.json",
    "/v1/jobs",
    "/v1/jobs/{id}",
    "/v1/jobs/{id}/attempts",
    "/v1/jobs/{id}/cancel",
    "/v1/sessions",
    "/v1/sessions/{id}",
  ];
  for (const routePath of required) {
    assert.ok(doc.paths[routePath], `missing documented path ${routePath}`);
  }

  for (const [routePath, operations] of Object.entries(doc.paths)) {
    for (const [method, operation] of Object.entries(operations)) {
      assert.ok(["get", "post", "put", "patch", "delete"].includes(method));
      assert.ok(operation.responses, `${method.toUpperCase()} ${routePath} has no responses`);
    }
  }

  assert.ok(doc.paths["/v1/jobs"].post.requestBody.required);
  assert.deepEqual(doc.paths["/health"].get.security, []);
});

test("the documented job type enum matches the enforced allowlist", () => {
  const doc = JSON.parse(readRepo("api/openapi.json"));
  const documented = doc.paths["/v1/jobs"].post.requestBody.content["application/json"].schema.properties.type.enum;
  assert.deepEqual([...documented].sort(), [...ALLOWED_JOB_TYPES].sort());
});

// ── Database contract ───────────────────────────────────────────────────
test("every tenant-owned table has row level security enabled", () => {
  const sql = readRepo("db/migrations/001_portable_core.sql");
  const tables = [
    "jobs",
    "job_attempts",
    "artifacts",
    "audit_log",
    "api_keys",
    "session_owners",
  ];
  for (const table of tables) {
    const enablePattern = new RegExp(`ALTER TABLE ${table}\\s+ENABLE ROW LEVEL SECURITY`);
    assert.ok(enablePattern.test(sql), `RLS not enabled on ${table}`);
    const policyPattern = new RegExp(`CREATE POLICY ${table}_tenant_isolation`);
    assert.ok(policyPattern.test(sql), `no tenant isolation policy on ${table}`);
  }
});

test("RLS policies are fail-closed when the tenant context is unset", () => {
  const sql = readRepo("db/migrations/001_portable_core.sql");
  const occurrences = sql.match(/NULLIF\(current_setting\('app\.tenant_id', true\), ''\)::UUID/g) || [];
  assert.ok(
    occurrences.length >= 6,
    `expected the fail-closed predicate on every policy, found ${occurrences.length}`,
  );
});

test("the worker role is the only bypass role and is never a login role", () => {
  const sql = readRepo("db/migrations/001_portable_core.sql");
  assert.match(sql, /CREATE ROLE cloudbrowser_worker NOLOGIN BYPASSRLS/);
  assert.match(sql, /CREATE ROLE cloudbrowser_api NOLOGIN;/);
  assert.equal(/CREATE ROLE cloudbrowser_api NOLOGIN BYPASSRLS/.test(sql), false);
});

test("idempotency is enforced by a partial unique index, not application code", () => {
  const sql = readRepo("db/migrations/001_portable_core.sql");
  assert.match(
    sql,
    /CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_idempotency\s+ON jobs \(tenant_id, idempotency_key\) WHERE idempotency_key IS NOT NULL/,
  );
});

// ── Migration invariant ─────────────────────────────────────────────────
const PORTABLE_DIRS = ["browser-engine", "operator", "python-sdk", "api", "worker", "shared", "db"];
const PLATFORM_COUPLING =
  /@base44\/sdk|@base44\/vite-plugin|base44Client|createClientFromRequest|base44\.entities|base44\.functions|base44\.auth|base44\.integrations/;

/**
 * Test files are excluded by default: an engine suite may legitimately READ
 * platform source as a fixture. Runtime coupling is what must be impossible.
 */
const isTestFile = (file) => /(^|\/)tests?\//.test(file) || /\.(test|spec)\./.test(file);

function walkPortableFiles({ includeTests = false } = {}) {
  const files = [];
  const stack = PORTABLE_DIRS.map((dir) => path.join(repoRoot, dir));
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (/\.(js|mjs|cjs|ts|tsx|jsx|py|json|sql|toml)$/.test(entry.name)) {
        // Markdown is deliberately excluded: integration documentation may
        // legitimately describe the platform it is being migrated away from.
        if (includeTests || !isTestFile(full)) files.push(full);
      }
    }
  }
  return files;
}

test("no portable runtime file references the Base44 platform SDK", () => {
  const files = walkPortableFiles();
  assert.ok(files.length >= 25, `expected to scan the portable layer, found ${files.length} files`);

  const offenders = files.filter((file) => PLATFORM_COUPLING.test(readFileSync(file, "utf8")));
  assert.deepEqual(
    offenders.map((file) => path.relative(repoRoot, file)),
    [],
    "portable runtime layers must stay platform-independent",
  );
});

test("the coupling scan would actually catch reintroduced coupling", () => {
  const sample = "import { createClient } from '@base44/sdk';";
  assert.equal(PLATFORM_COUPLING.test(sample), true);
  assert.equal(PLATFORM_COUPLING.test("base44.entities.SkipTrace.filter("), true);
  assert.equal(PLATFORM_COUPLING.test("no coupling here"), false);
});

// The engine's own suites assert contracts about platform source files (for
// example that src/pages/StrategicReport.jsx still reads through
// base44.entities). Those files READ platform source as a fixture; they do not
// depend on the platform runtime. This test keeps the distinction honest: any
// coupling found outside a test file is real coupling and fails the build.
test("platform symbol references are confined to test fixtures", () => {
  const coupled = walkPortableFiles({ includeTests: true }).filter((file) =>
    PLATFORM_COUPLING.test(readFileSync(file, "utf8")),
  );

  const runtimeCoupled = coupled.filter((file) => !isTestFile(file));
  assert.deepEqual(
    runtimeCoupled.map((file) => path.relative(repoRoot, file)),
    [],
    "platform symbols outside a test file are runtime coupling, not a fixture",
  );

  // Known migration tripwire: these fixture assertions break the moment the
  // frontend is ported off the platform data API, and must be rewritten then.
  assert.ok(coupled.length <= 5, `unexpected platform-fixture references: ${coupled.length}`);
});

test("service entry points import nothing from the platform", () => {
  const entries = [
    "browser-engine/server.js",
    "operator/index.js",
    "api/server.js",
    "worker/worker.js",
  ];
  for (const entry of entries) {
    const source = readRepo(entry);
    assert.equal(PLATFORM_COUPLING.test(source), false, `${entry} references the platform`);
    assert.equal(/@base44/.test(source), false, `${entry} imports the platform SDK`);
  }
});

// ── Configuration documentation ─────────────────────────────────────────
const RUNTIME_INJECTED = new Set([
  "NODE_ENV",
  "PORT",
  "HOSTNAME",
  "RAILWAY_REPLICA_ID",
  "RAILWAY_REGION",
  "REGION",
]);

test("every environment variable used by the new services is documented", () => {
  const env = readRepo(".env.example");
  const used = new Set();

  for (const file of walkPortableFiles()) {
    const relative = path.relative(repoRoot, file);
    if (!/^(api|worker|shared)\//.test(relative)) continue;
    if (!/\.(js|mjs)$/.test(relative)) continue;
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/process\.env\.([A-Z_][A-Z0-9_]*)/g)) used.add(match[1]);
  }

  assert.ok(used.size >= 15, `expected to find the service env surface, found ${used.size}`);
  const missing = [...used].filter((name) => !RUNTIME_INJECTED.has(name) && !env.includes(`${name}=`));
  assert.deepEqual(missing, [], "undocumented environment variables");
});