# Session Manager Integration Guide

## Overview
The new `SessionManager` (session-manager.js) adds Supabase-backed session tracking to Cloud Browser Engine v3.1.0, preventing zombie processes and enabling graceful recovery from restarts.

## Changes Required to server.js

### 1. Add imports at top
```javascript
import SessionManager from './session-manager.js';
```

### 2. Initialize session manager after config
```javascript
const sessionManager = new SessionManager();
await sessionManager.initSchema();
sessionManager.startCleanupLoop();
```

### 3. Track sessions on creation
In `POST /sessions` handler, after creating browser/context/page:
```javascript
const session = {
  id, browser, context, page, status: "active", url: targetUrl,
  lastActivity: Date.now(), createdAt: Date.now(), 
  consoleLogs: [], networkLogs: [], isPooled: false,
};
sessions.set(id, session);
await sessionManager.trackSession(id, session); // NEW
```

### 4. Update status on pool operations
In pool usage:
```javascript
if (opts.usePool && pool.length > 0) {
  const pooledId = pool.shift();
  const s = sessions.get(pooledId);
  if (s) {
    await sessionManager.setStatus(pooledId, "active"); // NEW
    // ... rest of pool reuse logic
  }
}
```

### 5. Track session state on modifications
When session URL, title, logs change:
```javascript
session.lastActivity = Date.now(); // Update activity timestamp
await sessionManager.setStatus(id, "active"); // Ensure status is current
```

### 6. Cleanup on session close
Replace `closeSession` function with:
```javascript
async function closeSession(id, reason = "ended") {
  const s = sessions.get(id);
  if (!s) return false;
  try { s.status = reason; await s.context.close(); } catch (e) {}
  try { await s.browser?.close(); } catch (e) {}
  sessions.delete(id);
  await sessionManager.closeSession(id, reason); // NEW
  const idx = pool.indexOf(id);
  if (idx >= 0) pool.splice(idx, 1);
  return true;
}
```

### 7. Add recovery on startup
In startup sequence:
```javascript
// Optional: recover sessions from previous crash
const recoveredSessions = await sessionManager.recoverSessions();
recoveredSessions.forEach(s => {
  // Log recovery for monitoring
  console.log(`Recovered session metadata: ${s.id} (${s.status})`);
});
```

## Environment Variables

Add these to Railway service config:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here
SESSION_TTL_MS=300000  # 5 min default
```

## Database Setup

Run migrations.sql in Supabase SQL editor to create the `browser_sessions` table:
```sql
-- Copy content of migrations.sql and run in Supabase
```

Or use the automatic initialization (SessionManager will attempt auto-create).

## Monitoring

Check session health in Supabase:
```sql
-- Active sessions
SELECT id, status, url, last_heartbeat 
FROM browser_sessions 
WHERE status != 'closed' 
ORDER BY last_heartbeat DESC;

-- Zombie sessions (stale > 60s)
SELECT id, worker_id, status, last_heartbeat 
FROM browser_sessions 
WHERE status IN ('active', 'pooled') 
AND last_heartbeat < NOW() - INTERVAL '60 seconds';

-- Sessions by worker
SELECT worker_id, status, COUNT(*) as count 
FROM browser_sessions 
WHERE status != 'closed' 
GROUP BY worker_id, status;
```

## Benefits

✅ **Zombie Detection**: Stale sessions marked as zombie and closed after 60s of no heartbeat
✅ **Pool Resilience**: Session state survives restarts via Supabase
✅ **Memory Leak Prevention**: Periodic cleanup removes dead processes
✅ **Multi-Worker Awareness**: Tracks which worker owns each session
✅ **Observable**: Full audit trail in database for debugging
✅ **Graceful Degradation**: Works in-process-only if Supabase not configured

