import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Daily Validation Regression — runs the comprehensive score, compares to
// the previous ScoreRecord, and creates a HealingFlag on any score drop or
// new gap. This catches regressions automatically and feeds the self-healing
// infrastructure that's already in place.

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const sr = base44.asServiceRole.entities;

    // Get the last ScoreRecord for comparison (before running new score)
    const lastScorePage = await sr.ScoreRecord.filter({}, { sort: '-created_date', limit: 1 });
    const lastScore = lastScorePage.items?.[0];
    const previousScore = lastScore?.score || 100;

    // Run the comprehensive score
    const scoreRes = await base44.asServiceRole.functions.invoke('runComprehensiveScore', {});
    const score = scoreRes.data || scoreRes;
    const currentScore = score.overall_score || 0;
    const gaps = score.gaps || [];
    const newGapCount = gaps.length;

    const dropped = currentScore < previousScore;
    const regressionDetected = dropped || newGapCount > 0;

    // If regression detected, create a HealingFlag
    let flag = null;
    if (regressionDetected) {
      flag = await sr.HealingFlag.create({
        flag_type: 'validation_failure',
        source_entity: 'ScoreRecord',
        source_id: score.run_id || '',
        source_title: `Validation Regression: ${previousScore} → ${currentScore}`,
        error_message: `Score dropped from ${previousScore} to ${currentScore}. ${newGapCount} gaps detected: ${gaps.slice(0, 5).map((g) => g.label || g.key || JSON.stringify(g)).join(', ')}`,
        status: 'flagged',
        flagged_at: new Date().toISOString(),
      });
    }

    return Response.json({
      ok: true,
      current_score: currentScore,
      previous_score: previousScore,
      dropped,
      new_gaps: newGapCount,
      gaps: gaps.slice(0, 10),
      healing_flag_created: !!flag,
      healing_flag_id: flag?.id || null,
      launch_readiness: score.launch_readiness,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}