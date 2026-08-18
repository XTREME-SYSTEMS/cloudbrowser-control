import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

// ═══════════════════════════════════════════════
// Update engine connection — tests the provided URL + API key
// against the engine's /health endpoint, then persists them
// as Setting overrides (engine.url, engine.api_key).
// These override platform secrets at runtime.
// ═══════════════════════════════════════════════

export default async function (req) {
  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { engine_url, engine_api_key } = body;

    if (!engine_url || !engine_api_key) {
      return Response.json({ error: "engine_url and engine_api_key are required" }, { status: 400 });
    }

    const baseUrl = engine_url.replace(/\/$/, "");

    // ── Test the connection with the provided credentials ──
    let health;
    try {
      const res = await fetch(`${baseUrl}/health`, {
        headers: { "x-api-key": engine_api_key, "Content-Type": "application/json" },
      });
      const text = await res.text();
      let parsed;
      try { parsed = JSON.parse(text); } catch { parsed = text; }

      if (!res.ok) {
        const errMsg = typeof parsed === "object" && parsed?.error ? parsed.error : `HTTP ${res.status}`;
        return Response.json({
          ok: false,
          error: `Engine rejected credentials (${res.status}): ${errMsg}`,
          status_code: res.status,
        }, { status: 200 });
      }
      health = parsed;
    } catch (err) {
      return Response.json({ ok: false, error: `Connection failed: ${err.message}` }, { status: 200 });
    }

    // ── Connection verified — upsert Setting overrides ──
    const now = new Date().toISOString();

    // engine.url
    const existingUrl = await base44.asServiceRole.entities.Setting.filter({ setting_key: "engine.url" });
    if (existingUrl.length > 0) {
      await base44.asServiceRole.entities.Setting.update(existingUrl[0].id, {
        effective_value: baseUrl,
        desired_value: baseUrl,
        changed_by: user.id,
        changed_at: now,
        apply_status: "applied",
      });
    } else {
      await base44.asServiceRole.entities.Setting.create({
        setting_key: "engine.url",
        category: "system",
        scope_type: "platform",
        effective_value: baseUrl,
        desired_value: baseUrl,
        apply_status: "applied",
        operator_editable: true,
        changed_by: user.id,
        changed_at: now,
      });
    }

    // engine.api_key
    const existingKey = await base44.asServiceRole.entities.Setting.filter({ setting_key: "engine.api_key" });
    if (existingKey.length > 0) {
      await base44.asServiceRole.entities.Setting.update(existingKey[0].id, {
        effective_value: engine_api_key,
        desired_value: engine_api_key,
        changed_by: user.id,
        changed_at: now,
        apply_status: "applied",
        sensitive: true,
      });
    } else {
      await base44.asServiceRole.entities.Setting.create({
        setting_key: "engine.api_key",
        category: "security",
        scope_type: "platform",
        effective_value: engine_api_key,
        desired_value: engine_api_key,
        apply_status: "applied",
        sensitive: true,
        operator_editable: true,
        changed_by: user.id,
        changed_at: now,
      });
    }

    return Response.json({
      ok: true,
      message: "Engine configuration saved and connection verified",
      health,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}