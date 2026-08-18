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
// Factory: returns the appropriate adapter based on environment
// ═══════════════════════════════════════════════

export function createFabricAdapters() {
  // In production, check for REDIS_URL and return Redis adapters.
  // Until Redis is provisioned, use local adapters (single-node only).
  const redisUrl = typeof process !== "undefined" && process.env?.REDIS_URL;

  if (redisUrl) {
    // BLOCKED: Redis adapter not yet implemented.
    // When REDIS_URL is provisioned, implement Redis-backed adapters here.
    throw new Error("Redis adapter not yet implemented — REDIS_URL detected but adapter is BLOCKED pending implementation");
  }

  // Local development adapters
  return {
    sessionStore: new LocalSessionStore(),
    workerRegistry: new LocalWorkerRegistry(),
    rateLimiter: new LocalRateLimiter(),
    idempotencyStore: new LocalIdempotencyStore(),
    dlq: new LocalDLQ(),
    distributed: false,
    warning: "Using local single-node adapters — not safe for multi-instance production",
  };
}