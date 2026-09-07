// Shared engine health probe — used by engineHealth and railwayAutoHeal.
// Probes a single engine URL directly (no failover), with a hard timeout.

const PROBE_TIMEOUT_MS = 8000;

export interface EngineProbeResult {
  ok: boolean;
  status: "healthy" | "degraded" | "unhealthy" | "unreachable";
  engine_url: string;
  engine_label?: string;
  response_time_ms: number;
  worker_id?: string;
  region?: string;
  engine_version?: string;
  active_sessions?: number;
  max_sessions?: number;
  pool_size?: number;
  pool_capacity?: number;
  uptime_seconds?: number;
  error_message?: string;
  raw?: any;
}

export async function probeEngine(baseUrl: string, key: string): Promise<EngineProbeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const started = Date.now();
  try {
    const res = await fetch(`${baseUrl}/health`, {
      headers: { "x-api-key": key, "Content-Type": "application/json" },
      signal: controller.signal,
    });
    const text = await res.text();
    let body: any;
    try { body = JSON.parse(text); } catch { body = { raw: text }; }
    const responseTime = Date.now() - started;

    if (!res.ok) {
      return {
        ok: false,
        status: res.status >= 500 ? "unhealthy" : "degraded",
        engine_url: baseUrl,
        response_time_ms: responseTime,
        error_message: `HTTP ${res.status}: ${typeof body === "object" && body?.error ? body.error : text.slice(0, 200)}`,
        raw: body,
      };
    }

    // Detect HTML responses (misconfigured engine serving Vite app shell)
    const bodyStr = typeof body === "string"
      ? body
      : (body?.raw && typeof body.raw === "string" ? body.raw : "");
    if (bodyStr && (bodyStr.trim().startsWith("<!doctype") || bodyStr.trim().startsWith("<html") || bodyStr.includes("<!doctype html"))) {
      return {
        ok: false,
        status: "unhealthy",
        engine_url: baseUrl,
        response_time_ms: responseTime,
        error_message: "Engine returned HTML instead of JSON — deployment is misconfigured (serving Vite app, not browser engine)",
        raw: { html_detected: true, snippet: bodyStr.slice(0, 200) },
      };
    }

    return {
      ok: true,
      status: body.ok ? "healthy" : "degraded",
      engine_url: baseUrl,
      response_time_ms: responseTime,
      worker_id: body.worker_id,
      region: body.region,
      engine_version: body.engine_version,
      active_sessions: body.active_sessions,
      max_sessions: body.max_sessions,
      pool_size: body.pool_size,
      pool_capacity: body.pool_capacity,
      uptime_seconds: Math.round(body.uptime),
      raw: body,
    };
  } catch (err: any) {
    return {
      ok: false,
      status: "unreachable",
      engine_url: baseUrl,
      response_time_ms: Date.now() - started,
      error_message: err.name === "AbortError" ? `Timeout after ${PROBE_TIMEOUT_MS}ms` : err.message,
    };
  } finally {
    clearTimeout(timer);
  }
}

export function deriveLabel(url: string, index: number): string {
  const match = url.match(/engine-(\d+)/i);
  if (match) return `engine-${match[1]}`;
  return `engine-${index + 1}`;
}