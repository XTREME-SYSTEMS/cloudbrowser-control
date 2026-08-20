import { decrypt } from "./crypto.ts";
import { safeFetch } from "./ssrf.ts";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const TIMEOUT_MS = 10000;

async function hmacSha256(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function dispatchWebhooks(base44, { event, payload, projectId = null }) {
  const webhooks = await base44.asServiceRole.entities.Webhook.filter({ active: true });
  const matching = webhooks.filter((webhook) => {
    if (!webhook.events?.includes(event)) return false;
    if (!projectId) return true;
    return webhook.project_id === projectId;
  });

  let triggered = 0;
  let failed = 0;
  let dlqCount = 0;

  for (const webhook of matching) {
    const start = Date.now();
    const timestamp = Date.now().toString();
    const eventId = `evt_${crypto.randomUUID()}`;
    const message = `${timestamp}.${eventId}.${JSON.stringify(payload || {})}`;

    let signingSecret = null;
    if (webhook.secret_encrypted) signingSecret = await decrypt(webhook.secret_encrypted).catch(() => null);
    if (!signingSecret) {
      await base44.asServiceRole.entities.WebhookDelivery.create({
        webhook_id: webhook.id,
        event,
        payload: { event, data: payload, error: "Encrypted signing secret unavailable" },
        response_status: 0,
        response_body: "Decrypt failed",
        attempts: 1,
        success: false,
        duration_ms: Date.now() - start,
      }).catch(() => {});
      failed++;
      continue;
    }

    const signature = await hmacSha256(signingSecret, message);
    const headers = {
      "Content-Type": "application/json",
      "X-Webhook-Timestamp": timestamp,
      "X-Webhook-Event-Id": eventId,
      "X-Webhook-Signature": signature,
    };

    let requestBody;
    if (webhook.provider === "slack") {
      requestBody = JSON.stringify({
        text: `*${event}*`,
        blocks: [{ type: "section", text: { type: "mrkdwn", text: `*${event}*\n\`\`\`${JSON.stringify(payload, null, 2)}\`\`\`` } }],
      });
    } else if (webhook.provider === "discord") {
      requestBody = JSON.stringify({
        content: `**${event}**`,
        embeds: [{ title: event, description: JSON.stringify(payload).slice(0, 4000), color: 5814783 }],
      });
    } else {
      requestBody = JSON.stringify({ event, payload, timestamp, event_id: eventId, webhook: webhook.name });
    }

    let lastStatus = 0;
    let lastBody = "";
    let success = false;
    let attempts = 0;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      attempts = attempt + 1;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const response = await safeFetch(webhook.url, {
          method: "POST",
          headers,
          body: requestBody,
          signal: controller.signal,
        }, { allowed_ports: [80, 443], private_network_access: false, metadata_access: false });
        clearTimeout(timeout);
        const responseText = await response.text();
        lastStatus = response.status;
        lastBody = responseText.slice(0, 1000);
        if (response.ok) { success = true; break; }
      } catch (error) {
        clearTimeout(timeout);
        lastBody = error.message.slice(0, 1000);
        if (error.message.includes("SSRF blocked") || error.message.includes("redirect")) break;
      }
      if (attempt < MAX_RETRIES - 1) await new Promise((resolve) => setTimeout(resolve, BASE_DELAY_MS * Math.pow(2, attempt)));
    }

    await base44.asServiceRole.entities.WebhookDelivery.create({
      webhook_id: webhook.id,
      event,
      payload: { event, data: payload, event_id: eventId },
      response_status: lastStatus,
      response_body: lastBody,
      attempts,
      success,
      duration_ms: Date.now() - start,
    }).catch(() => {});

    await base44.asServiceRole.entities.Webhook.update(webhook.id, {
      last_triggered: new Date().toISOString(),
      last_status: lastStatus,
    }).catch(() => {});

    if (success) triggered++;
    else { failed++; dlqCount++; }
  }

  return { triggered, failed, dlq: dlqCount, total: matching.length };
}
