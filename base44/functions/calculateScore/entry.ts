import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

export default async function (req) {
  const base44 = createClientFromRequest(req);

  try {
    const body = await req.json().catch(() => ({}));
    const runId = body.run_id;

    let results;
    if (runId) {
      results = await base44.asServiceRole.entities.TestResult.filter({ run_id: runId });
    } else {
      // Get latest run
      const latest = await base44.asServiceRole.entities.ScoreRecord.list("-created_date", 1);
      if (!latest.length) return Response.json({ error: "No test runs found" }, { status: 404 });
      results = await base44.asServiceRole.entities.TestResult.filter({ run_id: latest[0].run_id });
    }

    const total = results.length;
    const passed = results.filter((r) => r.status === "pass").length;
    const failed = results.filter((r) => r.status === "fail").length;
    const skipped = results.filter((r) => r.status === "skip").length;
    const pointsEarned = results.reduce((sum, r) => sum + (r.score_points || 0), 0);
    const maxPoints = results.reduce((sum, r) => sum + (r.max_points || 0), 0);
    const score = maxPoints > 0 ? Math.round((pointsEarned / maxPoints) * 100) : 0;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
    const letterGrade = score >= 95 ? "A" : score >= 90 ? "A-" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";

    const categories = {};
    for (const r of results) {
      if (!categories[r.score_category]) categories[r.score_category] = { total: 0, passed: 0, points: 0, max: 0 };
      categories[r.score_category].total++;
      if (r.status === "pass") categories[r.score_category].passed++;
      categories[r.score_category].points += r.score_points || 0;
      categories[r.score_category].max += r.max_points || 0;
    }

    return Response.json({
      run_id: runId,
      total_tests: total,
      passed, failed, skipped,
      pass_rate: passRate,
      score,
      letter_grade: letterGrade,
      categories,
      results: results.map((r) => ({
        test_name: r.test_name,
        status: r.status,
        duration_ms: r.duration_ms,
        error_message: r.error_message,
        category: r.score_category,
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}