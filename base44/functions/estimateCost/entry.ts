import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { estimateJobCost, getRates } from "../../shared/costCalculator.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { steps, sessionConfig } = body;

    const rates = await getRates(base44);
    const result = estimateJobCost(steps || [], sessionConfig || {}, rates);

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}