// Applies the portable core schema at boot.
//
// Nothing else in the stack creates tables, so a fresh database reported itself
// healthy — the process answered /health — while every real query failed with
// "relation does not exist". The SQL is idempotent (CREATE TABLE IF NOT EXISTS),
// so applying it on each boot is safe and makes a new environment self-seeding.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPool } from "../../shared/db.js";

const here = path.dirname(fileURLToPath(import.meta.url));

// The image layout depends on the build context, so look in each plausible place
// rather than assuming one.
const CANDIDATES = [
  path.resolve(here, "../db"),              // schema shipped inside the API image
  path.resolve(here, "../../db/migrations"), // repo-root build
  path.resolve(here, "../db/migrations"),    // api as build root
  "/srv/db/migrations",
];

async function findMigrations() {
  for (const dir of CANDIDATES) {
    try {
      const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
      if (files.length) return { dir, files };
    } catch {
      /* not this layout */
    }
  }
  return null;
}

export async function runMigrations() {
  const found = await findMigrations();
  if (!found) {
    console.log(JSON.stringify({ level: "warn", msg: "migrations_not_found", looked_in: CANDIDATES }));
    return { applied: 0 };
  }

  let pool;
  try {
    pool = getPool();
  } catch (err) {
    console.error(JSON.stringify({ level: "error", msg: `migration_failed: no database: ${err?.message || "unknown"}` }));
    return { applied: 0 };
  }

  let applied = 0;
  for (const file of found.files) {
    const sql = await readFile(path.join(found.dir, file), "utf8");
    try {
      await pool.query(sql);
      applied += 1;
      console.log(JSON.stringify({ level: "info", msg: "migration_applied", file }));
    } catch (err) {
      console.error(
        JSON.stringify({ level: "error", msg: `migration_failed: ${file}: ${err?.message || err?.code || "unknown"}` }),
      );
      return { applied, failed: file };
    }
  }
  return { applied };
}
