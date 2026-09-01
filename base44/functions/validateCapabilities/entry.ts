import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { generateMousePath, generateTypingDelays, generateScrollPath, humanDelay } from '../../shared/humanBehavior.ts';
import { generateHar, harToJsonString } from '../../shared/harGenerator.ts';
import { detectAntiBot, getAllDetectedSystems } from '../../shared/antiBotDetection.ts';
import { generateFingerprint, validateFingerprint } from '../../shared/fingerprintRandomizer.ts';
import { validateUrl } from '../../shared/ssrfProtection.ts';
import { sanitizeUrl } from '../../shared/urlValidator.ts';
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

    // === TEST 1: Human behavior — mouse path generation (10 pts) ===
    try {
      const path = generateMousePath({ x: 0, y: 0 }, { x: 500, y: 300 }, { steps: 20 });
      const passed = path.length === 21 && path[0].x === 0 && path[0].y === 0 && path[20].x === 500 && path[20].y === 300;
      results.push({ name: 'Human Behavior: Mouse path (bezier curves)', passed, points: passed ? 10 : 0, maxPoints: 10, detail: `Path length: ${path.length}, start: (${path[0].x},${path[0].y}), end: (${path[20].x},${path[20].y})` });
    } catch (e) {
      results.push({ name: 'Human Behavior: Mouse path', passed: false, points: 0, maxPoints: 10, detail: e.message });
    }

    // === TEST 2: Human behavior — typing delays (10 pts) ===
    try {
      const delays = generateTypingDelays('Hello World', { baseDelay: 80, jitter: 40 });
      const passed = delays.length === 11 && delays.every(d => d > 0) && delays.some(d => d !== delays[0]);
      results.push({ name: 'Human Behavior: Typing delays (jitter)', passed, points: passed ? 10 : 0, maxPoints: 10, detail: `Delays: ${delays.length} chars, variation: ${Math.max(...delays) - Math.min(...delays)}ms` });
    } catch (e) {
      results.push({ name: 'Human Behavior: Typing delays', passed: false, points: 0, maxPoints: 10, detail: e.message });
    }

    // === TEST 3: Human behavior — scroll path (5 pts) ===
    try {
      const scroll = generateScrollPath(0, 2000, { steps: 10 });
      const passed = scroll.length === 11 && scroll[0] === 0 && scroll[10] === 2000;
      results.push({ name: 'Human Behavior: Scroll path (ease-in-out)', passed, points: passed ? 5 : 0, maxPoints: 5, detail: `Steps: ${scroll.length}, start: ${scroll[0]}, end: ${scroll[10]}` });
    } catch (e) {
      results.push({ name: 'Human Behavior: Scroll path', passed: false, points: 0, maxPoints: 5, detail: e.message });
    }

    // === TEST 4: HAR generation (15 pts) ===
    try {
      const har = generateHar([
        { method: 'GET', url: 'https://example.com/api/data?foo=bar', status: 200, statusText: 'OK', mimeType: 'application/json', responseBody: '{"result":true}', duration: 150, timestamp: new Date().toISOString() },
        { method: 'POST', url: 'https://example.com/api/submit', status: 201, statusText: 'Created', requestBody: '{"name":"test"}', responseBody: '{"id":1}', duration: 200, timestamp: new Date().toISOString() },
      ]);
      const passed = har.log.version === '1.2' && har.log.entries.length === 2 && har.log.entries[0].request.method === 'GET' && har.log.entries[1].request.method === 'POST' && har.log.entries[1].request.postData?.text === '{"name":"test"}';
      results.push({ name: 'HAR: Generation (1.2 compliant)', passed, points: passed ? 15 : 0, maxPoints: 15, detail: `Version: ${har.log.version}, entries: ${har.log.entries.length}, creator: ${har.log.creator.name}` });
    } catch (e) {
      results.push({ name: 'HAR: Generation', passed: false, points: 0, maxPoints: 15, detail: e.message });
    }

    // === TEST 5: Anti-bot detection — Cloudflare (10 pts) ===
    try {
      const result = detectAntiBot('<html><script src="/cdn-cgi/challenge-platform/h/g/orchestrate/managed/v1">cf-ray: 12345</script></html>', { 'cf-ray': '12345', 'server': 'cloudflare' }, ['/cdn-cgi/challenge-platform/h/g/orchestrate/managed/v1']);
      const passed = result.detected === 'cloudflare' && result.confidence > 0;
      results.push({ name: 'Anti-Bot: Cloudflare detection', passed, points: passed ? 10 : 0, maxPoints: 10, detail: `Detected: ${result.detected}, confidence: ${result.confidence.toFixed(2)}, signals: ${result.signals.length}` });
    } catch (e) {
      results.push({ name: 'Anti-Bot: Cloudflare', passed: false, points: 0, maxPoints: 10, detail: e.message });
    }

    // === TEST 6: Anti-bot detection — reCAPTCHA v2 (10 pts) ===
    try {
      const result = detectAntiBot('<div class="g-recaptcha" data-sitekey="6Le_xxxx"></div><script src="https://www.google.com/recaptcha/api.js"></script>');
      const passed = result.detected === 'recaptcha_v2' && result.confidence > 0;
      results.push({ name: 'Anti-Bot: reCAPTCHA v2 detection', passed, points: passed ? 10 : 0, maxPoints: 10, detail: `Detected: ${result.detected}, confidence: ${result.confidence.toFixed(2)}` });
    } catch (e) {
      results.push({ name: 'Anti-Bot: reCAPTCHA v2', passed: false, points: 0, maxPoints: 10, detail: e.message });
    }

    // === TEST 7: Anti-bot detection — multiple systems (10 pts) ===
    try {
      const all = getAllDetectedSystems('<div class="g-recaptcha"></div><div class="h-captcha"></div>', {}, []);
      const passed = all.includes('recaptcha_v2') && all.includes('hcaptcha');
      results.push({ name: 'Anti-Bot: Multi-system detection', passed, points: passed ? 10 : 0, maxPoints: 10, detail: `Detected systems: ${all.join(', ')}` });
    } catch (e) {
      results.push({ name: 'Anti-Bot: Multi-system', passed: false, points: 0, maxPoints: 10, detail: e.message });
    }

    // === TEST 8: Fingerprint randomization — generation (15 pts) ===
    try {
      const fp1 = generateFingerprint();
      const fp2 = generateFingerprint();
      const validation = validateFingerprint(fp1);
      const different = fp1.userAgent !== fp2.userAgent || fp1.webgl.renderer !== fp2.webgl.renderer || fp1.screen.width !== fp2.screen.width;
      const passed = validation.valid && different;
      results.push({ name: 'Fingerprint: Randomization + validation', passed, points: passed ? 15 : 0, maxPoints: 15, detail: `Valid: ${validation.valid}, different from second: ${different}, platform: ${fp1.platform}, screen: ${fp1.screen.width}x${fp1.screen.height}` });
    } catch (e) {
      results.push({ name: 'Fingerprint: Randomization', passed: false, points: 0, maxPoints: 15, detail: e.message });
    }

    // === TEST 9: Fingerprint — realistic values (5 pts) ===
    try {
      const fp = generateFingerprint();
      const passed = fp.fonts.length >= 15 && fp.plugins.length >= 3 && fp.hardwareConcurrency >= 4 && fp.deviceMemory >= 4 && fp.userAgent.includes('Chrome/');
      results.push({ name: 'Fingerprint: Realistic values', passed, points: passed ? 5 : 0, maxPoints: 5, detail: `Fonts: ${fp.fonts.length}, plugins: ${fp.plugins.length}, cores: ${fp.hardwareConcurrency}, memory: ${fp.deviceMemory}GB` });
    } catch (e) {
      results.push({ name: 'Fingerprint: Realistic', passed: false, points: 0, maxPoints: 5, detail: e.message });
    }

    // === TEST 10: SSRF + URL validation integration (10 pts) ===
    try {
      const r1 = validateUrl('https://example.com');
      const r2 = sanitizeUrl('javascript:alert(1)');
      const passed = r1.valid && !r2.valid;
      results.push({ name: 'Security: SSRF + URL validation', passed, points: passed ? 10 : 0, maxPoints: 10, detail: `SSRF valid: ${r1.valid}, URL dangerous blocked: ${!r2.valid}` });
    } catch (e) {
      results.push({ name: 'Security: SSRF + URL', passed: false, points: 0, maxPoints: 10, detail: e.message });
    }

    // Calculate score
    const totalPoints = results.reduce((sum, r) => sum + r.points, 0);
    const maxPoints = results.reduce((sum, r) => sum + r.maxPoints, 0);
    const score = Math.round((totalPoints / maxPoints) * 100);
    const passedCount = results.filter(r => r.passed).length;

    return Response.json({
      suite: 'capabilities',
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