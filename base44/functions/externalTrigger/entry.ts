import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

/**
 * External Trigger Endpoint
 *
 * This function BYPASSES the Base44 scheduled workflow system entirely.
 * It can be called by ANY external cron service (cron-job.org, UptimeRobot,
 * GitHub Actions, Vercel Cron, etc.) to keep the system running 24/7
 * even when integration credits are exhausted and scheduled automations
 * are blocked.
 *
 * Usage:
 *   GET /functions/externalTrigger?key=<ENGINE_API_KEY>&target=all
 *   GET /functions/externalTrigger?key=<ENGINE_API_KEY>&target=swarm
 *   GET /functions/externalTrigger?key=<ENGINE_API_KEY>&target=healing
 *
 * The function validates the API key against the ENGINE_API_KEY secret,
 * then invokes the autonomous swarm and/or self-healing loop using
 * asServiceRole (no user auth needed).
 *
 * Set up a free external cron:
 *   - cron-job.org: hit this URL every 5 minutes
 *   - UptimeRobot: hit this URL every 5 minutes
 *   - GitHub Actions: cron schedule hitting this URL
 *
 * This ensures the system ALWAYS continues to operate.
 */

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // Validate API key
    const url = new URL(req.url);
    const apiKey = req.headers.get("X-API-Key") || url.searchParams.get("key");
    const expectedKey = process.env.ENGINE_API_KEY;

    if (!expectedKey) {
      return Response.json({ error: "ENGINE_API_KEY secret not configured" }, { status: 500 });
    }
    if (!apiKey || apiKey !== expectedKey) {
      return Response.json({ error: "Unauthorized — invalid API key" }, { status: 401 });
    }

    const target = url.searchParams.get("target") || "all";
    const results: any = {};
    const timestamp = new Date().toISOString();

    // Trigger the autonomous swarm (processes pending skip trace tasks)
    if (target === "all" || target === "swarm") {
      try {
        const swarmRaw: any = await base44.functions.invoke("runAutonomousSwarm", {});
        results.swarm = swarmRaw?.data ?? swarmRaw;
      } catch (e: any) {
        results.swarm_error = e.message;
      }
    }

    // Trigger the self-healing loop (checks health, retries, flags, repairs)
    if (target === "all" || target === "healing") {
      try {
        const healingRaw: any = await base44.functions.invoke("runSelfHealingLoop", {});
        results.healing = healingRaw?.data ?? healingRaw;
      } catch (e: any) {
        results.healing_error = e.message;
      }
    }

    return Response.json({
      status: "triggered",
      target,
      timestamp,
      results,
    });
  } catch (err: any) {
    console.error("externalTrigger error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}