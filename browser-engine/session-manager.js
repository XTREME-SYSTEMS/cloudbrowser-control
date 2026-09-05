/**
 * Supabase-backed session manager for Cloud Browser Engine
 * Tracks session lifecycle, manages pool recovery, prevents zombie processes
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const WORKER_ID = process.env.RAILWAY_REPLICA_ID || process.env.HOSTNAME || "worker-local";

let supabase = null;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.warn(
    "Session manager disabled: SUPABASE_URL or SUPABASE_SERVICE_KEY not set. Using in-process sessions only."
  );
} else {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    console.log("✓ Supabase session manager initialized");
  } catch (e) {
    console.warn(`Failed to initialize Supabase client: ${e.message}. Falling back to in-process sessions.`);
    supabase = null;
  }
}

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
          return;
        }
      }
      console.log(`✓ Session manager ready (${SESSION_TABLE} table OK)`);
    } catch (e) {
      console.warn(`Session schema check failed (continuing with in-process only): ${e.message}`);
    }
  }

  /**
   * Register a session in Supabase and start heartbeat
   */
  async trackSession(id, sessionData) {
    this.localSessions.set(id, sessionData);

    if (!this.isEnabled) return;

    const { status, url } = sessionData;
    const { error } = await supabase.from(SESSION_TABLE).insert(
      {
        id,
        worker_id: WORKER_ID,
        status: status || "active",
        url: url || "",
        ttl_ms: SESSION_TTL_MS,
      },
      { upsert: true }
    );

    if (error) {
      console.error(`Failed to track session ${id}:`, error.message);
      return;
    }

    // Start heartbeat
    this.startHeartbeat(id);
  }

  /**
   * Heartbeat: ping DB to prove session is alive
   */
  startHeartbeat(id) {
    if (this.heartbeatTimers.has(id)) return; // Already beating

    const beat = async () => {
      if (!this.localSessions.has(id)) {
        // Session was closed locally, stop heartbeat
        clearInterval(this.heartbeatTimers.get(id));
        this.heartbeatTimers.delete(id);
        return;
      }

      if (!this.isEnabled) return;

      const { error } = await supabase
        .from(SESSION_TABLE)
        .update({ last_heartbeat: new Date().toISOString() })
        .eq("id", id);

      if (error) {
        console.warn(`Heartbeat failed for session ${id}: ${error.message}`);
      }
    };

    const intervalId = setInterval(beat, HEARTBEAT_INTERVAL_MS);
    this.heartbeatTimers.set(id, intervalId);
  }

  /**
   * Update session status (active, pooled, closing, zombie)
   */
  async setStatus(id, status) {
    const session = this.localSessions.get(id);
    if (session) session.status = status;

    if (!this.isEnabled) return;

    const { error } = await supabase
      .from(SESSION_TABLE)
      .update({ status })
      .eq("id", id);

    if (error) {
      console.warn(`Failed to update session ${id} status: ${error.message}`);
    }
  }

  /**
   * Unregister and stop tracking a session
   */
  async closeSession(id, reason = "ended") {
    const session = this.localSessions.get(id);
    if (!session) return false;

    // Stop heartbeat
    if (this.heartbeatTimers.has(id)) {
      clearInterval(this.heartbeatTimers.get(id));
      this.heartbeatTimers.delete(id);
    }

    // Mark as closed in Supabase
    if (this.isEnabled) {
      await supabase
        .from(SESSION_TABLE)
        .update({ status: "closed" })
        .eq("id", id);
    }

    this.localSessions.delete(id);
    return true;
  }

  /**
   * Cleanup zombies: mark sessions as zombie if no heartbeat for ZOMBIE_TIMEOUT_MS
   * Call periodically (e.g., every 30s)
   */
  async cleanupZombies() {
    if (!this.isEnabled) {
      // Local cleanup only
      const now = Date.now();
      for (const [id, session] of this.localSessions) {
        if (session.status === "active" && now - session.lastActivity > ZOMBIE_TIMEOUT_MS) {
          console.warn(`Local zombie detected: ${id}, closing...`);
          await this.closeSession(id, "zombie");
        }
      }
      return;
    }

    const zombieThreshold = new Date(Date.now() - ZOMBIE_TIMEOUT_MS).toISOString();

    try {
      // Mark stale active/pooled sessions as zombie
      const { data: zombies, error } = await supabase
        .from(SESSION_TABLE)
        .select("id")
        .in("status", ["active", "pooled"])
        .eq("worker_id", WORKER_ID)
        .lt("last_heartbeat", zombieThreshold);

      if (error) {
        console.error(`Zombie cleanup query failed: ${error.message}`);
        return;
      }

      if (zombies?.length > 0) {
        console.warn(
          `Found ${zombies.length} zombie session(s), marking for cleanup...`
        );
        const { error: updateError } = await supabase
          .from(SESSION_TABLE)
          .update({ status: "zombie" })
          .in(
            "id",
            zombies.map((z) => z.id)
          );

        if (updateError) {
          console.error(`Failed to mark zombies: ${updateError.message}`);
        } else {
          // Also close locally
          for (const { id } of zombies) {
            await this.closeSession(id, "zombie");
          }
        }
      }
    } catch (e) {
      console.error(`Zombie cleanup failed: ${e.message}`);
    }
  }

  /**
   * Recover pooled sessions from Supabase (for restart scenario)
   * Note: actual browser objects are lost; just recovers metadata
   */
  async recoverSessions() {
    if (!this.isEnabled) return [];

    try {
      const { data, error } = await supabase
        .from(SESSION_TABLE)
        .select("*")
        .in("status", ["pooled", "active"])
        .eq("worker_id", WORKER_ID);

      if (error) {
        console.warn(`Failed to recover sessions: ${error.message}`);
        return [];
      }

      console.log(`Recovered ${data?.length || 0} session(s) from Supabase`);
      return data || [];
    } catch (e) {
      console.error(`Session recovery failed: ${e.message}`);
      return [];
    }
  }

  /**
   * Get local session by ID
   */
  getSession(id) {
    return this.localSessions.get(id);
  }

  /**
   * Get all local sessions
   */
  getAllSessions() {
    return Array.from(this.localSessions.values());
  }

  /**
   * Start periodic cleanup
   */
  startCleanupLoop() {
    setInterval(() => this.cleanupZombies(), CLEANUP_INTERVAL_MS);
    console.log(`Cleanup loop started (interval: ${CLEANUP_INTERVAL_MS}ms)`);
  }
}

export default SessionManager;

