import { secrets } from "base44:runtime";

// ═══════════════════════════════════════════════
// STAGING ENGINE CREDENTIAL BOUNDARY (Fortress v1.1)
// Isolated credential path for Fortress live validators ONLY.
//
// HARD ISOLATION:
//  - This module is a SEPARATE code path from the production engine
//    client (base44/shared/engineClient.ts). It NEVER imports or calls
//    getEngineConfig / engineFetch / ENGINE_URL / ENGINE_API_KEY.
//  - No existing gateway, job, MCP, or UI code imports this module,
//    so normal/customer traffic can NEVER select staging credentials.
//  - Fail-closed: if the operator-only gate is off OR staging secrets
//    are missing, staging access throws STAGING_ENGINE_CONFIGURATION_REQUIRED.
//    It NEVER falls back to production credentials.
//
// Gate: requireIsolatedFortressTestEnvironment() returns true ONLY when
// ALL THREE operator-only guards are set to exact values:
//   FORTRESS_STAGING_VALIDATION_MODE === "true"
//   FORTRESS_TEST_ENVIRONMENT       === "isolated-staging"
//   FORTRESS_TEST_DATA_ISOLATED     === "true"
// Secrets are settable only by operators via the secure secret channel —
// never by gateway, jobs, UI, or customer traffic. Any missing/wrong
// value => false => staging access fails closed.
// ═══════════════════════════════════════════════

export const STAGING_ENGINE_CONFIGURATION_REQUIRED = "STAGING_ENGINE_CONFIGURATION_REQUIRED";

/** Operator-only fail-closed gate. true ONLY when ALL THREE guards are set:
 *  FORTRESS_STAGING_VALIDATION_MODE === "true"
 *  FORTRESS_TEST_ENVIRONMENT       === "isolated-staging"
 *  FORTRESS_TEST_DATA_ISOLATED     === "true"
 *  Any missing/wrong value => false => staging access fails closed. */
export function requireIsolatedFortressTestEnvironment() {
  return (
    secrets.get("FORTRESS_STAGING_VALIDATION_MODE") === "true" &&
    secrets.get("FORTRESS_TEST_ENVIRONMENT") === "isolated-staging" &&
    secrets.get("FORTRESS_TEST_DATA_ISOLATED") === "true"
  );
}

/**
 * Staging engine config — Fortress live validators ONLY.
 * NEVER reads production ENGINE_URL / ENGINE_API_KEY. NEVER falls back.
 * Missing gate or missing staging secrets => STAGING_ENGINE_CONFIGURATION_REQUIRED.
 */
export async function getStagingEngineConfig() {
  if (!requireIsolatedFortressTestEnvironment()) {
    throw new Error(STAGING_ENGINE_CONFIGURATION_REQUIRED);
  }
  const stagingUrl = secrets.get("STAGING_ENGINE_URL");
  const stagingKey = secrets.get("STAGING_ENGINE_API_KEY");
  if (!stagingUrl || !stagingKey) {
    throw new Error(STAGING_ENGINE_CONFIGURATION_REQUIRED);
  }
  return { baseUrl: stagingUrl.replace(/\/$/, ""), key: stagingKey, environment: "staging" };
}

export async function isStagingEngineConfigured() {
  try { await getStagingEngineConfig(); return true; } catch { return false; }
}

/** Safe non-reversible fingerprint of the staging key (never the value). */
export async function getStagingEngineKeyFingerprint() {
  const key = secrets.get("STAGING_ENGINE_API_KEY");
  if (!key) return null;
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  const hash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return "sha256:" + hash.slice(0, 16);
}

export async function stagingEngineFetch(path, options = {}) {
  const { baseUrl, key } = await getStagingEngineConfig();
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "x-fortress-env": "staging",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  if (!res.ok) {
    const errMsg = typeof body === "object" && body?.error ? body.error : `Staging engine error ${res.status}`;
    throw new Error(errMsg);
  }
  return body;
}

export async function stagingEnginePost(path, payload) {
  return stagingEngineFetch(path, { method: "POST", body: JSON.stringify(payload || {}) });
}
export async function stagingEngineDelete(path) {
  return stagingEngineFetch(path, { method: "DELETE" });
}
export async function stagingEngineGet(path) {
  return stagingEngineFetch(path, { method: "GET" });
}