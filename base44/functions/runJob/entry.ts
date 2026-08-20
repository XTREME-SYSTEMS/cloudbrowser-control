import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { executeJob, JobRunnerError } from "../../shared/jobRunner.ts";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";

export default async function (req) {
  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ error: "Authentication required", __v: DEPLOYMENT_VERSION }, { status: 401 });
    }

    const body = await req.json();
    const { jobId, idempotency_key } = body || {};
    if (!jobId) return Response.json({ error: "jobId required", __v: DEPLOYMENT_VERSION }, { status: 400 });

    const job = await base44.asServiceRole.entities.Job.get(jobId);
    if (!job) return Response.json({ error: "Job not found", __v: DEPLOYMENT_VERSION }, { status: 404 });

    const isAdmin = user.role === "admin";
    if (!isAdmin && job.created_by_id !== user.id) {
      return Response.json({ error: "Forbidden", __v: DEPLOYMENT_VERSION }, { status: 403 });
    }
    if (!isAdmin && !job.project_id) {
      return Response.json({ error: "Project-scoped Job required", __v: DEPLOYMENT_VERSION }, { status: 403 });
    }

    const result = await executeJob(base44, {
      jobId,
      authorizedProjectId: job.project_id || null,
      actor: user,
      idempotencyKey: idempotency_key || `job:${jobId}`,
      allowPlatformJob: isAdmin && !job.project_id,
    });

    return Response.json(result);
  } catch (error) {
    const status = error instanceof JobRunnerError ? error.status : 500;
    return Response.json({
      error: error.message,
      details: error instanceof JobRunnerError ? error.details : undefined,
      __v: DEPLOYMENT_VERSION,
    }, { status });
  }
}
