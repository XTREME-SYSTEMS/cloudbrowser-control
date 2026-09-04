/**
 * Supabase-backed session manager for Cloud Browser Engine
 * Tracks session lifecycle, manages pool recovery, prevents zombie processes
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const WORKER_ID = process.env.RAILWAY_REPLICA_ID || process.env.HOSTNAME || "worker-local";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.warn(
    "Session manager disabled: SUPABASE_URL or SUPABASE_SERVICE_KEY not set. Using in-process sessions only."
  );
}

const supabase = SUPABASE_URL && SUPABASE_SERVICE_KEY 
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  : null;

const SESSION_TABLE = "browser_sessions";
const HEARTBEAT_INTERVAL_MS = 15000; // Ping DB every 15s
const SESSION_TTL_MS = parseInt(process.env.SESSION_TTL_MS || "300000", 10); // 5 min default
const ZOMBIE_TIMEOUT_MS = 60000; // Mark session zombie if no heartbeat for 60s
const CLEANUP_INTERVAL_MS = 30000; // Check for zombies every 30s

/**
 * Session states:
 * - pooled: ready to use from pool
 * - active: in use
 * - closing: graceful shutdown in progress
 * - zombie: stale, lost contact with worker
 * - closed: cleaned up
 */

class SessionManager {
  constructor() {
    this.localSessions = new Map(); // id => { browser, context, page, ...metadata }
    this.heartbeatTimers = new Map(); // id => intervalId
    this.isEnabled = !!supabase;
  }

  /**
   * Initialize Supabase schema on startup (idempotent)
   */
  async initSchema() {
    if (!this.isEnabled) return;
    try {
      const { data, error } = await supabase
        .from(SESSION_TABLE)
        .select("count", { count: "exact", head: true })
        .limit(1);
      if (error?.code === "PGRST116") {
        // Table doesn't exist, create it
        console.log(`Creating ${SESSION_TABLE} table...`);
        const { error: createError } = await supabase.rpc("init_session_schema", {});
        if (createError) {
          console.warn(
            `Failed to auto-create session schema (OK if using manual SQL): ${createError.message}`
          );
          console.log(
            `Initialize schema manually with:\nCREATE TABLE ${SESSION_TABLE} (\n  id TEXT PRIMARY KEY,\n  worker_id TEXT,\n  status TEXT,\n  url TEXT,\n  pool_id TEXT,\n  created_at TIMESTAMP DEFAULT NOW(),\n  last_heartbeat TIMESTAMP DEFAULT NOW(),\n  ttl_ms INT\n);\nCREATE INDEX idx_worker_status ON ${SESSION_TABLE}(worker_id, status);`
          );
          return;\n        }
      }
      console.log(`✓ Session manager ready (${SESSION_TABLE} table OK)`);\n    } catch (e) {\n      console.warn(`Session schema check failed (continuing with in-process only): ${e.message}`);\n    }\n  }\n\n  /**\n   * Register a session in Supabase and start heartbeat\n   */\n  async trackSession(id, sessionData) {\n    this.localSessions.set(id, sessionData);\n\n    if (!this.isEnabled) return;\n\n    const { status, url } = sessionData;\n    const { error } = await supabase.from(SESSION_TABLE).insert(\n      {\n        id,\n        worker_id: WORKER_ID,\n        status: status || \"active\",\n        url: url || \"\",\n        ttl_ms: SESSION_TTL_MS,\n      },\n      { upsert: true }\n    );\n\n    if (error) {\n      console.error(`Failed to track session ${id}:`, error.message);\n      return;\n    }\n\n    // Start heartbeat\n    this.startHeartbeat(id);\n  }\n\n  /**\n   * Heartbeat: ping DB to prove session is alive\n   */\n  startHeartbeat(id) {\n    if (this.heartbeatTimers.has(id)) return; // Already beating\n\n    const beat = async () => {\n      if (!this.localSessions.has(id)) {\n        // Session was closed locally, stop heartbeat\n        clearInterval(this.heartbeatTimers.get(id));\n        this.heartbeatTimers.delete(id);\n        return;\n      }\n\n      if (!this.isEnabled) return;\n\n      const { error } = await supabase\n        .from(SESSION_TABLE)\n        .update({ last_heartbeat: new Date().toISOString() })\n        .eq(\"id\", id);\n\n      if (error) {\n        console.warn(`Heartbeat failed for session ${id}: ${error.message}`);\n      }\n    };\n\n    const intervalId = setInterval(beat, HEARTBEAT_INTERVAL_MS);\n    this.heartbeatTimers.set(id, intervalId);\n  }\n\n  /**\n   * Update session status (active, pooled, closing, zombie)\n   */\n  async setStatus(id, status) {\n    const session = this.localSessions.get(id);\n    if (session) session.status = status;\n\n    if (!this.isEnabled) return;\n\n    const { error } = await supabase\n      .from(SESSION_TABLE)\n      .update({ status })\n      .eq(\"id\", id);\n\n    if (error) {\n      console.warn(`Failed to update session ${id} status: ${error.message}`);\n    }\n  }\n\n  /**\n   * Unregister and stop tracking a session\n   */\n  async closeSession(id, reason = \"ended\") {\n    const session = this.localSessions.get(id);\n    if (!session) return false;\n\n    // Stop heartbeat\n    if (this.heartbeatTimers.has(id)) {\n      clearInterval(this.heartbeatTimers.get(id));\n      this.heartbeatTimers.delete(id);\n    }\n\n    // Mark as closed in Supabase\n    if (this.isEnabled) {\n      await supabase\n        .from(SESSION_TABLE)\n        .update({ status: \"closed\" })\n        .eq(\"id\", id);\n    }\n\n    this.localSessions.delete(id);\n    return true;\n  }\n\n  /**\n   * Cleanup zombies: mark sessions as zombie if no heartbeat for ZOMBIE_TIMEOUT_MS\n   * Call periodically (e.g., every 30s)\n   */\n  async cleanupZombies() {\n    if (!this.isEnabled) {\n      // Local cleanup only\n      const now = Date.now();\n      for (const [id, session] of this.localSessions) {\n        if (session.status === \"active\" && now - session.lastActivity > ZOMBIE_TIMEOUT_MS) {\n          console.warn(`Local zombie detected: ${id}, closing...`);\n          await this.closeSession(id, \"zombie\");\n        }\n      }\n      return;\n    }\n\n    const zombieThreshold = new Date(Date.now() - ZOMBIE_TIMEOUT_MS).toISOString();\n\n    try {\n      // Mark stale active/pooled sessions as zombie\n      const { data: zombies, error } = await supabase\n        .from(SESSION_TABLE)\n        .select(\"id\")\n        .in(\"status\", [\"active\", \"pooled\"])\n        .eq(\"worker_id\", WORKER_ID)\n        .lt(\"last_heartbeat\", zombieThreshold);\n\n      if (error) {\n        console.error(`Zombie cleanup query failed: ${error.message}`);\n        return;\n      }\n\n      if (zombies?.length > 0) {\n        console.warn(\n          `Found ${zombies.length} zombie session(s), marking for cleanup...`\n        );\n        const { error: updateError } = await supabase\n          .from(SESSION_TABLE)\n          .update({ status: \"zombie\" })\n          .in(\n            \"id\",\n            zombies.map((z) => z.id)\n          );\n\n        if (updateError) {\n          console.error(`Failed to mark zombies: ${updateError.message}`);\n        } else {\n          // Also close locally\n          for (const { id } of zombies) {\n            await this.closeSession(id, \"zombie\");\n          }\n        }\n      }\n    } catch (e) {\n      console.error(`Zombie cleanup failed: ${e.message}`);\n    }\n  }\n\n  /**\n   * Recover pooled sessions from Supabase (for restart scenario)\n   * Note: actual browser objects are lost; just recovers metadata\n   */\n  async recoverSessions() {\n    if (!this.isEnabled) return [];\n\n    try {\n      const { data, error } = await supabase\n        .from(SESSION_TABLE)\n        .select(\"*\")\n        .in(\"status\", [\"pooled\", \"active\"])\n        .eq(\"worker_id\", WORKER_ID);\n\n      if (error) {\n        console.warn(`Failed to recover sessions: ${error.message}`);\n        return [];\n      }\n\n      console.log(`Recovered ${data?.length || 0} session(s) from Supabase`);\n      return data || [];\n    } catch (e) {\n      console.error(`Session recovery failed: ${e.message}`);\n      return [];\n    }\n  }\n\n  /**\n   * Get local session by ID\n   */\n  getSession(id) {\n    return this.localSessions.get(id);\n  }\n\n  /**\n   * Get all local sessions\n   */\n  getAllSessions() {\n    return Array.from(this.localSessions.values());\n  }\n\n  /**\n   * Start periodic cleanup\n   */\n  startCleanupLoop() {\n    setInterval(() => this.cleanupZombies(), CLEANUP_INTERVAL_MS);\n    console.log(`Cleanup loop started (interval: ${CLEANUP_INTERVAL_MS}ms)`);\n  }\n}\n\nexport default SessionManager;\n
