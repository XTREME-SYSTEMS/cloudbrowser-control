import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

export default async function (req) {
  const base44 = createClientFromRequest(req);
  try {
    const body = await req.json();
    const { job_id, signature, payload } = body;

    // Verify signature if provided
    // Look up webhooks with inbound capability
    const webhooks = await base44.asServiceRole.entities.Webhook.filter({ active: true });
    const inboundWebhook = webhooks.find((w) => w.secret && signature && signature === w.secret);

    if (!inboundWebhook && signature) {
      return Response.json({ error: "Invalid webhook signature" }, { status: 403 });
    }

    // Trigger the job
    if (!job_id) return Response.json({ error: "job_id required" }, { status: 400 });

    const job = await base44.asServiceRole.entities.Job.get(job_id);
    if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

    // Run the job
    const result = await base44.asServiceRole.functions.invoke("runJob", { job_id });

    return Response.json({ success: true, job_id, result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}