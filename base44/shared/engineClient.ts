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

  // V1.1 F-28: validate engine URL host — reject private/loopback/metadata
  if (url) {
    try {
      const parsed = new URL(url);
      const h = parsed.hostname.toLowerCase();
      const blocked = h === "localhost" || h === "127.0.0.1" || h === "::1" ||
        h === "169.254.169.254" || h.endsWith(".internal") || h.endsWith(".local") ||
        /^10\./.test(h) || /^172\.(1[6-9]|2[0-9]|3[01])\./.test(h) || /^192\.168\./.test(h);
      if (blocked) throw new Error(`Engine URL host blocked (SSRF guard): ${h}`);
    } catch (e) {
      throw new Error(`Invalid engine URL: ${e.message}`);
    }
  }

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
  // V1.1 F-12: 30s timeout via AbortController to prevent hung-engine cascades
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  let res;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timeout);
    if (e.name === "AbortError") throw new Error("Engine request timed out (30s)");
    throw e;
  }
  clearTimeout(timeout);
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