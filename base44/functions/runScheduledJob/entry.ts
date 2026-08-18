import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    // Service-role: called by workflow, no user context
    const body = await req.json();
    const { scheduleId } = body;

    const schedule = await base44.asServiceRole.entities.Schedule.get(scheduleId);
    if (!schedule) return Response.json({ error: "Schedule not found" }, { status: 404 });
    if (!schedule.enabled) return Response.json({ ok: false, reason: "Schedule disabled" });

    const template = schedule.job_template || {};

    // Create job from template
    const job = await base44.asServiceRole.entities.Job.create({
      name: template.name || `Scheduled: ${schedule.name}`,
      status: "queued",
      start_url: template.start_url || "",
      schedule_id: scheduleId,
      max_retries: template.max_retries || 3,
      session_config: template.session_config || {},
      tags: ["scheduled"],
      started_at: new Date().toISOString(),
    });

    // Create steps from template
    const steps = template.steps || [];
    if (steps.length > 0) {
      await base44.asServiceRole.entities.Step.bulkCreate(
        steps.map((s, i) => ({
          job_id: job.id,
          order: i,
          name: s.name || "",
          action_type: s.action_type,
          selector: s.selector || "",
          value: s.value || "",
          options: s.options || {},
        }))
      );
    }

    // Invoke runJob
    await base44.asServiceRole.functions.invoke("runJob", { jobId: job.id });

    // Update schedule
    await base44.asServiceRole.entities.Schedule.update(scheduleId, {
      last_run: new Date().toISOString(),
      run_count: (schedule.run_count || 0) + 1,
    });

    return Response.json({ ok: true, jobId: job.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}