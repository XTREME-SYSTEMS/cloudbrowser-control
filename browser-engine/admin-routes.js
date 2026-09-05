/**
 * Admin API Routes - Full Supabase control panel
 * POST /admin/sync - Force sync schema and health check
 * POST /admin/migrate - Run migrations manually
 * GET /admin/status - Supabase sync status
 * GET /admin/stats - Pool and session statistics
 * POST /admin/cleanup - Manually trigger zombie cleanup
 */

export function setupAdminRoutes(app, supabaseAdmin, sessionManager, sessions, pool) {
  // Health and diagnostics
  app.get("/admin/health", async (req, res) => {
    const sbHealth = await supabaseAdmin.healthCheck();
    const engineHealth = {
      status: "ok",
      activeSessions: sessions.size,
      poolSize: pool.length,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };

    res.json({
      engine: engineHealth,
      supabase: sbHealth,
      enabled: supabaseAdmin.isEnabled,
      schemaVersion: supabaseAdmin.schemaVersion,
    });
  });

  // Full sync: verify schema exists and is healthy
  app.post("/admin/sync", async (req, res) => {
    if (!supabaseAdmin.isEnabled) {
      return res.status(503).json({
        error: "Supabase not enabled",
        hint: "Set SUPABASE_URL and SUPABASE_SERVICE_KEY env vars",
      });
    }

    try {
      const health = await supabaseAdmin.healthCheck();
      if (!health.healthy) {
        return res.status(503).json({
          error: "Supabase connection failed",
          details: health.reason,
        });
      }

      // Run migrations to ensure schema is current
      await supabaseAdmin.runMigrations();

      // Get current state
      const workerSessions = await supabaseAdmin.getWorkerSessions();
      const stats = await supabaseAdmin.getStats(1);

      res.json({
        status: "synced",
        supabase: health,
        schema: supabaseAdmin.tables,
        sessionCount: workerSessions.length,
        latestStats: stats?.workerStats?.[0] || null,
      });
    } catch (e) {
      res.status(500).json({ error: "Sync failed", details: e.message });
    }
  });

  // Manual migration: run schema migrations
  app.post("/admin/migrate", async (req, res) => {
    if (!supabaseAdmin.isEnabled) {
      return res.status(503).json({
        error: "Supabase not enabled",
      });
    }

    try {
      await supabaseAdmin.runMigrations();
      res.json({
        status: "migrations_triggered",
        schema: supabaseAdmin.tables,
        note: "If tables already exist, this is a no-op. Check Supabase for details.",
      });
    } catch (e) {
      res.status(500).json({ error: "Migration failed", details: e.message });
    }
  });

  // Status: current sync state
  app.get("/admin/status", async (req, res) => {
    const health = await supabaseAdmin.healthCheck();

    res.json({
      supabaseEnabled: supabaseAdmin.isEnabled,
      supabaseConnected: health.healthy,
      supabaseError: health.reason || null,
      engineVersion: "3.1.0",
      schemaVersion: supabaseAdmin.schemaVersion,
      activeSessions: sessions.size,
      poolSize: pool.length,
      sessionManagerEnabled: sessionManager?.isEnabled || false,
    });
  });

  // Stats: pool metrics and session history
  app.get("/admin/stats", async (req, res) => {
    const hours = parseInt(req.query.hours || "24", 10);

    if (!supabaseAdmin.isEnabled) {
      return res.json({
        error: "Supabase not enabled",
        local: {
          activeSessions: sessions.size,
          poolSize: pool.length,
        },
      });
    }

    try {
      const stats = await supabaseAdmin.getStats(hours);
      const currentSessions = await supabaseAdmin.getWorkerSessions();

      res.json({
        period: { hours, since: new Date(Date.now() - hours * 60 * 60 * 1000).toISOString() },
        current: {
          activeSessions: sessions.size,
          poolSize: pool.length,
          totalTracked: currentSessions.length,
          byStatus: {
            pooled: currentSessions.filter((s) => s.status === "pooled").length,
            active: currentSessions.filter((s) => s.status === "active").length,
            zombie: currentSessions.filter((s) => s.status === "zombie").length,
            closed: currentSessions.filter((s) => s.status === "closed").length,
          },
        },
        history: stats?.workerStats || [],
        snapshots: stats?.totalSnapshots || 0,
      });
    } catch (e) {
      res.status(500).json({ error: "Stats fetch failed", details: e.message });
    }
  });

  // Manual zombie cleanup
  app.post("/admin/cleanup", async (req, res) => {
    if (!supabaseAdmin.isEnabled) {
      return res.status(503).json({
        error: "Supabase not enabled",
      });
    }

    try {
      const timeoutMs = parseInt(req.body?.timeoutMs || "60000", 10);
      const zombies = await supabaseAdmin.detectZombies(timeoutMs);

      res.json({
        status: "cleanup_complete",
        zombiesDetected: zombies.length,
        zombieIds: zombies.map((z) => z.id),
      });
    } catch (e) {
      res.status(500).json({ error: "Cleanup failed", details: e.message });
    }
  });

  // Session details
  app.get("/admin/sessions/:id", async (req, res) => {
    const { id } = req.params;

    if (!supabaseAdmin.isEnabled) {
      const local = sessions.get(id);
      return res.json({
        id,
        local: local || null,
        supabase: "not enabled",
      });
    }

    try {
      const sessionData = await supabaseAdmin.getSession(id);
      res.json({
        id,
        data: sessionData || null,
      });
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch session", details: e.message });
    }
  });

  // Re-authenticate with new Supabase token (runtime update)
  app.post("/admin/credentials", async (req, res) => {
    const { supabaseUrl, supabaseServiceKey } = req.body;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(400).json({
        error: "Missing supabaseUrl or supabaseServiceKey",
      });
    }

    try {
      // Update env vars (in-process)
      process.env.SUPABASE_URL = supabaseUrl;
      process.env.SUPABASE_SERVICE_KEY = supabaseServiceKey;

      // Re-initialize Supabase admin
      const newAdmin = new SupabaseAdmin();
      const success = await newAdmin.init();

      if (!success) {
        return res.status(503).json({
          error: "Failed to connect with new credentials",
        });
      }

      // Replace the global instance
      Object.assign(supabaseAdmin, newAdmin);

      res.json({
        status: "credentials_updated",
        supabaseUrl,
        connected: supabaseAdmin.isEnabled,
      });
    } catch (e) {
      res.status(500).json({ error: "Credentials update failed", details: e.message });
    }
  });

  console.log("✅ Admin routes initialized (/admin/*)");
}

