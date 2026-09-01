// Rate Limiter — fixed-window rate limiting using the RateLimitEntry entity.
// SHA-256 hashes the key so the raw key is never stored.

import { createHash } from 'node:crypto';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: number;
  windowStart: number;
}

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

function currentWindowStart(): number {
  return Math.floor(Date.now() / 60000) * 60000;
}

export async function checkRateLimit(
  base44: any,
  key: string,
  limitPerMinute: number
): Promise<RateLimitResult> {
  const keyHash = hashKey(key);
  const windowStart = currentWindowStart();
  const resetAt = windowStart + 60000;

  const entries = await base44.entities.RateLimitEntry.filter({ key_hash: keyHash, window_start: windowStart });

  if (entries.length > 0) {
    const entry = entries[0];
    if (entry.count >= limitPerMinute) {
      return { allowed: false, remaining: 0, limit: limitPerMinute, resetAt, windowStart };
    }
    await base44.entities.RateLimitEntry.update(entry.id, { count: entry.count + 1 });
    return { allowed: true, remaining: limitPerMinute - entry.count - 1, limit: limitPerMinute, resetAt, windowStart };
  }

  await base44.entities.RateLimitEntry.create({ key_hash: keyHash, window_start: windowStart, count: 1 });
  return { allowed: true, remaining: limitPerMinute - 1, limit: limitPerMinute, resetAt, windowStart };
}

export async function getCurrentCount(base44: any, key: string): Promise<number> {
  const keyHash = hashKey(key);
  const windowStart = currentWindowStart();
  const entries = await base44.entities.RateLimitEntry.filter({ key_hash: keyHash, window_start: windowStart });
  return entries.length > 0 ? entries[0].count : 0;
}

export async function resetRateLimit(base44: any, key: string): Promise<void> {
  const keyHash = hashKey(key);
  await base44.entities.RateLimitEntry.deleteMany({ key_hash: keyHash });
}