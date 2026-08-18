import { secrets } from "base44:runtime";

export async function getEngineConfig() {
  const url = secrets.get("ENGINE_URL");
  const key = secrets.get("ENGINE_API_KEY");
  if (!url || !key) {
    throw new Error("Browser engine not configured. Set ENGINE_URL and ENGINE_API_KEY in Settings → Secrets.");
  }
  return { baseUrl: url.replace(/\/$/, ""), key };
}

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

export function isEngineConfigured() {
  const url = secrets.get("ENGINE_URL");
  const key = secrets.get("ENGINE_API_KEY");
  return !!(url && key);
}