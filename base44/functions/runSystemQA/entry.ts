import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { DEPLOYMENT_VERSION } from '../../shared/deploymentVersion.ts';

// Comprehensive System QA — runs all validation suites, engine health, capability matrix,
// and visual validation in parallel, then returns a scored report with prioritized fix recommendations.
// This is the single function an autonomous agent or QA validator calls to assess the entire system.

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin access required for system QA' }, { status: 403 });

    // Run all validation suites in parallel
    const [engineHealthRes, capabilityMatrixRes, fullValidationRes, visualValidationRes] = await Promise.allSettled([
      base44.functions.invoke('engineHealth', {}).then(r => r.data || r).catch(e => ({ error: e.message })),
      base44.functions.invoke('getCapabilityMatrix', {}).then(r => r.data || r).catch(e => ({ error: e.message })),
      base44.functions.invoke('runFullValidation', {}).then(r => r.data || r).catch(e => ({ error: e.message })),
      base44.functions.invoke('runVisualValidation', {}).then(r => r.data || r).catch(e => ({ error: e.message })),
    ]);

    const engineHealth = engineHealthRes.status === 'fulfilled' ? engineHealthRes.value : { error: 'Failed to invoke' };
    const capabilityMatrix = capabilityMatrixRes.status === 'fulfilled' ? capabilityMatrixRes.value : { error: 'Failed to invoke' };
    const fullValidation = fullValidationRes.status === 'fulfilled' ? fullValidationRes.value : { error: 'Failed to invoke' };
    const visualValidation = visualValidationRes.status === 'fulfilled' ? visualValidationRes.value : { error: 'Failed to invoke' };

    // === ENGINE HEALTH ANALYSIS ===
    const engineIssues: any[] = [];
    const swarm = engineHealth?.swarm || {};
    const engines = engineHealth?.engines || [];

    for (const engine of engines) {
      if (!engine.ok) {
        engineIssues.push({
          severity: 'P0',
          engine: engine.engine_label,
          url: engine.engine_url,
          issue: engine.error_message || 'Engine unhealthy',
          fix: engine.error_message?.includes('HTML')
            ? `Engine is serving Vite app HTML instead of browser engine API. Swap ENGINE_URL secret to a healthy engine (e.g. ${engines.find(e => e.ok)?.engine_url || 'https://cloudbrowser-engine-2-production.up.railway.app'}).`
            : engine.error_message?.includes('Timeout')
            ? 'Engine timed out — check Railway deployment status and memory limits.'
            : 'Engine unreachable — check Railway deployment and ENGINE_URL secret.',
        });
      } else if (engine.readiness && !engine.readiness.ready) {
        engineIssues.push({
          severity: 'P0',
          engine: engine.engine_label,
          url: engine.engine_url,
          issue: `Browser launch failed: ${engine.readiness.error || 'unknown'}`,
          fix: 'Engine is healthy but Playwright cannot launch — check memory limits, Chromium dependencies, and container resources on Railway.',
        });
      }
    }

    // === CAPABILITY GAP ANALYSIS ===
    const capabilityGaps: any[] = [];
    const capabilitySummary = capabilityMatrix?.summary || {};
    const gaps = capabilityMatrix?.gaps || [];

    for (const gap of gaps) {
      capabilityGaps.push({
        severity: gap.status === 'gap' ? 'P1' : 'P2',
        category: gap.category,
        capability: gap.capability,
        currentScore: gap.currentScore,
        gap: gap.gap,
        closable: gap.closable,
        fix: gap.closable
          ? `Implement ${gap.capability} — gap: ${gap.gap}`
          : `External dependency — ${gap.gap}`,
      });
    }

    // === VALIDATION SUITE ANALYSIS ===
    const validationIssues: any[] = [];
    const suites = fullValidation?.suites || [];
    const failures = fullValidation?.failures || [];

    for (const failure of failures) {
      validationIssues.push({
        severity: 'P1',
        suite: failure.suite,
        test: failure.test,
        detail: failure.detail,
        fix: `Fix ${failure.test} in ${failure.suite} — ${failure.detail}`,
      });
    }

    // === VISUAL VALIDATION ANALYSIS ===
    const visualIssues: any[] = [];
    if (visualValidation?.error) {
      if (visualValidation.error.includes('BLOB_READ_WRITE_TOKEN')) {
        visualIssues.push({
          severity: 'P0',
          issue: 'BLOB_READ_WRITE_TOKEN secret not set — screenshots and visual validation cannot run',
          fix: 'Set BLOB_READ_WRITE_TOKEN in Dashboard → Secrets. Get it from Vercel → Storage → Blob.',
        });
      } else {
        visualIssues.push({
          severity: 'P1',
          issue: `Visual validation failed: ${visualValidation.error}`,
          fix: 'Check runVisualValidation function logs for details.',
        });
      }
    } else if (visualValidation?.overall_score !== undefined) {
      if (visualValidation.overall_score < 80) {
        visualIssues.push({
          severity: 'P1',
          issue: `Visual validation score is ${visualValidation.overall_score}% — below 80% threshold`,
          fix: 'Review failed checks in runVisualValidation results and fix UI/design issues.',
        });
      }
    }

    // === COMBINED SCORE ===
    const engineScore = swarm.status === 'healthy' ? 100 : swarm.status === 'degraded' ? 60 : 0;
    const capabilityScore = capabilitySummary.averageScore || 0;
    const validationScore = fullValidation?.combinedScore || 0;
    const visualScore = visualValidation?.overall_score !== undefined ? visualValidation.overall_score : 0;

    // Weighted: engine (25%), capabilities (25%), validation (30%), visual (20%)
    const overallScore = Math.round(
      engineScore * 0.25 +
      capabilityScore * 0.25 +
      validationScore * 0.30 +
      visualScore * 0.20
    );

    // === PRIORITIZED ACTION PLAN ===
    const allIssues = [
      ...engineIssues.map(i => ({ ...i, category: 'Engine' })),
      ...visualIssues.map(i => ({ ...i, category: 'Visual' })),
      ...validationIssues.map(i => ({ ...i, category: 'Validation' })),
      ...capabilityGaps.filter(g => g.severity === 'P1').map(i => ({ ...i, category: 'Capability' })),
    ].sort((a, b) => {
      const sevOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
      return (sevOrder[a.severity] || 9) - (sevOrder[b.severity] || 9);
    });

    // === SYSTEM STATUS ===
    const systemStatus = overallScore >= 90 ? 'production_ready'
      : overallScore >= 70 ? 'operational_with_gaps'
      : overallScore >= 50 ? 'degraded'
      : 'critical';

    // Persist QA result
    try {
      await base44.asServiceRole.entities.TestResult.create({
        suite: 'system_qa',
        test_name: 'comprehensive_system_qa',
        status: overallScore >= 80 ? 'pass' : 'fail',
        duration_ms: 0,
        score_category: 'overall',
        score_points: overallScore,
        max_points: 100,
        run_id: `qa_${Date.now()}`,
      });
    } catch (e) { /* ignore persist errors */ }

    return Response.json({
      overall_score: overallScore,
      system_status: systemStatus,
      category_scores: {
        engine: { score: engineScore, status: swarm.status, healthy_engines: swarm.healthy_count, total_engines: swarm.total_engines },
        capabilities: { score: capabilityScore, implemented: capabilitySummary.implemented, partial: capabilitySummary.partial, gaps: capabilitySummary.gaps, closable_gaps: capabilitySummary.closableGaps },
        validation: { score: validationScore, tests_passed: fullValidation?.totalPassed, tests_total: fullValidation?.totalTests, tests_failed: fullValidation?.totalFailed },
        visual: { score: visualScore, available: !visualValidation?.error },
      },
      engine_issues: engineIssues,
      capability_gaps: capabilityGaps,
      validation_issues: validationIssues,
      visual_issues: visualIssues,
      prioritized_action_plan: allIssues,
      raw: {
        engine_health: engineHealth,
        capability_matrix: capabilityMatrix,
        full_validation: fullValidation,
        visual_validation: visualValidation,
      },
      timestamp: new Date().toISOString(),
      __v: DEPLOYMENT_VERSION,
    });
  } catch (error) {
    return Response.json({ error: error.message, __v: DEPLOYMENT_VERSION }, { status: 500 });
  }
}