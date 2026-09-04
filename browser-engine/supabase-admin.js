/**
 * Supabase Admin Client - Full bidirectional sync with automatic schema management
 * Uses service role key for admin operations (read/write all tables, create tables/indexes)
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const WORKER_ID = process.env.RAILWAY_REPLICA_ID || process.env.HOSTNAME || "worker-local";

class SupabaseAdmin {
  constructor() {
    this.client = null;
    this.isEnabled = false;
    this.schemaVersion = "3.1.0";
    this.tables = {
      browser_sessions: {
        name: "browser_sessions",
        managed: true,
        description: "Tracks Playwright browser session lifecycle and health",
      },
      browser_events: {
        name: "browser_events",
        managed: true,
        description: "Audit log for session events (created, closed, zombie, etc)",
      },
      browser_pool_stats: {
        name: "browser_pool_stats",
        managed: true,
        description: "Real-time pool metrics snapshot",
      },
    };
  }

  /**
   * Initialize Supabase admin client
   */
  async init() {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.warn("⚠ Supabase credentials not set. Admin sync disabled.");
      return false;
    }

    try {
      this.client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });

      // Test connection
      const { data, error } = await this.client.from("browser_sessions").select("count", { count: "exact", head: true }).limit(1);
      
      if (error?.code === "PGRST116") {
        // Table doesn't exist — run migrations
        console.log("📋 Table browser_sessions not found. Running auto-migrations...");
        await this.runMigrations();
      } else if (error) {
        console.error(`❌ Supabase connection failed: ${error.message}`);
        return false;
      }

      this.isEnabled = true;
      console.log("✅ Supabase admin sync ready (service role authenticated)");
      return true;
    } catch (e) {
      console.error(`❌ Failed to initialize Supabase: ${e.message}`);
      return false;
    }
  }

  /**
   * Auto-migrate schema: creates tables if they don't exist
   */
  async runMigrations() {
    if (!this.client) return;

    const migrations = [
      // browser_sessions table
      {
        name: "create_browser_sessions",
        sql: `
          CREATE TABLE IF NOT EXISTS browser_sessions (
            id TEXT PRIMARY KEY,
            worker_id TEXT NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('pooled', 'active', 'closing', 'zombie', 'closed')),
            url TEXT,
            pool_id TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            ttl_ms INT DEFAULT 300000,
            closed_at TIMESTAMP WITH TIME ZONE,
            metadata JSONB DEFAULT '{}'::jsonb
          );
          CREATE INDEX IF NOT EXISTS idx_browser_sessions_worker_status 
            ON browser_sessions(worker_id, status);
          CREATE INDEX IF NOT EXISTS idx_browser_sessions_last_heartbeat 
            ON browser_sessions(last_heartbeat);
          CREATE INDEX IF NOT EXISTS idx_browser_sessions_created_at 
            ON browser_sessions(created_at DESC);
        `,
      },
      // browser_events audit log
      {
        name: "create_browser_events",
        sql: `
          CREATE TABLE IF NOT EXISTS browser_events (
            id BIGSERIAL PRIMARY KEY,
            session_id TEXT NOT NULL REFERENCES browser_sessions(id) ON DELETE CASCADE,
            worker_id TEXT NOT NULL,
            event_type TEXT NOT NULL CHECK (event_type IN ('created', 'pooled', 'active', 'zombie', 'closed', 'error')),
            message TEXT,
            metadata JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_browser_events_session_id 
            ON browser_events(session_id);
          CREATE INDEX IF NOT EXISTS idx_browser_events_worker_id 
            ON browser_events(worker_id);
          CREATE INDEX IF NOT EXISTS idx_browser_events_created_at 
            ON browser_events(created_at DESC);
        `,
      },
      // pool stats snapshot
      {
        name: "create_browser_pool_stats",
        sql: `
          CREATE TABLE IF NOT EXISTS browser_pool_stats (
            id BIGSERIAL PRIMARY KEY,
            worker_id TEXT NOT NULL,
            pool_size INT,
            pool_capacity INT,
            active_sessions INT,
            max_sessions INT,
            zombie_count INT,
            avg_session_duration_ms INT,
            memory_usage_mb FLOAT,
            cpu_usage_percent FLOAT,
            metadata JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_browser_pool_stats_worker_id 
            ON browser_pool_stats(worker_id);
          CREATE INDEX IF NOT EXISTS idx_browser_pool_stats_created_at 
            ON browser_pool_stats(created_at DESC);
        `,
      },
    ];

    for (const migration of migrations) {
      try {
        const { error } = await this.client.rpc("exec_sql", { sql: migration.sql }).catch(() => ({ error: null }));
        // If rpc doesn't exist, fall back to raw SQL via postgres
        if (error?.code === "PGRST116") {
          console.log(`⚠ exec_sql RPC not found (OK for managed Supabase). Skipping ${migration.name}.`);
          console.log(`   Run manually in Supabase SQL Editor:\n${migration.sql}`);
        } else if (error) {
          console.error(`❌ Migration ${migration.name} failed: ${error.message}`);
        } else {
          console.log(`✅ Migration ${migration.name} applied`);
        }
      } catch (e) {
        console.warn(`⚠ Migration ${migration.name} skipped: ${e.message}`);
      }
    }
  }

  /**
   * Track session: insert or update in browser_sessions
   */
  async trackSession(id, sessionData) {
    if (!this.isEnabled) return;

    const { status, url } = sessionData;
    const { error } = await this.client.from("browser_sessions").upsert(
      {
        id,
        worker_id: WORKER_ID,
        status: status || "active",
        url: url || "",
        ttl_ms: parseInt(process.env.SESSION_TTL_MS || "300000", 10),
      },
      { onConflict: "id" }
    );

    if (error) {
      console.error(`Failed to track session ${id}:`, error.message);
      return;
    }

    // Log event
    await this.logEvent(id, "created", `Session ${status || "active"}`);
  }

  /**
   * Update session status and last_heartbeat
   */
  async updateSessionStatus(id, newStatus) {
    if (!this.isEnabled) return;

    const { error } = await this.client.from("browser_sessions").update({
      status: newStatus,
      last_heartbeat: new Date().toISOString(),
    }).eq("id", id);

    if (error) {
      console.warn(`Failed to update session ${id} status:`, error.message);
      return;
    }

    await this.logEvent(id, newStatus, `Status changed to ${newStatus}`);
  }

  /**
   * Heartbeat: proof of life
   */
  async heartbeat(id) {
    if (!this.isEnabled) return;

    const { error } = await this.client.from("browser_sessions").update({
      last_heartbeat: new Date().toISOString(),
    }).eq("id", id);

    if (error && error.code !== "PGRST116") {
      console.warn(`Heartbeat failed for session ${id}: ${error.message}`);
    }
  }

  /**
   * Close session: mark as closed and set closed_at
   */
  async closeSession(id, reason = "ended") {
    if (!this.isEnabled) return;

    const { error } = await this.client.from("browser_sessions").update({
      status: "closed",
      closed_at: new Date().toISOString(),
    }).eq("id", id);

    if (error) {
      console.warn(`Failed to close session ${id}:`, error.message);
      return;
    }

    await this.logEvent(id, "closed", reason);
  }

  /**
   * Log event to browser_events audit table
   */
  async logEvent(sessionId, eventType, message = "", metadata = {}) {
    if (!this.isEnabled) return;

    const { error } = await this.client.from("browser_events").insert({
      session_id: sessionId,
      worker_id: WORKER_ID,
      event_type: eventType,
      message,
      metadata: JSON.stringify(metadata),
    });

    if (error && error.code !== "PGRST116") {
      console.warn(`Failed to log event for session ${sessionId}:`, error.message);
    }
  }

  /**
   * Get session by ID
   */
  async getSession(id) {
    if (!this.isEnabled) return null;

    const { data, error } = await this.client.from("browser_sessions").select("*").eq("id", id).single();

    if (error) {
      console.warn(`Failed to fetch session ${id}:`, error.message);
      return null;
    }

    return data;
  }

  /**
   * Get all sessions for this worker
   */
  async getWorkerSessions(status = null) {
    if (!this.isEnabled) return [];

    let query = this.client.from("browser_sessions").select("*").eq("worker_id", WORKER_ID);

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      console.warn(`Failed to fetch worker sessions:`, error.message);
      return [];
    }

    return data || [];
  }

  /**
   * Detect and mark zombies: sessions with no heartbeat > 60s
   */
  async detectZombies(timeoutMs = 60000) {
    if (!this.isEnabled) return [];

    const zombieThreshold = new Date(Date.now() - timeoutMs).toISOString();

    const { data: zombies, error } = await this.client
      .from("browser_sessions")
      .select("id")
      .in("status", ["active", "pooled"])
      .eq("worker_id", WORKER_ID)
      .lt("last_heartbeat", zombieThreshold);

    if (error) {
      console.warn(`Zombie detection failed:`, error.message);
      return [];
    }

    if (zombies?.length > 0) {
      console.warn(`🧟 Found ${zombies.length} zombie session(s)`);
      
      const { error: updateError } = await this.client
        .from("browser_sessions")
        .update({ status: "zombie" })
        .in("id", zombies.map((z) => z.id));

      if (updateError) {
        console.error(`Failed to mark zombies:`, updateError.message);
      } else {
        for (const { id } of zombies) {
          await this.logEvent(id, "zombie", "Marked as zombie (no heartbeat)");
        }
      }
    }

    return zombies || [];
  }

  /**
   * Store pool stats snapshot
   */
  async recordPoolStats(stats) {
    if (!this.isEnabled) return;

    const { error } = await this.client.from("browser_pool_stats").insert({
      worker_id: WORKER_ID,
      pool_size: stats.poolSize,
      pool_capacity: stats.poolCapacity,
      active_sessions: stats.activeSessions,
      max_sessions: stats.maxSessions,
      zombie_count: stats.zombieCount || 0,
      avg_session_duration_ms: stats.avgSessionDuration || 0,
      memory_usage_mb: stats.memoryUsageMb,
      cpu_usage_percent: stats.cpuUsagePercent,
      metadata: JSON.stringify(stats.metadata || {}),
    });

    if (error && error.code !== "PGRST116") {
      console.warn(`Failed to record pool stats:`, error.message);
    }
  }

  /**
   * Get stats for monitoring dashboard
   */
  async getStats(hoursBack = 24) {
    if (!this.isEnabled) return null;

    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

    const { data: stats, error } = await this.client
      .from("browser_pool_stats")
      .select("*")
      .eq("worker_id", WORKER_ID)
      .gte("created_at", since)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn(`Failed to fetch stats:`, error.message);
      return null;
    }

    return {
      workerStats: stats || [],
      totalSnapshots: stats?.length || 0,
      hoursBack,
    };
  }

  /**
   * Health check: verify Supabase connection is alive
   */
  async healthCheck() {
    if (!this.isEnabled) return { healthy: false, reason: "Supabase not enabled" };

    try {
      const { data, error } = await this.client
        .from("browser_sessions")
        .select("count", { count: "exact", head: true })
        .limit(1);

      if (error) {
        return { healthy: false, reason: error.message };
      }

      return { healthy: true, timestamp: new Date().toISOString() };
    } catch (e) {
      return { healthy: false, reason: e.message };
    }
  }
}

export default SupabaseAdmin;

