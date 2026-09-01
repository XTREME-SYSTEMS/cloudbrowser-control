// Webhook Delivery — delivers webhook payloads with HMAC-SHA256 signing,
// exponential backoff retry, and delivery tracking via the WebhookDelivery entity.

import { createHmac } from 'node:crypto';

export function signPayload(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function verifySignature(secret: string, payload: string, signature: string): boolean {
  const expected = signPayload(secret, payload);
  if (expected.length !== signature.length) return false;
  // Constant-time comparison
  let result = 0;
  for (let i = 0; i < expected.length; i++) {
    result |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return result === 0;
}

export interface DeliveryResult {
  success: boolean;
  attempts: number;
  responseStatus?: number;
  error?: string;
  deliveryId?: string;
  durationMs: number;
}

export async function deliverWebhook(
  base44: any,
  webhook: any,
  event: string,
  payload: any,
  options?: { maxAttempts?: number; initialDelayMs?: number; timeoutMs?: number }
): Promise<DeliveryResult> {
  const maxAttempts = options?.maxAttempts ?? 3;
  const initialDelayMs = options?.initialDelayMs ?? 500;
  const timeoutMs = options?.timeoutMs ?? 10000;

  const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });
  const startTime = Date.now();

  // Sign the payload (in production, decrypt the secret first)
  const secret = webhook.secret_encrypted || '';
  const signature = secret ? signPayload(secret, body) : '';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'CloudBrowser-Webhook/1.0',
  };
  if (signature) {
    headers['X-CloudBrowser-Signature'] = signature;
    headers['X-CloudBrowser-Event'] = event;
  }

  let attempts = 0;
  let responseStatus: number | undefined;
  let lastError: string | undefined;
  let responseBody = '';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    attempts = attempt;
    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });

      responseStatus = response.status;
      responseBody = await response.text().catch(() => '');

      if (response.status >= 200 && response.status < 300) {
        const durationMs = Date.now() - startTime;

        // Update webhook stats
        base44.entities.Webhook.update(webhook.id, {
          last_triggered: new Date().toISOString(),
          last_status: response.status,
        }).catch(() => {});

        // Record successful delivery
        const delivery = await base44.entities.WebhookDelivery.create({
          webhook_id: webhook.id,
          event,
          payload: { event, data: payload },
          response_status: response.status,
          response_body: responseBody.substring(0, 1000),
          attempts,
          success: true,
          duration_ms: durationMs,
        });

        return { success: true, attempts, responseStatus, deliveryId: delivery.id, durationMs };
      }

      lastError = `HTTP ${response.status}`;
    } catch (e) {
      lastError = e.message;
    }

    // Exponential backoff before next attempt
    if (attempt < maxAttempts) {
      const delay = initialDelayMs * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  const durationMs = Date.now() - startTime;

  // Update webhook stats
  base44.entities.Webhook.update(webhook.id, {
    last_triggered: new Date().toISOString(),
    last_status: responseStatus || 0,
  }).catch(() => {});

  // Record failed delivery
  const delivery = await base44.entities.WebhookDelivery.create({
    webhook_id: webhook.id,
    event,
    payload: { event, data: payload },
    response_status: responseStatus || 0,
    response_body: lastError || '',
    attempts,
    success: false,
    duration_ms: durationMs,
  });

  return { success: false, attempts, responseStatus, error: lastError, deliveryId: delivery.id, durationMs };
}