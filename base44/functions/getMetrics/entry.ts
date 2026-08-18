import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

export default async function (req) {
  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const jobs = await base44.entities.Job.list("-created_date", 200);
    const completed = jobs.filter((j) => j.status === "completed");
    const failed = jobs.filter((j) => j.status === "failed");

    // Durations
    const durations = completed
      .filter((j) => j.started_at && j.completed_at)
      .map((j) => new Date(j.completed_at).getTime() - new Date(j.started_at).getTime())
      .sort((a, b) => a - b);

    const percentile = (arr, p) => {
      if (!arr.length) return 0;
      const idx = Math.ceil((p / 100) * arr.length) - 1;
      return arr[Math.max(0, idx)];
    };

    const p50 = percentile(durations, 50);
    const p90 = percentile(durations, 90);
    const p99 = percentile(durations, 99);

    // Throughput (jobs/hour in last 24h)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentJobs = jobs.filter((j) => new Date(j.created_date).getTime() > oneDayAgo);
    const throughput = recentJobs.length;

    // Error rate
    const errorRate = jobs.length > 0 ? Math.round((failed.length / jobs.length) * 100) : 0;

    // Success rate
    const successRate = jobs.length > 0 ? Math.round((completed.length / jobs.length) * 100) : 0;

    return Response.json({
      total_jobs: jobs.length,
      completed: completed.length,
      failed: failed.length,
      p50_duration_ms: p50,
      p90_duration_ms: p90,
      p99_duration_ms: p99,
      throughput_24h: throughput,
      error_rate: errorRate,
      success_rate: successRate,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}