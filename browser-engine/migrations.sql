-- Browser session tracking for Cloud Browser Engine
-- Tracks session lifecycle, enables zombie detection, survives restarts

CREATE TABLE IF NOT EXISTS browser_sessions (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pooled', 'active', 'closing', 'zombie', 'closed')),
  url TEXT,
  pool_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ttl_ms INT DEFAULT 300000,
  closed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_browser_sessions_worker_status 
  ON browser_sessions(worker_id, status);

CREATE INDEX IF NOT EXISTS idx_browser_sessions_last_heartbeat 
  ON browser_sessions(last_heartbeat);

-- Auto-archive closed sessions older than 7 days (optional)
-- Can be run as a cron job
CREATE OR REPLACE FUNCTION archive_old_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM browser_sessions 
  WHERE status = 'closed' 
  AND closed_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

