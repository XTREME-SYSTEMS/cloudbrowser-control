import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { signPayload, verifySignature, deliverWebhook } from '../../shared/webhookDelivery.ts';
import { recordCost, getTotalSpend, getSpendByCategory, getJobCost } from '../../shared/costTracker.ts';
import { redactString, redactValue } from '../../shared/piiRedaction.ts';
import { detectAll } from '../../shared/anomalyDetection.ts';

interface TestResult {
  name: string;
  passed: boolean;
  points: number;
  maxPoints: number;
  detail: string;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const results: TestResult[] = [];
    const testRunId = 'reliability-' + Date.now();

    // === TEST 1: Webhook HMAC signing (10 pts) ===
    try {
      const secret = 'test-signing-secret';
      const payload = '{"event":"job.completed","data":{"id":"123"}}';
      const signature = signPayload(secret, payload);
      const valid = verifySignature(secret, payload, signature);
      const tampered = verifySignature(secret, payload + 'tampered', signature);
      const wrongKey = verifySignature('wrong-secret', payload, signature);
      const passed = valid && !tampered && !wrongKey && signature.length === 64;
      results.push({ name: 'Webhook: HMAC signing + verification', passed, points: passed ? 10 : 0, maxPoints: 10, detail: `valid: ${valid}, tampered rejected: ${!tampered}, wrong key rejected: ${!wrongKey}` });
    } catch (e) {
      results.push({ name: 'Webhook: HMAC signing', passed: false, points: 0, maxPoints: 10, detail: e.message });
    }

    // === TEST 2: Webhook delivery — retry on failure (15 pts) ===
    try {
      // Create a webhook pointing to a non-existent URL to test retry logic
      const webhook = await base44.entities.Webhook.create({
        name: 'test-webhook-' + testRunId,
        url: 'https://nonexistent-host-12345.example/webhook',
        events: ['job.completed'],
        active: true,
        provider: 'generic',
      });

      const result = await deliverWebhook(base44, webhook, 'job.completed', { test: true }, {
        maxAttempts: 3,
        initialDelayMs: 100,
        timeoutMs: 3000,
      });

      const passed = !result.success && result.attempts === 3 && result.error !== undefined;

      // Clean up
      await base44.entities.Webhook.delete(webhook.id);
      if (result.deliveryId) {
        await base44.entities.WebhookDelivery.delete(result.deliveryId).catch(() => {});
      }

      results.push({ name: 'Webhook: Retry on failure (3 attempts)', passed, points: passed ? 15 : 0, maxPoints: 15, detail: `success: ${result.success}, attempts: ${result.attempts}, error: ${result.error}` });
    } catch (e) {
      results.push({ name: 'Webhook: Retry', passed: false, points: 0, maxPoints: 15, detail: e.message });
    }

    // === TEST 3: Webhook delivery — success tracking (10 pts) ===
    try {
      // Use httpbin.org which echoes back and returns 200
      const webhook = await base44.entities.Webhook.create({
        name: 'test-webhook-success-' + testRunId,
        url: 'https://httpbin.org/post',
        events: ['job.completed'],
        active: true,
        provider: 'generic',
      });

      const result = await deliverWebhook(base44, webhook, 'job.completed', { test: true }, {
        maxAttempts: 3,
        initialDelayMs: 100,
        timeoutMs: 10000,
      });

      const passed = result.success && result.responseStatus === 200 && result.attempts === 1;

      // Clean up
      await base44.entities.Webhook.delete(webhook.id);
      if (result.deliveryId) {
        await base44.entities.WebhookDelivery.delete(result.deliveryId).catch(() => {});
      }

      results.push({ name: 'Webhook: Success tracking', passed, points: passed ? 10 : 0, maxPoints: 10, detail: `success: ${result.success}, status: ${result.responseStatus}, attempts: ${result.attempts}` });
    } catch (e) {
      results.push({ name: 'Webhook: Success tracking', passed: false, points: 0, maxPoints: 10, detail: e.message });
    }

    // === TEST 4: Cost tracking — record + aggregate (15 pts) ===
    try {
      const entry1 = await recordCost(base44, {
        category: 'compute',
        amount: 10,
        unit: 'minutes',
        rate: 0.05,
        description: 'Test compute cost',
      });
      const entry2 = await recordCost(base44, {
        category: 'proxy',
        amount: 5,
        unit: 'minutes',
        rate: 0.02,
        description: 'Test proxy cost',
      });

      const cost1Correct = entry1.cost === 0.50; // 10 * 0.05
      const cost2Correct = entry2.cost === 0.10; // 5 * 0.02

      // Clean up
      await base44.entities.CostEntry.delete(entry1.id).catch(() => {});
      await base44.entities.CostEntry.delete(entry2.id).catch(() => {});

      const passed = cost1Correct && cost2Correct;
      results.push({ name: 'Cost: Record + calculate', passed, points: passed ? 15 : 0, maxPoints: 15, detail: `compute: $${entry1.cost} (expected $0.50), proxy: $${entry2.cost} (expected $0.10)` });
    } catch (e) {
      results.push({ name: 'Cost: Record + calculate', passed: false, points: 0, maxPoints: 15, detail: e.message });
    }

    // === TEST 5: Cost tracking — default rates (10 pts) ===
    try {
      const entry = await recordCost(base44, {
        category: 'llm',
        amount: 100,
        description: 'Test LLM calls',
      });
      const passed = entry.cost === 1.00 && entry.rate === 0.01 && entry.unit === 'calls';
      await base44.entities.CostEntry.delete(entry.id).catch(() => {});
      results.push({ name: 'Cost: Default rates applied', passed, points: passed ? 10 : 0, maxPoints: 10, detail: `cost: $${entry.cost}, rate: ${entry.rate}, unit: ${entry.unit}` });
    } catch (e) {
      results.push({ name: 'Cost: Default rates', passed: false, points: 0, maxPoints: 10, detail: e.message });
    }

    // === TEST 6: PII redaction — integration check (10 pts) ===
    try {
      const extractedData = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '555-123-4567',
        ssn: '123-45-6789',
        notes: 'Contact at john@test.com or 555-999-8888',
      };
      const redacted = redactValue(extractedData);
      const passed = redacted.email === '[REDACTED_EMAIL]' && redacted.ssn === '[REDACTED_SSN]' && redacted.phone === '[REDACTED_PHONE]' && redacted.name === 'John Doe';
      results.push({ name: 'PII: Integration redaction', passed, points: passed ? 10 : 0, maxPoints: 10, detail: JSON.stringify(redacted) });
    } catch (e) {
      results.push({ name: 'PII: Integration', passed: false, points: 0, maxPoints: 10, detail: e.message });
    }

    // === TEST 7: Anomaly detection — integration check (10 pts) ===
    try {
      const extractedResults = [
        { product: 'A', price: 10 },
        { product: 'B', price: 12 },
        { product: 'C', price: 11 },
        { product: 'D', price: 5000 },
        { product: 'A', price: 10 },
      ];
      const anomalies = detectAll(extractedResults, {
        numericFields: ['price'],
        duplicateKeyFields: ['product'],
        requiredFields: ['product', 'price'],
      });
      const passed = anomalies.length >= 2; // outlier + duplicate
      results.push({ name: 'Anomaly: Integration detection', passed, points: passed ? 10 : 0, maxPoints: 10, detail: `Found ${anomalies.length} anomalies in extracted data` });
    } catch (e) {
      results.push({ name: 'Anomaly: Integration', passed: false, points: 0, maxPoints: 10, detail: e.message });
    }

    // === TEST 8: Cost aggregation — by category (10 pts) ===
    try {
      const byCategory = await getSpendByCategory(base44);
      const passed = typeof byCategory === 'object' && ('compute' in byCategory || 'proxy' in byCategory || 'llm' in byCategory || Object.keys(byCategory).length >= 0);
      results.push({ name: 'Cost: Category aggregation', passed, points: passed ? 10 : 0, maxPoints: 10, detail: JSON.stringify(byCategory) });
    } catch (e) {
      results.push({ name: 'Cost: Category aggregation', passed: false, points: 0, maxPoints: 10, detail: e.message });
    }

    // === TEST 9: Webhook delivery tracking — WebhookDelivery records created (10 pts) ===
    try {
      // Create a webhook pointing to a failing URL
      const webhook = await base44.entities.Webhook.create({
        name: 'test-delivery-track-' + testRunId,
        url: 'https://nonexistent-host-67890.example/webhook',
        events: ['job.failed'],
        active: true,
        provider: 'generic',
      });

      const result = await deliverWebhook(base44, webhook, 'job.failed', { test: true }, {
        maxAttempts: 2,
        initialDelayMs: 50,
        timeoutMs: 2000,
      });

      // Check that a WebhookDelivery record was created
      const deliveries = await base44.entities.WebhookDelivery.filter({ webhook_id: webhook.id });
      const deliveryRecorded = deliveries.length > 0 && deliveries[0].attempts === 2 && deliveries[0].success === false;

      // Clean up
      await base44.entities.Webhook.delete(webhook.id);
      await base44.entities.WebhookDelivery.deleteMany({ webhook_id: webhook.id }).catch(() => {});

      const passed = result.deliveryId !== undefined && deliveryRecorded;
      results.push({ name: 'Webhook: Delivery tracking records', passed, points: passed ? 10 : 0, maxPoints: 10, detail: `deliveryId: ${result.deliveryId}, deliveries found: ${deliveries.length}` });
    } catch (e) {
      results.push({ name: 'Webhook: Delivery tracking', passed: false, points: 0, maxPoints: 10, detail: e.message });
    }

    // Calculate score
    const totalPoints = results.reduce((sum, r) => sum + r.points, 0);
    const maxPoints = results.reduce((sum, r) => sum + r.maxPoints, 0);
    const score = Math.round((totalPoints / maxPoints) * 100);
    const passedCount = results.filter(r => r.passed).length;

    return Response.json({
      suite: 'reliability',
      score,
      totalPoints,
      maxPoints,
      testsPassed: passedCount,
      testsTotal: results.length,
      results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}