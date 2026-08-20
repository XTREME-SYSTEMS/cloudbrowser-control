import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { executeJob, JobRunnerError } from "../../shared/jobRunner.ts";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { scheduleId } = body;

    const schedule = await base44.asServiceRole.entities.Schedule.get(scheduleId);
    if (!schedule) return Response.json({ error: "Schedule not found" }, { status: 404 });
    if (!schedule.enabled) return Response.json({ ok: false, reason: "Schedule disabled" });

    const template = schedule.job_template || {};
    const projectId = template.project_id || template.projectId || null;
    if (!projectId) {
      return Response.json({ error: "Scheduled job template must include project_id" }, { status: 400 });
    }

    const job = await base44.asServiceRole.entities.Job.create({
      name: template.name || `Scheduled: ${schedule.name}`,
      status: "queued",
      start_url: template.start_url || "",
      schedule_id: scheduleId,
      max_retries: template.max_retries || 3,
      session_config: template.session_config || {},
      tags: ["scheduled"],
      project_id: projectId,
    });

    const steps = template.steps || [];
    if (steps.length > 0) {
      await base44.asServiceRole.entities.Step.bulkCreate(steps.map((s, i) => ({
        job_id: job.id,
        order: i,
        name: s.name || "",
        action_type: s.action_type,
        selector: s.selector || "",
        value: s.value || "",
        options: s.options || {},
      })));
    }

    const result = await executeJob(base44, {
      jobId: job.id,
      authorizedProjectId: projectId,
      actor: { id: `schedule:${scheduleId}`, full_name: schedule.name || "Schedule", role: "schedule" },
      idempotencyKey: `schedule:${scheduleId}:job:${job.id}`,
    });

    await base44.asServiceRole.entities.Schedule.update(scheduleId, {
      last_run: new Date().toISOString(),
      run_count: (schedule.run_count || 0) + 1,
    });

    return Response.json({ ok: result.ok, jobId: job.id, result });
  } catch (error) {
    const status = error instanceof JobRunnerError ? error.status : 500;
    return Response.json({ error: error.message }, { status });
  }
}
