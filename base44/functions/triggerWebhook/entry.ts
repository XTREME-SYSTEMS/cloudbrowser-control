import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { dispatchWebhooks } from "../../shared/webhookDispatcher.ts";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";

export default async function (req) {
  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized", __v: DEPLOYMENT_VERSION }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Admin role required", __v: DEPLOYMENT_VERSION }, { status: 403 });

    const body = await req.json();
    const { event, payload, project_id } = body || {};
    if (!event) return Response.json({ error: "event required", __v: DEPLOYMENT_VERSION }, { status: 400 });
    const projectId = project_id || payload?.project_id || null;
    if (event.startsWith("job.") && !projectId) return Response.json({ error: "Project-scoped job webhook event required", __v: DEPLOYMENT_VERSION }, { status: 403 });

    const result = await dispatchWebhooks(base44, { event, payload, projectId });
    return Response.json({ event, ...result, __v: DEPLOYMENT_VERSION });
  } catch (error) {
    return Response.json({ error: error.message, __v: DEPLOYMENT_VERSION }, { status: 500 });
  }
}
