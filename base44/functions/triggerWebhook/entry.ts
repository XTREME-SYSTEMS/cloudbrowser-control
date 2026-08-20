import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { decrypt } from "../../shared/crypto.ts";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";
// v5.0.0 — deployment refresh

// ═══════════════════════════════════════════════
// Outbound webhook — HMAC signed, retry, DLQ, SSRF-safe
// v2: Uses encrypted secret from secret_encrypted field (not plaintext)
// ═══════════════════════════════════════════════

async function hmacSha256(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// V1.1 F-02: IP-level blocklist for resolved addresses
function isBlockedIp(ip) {
  if (!ip) return true;
  const v4 = ip.split(".").map(Number);
  if (v4.length === 4 && v4.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
    const [a, b] = v4;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 169 && b === 254) return true;
    if (a >= 224) return true;
    return false;
  }
  const h = ip.toLowerCase();
  if (h === "::1" || h === "::") return true;
  if (h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true;
  return false;
}

// SSRF guard — block private/loopback/metadata/CGNAT/IPv6-private + DNS resolution (V1.1 F-02)
async function isBlockedUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return true;
    const h = parsed.hostname.toLowerCase();
    if (h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "0.0.0.0") return true;
    if (h === "169.254.169.254" || h === "metadata.google.internal") return true;
    if (h.endsWith(".internal") || h.endsWith(".local")) return true;
    if (h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true;
    const parts = h.split(".").map(Number);
    if (parts.length === 4) {
      const [a, b] = parts;
      if (a === 10 || a === 127 || a === 0) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 192 && b === 168) return true;
      if (a === 100 && b >= 64 && b <= 127) return true;
      if (a >= 224) return true;
    }
    // V1.1 F-02: DNS resolution (Deno) — defeats rebinding; guarded for portability
    if (typeof Deno !== "undefined" && Deno.resolveDns) {
      try {
        const a4 = await Deno.resolveDns(h, "A");
        if (a4.some((ip) => isBlockedIp(ip))) return true;
      } catch (e) {}
      try {
        const a6 = await Deno.resolveDns(h, "AAAA");
        if (a6.some((ip) => isBlockedIp(ip))) return true;
      } catch (e) {}
    }
    return false;
  } catch { return true; }
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const TIMEOUT_MS = 10000;

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { event, payload } = body;

    const webhooks = await base44.asServiceRole.entities.Webhook.filter({ active: true });
    const matching = webhooks.filter((w) => w.events?.includes(event));

    let triggered = 0;
    let failed = 0;
    let dlqCount = 0;

    for (const webhook of matching) {
      if (await isBlockedUrl(webhook.url)) {
        await base44.asServiceRole.entities.WebhookDelivery.create({
          webhook_id: webhook.id, event,
          payload: { event, data: payload, error: "URL blocked by SSRF policy" },
          response_status: 0, response_body: "SSRF blocked", attempts: 1, success: false, duration_ms: 0,
        });
        failed++;
        continue;
      }

      const start = Date.now();
      const timestamp = Date.now().toString();
      const eventId = "evt_" + timestamp + "_" + Math.random().toString(36).slice(2, 8);
      const message = `${timestamp}.${eventId}.${JSON.stringify(payload || {})}`;

      // V1.1 F-17/F-18: encrypted secret only; fail-closed on decrypt failure
      let signingSecret = null;
      if (webhook.secret_encrypted) {
        signingSecret = await decrypt(webhook.secret_encrypted);
        if (!signingSecret) {
          await base44.asServiceRole.entities.WebhookDelivery.create({
            webhook_id: webhook.id, event,
            payload: { event, data: payload, error: "Decrypt failed — secret corrupted" },
            response_status: 0, response_body: "Decrypt failed", attempts: 1, success: false, duration_ms: 0,
          });
          failed++;
          continue;
        }
      }

      const signature = signingSecret ? await hmacSha256(signingSecret, message) : null;

      let requestBody;
      const headers = {
        "Content-Type": "application/json",
        "X-Webhook-Timestamp": timestamp,
        "X-Webhook-Event-Id": eventId,
      };
      if (signature) headers["X-Webhook-Signature"] = signature;

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

      let lastError = null;
      let lastStatus = 0;
      let lastBody = "";
      let success = false;

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
          const res = await fetch(webhook.url, { method: "POST", headers, body: requestBody, signal: controller.signal });
          clearTimeout(timeout);
          const responseText = await res.text();
          lastStatus = res.status;
          lastBody = responseText.slice(0, 1000);
          if (res.ok) { success = true; break; }
          lastError = `HTTP ${res.status}`;
        } catch (e) {
          lastError = e.message;
        }
        if (attempt < MAX_RETRIES - 1) {
          await new Promise((r) => setTimeout(r, BASE_DELAY_MS * Math.pow(2, attempt)));
        }
      }

      const duration = Date.now() - start;

      await base44.asServiceRole.entities.WebhookDelivery.create({
        webhook_id: webhook.id, event,
        payload: { event, data: payload, event_id: eventId },
        response_status: lastStatus,
        response_body: lastBody,
        attempts: MAX_RETRIES,
        success,
        duration_ms: duration,
      });

      await base44.asServiceRole.entities.Webhook.update(webhook.id, {
        last_triggered: new Date().toISOString(),
        last_status: lastStatus,
      });

      if (success) triggered++;
      else { failed++; dlqCount++; }
    }

    return Response.json({ triggered, failed, dlq: dlqCount, total: matching.length, __v: DEPLOYMENT_VERSION });
  } catch (error) {
    return Response.json({ error: error.message, __v: DEPLOYMENT_VERSION }, { status: 500 });
  }
}