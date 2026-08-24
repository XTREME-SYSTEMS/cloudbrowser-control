import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { secrets } from "base44:runtime";

// ═══════════════════════════════════════════════
// testCaptchaSolver — Runs a live captcha solve test against the engine
// and logs the result to CaptchaSolveLog. Admin-only.
// ═══════════════════════════════════════════════

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden — admin only" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const provider = body.provider || "self";
    const testUrl = body.url || "https://2captcha.com/demo/recaptcha-v2";

    const ENGINE_URL = secrets.get("ENGINE_URL");
    const ENGINE_API_KEY = secrets.get("ENGINE_API_KEY");
    if (!ENGINE_URL || !ENGINE_API_KEY) {
      return Response.json({ error: "ENGINE_URL or ENGINE_API_KEY secret not configured" }, { status: 500 });
    }

    const startedAt = Date.now();

    // 1. Health check
    const healthRes = await fetch(`${ENGINE_URL}/health`, {
      headers: { "x-api-key": ENGINE_API_KEY },
    });
    const health = await healthRes.json();

    // 2. Create session with captcha solver
    const sessionRes = await fetch(`${ENGINE_URL}/sessions`, {
      method: "POST",
      headers: { "x-api-key": ENGINE_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        captchaSolver: { provider },
        usePool: false,
      }),
    });
    const session = await sessionRes.json();

    if (!session.sessionId) {
      return Response.json({ error: "Failed to create session", session, health }, { status: 500 });
    }

    // 3. Navigate — auto-solve triggers on goto
    const navRes = await fetch(`${ENGINE_URL}/sessions/${session.sessionId}/execute`, {
      method: "POST",
      headers: { "x-api-key": ENGINE_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        action_type: "goto",
        value: testUrl,
        options: { timeout: 90000 },
      }),
    });
    const navResult = await navRes.json();

    const duration_ms = Date.now() - startedAt;
    const captcha = navResult.captcha || {};

    // 4. Log to CaptchaSolveLog
    const logEntry = await base44.asServiceRole.entities.CaptchaSolveLog.create({
      session_id: session.sessionId,
      url: testUrl,
      captcha_type: captcha.type || "unknown",
      provider,
      detected: captcha.detected || false,
      solved: captcha.solved || false,
      token: captcha.token || "",
      error: captcha.error || "",
      duration_ms,
      engine_version: health.engine_version || "unknown",
      triggered_by: "test",
    });

    // 5. Cleanup session
    await fetch(`${ENGINE_URL}/sessions/${session.sessionId}`, {
      method: "DELETE",
      headers: { "x-api-key": ENGINE_API_KEY },
    }).catch(() => {});

    return Response.json({
      ok: true,
      log_id: logEntry.id,
      engine_version: health.engine_version,
      engine_status: health.status,
      session_id: session.sessionId,
      url: navResult.url,
      title: navResult.title,
      captcha,
      duration_ms,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}