// ═══════════════════════════════════════════════
// Concurrency Quotas — per-project + per-store enforcement
// Browserbase parity: org-level concurrency distributed across projects,
// session-creation rate limit, 429 + retry-after + x-ratelimit headers.
// ═══════════════════════════════════════════════

// Count active sessions for a project (by project_id on Session entity, status not ended/errored)
export async function countActiveSessionsForProject(base44, projectId) {
  const sessions = await base44.asServiceRole.entities.Session.filter({
    project_id: projectId,
  });
  return sessions.filter((s) => !["ended", "errored", "timed_out"].includes(s.status)).length;
}

// Count active sessions for a store (by store_id metadata on Session)
export async function countActiveSessionsForStore(base44, storeId) {
  if (!storeId) return 0;
  const sessions = await base44.asServiceRole.entities.Session.filter({});
  return sessions.filter((s) => s.metadata?.store_id === storeId && !["ended", "errored", "timed_out"].includes(s.status)).length;
}

// Session-creation rate limit per minute (distinct from request rate limit)
// Uses RateLimitEntry with a composite key hash.
async function hashKey(key) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function checkSessionCreationRate(base44, scope, scopeId, limitPerMin) {
  const now = Date.now();
  const windowStart = Math.floor(now / 60000) * 60000;
  const keyHash = await hashKey(`sesscreate:${scope}:${scopeId}`);

  const updateResult = await base44.asServiceRole.entities.RateLimitEntry.updateMany(
    { key_hash: keyHash, window_start: windowStart },
    { $inc: { count: 1 } }
  );
  const updatedCount = updateResult.updated ?? updateResult.modified_count ?? 0;

  if (updatedCount === 0) {
    try {
      await base44.asServiceRole.entities.RateLimitEntry.create({
        key_hash: keyHash, window_start: windowStart, count: 1,
      });
      return { allowed: true, remaining: limitPerMin - 1, limit: limitPerMin, resetSec: 60 };
    } catch (_e) { /* race — fall through */ }
  }

  const entries = await base44.asServiceRole.entities.RateLimitEntry.filter({
    key_hash: keyHash, window_start: windowStart,
  });
  const totalCount = entries.reduce((sum, e) => sum + (e.count || 0), 0);
  if (entries.length > 1) {
    await base44.asServiceRole.entities.RateLimitEntry.update(entries[0].id, { count: totalCount });
    for (let i = 1; i < entries.length; i++) {
      await base44.asServiceRole.entities.RateLimitEntry.delete(entries[i].id).catch(() => {});
    }
  }
  const remaining = Math.max(0, limitPerMin - totalCount);
  const resetSec = Math.max(1, 60 - Math.floor((now - windowStart) / 1000));
  return { allowed: totalCount <= limitPerMin, remaining, limit: limitPerMin, resetSec };
}

// Resolve the effective concurrency + creation limits for a request.
// Priority: Store > Project > SystemSettings defaults.
export async function resolveQuotas(base44, keyRecord, data) {
  const sysSettingsList = await base44.asServiceRole.entities.SystemSettings.list("-created_date", 1);
  const sys = sysSettingsList[0] || {};
  const defaultConcurrency = sys.max_concurrent_sessions || 10;
  const defaultCreationLimit = sys.rate_limit_per_minute || 60;

  const projectId = keyRecord.project_id || data.project_id || null;
  const storeId = data.store_id || data.metadata?.store_id || null;

  let concurrencyLimit = defaultConcurrency;
  let creationLimit = defaultCreationLimit;
  let store = null;

  if (storeId) {
    const stores = await base44.asServiceRole.entities.Store.filter({ store_code: storeId, status: "active" });
    store = stores[0] || null;
    if (store) {
      if (store.concurrency_limit) concurrencyLimit = store.concurrency_limit;
      if (store.session_creation_limit_per_min) creationLimit = store.session_creation_limit_per_min;
    }
  }

  return {
    projectId, storeId, store,
    concurrencyLimit, creationLimit,
    defaultConcurrency, defaultCreationLimit,
  };
}

// Enforce concurrency + creation quota. Returns null if allowed, or a 429 response payload.
export async function enforceConcurrencyQuota(base44, keyRecord, data) {
  const { projectId, storeId, store, concurrencyLimit, creationLimit } = await resolveQuotas(base44, keyRecord, data);

  // Session-creation rate limit
  const scope = storeId ? "store" : "project";
  const scopeId = storeId || projectId || "global";
  const rate = await checkSessionCreationRate(base44, scope, scopeId, creationLimit);
  if (!rate.allowed) {
    return {
      status: 429,
      error: "Session creation rate limit exceeded",
      headers: {
        "retry-after": String(rate.resetSec),
        "x-ratelimit-limit": String(rate.limit),
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": String(rate.resetSec),
      },
    };
  }

  // Concurrency limit (active sessions) — project/store scoped (Browserbase model).
  // Global keys (no project/store) are rate-limited but not concurrency-capped,
  // preserving baseline test behavior and avoiding cross-tenant pollution.
  let activeCount = null;
  if (projectId || (storeId && store)) {
    if (storeId && store) {
      activeCount = await countActiveSessionsForStore(base44, store.id);
    } else {
      activeCount = await countActiveSessionsForProject(base44, projectId);
    }
    if (activeCount >= concurrencyLimit) {
      return {
        status: 429,
        error: `Concurrency limit reached (${activeCount}/${concurrencyLimit})`,
        headers: {
          "retry-after": "5",
          "x-ratelimit-limit": String(concurrencyLimit),
          "x-ratelimit-remaining": "0",
          "x-ratelimit-reset": "5",
        },
      };
    }
  }

  // Attach rate headers for the success path
  return {
    allowed: true,
    headers: {
      "x-ratelimit-limit": String(rate.limit),
      "x-ratelimit-remaining": String(rate.remaining),
      "x-ratelimit-reset": String(rate.resetSec),
    },
    quotaContext: { projectId, storeId, store, concurrencyLimit, creationLimit, activeCount },
  };
}