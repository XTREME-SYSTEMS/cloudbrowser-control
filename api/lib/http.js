// Pure HTTP primitives for the API gateway: request IDs, API-key parsing,
// error normalization, and an in-process fixed-window rate limiter.
//
// Deliberately dependency-free so it can be unit tested without installing
// the service runtime (see tests/portable-core.contract.test.mjs).
import crypto from "node:crypto";

/** API keys are presented as `cb_<env>_<8-char prefix>_<secret>`. */
export const API_KEY_PATTERN = /^(cb_(?:live|test))_([a-z0-9]{8})_([A-Za-z0-9_-]{24,})$/;

export function newRequestId() {
  return `req_${crypto.randomUUID().replace(/-/g, "")}`;
}

/**
 * @param {unknown} raw
 * @returns {{ environment: string, prefix: string, secret: string, raw: string } | null}
 */
export function parseApiKeyHeader(raw) {
  if (typeof raw !== "string") return null;
  const value = raw.trim().replace(/^Bearer\s+/i, "");
  const match = API_KEY_PATTERN.exec(value);
  if (!match) return null;
  return { environment: match[1], prefix: match[2], secret: match[3], raw: value };
}

export function hashApiKey(secret, pepper) {
  return crypto.createHmac("sha256", String(pepper)).update(String(secret)).digest("hex");
}

/** Length-checked, branch-free hex comparison (no early exit on mismatch). */
export function safeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length === 0 || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export class ValidationError extends Error {
  constructor(message) { super(message); this.name = "ValidationError"; }
}
export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") { super(message); this.name = "UnauthorizedError"; }
}
export class ForbiddenError extends Error {
  constructor(message = "Forbidden") { super(message); this.name = "ForbiddenError"; }
}
export class NotFoundError extends Error {
  constructor(message = "Not found") { super(message); this.name = "NotFoundError"; }
}
export class ConflictError extends Error {
  constructor(message = "Conflict") { super(message); this.name = "ConflictError"; }
}
export class RateLimitError extends Error {
  constructor(message = "Rate limit exceeded") { super(message); this.name = "RateLimitError"; }
}
export class UpstreamError extends Error {
  constructor(message = "Upstream service failed") { super(message); this.name = "UpstreamError"; }
}

const ERROR_MAP = [
  [/^ValidationError$/, 400, "invalid_request", false],
  [/^UnauthorizedError$/, 401, "unauthorized", false],
  [/^ForbiddenError$/, 403, "forbidden", false],
  [/^NotFoundError$/, 404, "not_found", false],
  [/^ConflictError$/, 409, "conflict", false],
  [/^RateLimitError$/, 429, "rate_limited", true],
  [/^UpstreamError$/, 502, "upstream_failure", true],
];

/**
 * Maps any thrown value to a stable HTTP status + machine code.
 * Unknown failures become a generic 500: internal messages never leak.
 */
export function normalizeError(err) {
  const name = typeof err?.name === "string" ? err.name : "";
  for (const [pattern, status, code, retryable] of ERROR_MAP) {
    if (pattern.test(name)) {
      const message = typeof err?.message === "string" && err.message ? err.message : code;
      return { status, code, message, retryable };
    }
  }
  return { status: 500, code: "internal_error", message: "Internal server error", retryable: true };
}

export function problemJson({ requestId, status, code, message, retryable }) {
  return {
    error: { code, message, retryable: Boolean(retryable) },
    request_id: requestId,
    status,
  };
}

/** Fixed-window limiter keyed by tenant or IP. In-process; see docs for edge limits. */
export class RateLimiter {
  constructor({ limit, windowMs, now = () => Date.now() }) {
    if (!Number.isFinite(limit) || limit <= 0) throw new ValidationError("limit must be a positive number");
    if (!Number.isFinite(windowMs) || windowMs <= 0) throw new ValidationError("windowMs must be a positive number");
    this.limit = limit;
    this.windowMs = windowMs;
    this.now = now;
    /** @type {Map<string, { start: number, count: number }>} */
    this.buckets = new Map();
  }

  check(key) {
    const t = this.now();
    const bucket = this.buckets.get(key);

    if (!bucket || t - bucket.start >= this.windowMs) {
      this.buckets.set(key, { start: t, count: 1 });
      return { allowed: true, remaining: this.limit - 1, resetAt: t + this.windowMs };
    }

    bucket.count += 1;
    return {
      allowed: bucket.count <= this.limit,
      remaining: Math.max(0, this.limit - bucket.count),
      resetAt: bucket.start + this.windowMs,
    };
  }

  sweep() {
    const t = this.now();
    for (const [key, bucket] of this.buckets) {
      if (t - bucket.start >= this.windowMs) this.buckets.delete(key);
    }
  }
}

/** Query-string coercion helpers — reject bad input instead of silently clamping. */
export function parseLimit(raw, { fallback = 25, max = 100 } = {}) {
  if (raw === undefined || raw === null || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) throw new ValidationError("limit must be a positive integer");
  return Math.min(value, max);
}

export function parseStatusFilter(raw, allowed) {
  if (raw === undefined || raw === null || raw === "") return [];
  const requested = String(raw).split(",").map((s) => s.trim()).filter(Boolean);
  const invalid = requested.filter((status) => !allowed.includes(status));
  if (invalid.length > 0) throw new ValidationError(`unsupported status: ${invalid.join(", ")}`);
  return [...new Set(requested)];
}

export function parseIsoTimestamp(raw, field = "timestamp") {
  if (raw === undefined || raw === null || raw === "") return null;
  const parsed = Date.parse(String(raw));
  if (!Number.isFinite(parsed)) throw new ValidationError(`${field} must be an ISO-8601 timestamp`);
  return new Date(parsed).toISOString();
}