import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Master validation — runs all three suites (Enhancements, Security, Reliability)
// and returns a combined score with zero ambiguity.

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const suites: any[] = [];
    const suiteNames = ['validateEnhancements', 'validateSecurity', 'validateReliability', 'validateCapabilities'];
    const suiteLabels = ['AI Core + PII + Anomaly', 'Security (SSRF + Rate Limit + API Keys)', 'Reliability (Webhooks + Cost + Integration)', 'Capabilities (Human Behavior + HAR + Anti-Bot + Fingerprint)'];

    for (let i = 0; i < suiteNames.length; i++) {
      try {
        const res = await base44.functions.invoke(suiteNames[i], {});
        suites.push({
          name: suiteNames[i],
          label: suiteLabels[i],
          ...res.data,
        });
      } catch (e: any) {
        suites.push({
          name: suiteNames[i],
          label: suiteLabels[i],
          score: 0,
          totalPoints: 0,
          maxPoints: 0,
          testsPassed: 0,
          testsTotal: 0,
          results: [],
          error: e.message,
        });
      }
    }

    // Calculate combined score
    const totalPoints = suites.reduce((sum, s) => sum + (s.totalPoints || 0), 0);
    const maxPoints = suites.reduce((sum, s) => sum + (s.maxPoints || 0), 0);
    const combinedScore = maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 0;
    const totalTests = suites.reduce((sum, s) => sum + (s.testsTotal || 0), 0);
    const totalPassed = suites.reduce((sum, s) => sum + (s.testsPassed || 0), 0);

    // Collect all failures
    const allFailures: any[] = [];
    for (const suite of suites) {
      if (suite.results) {
        for (const r of suite.results) {
          if (!r.passed) {
            allFailures.push({ suite: suite.name, test: r.name, detail: r.detail, maxPoints: r.maxPoints });
          }
        }
      }
    }

    return Response.json({
      combinedScore,
      totalPoints,
      maxPoints,
      totalTests,
      totalPassed,
      totalFailed: totalTests - totalPassed,
      allTestsPassed: totalPassed === totalTests,
      suites,
      failures: allFailures,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}