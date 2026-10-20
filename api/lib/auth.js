// API-key authentication and tenant resolution.
// Portable replacement for Base44 auth on the service surface: no platform
// runtime, no proprietary session, no third-party identity dependency.
import { getPool } from "../../shared/db.js";
import {
  parseApiKeyHeader,
  hashApiKey,
  safeEqualHex,
  UnauthorizedError,
  ForbiddenError,
} from "./http.js";

export const ALL_SCOPES = [
  "jobs:read",
  "jobs:write",
  "sessions:read",
  "sessions:write",
  "artifacts:read",
  "admin",
];

/** 'admin' implies every other scope. */
export function scopesInclude(scopes, required) {
  const granted = Array.isArray(scopes) ? scopes : [];
  if (granted.includes("admin")) return true;
  return required.every((scope) => granted.includes(scope));
}

export function requireScopes(auth, required) {
  if (!scopesInclude(auth?.scopes, required)) {
    throw new ForbiddenError(`Missing required scope: ${required.join(", ")}`);
  }
}

/**
 * Resolves the caller from the `x-api-key` header.
 * @returns {Promise<{ keyId: string, tenantId: string, scopes: string[], environment: string }>}
 */
export async function authenticate(req) {
  const header = req.get("x-api-key") || req.get("authorization") || "";
  const parsed = parseApiKeyHeader(header);
  if (!parsed) throw new UnauthorizedError("Missing or malformed API key");

  const pepper = process.env.API_KEY_PEPPER;
  if (!pepper) throw new UnauthorizedError("API_KEY_PEPPER is not configured");

  const { rows } = await getPool().query(
    `SELECT id, tenant_id, key_hash, scopes, expires_at, revoked_at
       FROM api_keys
      WHERE prefix = $1 AND environment = $2
      LIMIT 1`,
    [parsed.prefix, parsed.environment],
  );

  const key = rows[0];
  if (!key) throw new UnauthorizedError("Invalid API key");
  if (key.revoked_at) throw new UnauthorizedError("API key revoked");
  if (key.expires_at && new Date(key.expires_at).getTime() <= Date.now()) {
    throw new UnauthorizedError("API key expired");
  }
  if (!safeEqualHex(key.key_hash, hashApiKey(parsed.secret, pepper))) {
    throw new UnauthorizedError("Invalid API key");
  }

  const tenantId = String(key.tenant_id);

  // A caller may state which tenant it believes it is, but it may never
  // act outside the tenant its key belongs to.
  const claimedTenant = req.get("x-tenant-id");
  if (claimedTenant && claimedTenant !== tenantId) {
    throw new ForbiddenError("API key does not belong to the requested tenant");
  }

  return {
    keyId: String(key.id),
    tenantId,
    scopes: Array.isArray(key.scopes) ? key.scopes : [],
    environment: parsed.environment,
  };
}