import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { engineFetch, isEngineConfigured } from "../../shared/engineClient.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (!isEngineConfigured()) {
      return Response.json({ ok: false, configured: false, error: "Browser engine not configured" }, { status: 200 });
    }

    try {
      const health = await engineFetch("/health");
      return Response.json({ ok: true, configured: true, ...health });
    } catch (err) {
      return Response.json({ ok: false, configured: true, error: err.message }, { status: 200 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}