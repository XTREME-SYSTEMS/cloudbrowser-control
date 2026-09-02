import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Autonomously runs ALL capability validation suites one after another,
// stores every individual test result as a TestResult record, and returns a summary.
// Designed to be called by the "Capability Test Automation" workflow on a schedule,
// or manually from the Capability Test Lab page.

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const runId = 'auto-' + Date.now();
    const startedAt = new Date().toISOString();

    // Define all suites to run sequentially
    const suites = [
      { fn: 'validateSecurity', label: 'Security', category: 'Security & Enterprise' },
      { fn: 'validateReliability', label: 'Reliability', category: 'Data & Observability' },
      { fn: 'validateCapabilities', label: 'Capabilities', category: 'Browser Infrastructure' },
      { fn: 'validateEnhancements', label: 'AI Enhancements', category: 'AI & Automation' },
    ];

    const suiteSummaries = [];
    let totalScore = 0;
    let totalPassed = 0;
    let totalTests = 0;
    let totalPoints = 0;
    let totalMaxPoints = 0;
    const allErrors = [];

    // Run each validation suite sequentially
    for (const suite of suites) {
      try {
        const res = await base44.functions.invoke(suite.fn, {});
        const data = res.data || res;

        totalScore += data.score || 0;
        totalPassed += data.testsPassed || 0;
        totalTests += data.testsTotal || 0;
        totalPoints += data.totalPoints || 0;
        totalMaxPoints += data.maxPoints || 0;

        suiteSummaries.push({
          suite: suite.label,
          score: data.score || 0,
          testsPassed: data.testsPassed || 0,
          testsTotal: data.testsTotal || 0,
        });

        // Store each individual test result
        if (data.results) {
          for (const t of data.results) {
            try {
              await base44.entities.TestResult.create({
                suite: suite.label,
                test_name: t.name,
                status: t.passed ? 'pass' : 'fail',
                duration_ms: 0,
                error_message: t.passed ? null : t.detail,
                score_category: suite.category,
                score_points: t.points || 0,
                max_points: t.maxPoints || 0,
                run_id: runId,
              });
            } catch (e) {
              // skip individual record errors
            }
          }
        }
      } catch (e) {
        allErrors.push({ suite: suite.label, error: e.message });
        suiteSummaries.push({
          suite: suite.label,
          score: 0,
          testsPassed: 0,
          testsTotal: 0,
          error: e.message,
        });
      }
    }

    // Run engine health check
    let engineStatus = 'unknown';
    try {
      const res = await base44.functions.invoke('engineHealth', {});
      const data = res.data || res;
      engineStatus = data.status || (data.ok ? 'ok' : 'error');
      await base44.entities.TestResult.create({
        suite: 'Engine Health',
        test_name: 'Engine connectivity',
        status: engineStatus === 'ok' ? 'pass' : 'fail',
        duration_ms: 0,
        error_message: engineStatus === 'ok' ? null : (data.error || 'Engine not healthy'),
        score_category: 'Browser Infrastructure',
        score_points: engineStatus === 'ok' ? 10 : 0,
        max_points: 10,
        run_id: runId,
      });
    } catch (e) {
      engineStatus = 'error';
      allErrors.push({ suite: 'Engine Health', error: e.message });
      await base44.entities.TestResult.create({
        suite: 'Engine Health',
        test_name: 'Engine connectivity',
        status: 'fail',
        duration_ms: 0,
        error_message: e.message,
        score_category: 'Browser Infrastructure',
        score_points: 0,
        max_points: 10,
        run_id: runId,
      }).catch(() => {});
    }

    // Run capability matrix
    let matrixScore = 0;
    try {
      const res = await base44.functions.invoke('getCapabilityMatrix', {});
      const data = res.data || res;
      matrixScore = data.summary?.averageScore || 0;
      await base44.entities.TestResult.create({
        suite: 'Capability Matrix',
        test_name: 'Matrix average score',
        status: matrixScore >= 80 ? 'pass' : 'fail',
        duration_ms: 0,
        score_category: 'Browser Infrastructure',
        score_points: matrixScore >= 80 ? 10 : 0,
        max_points: 10,
        run_id: runId,
      });
    } catch (e) {
      allErrors.push({ suite: 'Capability Matrix', error: e.message });
    }

    const completedAt = new Date().toISOString();
    const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();
    const averageScore = suites.length > 0 ? Math.round(totalScore / suites.length) : 0;

    const summary = {
      run_id: runId,
      started_at: startedAt,
      completed_at: completedAt,
      duration_ms: durationMs,
      average_score: averageScore,
      total_passed: totalPassed,
      total_tests: totalTests,
      total_points: totalPoints,
      total_max_points: totalMaxPoints,
      engine_status: engineStatus,
      matrix_score: matrixScore,
      suites: suiteSummaries,
      errors: allErrors,
    };

    // Send notification about the run
    try {
      await base44.functions.invoke('sendNotification', {
        type: 'capability_test_run',
        title: `Capability Test Run Complete — ${averageScore}/100`,
        body: `${totalPassed}/${totalTests} tests passed. Engine: ${engineStatus}. Matrix: ${matrixScore}/100.`,
        link: '/capability-test-lab',
        send_email: averageScore < 90,
      });
    } catch (e) {
      // notification is best-effort
    }

    return Response.json(summary);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}