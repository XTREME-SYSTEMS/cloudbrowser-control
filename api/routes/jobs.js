import express from "express";
import { requireScopes } from "../lib/auth.js";
import { withTenant } from "../../shared/db.js";
import {
  normalizeError,
  parseLimit,
  parseStatusFilter,
  parseIsoTimestamp,
  NotFoundError,
  ConflictError,
} from "../lib/http.js";
import {
  ALLOWED_JOB_TYPES,
  JOB_STATUSES,
  validateCreateJobInput,
  canCancelStatus,
  isTerminalStatus,
} from "../lib/jobs.js";

export const JOB_COLUMNS = `id, tenant_id, type, status, priority, payload, result, error,
  attempts, max_attempts, idempotency_key, lease_owner, lease_expires_at,
  available_at, created_at, updated_at, completed_at`;

const router = express.Router();

// POST /v1/jobs — enqueue a durable job. Idempotent when a key is supplied.
router.post("/", async (req, res, next) => {
  try {
    requireScopes(req.auth, ["jobs:write"]);
    const { type, payload, idempotencyKey, priority, maxAttempts } = validateCreateJobInput(req.body);

    const job = await withTenant(req.auth.tenantId, async (client) => {
      if (idempotencyKey) {
        const inserted = await client.query(
          `INSERT INTO jobs (tenant_id, type, payload, idempotency_key, priority, max_attempts)
                VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL
                  DO NOTHING
             RETURNING ${JOB_COLUMNS}`,
          [req.auth.tenantId, type, payload, idempotencyKey, priority, maxAttempts],
        );
        if (inserted.rows[0]) return inserted.rows[0];

        const existing = await client.query(
          `SELECT ${JOB_COLUMNS} FROM jobs WHERE tenant_id = $1 AND idempotency_key = $2`,
          [req.auth.tenantId, idempotencyKey],
        );
        return existing.rows[0];
      }

      const inserted = await client.query(
        `INSERT INTO jobs (tenant_id, type, payload, priority, max_attempts)
              VALUES ($1, $2, $3, $4, $5)
           RETURNING ${JOB_COLUMNS}`,
        [req.auth.tenantId, type, payload, priority, maxAttempts],
      );
      return inserted.rows[0];
    });

    res.status(202).json({ job });
  } catch (err) {
    next(err);
  }
});

// GET /v1/jobs — newest-first page, keyset paginated.
router.get("/", async (req, res, next) => {
  try {
    requireScopes(req.auth, ["jobs:read"]);
    const limit = parseLimit(req.query.limit);
    const statuses = parseStatusFilter(req.query.status, JOB_STATUSES);
    const before = parseIsoTimestamp(req.query.before, "before");

    const jobs = await withTenant(req.auth.tenantId, async (client) => {
      const params = [req.auth.tenantId];
      let where = "tenant_id = $1";

      if (statuses.length > 0) {
        params.push(statuses);
        where += ` AND status = ANY($${params.length})`;
      }
      if (before) {
        params.push(before);
        where += ` AND created_at < $${params.length}`;
      }

      params.push(limit);
      const { rows } = await client.query(
        `SELECT ${JOB_COLUMNS} FROM jobs
          WHERE ${where}
          ORDER BY created_at DESC
          LIMIT $${params.length}`,
        params,
      );
      return rows;
    });

    const nextCursor = jobs.length === limit ? jobs[jobs.length - 1].created_at : null;
    res.json({ jobs, next_cursor: nextCursor });
  } catch (err) {
    next(err);
  }
});

// GET /v1/jobs/:id
router.get("/:id", async (req, res, next) => {
  try {
    requireScopes(req.auth, ["jobs:read"]);
    const job = await withTenant(req.auth.tenantId, async (client) => {
      const { rows } = await client.query(
        `SELECT ${JOB_COLUMNS} FROM jobs WHERE id = $1 LIMIT 1`,
        [req.params.id],
      );
      return rows[0] || null;
    });
    if (!job) throw new NotFoundError("Job not found");
    res.json({ job });
  } catch (err) {
    next(err);
  }
});

// GET /v1/jobs/:id/attempts — per-attempt audit trail.
router.get("/:id/attempts", async (req, res, next) => {
  try {
    requireScopes(req.auth, ["jobs:read"]);
    const attempts = await withTenant(req.auth.tenantId, async (client) => {
      const { rows } = await client.query(
        `SELECT id, job_id, attempt, worker_id, outcome, failure_kind, error, duration_ms, created_at
           FROM job_attempts
          WHERE job_id = $1
          ORDER BY attempt ASC`,
        [req.params.id],
      );
      return rows;
    });
    res.json({ attempts });
  } catch (err) {
    next(err);
  }
});

// POST /v1/jobs/:id/cancel — cooperative cancellation for queued/leased jobs.
router.post("/:id/cancel", async (req, res, next) => {
  try {
    requireScopes(req.auth, ["jobs:write"]);
    const job = await withTenant(req.auth.tenantId, async (client) => {
      const current = await client.query(
        `SELECT ${JOB_COLUMNS} FROM jobs WHERE id = $1 LIMIT 1`,
        [req.params.id],
      );
      const existing = current.rows[0];
      if (!existing) throw new NotFoundError("Job not found");
      if (isTerminalStatus(existing.status)) {
        throw new ConflictError(`Job is already ${existing.status} and cannot be cancelled`);
      }
      if (!canCancelStatus(existing.status)) {
        throw new ConflictError(`Job in status ${existing.status} cannot be cancelled`);
      }

      const { rows } = await client.query(
        `UPDATE jobs
            SET status = 'cancelled',
                lease_owner = NULL,
                lease_expires_at = NULL,
                completed_at = NOW(),
                updated_at = NOW()
          WHERE id = $1
      RETURNING ${JOB_COLUMNS}`,
        [req.params.id],
      );
      return rows[0];
    });
    res.json({ job });
  } catch (err) {
    const normalized = normalizeError(err);
    if (normalized.status === 404 || normalized.status === 409) return next(err);
    return next(err);
  }
});

export default router;