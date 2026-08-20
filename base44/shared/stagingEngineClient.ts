import { secrets } from "base44:runtime";
import { requireIsolatedFortressTestEnvironment } from "./liveTestGuard.ts";

export const STAGING_ENGINE_CONFIGURATION_REQUIRED = "STAGING_ENGINE_CONFIGURATION_REQUIRED";

function blockedEngineHost(hostname) {
  const h = String(hostname || "").toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "::1" ||
    h === "169.254.169.254" || h.endsWith(".internal") || h.endsWith(".local") ||
    /^10\./.test(h) || /^172\.(1[6-9]|2[0-9]|3[01])\./.test(h) || /^192\.168\./.test(h);
}

async function stagingAccessState() {
  const isolation = await requireIsolatedFortressTestEnvironment();
  const stagingMode = secrets.get("FORTRESS_STAGING_VALIDATION_MODE") === "true";
  return { ok: isolation.ok === true && stagingMode, isolation, stagingMode };
}

export async function requireStagingEngineAccess() {
  const state = await stagingAccessState();
  if (!state.ok) throw new Error(STAGING_ENGINE_CONFIGURATION_REQUIRED);
  return state;
}

function normalizeStagingUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:" || blockedEngineHost(parsed.hostname)) {
      throw new Error(STAGING_ENGINE_CONFIGURATION_REQUIRED);
    }
    return parsed.toString().replace(/\/$/, "");
  } catch {
    throw new Error(STAGING_ENGINE_CONFIGURATION_REQUIRED);
  }
}

export async function getStagingEngineConfig() {
  await requireStagingEngineAccess();
  const stagingUrl = secrets.get("STAGING_ENGINE_URL");
  const stagingKey = secrets.get("STAGING_ENGINE_API_KEY");
  if (!stagingUrl || !stagingKey || stagingKey.length < 32) {
    throw new Error(STAGING_ENGINE_CONFIGURATION_REQUIRED);
  }
  return {
    baseUrl: normalizeStagingUrl(stagingUrl),
    key: stagingKey,
    environment: "isolated-staging",
  };
}

export async function isStagingEngineConfigured() {
  try {
    await getStagingEngineConfig();
    return true;
  } catch {
    return false;
  }
}

export async function getStagingEngineKeyFingerprint() {
  const state = await stagingAccessState();
  if (!state.ok) return null;
  const key = secrets.get("STAGING_ENGINE_API_KEY");
  if (!key) return null;
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  const hash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return "sha256:" + hash.slice(0, 16);
}

export async function stagingEngineFetch(path, options = {}) {
  const { baseUrl, key } = await getStagingEngineConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        ...(options.headers || {}),
        "Content-Type": "application/json",
        "x-fortress-env": "isolated-staging",
        "x-api-key": key,
      },
      signal: controller.signal,
    });
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text; }
    if (!res.ok) {
      const errMsg = typeof body === "object" && body?.error ? body.error : `Staging engine error ${res.status}`;
      throw new Error(errMsg);
    }
    return body;
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("Staging engine request timed out (30s)");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
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
