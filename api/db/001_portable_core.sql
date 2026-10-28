-- CloudBrowser Control — portable core schema (Phase 3.4)
-- Target: PostgreSQL 15+ (Supabase compatible). Idempotent: safe to re-run.
--
-- Tenant isolation model
--   * Every tenant-owned table carries tenant_id and has RLS enabled.
--   * The API role reads/writes only rows matching app.tenant_id, set per
--     transaction by shared/db.js → withTenant(). If the setting is absent
--     the predicate evaluates to NULL and no rows are visible (fail-closed).
--   * The worker claims jobs ACROSS tenants, so it connects with a role that
--     has BYPASSRLS. In local Docker the table owner bypasses RLS by default;
--     production must use the two roles created at the bottom of this file.
--
-- The browser engine owns its own table set (browser-engine/migrations.sql)
-- and is intentionally NOT duplicated here.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Tenants ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  plan          TEXT NOT NULL DEFAULT 'standard',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  suspended_at  TIMESTAMPTZ
);

-- ── API keys (HMAC-SHA256 hash only; the plaintext is never stored) ─────
CREATE TABLE IF NOT EXISTS api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  label        TEXT NOT NULL,
  environment  TEXT NOT NULL CHECK (environment IN ('cb_live', 'cb_test')),
  prefix       TEXT NOT NULL,
  key_hash     TEXT NOT NULL,
  scopes       TEXT[] NOT NULL DEFAULT ARRAY['jobs:read', 'jobs:write', 'sessions:read', 'sessions:write'],
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_prefix_env ON api_keys (prefix, environment);
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON api_keys (tenant_id);

-- ── Jobs (durable queue) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type              TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'queued'
                      CHECK (status IN ('queued', 'leased', 'succeeded', 'failed', 'dead_letter', 'cancelled')),
  priority          SMALLINT NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 9),
  payload           JSONB NOT NULL DEFAULT '{}'::JSONB,
  result            JSONB,
  error             TEXT,
  attempts          INT NOT NULL DEFAULT 0,
  max_attempts      INT NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 20),
  idempotency_key   TEXT,
  lease_owner       TEXT,
  lease_expires_at  TIMESTAMPTZ,
  available_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ
);

-- Partial unique index: enforces idempotency only when a key was supplied.
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_idempotency
  ON jobs (tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_claim
  ON jobs (status, available_at, priority) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_jobs_lease
  ON jobs (lease_expires_at) WHERE status = 'leased';
CREATE INDEX IF NOT EXISTS idx_jobs_tenant_created
  ON jobs (tenant_id, created_at DESC);

-- ── Job attempts (per-attempt audit trail) ──────────────────────────────
CREATE TABLE IF NOT EXISTS job_attempts (
  id           BIGSERIAL PRIMARY KEY,
  job_id       UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  attempt      INT NOT NULL,
  worker_id    TEXT NOT NULL,
  outcome      TEXT NOT NULL CHECK (outcome IN ('succeeded', 'failed', 'retrying', 'dead_letter', 'lease_expired')),
  failure_kind TEXT,
  error        TEXT,
  duration_ms  INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_attempts_job ON job_attempts (job_id, attempt);

-- ── Artifacts (screenshots, PDFs, HAR, video references) ────────────────
CREATE TABLE IF NOT EXISTS artifacts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id   TEXT,
  job_id       UUID REFERENCES jobs(id) ON DELETE SET NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('screenshot', 'pdf', 'har', 'video', 'download', 'dom', 'other')),
  storage_uri  TEXT NOT NULL,
  bytes        BIGINT NOT NULL DEFAULT 0 CHECK (bytes >= 0),
  sha256       TEXT,
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artifacts_tenant_created ON artifacts (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_artifacts_expiry ON artifacts (expires_at) WHERE expires_at IS NOT NULL;

-- ── Audit log ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGSERIAL PRIMARY KEY,
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  actor       TEXT NOT NULL,
  action      TEXT NOT NULL,
  target      TEXT,
  request_id  TEXT,
  ip          TEXT,
  detail      JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_created ON audit_log (tenant_id, created_at DESC);

-- ── Session ownership (gateway-side tenant binding) ─────────────────────
-- The browser engine tracks sessions in its own schema and exposes NO tenant
-- field (verified: browser-engine/server.js list response carries only
-- sessionId/status/url/title/timestamps/workerId/region). The gateway therefore
-- records ownership here, and every session read or write resolves through it.
-- A session with no owner row is denied — fail-closed.
CREATE TABLE IF NOT EXISTS session_owners (
  session_id  TEXT PRIMARY KEY,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_owners_tenant ON session_owners (tenant_id);

-- ── updated_at maintenance ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_jobs_touch ON jobs;
CREATE TRIGGER trg_jobs_touch BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ── Row-Level Security: tenant isolation, fail-closed ───────────────────
ALTER TABLE jobs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifacts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS jobs_tenant_isolation ON jobs;
CREATE POLICY jobs_tenant_isolation ON jobs
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID);

DROP POLICY IF EXISTS job_attempts_tenant_isolation ON job_attempts;
CREATE POLICY job_attempts_tenant_isolation ON job_attempts
  USING (EXISTS (
    SELECT 1 FROM jobs j
     WHERE j.id = job_attempts.job_id
       AND j.tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID
  ));

DROP POLICY IF EXISTS artifacts_tenant_isolation ON artifacts;
CREATE POLICY artifacts_tenant_isolation ON artifacts
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID);

DROP POLICY IF EXISTS audit_log_tenant_isolation ON audit_log;
CREATE POLICY audit_log_tenant_isolation ON audit_log
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID);

DROP POLICY IF EXISTS api_keys_tenant_isolation ON api_keys;
CREATE POLICY api_keys_tenant_isolation ON api_keys
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID);

ALTER TABLE session_owners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS session_owners_tenant_isolation ON session_owners;
CREATE POLICY session_owners_tenant_isolation ON session_owners
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID);

-- ── Service roles ───────────────────────────────────────────────────────
-- The API connects as cloudbrowser_api (RLS enforced).
-- The worker connects as cloudbrowser_worker (BYPASSRLS) because it claims
-- jobs across tenants. Never expose cloudbrowser_worker to the internet.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cloudbrowser_api') THEN
    CREATE ROLE cloudbrowser_api NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cloudbrowser_worker') THEN
    CREATE ROLE cloudbrowser_worker NOLOGIN BYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO cloudbrowser_api, cloudbrowser_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO cloudbrowser_api, cloudbrowser_worker;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO cloudbrowser_api, cloudbrowser_worker;

COMMIT;