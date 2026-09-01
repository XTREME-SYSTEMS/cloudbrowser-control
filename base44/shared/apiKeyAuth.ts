// API Key Authentication — validates API keys with SHA-256 hashing, scope checking,
// expiration enforcement, and last-used tracking.

import { createHash, randomBytes } from 'node:crypto';

export async function hashApiKey(rawKey: string): Promise<string> {
  return createHash('sha256').update(rawKey).digest('hex');
}

export async function generateApiKey(): Promise<{ raw: string; hash: string; prefix: string }> {
  const raw = 'cb_live_' + randomBytes(32).toString('hex');
  const hash = await hashApiKey(raw);
  const prefix = raw.substring(0, 12);
  return { raw, hash, prefix };
}

export interface ApiKeyValidationResult {
  valid: boolean;
  key?: any;
  reason?: string;
}

export async function validateApiKey(
  base44: any,
  rawKey: string,
  requiredScope?: string
): Promise<ApiKeyValidationResult> {
  if (!rawKey || !rawKey.startsWith('cb_live_')) {
    return { valid: false, reason: 'Invalid key format — must start with cb_live_' };
  }

  const hash = await hashApiKey(rawKey);
  const keys = await base44.entities.ApiKey.filter({ key_hash: hash });

  if (keys.length === 0) {
    return { valid: false, reason: 'Key not found' };
  }

  const key = keys[0];

  if (!key.active) {
    return { valid: false, reason: 'Key is inactive' };
  }

  if (key.expires_at && new Date(key.expires_at) < new Date()) {
    return { valid: false, reason: 'Key has expired' };
  }

  if (requiredScope && key.scopes && key.scopes.length > 0) {
    if (!key.scopes.includes(requiredScope) && !key.scopes.includes('*')) {
      return { valid: false, reason: `Missing required scope: ${requiredScope}` };
    }
  }

  // Update last_used (fire-and-forget, don't block validation)
  base44.entities.ApiKey.update(key.id, { last_used: new Date().toISOString() }).catch(() => {});

  return { valid: true, key };
}

export function hasScope(key: any, scope: string): boolean {
  if (!key.scopes || key.scopes.length === 0) return true; // No scopes = all access
  return key.scopes.includes(scope) || key.scopes.includes('*');
}