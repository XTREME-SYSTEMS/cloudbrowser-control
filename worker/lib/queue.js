// Postgres-backed durable queue. Claiming uses FOR UPDATE SKIP LOCKED so any
// number of workers can run without contending or double-processing a job.
import { getPool } from "../../shared/db.js";

export const JOB_COLUMNS = `id, tenant_id, type, status, priority, payload, result, error,
  attempts, max_attempts, idempotency_key, lease_owner, lease_expires_at,
  available_at, created_at, updated_at, completed_at`;

/** Atomically reserves the next runnable job and increments its attempt count. */
export async function claimNextJob({ workerId, leaseMs }) {
  const { rows } = await getPool().query(
    `WITH candidate AS (
       SELECT id
         FROM jobs
        WHERE status = 'queued'
          AND available_at <= NOW()
        ORDER BY priority ASC, available_at ASC, created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
     )
     UPDATE jobs j
        SET status = 'leased',
            lease_owner = $1,
            lease_expires_at = NOW() + make_interval(secs => $2::double precision / 1000),
            attempts = j.attempts + 1,
            updated_at = NOW()
       FROM candidate c
      WHERE j.id = c.id
      RETURNING ${JOB_COLUMNS}`,
    [workerId, leaseMs],
  );
  return rows[0] || null;
}

/** Extends a held lease. Returns false when the lease was lost. */
export async function heartbeat({ jobId, workerId, leaseMs }) {
  const { rowCount } = await getPool().query(
    `UPDATE jobs
        SET lease_expires_at = NOW() + make_interval(secs => $3::double precision / 1000),
            updated_at = NOW()
      WHERE id = $1 AND lease_owner = $2 AND status = 'leased'`,
    [jobId, workerId, leaseMs],
  );
  return rowCount === 1;
}

export async function completeJob({ jobId, workerId, result }) {
  const { rows } = await getPool().query(
    `UPDATE jobs
        SET status = 'succeeded',
            result = $3,
            error = NULL,
            lease_owner = NULL,
            lease_expires_at = NULL,
            completed_at = NOW(),
            updated_at = NOW()
      WHERE id = $1 AND lease_owner = $2 AND status = 'leased'
      RETURNING id`,
    [jobId, workerId, result === undefined ? null : result],
  );
  return rows.length === 1;
}

/**
 * Records a failed attempt.
 * @param {'failed'|'dead_letter'|'retry'} outcome  'retry' returns the job to the queue.
 */
export async function failJob({ jobId, workerId, outcome, error, retryDelayMs = 0 }) {
  const status = outcome === "retry" ? "queued" : outcome;
  const { rows } = await getPool().query(
    `UPDATE jobs
        SET status = $3,
            error = $4,
            lease_owner = NULL,
            lease_expires_at = NULL,
            available_at = CASE
              WHEN $5::double precision > 0
              THEN NOW() + make_interval(secs => $5::double precision / 1000)
              ELSE NOW()
            END,
            completed_at = CASE WHEN $3 IN ('failed', 'dead_letter') THEN NOW() ELSE NULL END,
            updated_at = NOW()
      WHERE id = $1 AND lease_owner = $2 AND status = 'leased'
      RETURNING ${JOB_COLUMNS}`,
    [jobId, workerId, status, error === undefined ? null : error, retryDelayMs],
  );
  return rows[0] || null;
}

/**
 * Crash recovery: any lease that expired while a worker was down is returned
 * to the queue, or dead-lettered when it has already used its attempts.
 */
export async function reapExpiredLeases() {
  const { rows } = await getPool().query(
    `UPDATE jobs
        SET status = CASE WHEN attempts >= max_attempts THEN 'dead_letter' ELSE 'queued' END,
            error = COALESCE(error, 'lease expired before completion'),
            lease_owner = NULL,
            lease_expires_at = NULL,
            available_at = NOW(),
            completed_at = CASE WHEN attempts >= max_attempts THEN NOW() ELSE NULL END,
            updated_at = NOW()
      WHERE status = 'leased' AND lease_expires_at <= NOW()
      RETURNING id, status, attempts`,
  );
  return rows;
}

export async function recordAttempt({
  jobId,
  attempt,
  workerId,
  outcome,
  failureKind,
  error,
  durationMs,
}) {
  await getPool().query(
    `INSERT INTO job_attempts (job_id, attempt, worker_id, outcome, failure_kind, error, duration_ms)
          VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      jobId,
      attempt,
      workerId,
      outcome,
      failureKind === undefined || failureKind === "none" ? null : failureKind,
      error === undefined ? null : error,
      Math.max(0, Math.round(Number(durationMs) || 0)),
    ],
  );
}

/** Queue depth by status — used by operator dashboards and health checks. */
export async function queueDepth() {
  const { rows } = await getPool().query(
    `SELECT status, COUNT(*)::int AS count FROM jobs GROUP BY status ORDER BY status`,
  );
  return rows;
}