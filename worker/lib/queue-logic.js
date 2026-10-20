// Pure queue decision logic — no database, no network.
// Shared by worker/lib/queue.js (SQL binding) and the contract tests.

export const FAILURE_KINDS = Object.freeze([
  "timeout",
  "network",
  "validation",
  "auth",
  "unknown",
]);

/** Failure kinds that will never succeed on retry. */
export const NON_RETRYABLE_KINDS = Object.freeze(["validation", "auth"]);

export function classifyFailure(err) {
  const message = typeof err?.message === "string" ? err.message.toLowerCase() : "";
  if (/(timeout|timed out|etimedout|aborted|abort)/.test(message)) return "timeout";
  if (/(econnrefused|enotfound|eai_again|network|socket hang up|fetch failed)/.test(message)) return "network";
  if (/(validation|invalid|required|malformed)/.test(message)) return "validation";
  if (/(unauthorized|forbidden|401|403)/.test(message)) return "auth";
  return "unknown";
}

export function isRetryableFailure(err) {
  return !NON_RETRYABLE_KINDS.includes(classifyFailure(err));
}

/**
 * Exponential backoff with bounded jitter, capped at maxMs.
 * `random` is injectable so tests are deterministic.
 */
export function computeBackoff(attempt, { baseMs = 1000, maxMs = 300_000, jitter = 0.2, random = Math.random } = {}) {
  if (!Number.isFinite(baseMs) || baseMs <= 0) throw new Error("baseMs must be a positive number");
  if (!Number.isFinite(maxMs) || maxMs <= 0) throw new Error("maxMs must be a positive number");

  const safeAttempt = Math.max(1, Math.floor(Number(attempt) || 1));
  const ceiling = Math.min(maxMs, baseMs * 2 ** (safeAttempt - 1));
  if (!Number.isFinite(jitter) || jitter <= 0) return Math.round(ceiling);

  const spread = ceiling * jitter;
  const offset = (random() * 2 - 1) * spread;
  return Math.max(0, Math.min(maxMs, Math.round(ceiling + offset)));
}

/**
 * Decides what happens after an attempt fails.
 * @returns {{ outcome: 'succeeded'|'failed'|'dead_letter'|'retry', failureKind: string }}
 */
export function decideOutcome({ attempt, maxAttempts, err }) {
  if (!err) return { outcome: "succeeded", failureKind: "none" };

  const failureKind = classifyFailure(err);
  const attemptsUsed = Math.max(0, Math.floor(Number(attempt) || 0));
  const ceiling = Math.max(1, Math.floor(Number(maxAttempts) || 1));

  if (attemptsUsed >= ceiling) return { outcome: "dead_letter", failureKind };
  if (!NON_RETRYABLE_KINDS.includes(failureKind)) return { outcome: "retry", failureKind };
  return { outcome: "failed", failureKind };
}

export function isLeaseExpired(job, now = Date.now()) {
  if (!job || !job.lease_expires_at) return true;
  const expiry = new Date(job.lease_expires_at).getTime();
  if (!Number.isFinite(expiry)) return true;
  return expiry <= now;
}

/** Splits a batch of claimed jobs by whether their lease is still held. */
export function partitionByLease(jobs, now = Date.now()) {
  const held = [];
  const expired = [];
  for (const job of jobs || []) {
    if (isLeaseExpired(job, now)) expired.push(job);
    else held.push(job);
  }
  return { held, expired };
}