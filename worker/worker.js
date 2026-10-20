#!/usr/bin/env node
// CloudBrowser Control durable job worker.
//
// Guarantees:
//   * At-most-once execution per lease — claiming uses FOR UPDATE SKIP LOCKED.
//   * Bounded retries with exponential backoff + jitter, then dead-letter.
//   * Crash recovery: expired leases are reaped back onto the queue.
//   * Per-attempt audit trail in job_attempts.
import { getPool, closePool, withTenant } from "../shared/db.js";
import {
  claimNextJob,
  heartbeat,
  completeJob,
  failJob,
  reapExpiredLeases,
  recordAttempt,
} from "./lib/queue.js";
import { computeBackoff, decideOutcome } from "./lib/queue-logic.js";

const WORKER_ID = process.env.RAILWAY_REPLICA_ID || process.env.HOSTNAME || `worker-${process.pid}`;
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 2000);
const CONCURRENCY = Math.max(1, Number(process.env.WORKER_CONCURRENCY || 2));
const LEASE_MS = Number(process.env.LEASE_MS || 120_000);
const BACKOFF_BASE_MS = Number(process.env.BACKOFF_BASE_MS || 1000);
const BACKOFF_MAX_MS = Number(process.env.BACKOFF_MAX_MS || 300_000);
const REAP_INTERVAL_MS = Number(process.env.REAP_INTERVAL_MS || 30_000);

let running = true;

const log = (level, msg, extra = {}) =>
  console.log(JSON.stringify({ level, msg, worker_id: WORKER_ID, ...extra }));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Handlers ────────────────────────────────────────────────────────────
// Every handler performs a real side effect. Errors are prefixed with the
// failure kind (validation:, network:, auth:) so queue-logic classifies them
// without guessing, and non-retryable kinds skip straight to terminal state.
const handlers = new Map();

handlers.set("engine.health", async () => {
  const baseUrl = process.env.ENGINE_URL;
  const apiKey = process.env.ENGINE_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error("validation: ENGINE_URL and ENGINE_API_KEY are required");
  }

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    Number(process.env.ENGINE_HEALTH_TIMEOUT_MS || 10_000),
  );
  try {
    const response = await fetch(`${String(baseUrl).replace(/\/+$/, "")}/health`, {
      signal: controller.signal,
      headers: { "x-api-key": apiKey },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(`network: engine health returned ${response.status}`);
    return { engine: body, checked_at: new Date().toISOString() };
  } finally {
    clearTimeout(timer);
  }
});

handlers.set("artifact.prune", async (job) => {
  const graceDays = Number(job.payload?.grace_days ?? 30);
  if (!Number.isFinite(graceDays) || graceDays < 0) {
    throw new Error("validation: grace_days must be a number >= 0");
  }

  const pruned = await withTenant(job.tenant_id, async (client) => {
    const { rowCount } = await client.query(
      `DELETE FROM artifacts
        WHERE tenant_id = $1
          AND expires_at IS NOT NULL
          AND expires_at <= NOW() - make_interval(days => $2::int)`,
      [job.tenant_id, Math.round(graceDays)],
    );
    return rowCount;
  });

  return { pruned, grace_days: graceDays };
});

async function runJob(job) {
  const startedAt = Date.now();
  const heartbeatTimer = setInterval(() => {
    heartbeat({ jobId: job.id, workerId: WORKER_ID, leaseMs: LEASE_MS }).catch(() => {});
  }, Math.max(1000, Math.floor(LEASE_MS / 3)));

  try {
    const handler = handlers.get(job.type);
    if (!handler) {
      const message = `validation: no handler registered for job type ${job.type}`;
      await recordAttempt({
        jobId: job.id,
        attempt: job.attempts,
        workerId: WORKER_ID,
        outcome: "dead_letter",
        failureKind: "validation",
        error: message,
        durationMs: Date.now() - startedAt,
      });
      await failJob({ jobId: job.id, workerId: WORKER_ID, outcome: "dead_letter", error: message });
      log("error", "job_unhandled", { job_id: job.id, type: job.type });
      return;
    }

    let result = null;
    let failure = null;
    try {
      result = await handler(job);
    } catch (err) {
      failure = err;
    }

    const durationMs = Date.now() - startedAt;

    if (!failure) {
      const committed = await completeJob({ jobId: job.id, workerId: WORKER_ID, result });
      if (!committed) {
        log("warn", "lease_lost_before_commit", { job_id: job.id });
        return;
      }
      await recordAttempt({
        jobId: job.id,
        attempt: job.attempts,
        workerId: WORKER_ID,
        outcome: "succeeded",
        durationMs,
      });
      log("info", "job_succeeded", { job_id: job.id, type: job.type, duration_ms: durationMs });
      return;
    }

    const decision = decideOutcome({
      attempt: job.attempts,
      maxAttempts: job.max_attempts,
      err: failure,
    });
    const retryDelayMs =
      decision.outcome === "retry"
        ? computeBackoff(job.attempts, { baseMs: BACKOFF_BASE_MS, maxMs: BACKOFF_MAX_MS })
        : 0;

    const updated = await failJob({
      jobId: job.id,
      workerId: WORKER_ID,
      outcome: decision.outcome,
      error: failure.message,
      retryDelayMs,
    });
    if (!updated) {
      log("warn", "lease_lost_before_failure_commit", { job_id: job.id });
      return;
    }

    await recordAttempt({
      jobId: job.id,
      attempt: job.attempts,
      workerId: WORKER_ID,
      outcome: decision.outcome === "retry" ? "retrying" : decision.outcome,
      failureKind: decision.failureKind,
      error: failure.message,
      durationMs,
    });

    log(decision.outcome === "retry" ? "warn" : "error", "job_failed", {
      job_id: job.id,
      type: job.type,
      outcome: decision.outcome,
      failure_kind: decision.failureKind,
      retry_delay_ms: retryDelayMs,
      error: failure.message,
    });
  } finally {
    clearInterval(heartbeatTimer);
  }
}

async function loop() {
  while (running) {
    try {
      const job = await claimNextJob({ workerId: WORKER_ID, leaseMs: LEASE_MS });
      if (!job) {
        await sleep(POLL_INTERVAL_MS);
        continue;
      }
      await runJob(job);
    } catch (err) {
      log("error", "worker_loop_error", { error: err?.message });
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

// Recovery loop: returns leases orphaned by a crashed worker back to the queue.
async function reaper() {
  while (running) {
    try {
      const reaped = await reapExpiredLeases();
      if (reaped.length > 0) {
        log("warn", "leases_reaped", {
          count: reaped.length,
          jobs: reaped.map((row) => ({ id: row.id, status: row.status })),
        });
      }
    } catch (err) {
      log("error", "reaper_error", { error: err?.message });
    }
    await sleep(REAP_INTERVAL_MS);
  }
}

async function main() {
  await getPool().query("SELECT 1");
  log("info", "worker_started", {
    concurrency: CONCURRENCY,
    lease_ms: LEASE_MS,
    poll_interval_ms: POLL_INTERVAL_MS,
    handlers: [...handlers.keys()],
  });

  const loops = [reaper()];
  for (let i = 0; i < CONCURRENCY; i += 1) loops.push(loop());
  await Promise.all(loops);
}

const shutdown = async (signal) => {
  if (!running) return;
  running = false;
  log("info", "worker_shutdown", { signal });
  await closePool().catch(() => {});
  process.exit(0);
};

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

main().catch(async (err) => {
  log("error", "worker_fatal", { error: err?.message });
  await closePool().catch(() => {});
  process.exit(1);
});