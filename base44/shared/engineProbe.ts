// ═══════════════════════════════════════════════
// Shared engine health probe — the single source of truth for whether an engine
// can serve. Used by engineHealth, railwayAutoHeal, and every suite that asks the
// fleet to prove it is up.
//
// /health only proves the process is answering. It does NOT prove a browser can
// launch: a container that has exhausted its process table answers /health with
// 200 and a full-looking session pool while every browser it starts dies with
// EAGAIN. So readiness is part of the verdict — `ok` means the engine can take
// work, not merely that something replied.
// ═══════════════════════════════════════════════

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
  readiness?: { ready: boolean; browser_launch: string; error: string | null } | null;
  error_message?: string;
  raw?: any;
}

/** One authenticated GET against a single engine, with a hard timeout. */
async function getFromEngine(baseUrl: string, path: string, key: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: { "x-api-key": key, "Content-Type": "application/json" },
      signal: controller.signal,
    });
    const text = await res.text();
    let body: any;
    try { body = JSON.parse(text); } catch { body = { raw: text }; }
    return { res, body, text };
  } finally {
    clearTimeout(timer);
  }
}

/** Detect an engine that is really serving the Vite app shell, not the engine API. */
function htmlSnippet(body: any, text: string): string {
  const candidate = typeof body === "string" ? body : (typeof body?.raw === "string" ? body.raw : text);
  const trimmed = (candidate || "").trim();
  const isHtml = /^<!doctype/i.test(trimmed) || /^<html/i.test(trimmed) || trimmed.includes("<!doctype html");
  return isHtml ? trimmed.slice(0, 200) : "";
}

export async function probeEngine(baseUrl: string, key: string): Promise<EngineProbeResult> {
  const started = Date.now();

  let health: Awaited<ReturnType<typeof getFromEngine>>;
  try {
    health = await getFromEngine(baseUrl, "/health", key);
  } catch (err: any) {
    return {
      ok: false,
      status: "unreachable",
      engine_url: baseUrl,
      response_time_ms: Date.now() - started,
      error_message: err.name === "AbortError" ? `Timeout after ${PROBE_TIMEOUT_MS}ms` : err.message,
    };
  }

  const responseTime = Date.now() - started;
  const body: any = health.body;

  if (!health.res.ok) {
    return {
      ok: false,
      status: health.res.status >= 500 ? "unhealthy" : "degraded",
      engine_url: baseUrl,
      response_time_ms: responseTime,
      error_message: `HTTP ${health.res.status}: ${typeof body === "object" && body?.error ? body.error : health.text.slice(0, 200)}`,
      raw: body,
    };
  }

  const html = htmlSnippet(body, health.text);
  if (html) {
    return {
      ok: false,
      status: "unhealthy",
      engine_url: baseUrl,
      response_time_ms: responseTime,
      error_message: "Engine returned HTML instead of JSON — deployment is misconfigured (serving Vite app, not browser engine)",
      raw: { html_detected: true, snippet: html },
    };
  }

  // Readiness — the only thing that proves a browser can actually launch here.
  let readiness: EngineProbeResult["readiness"] = null;
  try {
    const ready = await getFromEngine(baseUrl, "/readiness", key);
    readiness = {
      ready: ready.res.ok && Boolean(ready.body?.ok),
      browser_launch: ready.body?.browser_launch || "unknown",
      error: ready.body?.error || null,
    };
  } catch (err: any) {
    readiness = {
      ready: false,
      browser_launch: "unknown",
      error: err.name === "AbortError" ? `Readiness timeout after ${PROBE_TIMEOUT_MS}ms` : err.message,
    };
  }

  const reachable = Boolean(body?.ok);
  const canServe = reachable && readiness.ready;

  return {
    ok: canServe,
    status: canServe ? "healthy" : "degraded",
    readiness,
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
    // Why a degraded engine is degraded — carried into the health record so the
    // next reader does not have to guess. Left empty on an engine that can serve.
    error_message: canServe
      ? undefined
      : readiness.error || "Readiness probe did not confirm a browser launch",
    raw: body,
  };
}

export function deriveLabel(url: string, index: number): string {
  const match = url.match(/engine-(\d+)/i);
  if (match) return `engine-${match[1]}`;
  return `engine-${index + 1}`;
}