import { secrets } from "base44:runtime";

// ═══════════════════════════════════════════════
// Engine client — reads override from Setting entity,
// falls back to platform secrets (ENGINE_URL / ENGINE_API_KEY)
// ═══════════════════════════════════════════════

let _base44 = null;
let _cachedConfig = null;

/** Set the base44 client for DB-backed config lookups. Call at the top of each function. */
export function setEngineClient(base44) {
  _base44 = base44;
  _cachedConfig = null;
}

async function loadFromDB() {
  if (!_base44) return null;
  try {
    const urlRows = await _base44.asServiceRole.entities.Setting.filter({ setting_key: "engine.url" });
    const keyRows = await _base44.asServiceRole.entities.Setting.filter({ setting_key: "engine.api_key" });
    const url = urlRows[0]?.effective_value;
    const key = keyRows[0]?.effective_value;
    if (url && key) return { baseUrl: url.replace(/\/$/, ""), key };
  } catch (e) { /* fall through to secrets */ }
  return null;
}

export async function getEngineConfig() {
  if (_cachedConfig) return _cachedConfig;

  // 1. Try database override (set via Settings UI)
  const dbConfig = await loadFromDB();
  if (dbConfig) {
    _cachedConfig = dbConfig;
    return _cachedConfig;
  }

  // 2. Fall back to platform secrets
  const url = secrets.get("ENGINE_URL");
  const key = secrets.get("ENGINE_API_KEY");
  if (!url || !key) {
    throw new Error("Browser engine not configured. Set ENGINE_URL and ENGINE_API_KEY via Settings → Engine Connection, or in Settings → Secrets.");
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

// Generic authenticated fetch with proper method + body
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

// POST helper — always sends JSON body, never accidentally GETs
export async function enginePost(path, payload) {
  return engineFetch(path, {
    method: "POST",
    body: JSON.stringify(payload || {}),
  });
}

export async function engineDelete(path) {
  return engineFetch(path, { method: "DELETE" });
}

export async function engineGet(path) {
  return engineFetch(path, { method: "GET" });
}