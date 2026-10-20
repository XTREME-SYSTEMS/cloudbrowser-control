// Shared PostgreSQL access for the portable services (api, worker).
// Base44-free: talks to Postgres directly via a connection pool.
import pg from "pg";

const { Pool } = pg;

/** @type {import("pg").Pool | null} */
let pool = null;

export function getPool() {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to reach the database");
  }

  pool = new Pool({
    connectionString,
    max: Number(process.env.PG_POOL_MAX || 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: true } : undefined,
  });

  pool.on("error", (err) => {
    console.error(JSON.stringify({ level: "error", msg: "pg_pool_error", error: err.message }));
  });

  return pool;
}

/**
 * Runs `fn` inside a transaction with the tenant context set, so Row-Level
 * Security policies resolve to that tenant for the duration.
 *
 * @template T
 * @param {string} tenantId
 * @param {(client: import("pg").PoolClient) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withTenant(tenantId, fn) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    // set_config(..., is_local = true) scopes the setting to this transaction.
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}