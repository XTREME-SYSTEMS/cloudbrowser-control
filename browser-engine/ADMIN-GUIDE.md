# Cloud Browser Engine - Admin Control Panel

v3.1.0+ includes a full-featured admin API for Supabase bidirectional sync, automatic schema management, and real-time monitoring.

## Quick Start

### 1. Update Credentials at Runtime

Without restarting, update your Supabase credentials:

```bash
curl -X POST https://cloudbrowser-engine-production.up.railway.app/admin/credentials \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_ENGINE_API_KEY" \
  -d '{
    "supabaseUrl": "https://your-project.supabase.co",
    "supabaseServiceKey": "your-service-role-key-here"
  }'
```

**Response:**
```json
{
  "status": "credentials_updated",
  "supabaseUrl": "https://your-project.supabase.co",
  "connected": true
}
```

### 2. Force Sync & Auto-Migrate

Verify connection and auto-create missing tables:

```bash
curl -X POST https://cloudbrowser-engine-production.up.railway.app/admin/sync \
  -H "x-api-key: YOUR_ENGINE_API_KEY"
```

**Response:**
```json
{
  "status": "synced",
  "supabase": {
    "healthy": true,
    "timestamp": "2026-09-04T02:50:00Z"
  },
  "schema": {
    "browser_sessions": {...},
    "browser_events": {...},
    "browser_pool_stats": {...}
  },
  "sessionCount": 12,
  "latestStats": {...}
}
```

### 3. Check Health

Quick health check (no schema creation):

```bash
curl https://cloudbrowser-engine-production.up.railway.app/admin/health \
  -H "x-api-key: YOUR_ENGINE_API_KEY"
```

**Response:**
```json
{
  "engine": {
    "status": "ok",
    "activeSessions": 3,
    "poolSize": 2,
    "uptime": 12345.67,
    "memory": {...}
  },
  "supabase": {
    "healthy": true,
    "timestamp": "2026-09-04T02:50:00Z"
  },
  "enabled": true,
  "schemaVersion": "3.1.0"
}
```

## Admin API Endpoints

### POST /admin/credentials
**Update Supabase credentials at runtime (no restart needed)**

```bash
curl -X POST https://your-engine/admin/credentials \
  -H "Content-Type: application/json" \
  -H "x-api-key: ENGINE_API_KEY" \
  -d '{
    "supabaseUrl": "https://your-project.supabase.co",
    "supabaseServiceKey": "sbrk_service_..."
  }'
```

**Response:** `{ "status": "credentials_updated", "connected": true }`

---

### POST /admin/sync
**Full sync: verify Supabase connection + auto-migrate schema**

Checks that Supabase is reachable and creates any missing tables.

```bash
curl -X POST https://your-engine/admin/sync -H "x-api-key: ENGINE_API_KEY"
```

**Response:**
- `status: "synced"` ✅
- `supabase.healthy: true` ✅
- `sessionCount`: current tracked sessions
- `latestStats`: most recent pool snapshot

---

### POST /admin/migrate
**Manually run schema migrations**

Idempotent — safe to run multiple times (no-op if tables exist).

```bash
curl -X POST https://your-engine/admin/migrate -H "x-api-key: ENGINE_API_KEY"
```

**Response:**
```json
{
  "status": "migrations_triggered",
  "schema": {
    "browser_sessions": { "name": "browser_sessions", "managed": true },
    "browser_events": { "name": "browser_events", "managed": true },
    "browser_pool_stats": { "name": "browser_pool_stats", "managed": true }
  }
}
```

---

### GET /admin/status
**Current sync state**

```bash
curl https://your-engine/admin/status -H "x-api-key: ENGINE_API_KEY"
```

**Response:**
```json
{
  "supabaseEnabled": true,
  "supabaseConnected": true,
  "engineVersion": "3.1.0",
  "schemaVersion": "3.1.0",
  "activeSessions": 5,
  "poolSize": 3,
  "sessionManagerEnabled": true
}
```

---

### GET /admin/stats?hours=24
**Pool metrics and session history (configurable lookback)**

```bash
curl "https://your-engine/admin/stats?hours=24" -H "x-api-key: ENGINE_API_KEY"
```

**Response:**
```json
{
  "period": { "hours": 24, "since": "2026-09-03T02:50:00Z" },
  "current": {
    "activeSessions": 5,
    "poolSize": 3,
    "totalTracked": 48,
    "byStatus": {
      "pooled": 3,
      "active": 2,
      "zombie": 0,
      "closed": 43
    }
  },
  "history": [
    {
      "id": 142,
      "worker_id": "worker-123",
      "pool_size": 3,
      "active_sessions": 5,
      "zombie_count": 0,
      "memory_usage_mb": 512.34,
      "created_at": "2026-09-04T02:45:00Z"
    }
  ],
  "snapshots": 144
}
```

---

### GET /admin/sessions/:id
**Get a specific session details**

```bash
curl https://your-engine/admin/sessions/sess_abc123xyz \
  -H "x-api-key: ENGINE_API_KEY"
```

**Response:**
```json
{
  "id": "sess_abc123xyz",
  "data": {
    "id": "sess_abc123xyz",
    "worker_id": "worker-123",
    "status": "active",
    "url": "https://example.com",
    "created_at": "2026-09-04T02:50:00Z",
    "last_heartbeat": "2026-09-04T02:50:15Z"
  }
}
```

---

### POST /admin/cleanup
**Manually trigger zombie detection and cleanup**

Scans for sessions with no heartbeat > 60s, marks them as `zombie`.

```bash
curl -X POST https://your-engine/admin/cleanup \
  -H "Content-Type: application/json" \
  -H "x-api-key: ENGINE_API_KEY" \
  -d '{ "timeoutMs": 60000 }'
```

**Response:**
```json
{
  "status": "cleanup_complete",
  "zombiesDetected": 2,
  "zombieIds": ["sess_z1", "sess_z2"]
}
```

---

### GET /admin/health
**Engine + Supabase health check**

```bash
curl https://your-engine/admin/health -H "x-api-key: ENGINE_API_KEY"
```

**Response:**
```json
{
  "engine": {
    "status": "ok",
    "activeSessions": 3,
    "poolSize": 2,
    "uptime": 7200,
    "memory": { "heapUsed": 150000000, "heapTotal": 300000000 }
  },
  "supabase": {
    "healthy": true,
    "timestamp": "2026-09-04T02:50:00Z"
  },
  "enabled": true,
  "schemaVersion": "3.1.0"
}
```

## Automatic Schema Management

The engine **automatically creates missing tables** on first connection:

1. **`browser_sessions`** — tracks session lifecycle (pooled/active/zombie/closed)
2. **`browser_events`** — audit log for all session state changes
3. **`browser_pool_stats`** — periodic snapshots of pool health metrics

If Supabase credentials are missing or wrong:
- Engine falls back to in-process session tracking (no persistence)
- Admin endpoints return `503 Service Unavailable`
- POST /admin/credentials endpoint available to fix credentials

## Monitoring Dashboard

Use the admin API to build a real-time dashboard:

```python
import requests
import time

ENGINE_URL = "https://cloudbrowser-engine-production.up.railway.app"
API_KEY = "your-engine-api-key"

headers = {"x-api-key": API_KEY}

while True:
    # Get current status
    r = requests.get(f"{ENGINE_URL}/admin/status", headers=headers)
    status = r.json()
    
    print(f"Active: {status['activeSessions']}, Pool: {status['poolSize']}")
    
    # Get historical stats
    r = requests.get(f"{ENGINE_URL}/admin/stats?hours=1", headers=headers)
    stats = r.json()
    
    print(f"24h avg pool: {sum(s['pool_size'] for s in stats['history']) / len(stats['history'])}")
    
    time.sleep(30)
```

## Troubleshooting

### "Supabase not enabled"
**Problem:** Admin endpoints return 503

**Fix:**
```bash
curl -X POST https://your-engine/admin/credentials \
  -H "Content-Type: application/json" \
  -H "x-api-key: ENGINE_API_KEY" \
  -d '{
    "supabaseUrl": "https://your-project.supabase.co",
    "supabaseServiceKey": "sbrk_service_..."
  }'
```

### "Supabase connection failed"
**Problem:** Credentials set but connection fails

**Fix:**
1. Verify SUPABASE_URL is correct: `https://YOUR-PROJECT.supabase.co`
2. Verify SERVICE_KEY (not ANON key): starts with `sbrk_service_`
3. Check Supabase project status in dashboard
4. Retry: `POST /admin/sync`

### Sessions not syncing to Supabase
**Problem:** Sessions tracked locally but not appearing in Supabase

**Fix:**
1. Check: `GET /admin/status` → `supabaseConnected` should be `true`
2. Run: `POST /admin/sync` to trigger auto-migration
3. Check Supabase: `SELECT COUNT(*) FROM browser_sessions;`
4. If table doesn't exist, run migrations manually in Supabase SQL editor

## Security Notes

- Admin endpoints require valid `x-api-key` header (same as session API)
- POST /admin/credentials updates credentials in-process (survives only current restart)
- For persistent credential updates, set env vars in Railway and redeploy
- All database queries use service role key (read/write all tables)
- Audit events logged in `browser_events` table for compliance

