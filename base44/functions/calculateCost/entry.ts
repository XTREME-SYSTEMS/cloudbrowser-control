import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { calculateJobCost, getRates } from "../../shared/costCalculator.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { jobId, scheduleId } = body;

    if (jobId) {
      const result = await calculateJobCost(base44, jobId);
      return Response.json(result);
    }

    if (scheduleId) {
      // Calculate cost for all jobs from a schedule
      const jobs = await base44.entities.Job.filter({ schedule_id: scheduleId });
      let total = 0;
      for (const job of jobs) {
        try {
          const r = await calculateJobCost(base44, job.id);
          total += r.totalCost;
        } catch (e) {}
      }
      return Response.json({ totalCost: total, jobCount: jobs.length });
    }

    return Response.json({ error: "Provide jobId or scheduleId" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}