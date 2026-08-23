// ═══════════════════════════════════════════════
// Distributed Fabric Adapter Interfaces
// ═══════════════════════════════════════════════
// Process-local Maps are NOT authoritative distributed state.
// These interfaces define the contract for a distributed coordination
// system (Redis-compatible). The LocalAdapter is for development only.
// Production requires a Redis-backed adapter — BLOCKED until provisioned.
//
// Required external dependency: Redis 6+ (or Redis-compatible: Valkey,
// Upstash Redis, Redis Cluster). The adapter needs:
//   - GET/SET/DEL with TTL
//   - Atomic INCR (for rate limiting)
//   - Pub/Sub (for worker heartbeat)
//   - Lua scripts (for atomic lease acquire/release)
//   - Streams (for DLQ)
//
// Integration requirement:
//   REDIS_URL environment variable (rediss:// for TLS)
//   ioredis or node-redis client library

// ── Session Store ──
export class SessionStoreAdapter {
  async acquire(sessionId, ownerId, ttlMs) { throw new Error("Not implemented"); }
  async release(sessionId) { throw new Error("Not implemented"); }
  async get(sessionId) { throw new Error("Not implemented"); }
  async list(filters) { throw new Error("Not implemented"); }
  async heartbeat(sessionId) { throw new Error("Not implemented"); }
}

// ── Worker Registry ──
export class WorkerRegistryAdapter {
  async register(workerId, metadata) { throw new Error("Not implemented"); }
  async heartbeat(workerId) { throw new Error("Not implemented"); }
  async deregister(workerId) { throw new Error("Not implemented"); }
  async list() { throw new Error("Not implemented"); }
  async listByRegion(region) { throw new Error("Not implemented"); }
  async detectDeadWorkers(timeoutMs) { throw new Error("Not implemented"); }
}

// ── Lease Store ──
export class LeaseStoreAdapter {
  async acquire(resourceId, ownerId, ttlMs) { throw new Error("Not implemented"); }
  async renew(resourceId, ownerId, ttlMs) { throw new Error("Not implemented"); }
  async release(resourceId, ownerId) { throw new Error("Not implemented"); }
  async detectStaleLeases(timeoutMs) { throw new Error("Not implemented"); }
}

// ── Distributed Rate Limiter ──
export class RateLimiterAdapter {
  async check(key, limit, windowMs) { throw new Error("Not implemented"); }
  async reset(key) { throw new Error("Not implemented"); }
}

// ── Idempotency Store ──
export class IdempotencyStoreAdapter {
  async checkAndMark(key, ttlMs) { throw new Error("Not implemented"); }
  async get(key) { throw new Error("Not implemented"); }
  async set(key, value, ttlMs) { throw new Error("Not implemented"); }
}

// ── Dead Letter Queue ──
export class DLQAdapter {
  async enqueue(message) { throw new Error("Not implemented"); }
  async dequeue() { throw new Error("Not implemented"); }
  async peek(limit) { throw new Error("Not implemented"); }
  async requeue(messageId) { throw new Error("Not implemented"); }
  async purge(messageId) { throw new Error("Not implemented"); }
}

// ── Distributed Pool State ──
export class PoolStateAdapter {
  async getPoolState() { throw new Error("Not implemented"); }
  async acquireFromPool() { throw new Error("Not implemented"); }
  async returnToPool(sessionId) { throw new Error("Not implemented"); }
  async warmPool(count) { throw new Error("Not implemented"); }
}

// ═══════════════════════════════════════════════
// Local (single-node) adapter — development only
// NOT safe for multi-instance production
// ═══════════════════════════════════════════════

export class LocalSessionStore extends SessionStoreAdapter {
  constructor() { super(); this.sessions = new Map(); }
  async acquire(sessionId, ownerId, ttlMs) {
    this.sessions.set(sessionId, { ownerId, acquiredAt: Date.now(), ttlMs, heartbeat: Date.now() });
    return true;
  }
  async release(sessionId) { this.sessions.delete(sessionId); return true; }
  async get(sessionId) { return this.sessions.get(sessionId) || null; }
  async list() { return [...this.sessions.values()]; }
  async heartbeat(sessionId) {
    const s = this.sessions.get(sessionId);
    if (s) { s.heartbeat = Date.now(); return true; }
    return false;
  }
}

export class LocalWorkerRegistry extends WorkerRegistryAdapter {
  constructor() { super(); this.workers = new Map(); }
  async register(workerId, metadata) { this.workers.set(workerId, { ...metadata, lastHeartbeat: Date.now() }); }
  async heartbeat(workerId) {
    const w = this.workers.get(workerId);
    if (w) { w.lastHeartbeat = Date.now(); return true; }
    return false;
  }
  async deregister(workerId) { this.workers.delete(workerId); }
  async list() { return [...this.workers.entries()].map(([id, w]) => ({ id, ...w })); }
  async listByRegion(region) { return (await this.list()).filter((w) => w.region === region); }
  async detectDeadWorkers(timeoutMs = 60000) {
    const now = Date.now();
    return (await this.list()).filter((w) => now - w.lastHeartbeat > timeoutMs);
  }
}

export class LocalRateLimiter extends RateLimiterAdapter {
  constructor() { super(); this.windows = new Map(); }
  async check(key, limit, windowMs) {
    const now = Date.now();
    const entries = (this.windows.get(key) || []).filter((t) => now - t < windowMs);
    if (entries.length >= limit) return false;
    entries.push(now);
    this.windows.set(key, entries);
    return true;
  }
  async reset(key) { this.windows.delete(key); }
}

export class LocalIdempotencyStore extends IdempotencyStoreAdapter {
  constructor() { super(); this.store = new Map(); }
  async checkAndMark(key, ttlMs) {
    if (this.store.has(key)) return false;
    this.store.set(key, { ts: Date.now() });
    setTimeout(() => this.store.delete(key), ttlMs);
    return true;
  }
  async get(key) { return this.store.get(key) || null; }
  async set(key, value, ttlMs) { this.store.set(key, { value, ts: Date.now() }); }
}

export class LocalDLQ extends DLQAdapter {
  constructor() { super(); this.queue = []; }
  async enqueue(message) { this.queue.push({ id: Date.now() + "_" + Math.random(), ...message }); }
  async dequeue() { return this.queue.shift() || null; }
  async peek(limit = 10) { return this.queue.slice(0, limit); }
  async requeue(messageId) { /* no-op in local */ }
  async purge(messageId) { this.queue = this.queue.filter((m) => m.id !== messageId); }
}

// ═══════════════════════════════════════════════
// Redis-backed adapters — activate when REDIS_URL + FORTRESS_DISTRIBUTED_MODE=true
// Dormant otherwise (preserves single-worker baseline). Requires ioredis in the
// runtime that imports this (engine on Railway). Base44 backend sandbox stays local.
// ═══════════════════════════════════════════════

async function getRedis() {
  if (typeof process === "undefined") return null;
  const url = process.env?.REDIS_URL;
  const distributed = process.env?.FORTRESS_DISTRIBUTED_MODE === "true";
  if (!url || !distributed) return null;
  try {
    const { default: Redis } = await import("npm:ioredis@5.4.1");
    return new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: false, tls: url.startsWith("rediss://") ? {} : undefined });
  } catch (_e) {
    return null; // ioredis not installed in this runtime — fall back to local
  }
}

class RedisSessionStore extends SessionStoreAdapter {
  constructor(redis) { super(); this.redis = redis; this.prefix = "cb:sess:"; }
  async acquire(sessionId, ownerId, ttlMs) {
    await this.redis.set(this.prefix + sessionId, JSON.stringify({ ownerId, acquiredAt: Date.now(), ttlMs, heartbeat: Date.now() }), "PX", ttlMs);
    return true;
  }
  async release(sessionId) { await this.redis.del(this.prefix + sessionId); return true; }
  async get(sessionId) { const v = await this.redis.get(this.prefix + sessionId); return v ? JSON.parse(v) : null; }
  async list() { const keys = await this.redis.keys(this.prefix + "*"); const vals = await Promise.all(keys.map((k) => this.redis.get(k))); return vals.filter(Boolean).map((v) => JSON.parse(v)); }
  async heartbeat(sessionId) { const v = await this.redis.get(this.prefix + sessionId); if (!v) return false; const o = JSON.parse(v); o.heartbeat = Date.now(); await this.redis.set(this.prefix + sessionId, JSON.stringify(o), "PX", o.ttlMs); return true; }
}

class RedisWorkerRegistry extends WorkerRegistryAdapter {
  constructor(redis) { super(); this.redis = redis; this.prefix = "cb:worker:"; }
  async register(workerId, metadata) { await this.redis.set(this.prefix + workerId, JSON.stringify({ ...metadata, lastHeartbeat: Date.now() }), "PX", 90000); }
  async heartbeat(workerId) { const v = await this.redis.get(this.prefix + workerId); if (!v) return false; const o = JSON.parse(v); o.lastHeartbeat = Date.now(); await this.redis.set(this.prefix + workerId, JSON.stringify(o), "PX", 90000); return true; }
  async deregister(workerId) { await this.redis.del(this.prefix + workerId); }
  async list() { const keys = await this.redis.keys(this.prefix + "*"); const vals = await Promise.all(keys.map((k) => this.redis.get(k))); return keys.map((k, i) => ({ id: k.replace(this.prefix, ""), ...JSON.parse(vals[i]) })); }
  async listByRegion(region) { return (await this.list()).filter((w) => w.region === region); }
  async detectDeadWorkers(timeoutMs = 90000) { return (await this.list()).filter((w) => Date.now() - w.lastHeartbeat > timeoutMs); }
}

class RedisRateLimiter extends RateLimiterAdapter {
  constructor(redis) { super(); this.redis = redis; }
  async check(key, limit, windowMs) {
    const now = Date.now();
    const windowKey = `cb:rl:${key}:${Math.floor(now / windowMs)}`;
    const count = await this.redis.incr(windowKey);
    if (count === 1) await this.redis.pexpire(windowKey, windowMs);
    return count <= limit;
  }
  async reset(key) { const keys = await this.redis.keys(`cb:rl:${key}:*`); if (keys.length) await this.redis.del(...keys); }
}

class RedisIdempotencyStore extends IdempotencyStoreAdapter {
  constructor(redis) { super(); this.redis = redis; this.prefix = "cb:idem:"; }
  async checkAndMark(key, ttlMs) { const r = await this.redis.set(this.prefix + key, "1", "PX", ttlMs, "NX"); return r === "OK"; }
  async get(key) { return this.redis.get(this.prefix + key); }
  async set(key, value, ttlMs) { await this.redis.set(this.prefix + key, value, "PX", ttlMs); }
}

class RedisDLQ extends DLQAdapter {
  constructor(redis) { super(); this.redis = redis; this.key = "cb:dlq"; }
  async enqueue(message) { await this.redis.rpush(this.key, JSON.stringify({ id: Date.now() + "_" + Math.random(), ...message })); }
  async dequeue() { const v = await this.redis.lpop(this.key); return v ? JSON.parse(v) : null; }
  async peek(limit = 10) { const vals = await this.redis.lrange(this.key, 0, limit - 1); return vals.map((v) => JSON.parse(v)); }
  async requeue(messageId) { /* no-op — requeue handled by consumer */ }
  async purge(messageId) { /* filter via script — best-effort */ const vals = await this.redis.lrange(this.key, 0, -1); for (const v of vals) { const m = JSON.parse(v); if (m.id === messageId) await this.redis.lrem(this.key, 1, v); } }
}

// ═══════════════════════════════════════════════
// Factory: returns Redis adapters when REDIS_URL + FORTRESS_DISTRIBUTED_MODE=true,
// otherwise local single-worker adapters (preserves 47/47 baseline).
// ═══════════════════════════════════════════════

export async function createFabricAdapters() {
  const redis = await getRedis();
  if (redis) {
    return {
      sessionStore: new RedisSessionStore(redis),
      workerRegistry: new RedisWorkerRegistry(redis),
      rateLimiter: new RedisRateLimiter(redis),
      idempotencyStore: new RedisIdempotencyStore(redis),
      dlq: new RedisDLQ(redis),
      distributed: true,
      mode: "DISTRIBUTED_REDIS",
    };
  }
  return {
    sessionStore: new LocalSessionStore(),
    workerRegistry: new LocalWorkerRegistry(),
    rateLimiter: new LocalRateLimiter(),
    idempotencyStore: new LocalIdempotencyStore(),
    dlq: new LocalDLQ(),
    distributed: false,
    mode: "SINGLE_WORKER_PRODUCTION",
    warning: "SINGLE_WORKER mode — local adapters only. Multi-worker requires REDIS_URL + FORTRESS_DISTRIBUTED_MODE=true.",
  };
}

// Enforce single-worker mode ONLY when distributed mode is not enabled.
// When Redis is provisioned + FORTRESS_DISTRIBUTED_MODE=true, multi-worker is allowed.
export function enforceSingleWorker() {
  const distributed = typeof process !== "undefined" && process.env?.FORTRESS_DISTRIBUTED_MODE === "true" && !!process.env?.REDIS_URL;
  if (distributed) return { mode: "DISTRIBUTED", worker_id: process.env?.WORKER_ID || process.env?.RAILWAY_REPLICA_ID || "distributed" };
  const workerId = typeof process !== "undefined" ? process.env?.WORKER_ID || process.env?.RAILWAY_REPLICA_ID : null;
  if (workerId && workerId !== "0" && workerId !== "1") {
    throw new Error(`MULTI_WORKER_DETECTED: WORKER_ID=${workerId}. Set REDIS_URL + FORTRESS_DISTRIBUTED_MODE=true for multi-worker, else run single-worker.`);
  }
  return { mode: "SINGLE_WORKER", worker_id: workerId || "single" };
}