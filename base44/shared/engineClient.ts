import { secrets } from "base44:runtime";

// ═══════════════════════════════════════════════
// Engine client — SECURITY HARDENED v4
// URL: overridden via Setting entity (not secret)
// API KEY: ALWAYS from encrypted secrets vault, NEVER from DB
// ═══════════════════════════════════════════════

let _base44 = null;
let _cachedConfig = null;

/** Set the base44 client for URL override lookups. Call at top of each function. */
export function setEngineClient(base44) {
  _base44 = base44;
  _cachedConfig = null;
}

async function loadUrlOverride() {
  if (!_base44) return null;
  try {
    const rows = await _base44.asServiceRole.entities.Setting.filter({ setting_key: "engine.url" });
    return rows[0]?.effective_value || null;
  } catch (e) { return null; }
}

export async function getEngineConfig() {
  if (_cachedConfig) return _cachedConfig;

  // 1. URL: try Setting override first, then secret
  const urlOverride = await loadUrlOverride();
  const url = urlOverride || secrets.get("ENGINE_URL");

  // 2. API KEY: ALWAYS from encrypted secrets vault — NEVER from DB
  const key = secrets.get("ENGINE_API_KEY");

  if (!url || !key) {
    throw new Error("Browser engine not configured. Set ENGINE_URL and ENGINE_API_KEY in Settings → Secrets.");
  }
  _cachedConfig = { baseUrl: url.replace(/\/$/, ""), key };
  return _cachedConfig;
}

export async function isEngineConfigured() {
  try {
    await getEngineConfig();
    return true;
  } catch {
    return false;
  }
}

/** Safe non-reversible fingerprint of the secret-vault key (first 16 hex chars of SHA-256). */
export async function getEngineKeyFingerprint() {
  const key = secrets.get("ENGINE_API_KEY");
  if (!key) return null;
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  const hash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return "sha256:" + hash.slice(0, 16);
}

// Generic authenticated fetch — key always from secrets, never from DB
export async function engineFetch(path, options = {}) {
  const { baseUrl, key } = await getEngineConfig();
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  if (!res.ok) {
    const errMsg = typeof body === "object" && body?.error ? body.error : `Engine error ${res.status}`;
    throw new Error(errMsg);
  }
  return body;
}

export async function enginePost(path, payload) {
  return engineFetch(path, { method: "POST", body: JSON.stringify(payload || {}) });
}

export async function engineDelete(path) {
  return engineFetch(path, { method: "DELETE" });
}

export async function engineGet(path) {
  return engineFetch(path, { method: "GET" });
}