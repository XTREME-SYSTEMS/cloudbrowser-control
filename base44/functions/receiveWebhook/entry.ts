import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { decrypt } from "../../shared/crypto.ts";
import { executeJob, JobRunnerError } from "../../shared/jobRunner.ts";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";

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

const REPLAY_WINDOW_MS = 5 * 60 * 1000;

export default async function (req) {
  const base44 = createClientFromRequest(req);
  try {
    const body = await req.json();
    const { job_id, signature, timestamp, event_id, payload } = body;

    if (!signature) return Response.json({ error: "Webhook signature required", __v: DEPLOYMENT_VERSION }, { status: 401 });
    if (!timestamp) return Response.json({ error: "Webhook timestamp required", __v: DEPLOYMENT_VERSION }, { status: 401 });

    const ts = parseInt(timestamp, 10);
    if (isNaN(ts) || Math.abs(Date.now() - ts) > REPLAY_WINDOW_MS) {
      return Response.json({ error: "Webhook timestamp outside replay window", __v: DEPLOYMENT_VERSION }, { status: 401 });
    }

    if (event_id) {
      const seen = await base44.asServiceRole.entities.WebhookDelivery.filter({ event: `idempotency:${event_id}` });
      if (seen.length > 0) return Response.json({ ok: true, idempotent: true, message: "Already processed", __v: DEPLOYMENT_VERSION });
    }

    const webhooks = await base44.asServiceRole.entities.Webhook.filter({ active: true });
    let verifiedWebhook = null;
    const message = `${timestamp}.${event_id || ""}.${JSON.stringify(payload || {})}`;

    for (const webhook of webhooks) {
      if (!webhook.secret_encrypted) continue;
      const signingSecret = await decrypt(webhook.secret_encrypted).catch(() => null);
      if (!signingSecret) continue;
      const expected = await hmacSha256(signingSecret, message);
      if (timingSafeEqual(signature, expected)) {
        verifiedWebhook = webhook;
        break;
      }
    }

    if (!verifiedWebhook) {
      await base44.asServiceRole.entities.WebhookDelivery.create({
        webhook_id: "rejected",
        event: "signature_rejected",
        payload: { timestamp, event_id },
        response_status: 403,
        response_body: "Invalid HMAC signature",
        attempts: 1,
        success: false,
        duration_ms: 0,
      });
      return Response.json({ error: "Invalid webhook signature", __v: DEPLOYMENT_VERSION }, { status: 403 });
    }

    if (!job_id) return Response.json({ error: "job_id required", __v: DEPLOYMENT_VERSION }, { status: 400 });
    if (!verifiedWebhook.project_id) {
      return Response.json({ error: "Webhook must be project-scoped", __v: DEPLOYMENT_VERSION }, { status: 403 });
    }

    const job = await base44.asServiceRole.entities.Job.get(job_id);
    if (!job) return Response.json({ error: "Job not found", __v: DEPLOYMENT_VERSION }, { status: 404 });
    if (!job.project_id || verifiedWebhook.project_id !== job.project_id) {
      await base44.asServiceRole.entities.WebhookDelivery.create({
        webhook_id: verifiedWebhook.id,
        event: "project_mismatch",
        payload: { job_id },
        response_status: 403,
        response_body: "Job/project mismatch",
        attempts: 1,
        success: false,
        duration_ms: 0,
      }).catch(() => {});
      return Response.json({ error: "Job does not belong to webhook project", __v: DEPLOYMENT_VERSION }, { status: 403 });
    }

    const result = await executeJob(base44, {
      jobId: job_id,
      authorizedProjectId: verifiedWebhook.project_id,
      actor: { id: `webhook:${verifiedWebhook.id}`, full_name: verifiedWebhook.name || "Webhook", role: "webhook" },
      idempotencyKey: event_id ? `webhook:${verifiedWebhook.id}:${event_id}` : `webhook:${verifiedWebhook.id}:job:${job_id}`,
    });

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

    return Response.json({ success: true, job_id, verified_webhook: verifiedWebhook.name, result, __v: DEPLOYMENT_VERSION });
  } catch (error) {
    const status = error instanceof JobRunnerError ? error.status : 500;
    return Response.json({ error: error.message, __v: DEPLOYMENT_VERSION }, { status });
  }
}
