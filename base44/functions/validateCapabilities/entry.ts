import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { generateMousePath, generateTypingDelays, generateScrollPath } from '../../shared/humanBehavior.ts';
import { generateHar } from '../../shared/harGenerator.ts';
import { detectAntiBot, getAllDetectedSystems } from '../../shared/antiBotDetection.ts';
import { generateFingerprint, validateFingerprint } from '../../shared/fingerprintRandomizer.ts';
import { validateUrl } from '../../shared/ssrfProtection.ts';
import { sanitizeUrl } from '../../shared/urlValidator.ts';
import { getBypassStrategy, getAllBypassStrategies, generateSessionConfigForBypass } from '../../shared/antiBotBypass.ts';
import { computeScaleDecision, dequeueNextJob, computeWarmCount } from '../../shared/autoScaler.ts';
import { buildProxyUrl, validateProviderConfig, getSupportedProviders } from '../../shared/proxyProvider.ts';
import { generateTLSFingerprint, validateTLSFingerprint, matchFingerprintToUA, getSupportedProfiles } from '../../shared/tlsFingerprint.ts';
import { getComplianceReport, getAllComplianceReports, getSupportedFrameworks } from '../../shared/complianceControls.ts';

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

    // === GROUP 1: Human Behavior (25 pts) ===
    try {
      const path = generateMousePath({ x: 0, y: 0 }, { x: 500, y: 300 }, { steps: 20 });
      const passed = path.length === 21 && path[0].x === 0 && path[0].y === 0 && path[20].x === 500 && path[20].y === 300;
      results.push({ name: 'Human Behavior: Mouse path (bezier curves)', passed, points: passed ? 10 : 0, maxPoints: 10, detail: `Path length: ${path.length}, start: (${path[0].x},${path[0].y}), end: (${path[20].x},${path[20].y})` });
    } catch (e) { results.push({ name: 'Human Behavior: Mouse path', passed: false, points: 0, maxPoints: 10, detail: e.message }); }

    try {
      const delays = generateTypingDelays('Hello World', { baseDelay: 80, jitter: 40 });
      const passed = delays.length === 11 && delays.every(d => d > 0) && delays.some(d => d !== delays[0]);
      results.push({ name: 'Human Behavior: Typing delays (jitter)', passed, points: passed ? 10 : 0, maxPoints: 10, detail: `Delays: ${delays.length} chars, variation: ${Math.max(...delays) - Math.min(...delays)}ms` });
    } catch (e) { results.push({ name: 'Human Behavior: Typing delays', passed: false, points: 0, maxPoints: 10, detail: e.message }); }

    try {
      const scroll = generateScrollPath(0, 2000, { steps: 10 });
      const passed = scroll.length === 11 && scroll[0] === 0 && scroll[10] === 2000;
      results.push({ name: 'Human Behavior: Scroll path (ease-in-out)', passed, points: passed ? 5 : 0, maxPoints: 5, detail: `Steps: ${scroll.length}, start: ${scroll[0]}, end: ${scroll[10]}` });
    } catch (e) { results.push({ name: 'Human Behavior: Scroll path', passed: false, points: 0, maxPoints: 5, detail: e.message }); }

    // === GROUP 2: HAR Generation (15 pts) ===
    try {
      const har = generateHar([
        { method: 'GET', url: 'https://example.com/api/data?foo=bar', status: 200, statusText: 'OK', mimeType: 'application/json', responseBody: '{"result":true}', duration: 150, timestamp: new Date().toISOString() },
        { method: 'POST', url: 'https://example.com/api/submit', status: 201, statusText: 'Created', requestBody: '{"name":"test"}', responseBody: '{"id":1}', duration: 200, timestamp: new Date().toISOString() },
      ]);
      const passed = har.log.version === '1.2' && har.log.entries.length === 2 && har.log.entries[1].request.postData?.text === '{"name":"test"}';
      results.push({ name: 'HAR: Generation (1.2 compliant)', passed, points: passed ? 15 : 0, maxPoints: 15, detail: `Version: ${har.log.version}, entries: ${har.log.entries.length}, creator: ${har.log.creator.name}` });
    } catch (e) { results.push({ name: 'HAR: Generation', passed: false, points: 0, maxPoints: 15, detail: e.message }); }

    // === GROUP 3: Anti-Bot Detection (30 pts) ===
    try {
      const result = detectAntiBot('<html><script src="/cdn-cgi/challenge-platform/h/g/orchestrate/managed/v1">cf-ray: 12345</script></html>', { 'cf-ray': '12345', 'server': 'cloudflare' }, ['/cdn-cgi/challenge-platform/h/g/orchestrate/managed/v1']);
      const passed = result.detected === 'cloudflare' && result.confidence > 0;
      results.push({ name: 'Anti-Bot: Cloudflare detection', passed, points: passed ? 10 : 0, maxPoints: 10, detail: `Detected: ${result.detected}, confidence: ${result.confidence.toFixed(2)}, signals: ${result.signals.length}` });
    } catch (e) { results.push({ name: 'Anti-Bot: Cloudflare', passed: false, points: 0, maxPoints: 10, detail: e.message }); }

    try {
      const result = detectAntiBot('<div class="g-recaptcha" data-sitekey="6Le_xxxx"></div><script src="https://www.google.com/recaptcha/api.js"></script>');
      const passed = result.detected === 'recaptcha_v2' && result.confidence > 0;
      results.push({ name: 'Anti-Bot: reCAPTCHA v2 detection', passed, points: passed ? 10 : 0, maxPoints: 10, detail: `Detected: ${result.detected}, confidence: ${result.confidence.toFixed(2)}` });
    } catch (e) { results.push({ name: 'Anti-Bot: reCAPTCHA v2', passed: false, points: 0, maxPoints: 10, detail: e.message }); }

    try {
      const all = getAllDetectedSystems('<div class="g-recaptcha"></div><div class="h-captcha"></div>', {}, []);
      const passed = all.includes('recaptcha_v2') && all.includes('hcaptcha');
      results.push({ name: 'Anti-Bot: Multi-system detection', passed, points: passed ? 10 : 0, maxPoints: 10, detail: `Detected systems: ${all.join(', ')}` });
    } catch (e) { results.push({ name: 'Anti-Bot: Multi-system', passed: false, points: 0, maxPoints: 10, detail: e.message }); }

    // === GROUP 4: Fingerprint Randomization (20 pts) ===
    try {
      const fp1 = generateFingerprint();
      const fp2 = generateFingerprint();
      const validation = validateFingerprint(fp1);
      const different = fp1.userAgent !== fp2.userAgent || fp1.webgl.renderer !== fp2.webgl.renderer;
      const passed = validation.valid && different;
      results.push({ name: 'Fingerprint: Randomization + validation', passed, points: passed ? 15 : 0, maxPoints: 15, detail: `Valid: ${validation.valid}, different: ${different}, platform: ${fp1.platform}` });
    } catch (e) { results.push({ name: 'Fingerprint: Randomization', passed: false, points: 0, maxPoints: 15, detail: e.message }); }

    try {
      const fp = generateFingerprint();
      const passed = fp.fonts.length >= 15 && fp.plugins.length >= 3 && fp.hardwareConcurrency >= 4 && fp.deviceMemory >= 4;
      results.push({ name: 'Fingerprint: Realistic values', passed, points: passed ? 5 : 0, maxPoints: 5, detail: `Fonts: ${fp.fonts.length}, plugins: ${fp.plugins.length}, cores: ${fp.hardwareConcurrency}, memory: ${fp.deviceMemory}GB` });
    } catch (e) { results.push({ name: 'Fingerprint: Realistic', passed: false, points: 0, maxPoints: 5, detail: e.message }); }

    // === GROUP 5: Anti-Bot Bypass Strategies (20 pts) ===
    try {
      const strategies = getAllBypassStrategies();
      const systems = ['akamai', 'datadome', 'perimeterx', 'kasada', 'imperva', 'arkose', 'geetest'];
      const allPresent = systems.every(s => strategies.some(st => st.system.toLowerCase().includes(s)));
      const allHaveConfig = strategies.every(s => s.recommendedConfig.proxyType && s.recommendedConfig.fingerprintLevel);
      const passed = allPresent && allHaveConfig && strategies.length >= 7;
      results.push({ name: 'Anti-Bot Bypass: All 7 systems have strategies', passed, points: passed ? 10 : 0, maxPoints: 10, detail: `Strategies: ${strategies.length}, systems: ${strategies.map(s => s.system).join(', ')}` });
    } catch (e) { results.push({ name: 'Anti-Bot Bypass: Strategies', passed: false, points: 0, maxPoints: 10, detail: e.message }); }

    try {
      const config = generateSessionConfigForBypass('datadome');
      const passed = config !== null && config.proxyType === 'mobile' && config.fingerprintLevel === 'full' && config.strategy.length >= 3;
      results.push({ name: 'Anti-Bot Bypass: DataDome session config', passed, points: passed ? 10 : 0, maxPoints: 10, detail: `Proxy: ${config?.proxyType}, fingerprint: ${config?.fingerprintLevel}, strategies: ${config?.strategy.length}` });
    } catch (e) { results.push({ name: 'Anti-Bot Bypass: DataDome', passed: false, points: 0, maxPoints: 10, detail: e.message }); }

    // === GROUP 6: Auto-Scaling (20 pts) ===
    try {
      const scaleUp = computeScaleDecision({ currentPoolSize: 5, activeSessions: 5, queuedJobs: 20, minPool: 2, maxPool: 50, targetQueueDepth: 5 });
      const passed = scaleUp.action === 'scale_up' && scaleUp.targetPool > 5;
      results.push({ name: 'Auto-Scale: Scale up on high queue', passed, points: passed ? 7 : 0, maxPoints: 7, detail: `Action: ${scaleUp.action}, target: ${scaleUp.targetPool}, reason: ${scaleUp.reason}` });
    } catch (e) { results.push({ name: 'Auto-Scale: Scale up', passed: false, points: 0, maxPoints: 7, detail: e.message }); }

    try {
      const scaleDown = computeScaleDecision({ currentPoolSize: 10, activeSessions: 2, queuedJobs: 0, minPool: 2, maxPool: 50, targetQueueDepth: 5 });
      const passed = scaleDown.action === 'scale_down' && scaleDown.targetPool < 10;
      results.push({ name: 'Auto-Scale: Scale down on idle', passed, points: passed ? 7 : 0, maxPoints: 7, detail: `Action: ${scaleDown.action}, target: ${scaleDown.targetPool}, reason: ${scaleDown.reason}` });
    } catch (e) { results.push({ name: 'Auto-Scale: Scale down', passed: false, points: 0, maxPoints: 7, detail: e.message }); }

    try {
      const jobs = [
        { id: '1', priority: 5, created_date: '2026-01-01T10:00:00Z' },
        { id: '2', priority: 1, created_date: '2026-01-01T10:01:00Z' },
        { id: '3', priority: 3, created_date: '2026-01-01T10:02:00Z' },
      ];
      const next = dequeueNextJob(jobs);
      const passed = next.id === '2'; // priority 1 should be first
      results.push({ name: 'Auto-Scale: Priority queue dequeue', passed, points: passed ? 6 : 0, maxPoints: 6, detail: `Next job: ${next?.id} (priority ${next?.priority})` });
    } catch (e) { results.push({ name: 'Auto-Scale: Priority queue', passed: false, points: 0, maxPoints: 6, detail: e.message }); }

    // === GROUP 7: Proxy Provider Integration (15 pts) ===
    try {
      const endpoint = buildProxyUrl(
        { provider: 'bright_data', endpoint: '', username: 'brd-customer-xxx-zone-zone1', password: 'pass123', rotation: 'sticky' },
        { country: 'us', city: 'new york', state: 'ny' }
      );
      const passed = endpoint.url.includes('brd.superproxy.io') && endpoint.url.includes('country-us') && endpoint.url.includes('city-newyork');
      results.push({ name: 'Proxy Provider: Bright Data geo-targeting URL', passed, points: passed ? 8 : 0, maxPoints: 8, detail: `URL: ${endpoint.url.substring(0, 50)}...` });
    } catch (e) { results.push({ name: 'Proxy Provider: Bright Data', passed: false, points: 0, maxPoints: 8, detail: e.message }); }

    try {
      const providers = getSupportedProviders();
      const passed = providers.length >= 5 && providers.some(p => p.provider === 'bright_data') && providers.some(p => p.provider === 'smartproxy');
      results.push({ name: 'Proxy Provider: 5+ providers supported', passed, points: passed ? 7 : 0, maxPoints: 7, detail: `Providers: ${providers.map(p => p.provider).join(', ')}` });
    } catch (e) { results.push({ name: 'Proxy Provider: Providers', passed: false, points: 0, maxPoints: 7, detail: e.message }); }

    // === GROUP 8: TLS Fingerprinting (15 pts) ===
    try {
      const tls = generateTLSFingerprint('chrome_131');
      const validation = validateTLSFingerprint(tls);
      const passed = validation.valid && tls.ja3_hash.length >= 16 && tls.ja4.startsWith('t13') && tls.alpn.includes('h2');
      results.push({ name: 'TLS Fingerprint: Generation + JA3/JA4', passed, points: passed ? 8 : 0, maxPoints: 8, detail: `JA3: ${tls.ja3_hash.substring(0, 16)}..., JA4: ${tls.ja4}, valid: ${validation.valid}` });
    } catch (e) { results.push({ name: 'TLS Fingerprint: Generation', passed: false, points: 0, maxPoints: 8, detail: e.message }); }

    try {
      const tls = matchFingerprintToUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
      const passed = tls.ja4.startsWith('t13') && tls.tls_version === 'TLS 1.3';
      results.push({ name: 'TLS Fingerprint: Match to User-Agent', passed, points: passed ? 7 : 0, maxPoints: 7, detail: `Matched: Chrome 131, JA4: ${tls.ja4}` });
    } catch (e) { results.push({ name: 'TLS Fingerprint: UA match', passed: false, points: 0, maxPoints: 7, detail: e.message }); }

    // === GROUP 9: Compliance Controls (20 pts) ===
    try {
      const soc2 = getComplianceReport('soc2_type2');
      const passed = soc2.totalControls >= 10 && soc2.enforcedControls === soc2.totalControls && soc2.ready;
      results.push({ name: 'Compliance: SOC 2 Type II controls', passed, points: passed ? 8 : 0, maxPoints: 8, detail: `Controls: ${soc2.enforcedControls}/${soc2.totalControls}, ready: ${soc2.ready}` });
    } catch (e) { results.push({ name: 'Compliance: SOC 2', passed: false, points: 0, maxPoints: 8, detail: e.message }); }

    try {
      const hipaa = getComplianceReport('hipaa');
      const passed = hipaa.totalControls >= 5 && hipaa.enforcedControls === hipaa.totalControls && hipaa.ready;
      results.push({ name: 'Compliance: HIPAA controls', passed, points: passed ? 7 : 0, maxPoints: 7, detail: `Controls: ${hipaa.enforcedControls}/${hipaa.totalControls}, ready: ${hipaa.ready}` });
    } catch (e) { results.push({ name: 'Compliance: HIPAA', passed: false, points: 0, maxPoints: 7, detail: e.message }); }

    try {
      const frameworks = getSupportedFrameworks();
      const reports = getAllComplianceReports();
      const passed = frameworks.length >= 5 && reports.every(r => r.ready);
      results.push({ name: 'Compliance: All 5 frameworks ready', passed, points: passed ? 5 : 0, maxPoints: 5, detail: `Frameworks: ${frameworks.join(', ')}, all ready: ${reports.every(r => r.ready)}` });
    } catch (e) { results.push({ name: 'Compliance: Frameworks', passed: false, points: 0, maxPoints: 5, detail: e.message }); }

    // === GROUP 10: Security (10 pts) ===
    try {
      const r1 = validateUrl('https://example.com');
      const r2 = sanitizeUrl('javascript:alert(1)');
      const passed = r1.valid && !r2.valid;
      results.push({ name: 'Security: SSRF + URL validation', passed, points: passed ? 10 : 0, maxPoints: 10, detail: `SSRF valid: ${r1.valid}, URL dangerous blocked: ${!r2.valid}` });
    } catch (e) { results.push({ name: 'Security: SSRF + URL', passed: false, points: 0, maxPoints: 10, detail: e.message }); }

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