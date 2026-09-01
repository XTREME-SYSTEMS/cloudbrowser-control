import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { validateUrl, isPrivateIP, isMetadataEndpoint, extractDomain } from '../../shared/ssrfProtection.ts';
import { sanitizeUrl, isDangerousProtocol } from '../../shared/urlValidator.ts';
import { generateApiKey, hashApiKey, validateApiKey, hasScope } from '../../shared/apiKeyAuth.ts';
import { checkRateLimit, resetRateLimit } from '../../shared/rateLimiter.ts';

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

    // === TEST 1: SSRF — private IP blocked (10 pts) ===
    try {
      const r1 = validateUrl('http://10.0.0.1/admin');
      const r2 = validateUrl('http://192.168.1.1/admin');
      const r3 = validateUrl('http://172.16.0.1/admin');
      const r4 = validateUrl('http://127.0.0.1:8080/admin');
      const passed = !r1.valid && !r2.valid && !r3.valid && !r4.valid;
      results.push({ name: 'SSRF: Private IPs blocked', passed, points: passed ? 10 : 0, maxPoints: 10, detail: `10.x:${!r1.valid}, 192.168:${!r2.valid}, 172.16:${!r3.valid}, 127.x:${!r4.valid}` });
    } catch (e) {
      results.push({ name: 'SSRF: Private IPs', passed: false, points: 0, maxPoints: 10, detail: e.message });
    }

    // === TEST 2: SSRF — metadata endpoints blocked (10 pts) ===
    try {
      const r1 = validateUrl('http://169.254.169.254/latest/meta-data/');
      const r2 = validateUrl('http://metadata.google.internal/computeMetadata/');
      const passed = !r1.valid && !r2.valid;
      results.push({ name: 'SSRF: Metadata endpoints blocked', passed, points: passed ? 10 : 0, maxPoints: 10, detail: `AWS:${!r1.valid}, GCP:${!r2.valid}` });
    } catch (e) {
      results.push({ name: 'SSRF: Metadata endpoints', passed: false, points: 0, maxPoints: 10, detail: e.message });
    }

    // === TEST 3: SSRF — valid public URLs pass (5 pts) ===
    try {
      const r = validateUrl('https://example.com/path?q=1');
      const passed = r.valid && r.hostname === 'example.com';
      results.push({ name: 'SSRF: Valid public URLs pass', passed, points: passed ? 5 : 0, maxPoints: 5, detail: `valid: ${r.valid}, hostname: ${r.hostname}` });
    } catch (e) {
      results.push({ name: 'SSRF: Valid URLs', passed: false, points: 0, maxPoints: 5, detail: e.message });
    }

    // === TEST 4: SSRF — allowlist enforcement (5 pts) ===
    try {
      const r1 = validateUrl('https://allowed.com/path', { allowlist: ['allowed.com'] });
      const r2 = validateUrl('https://blocked.com/path', { allowlist: ['allowed.com'] });
      const passed = r1.valid && !r2.valid;
      results.push({ name: 'SSRF: Allowlist enforcement', passed, points: passed ? 5 : 0, maxPoints: 5, detail: `allowed: ${r1.valid}, blocked: ${!r2.valid}` });
    } catch (e) {
      results.push({ name: 'SSRF: Allowlist', passed: false, points: 0, maxPoints: 5, detail: e.message });
    }

    // === TEST 5: SSRF — HTTPS enforcement (5 pts) ===
    try {
      const r = validateUrl('http://example.com', { enforceHttps: true });
      const passed = !r.valid && r.reason?.includes('HTTPS');
      results.push({ name: 'SSRF: HTTPS enforcement', passed, points: passed ? 5 : 0, maxPoints: 5, detail: r.reason });
    } catch (e) {
      results.push({ name: 'SSRF: HTTPS enforcement', passed: false, points: 0, maxPoints: 5, detail: e.message });
    }

    // === TEST 6: URL Validator — dangerous protocols blocked (10 pts) ===
    try {
      const r1 = sanitizeUrl('javascript:alert(1)');
      const r2 = sanitizeUrl('data:text/html,<script>alert(1)</script>');
      const r3 = sanitizeUrl('file:///etc/passwd');
      const passed = !r1.valid && !r2.valid && !r3.valid;
      results.push({ name: 'URL: Dangerous protocols blocked', passed, points: passed ? 10 : 0, maxPoints: 10, detail: `javascript:${!r1.valid}, data:${!r2.valid}, file:${!r3.valid}` });
    } catch (e) {
      results.push({ name: 'URL: Dangerous protocols', passed: false, points: 0, maxPoints: 10, detail: e.message });
    }

    // === TEST 7: URL Validator — embedded credentials blocked (5 pts) ===
    try {
      const r = sanitizeUrl('https://user:pass@example.com');
      const passed = !r.valid && r.reason?.includes('credentials');
      results.push({ name: 'URL: Embedded credentials blocked', passed, points: passed ? 5 : 0, maxPoints: 5, detail: r.reason });
    } catch (e) {
      results.push({ name: 'URL: Credentials', passed: false, points: 0, maxPoints: 5, detail: e.message });
    }

    // === TEST 8: API Key — generation + validation (15 pts) ===
    try {
      const { raw, hash, prefix } = await generateApiKey();
      const hashCorrect = await hashApiKey(raw);
      const hashMatch = hash === hashCorrect;
      const prefixCorrect = prefix.startsWith('cb_live_');
      const passed = hashMatch && prefixCorrect && raw.startsWith('cb_live_') && hash.length === 64;
      results.push({ name: 'API Key: Generation + hashing', passed, points: passed ? 15 : 0, maxPoints: 15, detail: `prefix: ${prefix}, hash length: ${hash.length}, match: ${hashMatch}` });
    } catch (e) {
      results.push({ name: 'API Key: Generation', passed: false, points: 0, maxPoints: 15, detail: e.message });
    }

    // === TEST 9: API Key — invalid key rejected (10 pts) ===
    try {
      const r1 = await validateApiKey(base44, 'invalid_key');
      const r2 = await validateApiKey(base44, 'cb_live_nonexistent');
      const passed = !r1.valid && !r2.valid && r1.reason?.includes('format') && r2.reason?.includes('not found');
      results.push({ name: 'API Key: Invalid keys rejected', passed, points: passed ? 10 : 0, maxPoints: 10, detail: `bad format: ${r1.reason}, not found: ${r2.reason}` });
    } catch (e) {
      results.push({ name: 'API Key: Invalid rejection', passed: false, points: 0, maxPoints: 10, detail: e.message });
    }

    // === TEST 10: Rate Limiter — fixed-window enforcement (20 pts) ===
    try {
      const testKey = 'validate-security-test-' + Date.now();
      await resetRateLimit(base44, testKey);

      // Make 3 requests with limit of 3
      const r1 = await checkRateLimit(base44, testKey, 3);
      const r2 = await checkRateLimit(base44, testKey, 3);
      const r3 = await checkRateLimit(base44, testKey, 3);
      const r4 = await checkRateLimit(base44, testKey, 3);

      const passed = r1.allowed && r2.allowed && r3.allowed && !r4.allowed
        && r3.remaining === 0 && r4.remaining === 0;

      await resetRateLimit(base44, testKey);
      results.push({ name: 'Rate Limiter: Fixed-window enforcement', passed, points: passed ? 20 : 0, maxPoints: 20, detail: `r1:${r1.allowed}, r2:${r2.allowed}, r3:${r3.allowed}, r4:${r4.allowed}, remaining at r3: ${r3.remaining}` });
    } catch (e) {
      results.push({ name: 'Rate Limiter', passed: false, points: 0, maxPoints: 20, detail: e.message });
    }

    // Calculate score
    const totalPoints = results.reduce((sum, r) => sum + r.points, 0);
    const maxPoints = results.reduce((sum, r) => sum + r.maxPoints, 0);
    const score = Math.round((totalPoints / maxPoints) * 100);
    const passedCount = results.filter(r => r.passed).length;

    return Response.json({
      suite: 'security',
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