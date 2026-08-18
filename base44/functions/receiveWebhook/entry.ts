import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

// ═══════════════════════════════════════════════
// Inbound webhook — HMAC-SHA256 required, fail-closed
// ═══════════════════════════════════════════════

async function hmacSha256(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

const REPLAY_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export default async function (req) {
  const base44 = createClientFromRequest(req);
  try {
    const body = await req.json();
    const { job_id, signature, timestamp, event_id, payload } = body;

    // ── Require signature — fail-closed ──
    if (!signature) {
      return Response.json({ error: "Webhook signature required" }, { status: 401 });
    }
    if (!timestamp) {
      return Response.json({ error: "Webhook timestamp required" }, { status: 401 });
    }

    // ── Replay protection ──
    const ts = parseInt(timestamp, 10);
    if (isNaN(ts) || Math.abs(Date.now() - ts) > REPLAY_WINDOW_MS) {
      return Response.json({ error: "Webhook timestamp outside replay window" }, { status: 401 });
    }

    // ── Idempotency ──
    if (event_id) {
      const seen = await base44.asServiceRole.entities.WebhookDelivery.filter({ event: `idempotency:${event_id}` });
      if (seen.length > 0) {
        return Response.json({ ok: true, idempotent: true, message: "Already processed" });
      }
    }

    // ── Verify HMAC against all active webhooks ──
    const webhooks = await base44.asServiceRole.entities.Webhook.filter({ active: true });
    let verifiedWebhook = null;
    const message = `${timestamp}.${event_id || ""}.${JSON.stringify(payload || {})}`;

    for (const w of webhooks) {
      if (!w.secret) continue;
      const expected = await hmacSha256(w.secret, message);
      if (timingSafeEqual(signature, expected)) {
        verifiedWebhook = w;
        break;
      }
    }

    if (!verifiedWebhook) {
      // Log the rejection
      await base44.asServiceRole.entities.WebhookDelivery.create({
        webhook_id: "rejected",
        event: "signature_rejected",
        payload: { timestamp, event_id },
        response_status: 401,
        response_body: "Invalid HMAC signature",
        attempts: 1,
        success: false,
        duration_ms: 0,
      });
      return Response.json({ error: "Invalid webhook signature" }, { status: 403 });
    }

    // ── Trigger the job with canonical contract ──
    if (!job_id) return Response.json({ error: "job_id required" }, { status: 400 });

    const job = await base44.asServiceRole.entities.Job.get(job_id);
    if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

    // Run the job — canonical jobId contract
    const result = await base44.asServiceRole.functions.invoke("runJob", { jobId: job_id });

    // Record idempotency marker
    if (event_id) {
      await base44.asServiceRole.entities.WebhookDelivery.create({
        webhook_id: verifiedWebhook.id,
        event: `idempotency:${event_id}`,
        payload: { event_id, job_id },
        response_status: 200,
        success: true,
        attempts: 1,
        duration_ms: 0,
      });
    }

    return Response.json({ success: true, job_id, verified_webhook: verifiedWebhook.name, result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}