import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Master Dream Factory Cycle: The autonomous loop that runs the entire
// discover → architect → build → validate → market → sell pipeline.
// Designed to run while the operator sleeps. Self-healing on failure.

export default async function(req: any) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

  const sr = base44.asServiceRole.entities;
  const { max_ideas = 3, auto_architect = true, auto_market = true, niche } = req.body || {};
  const cycleId = `cycle_${Date.now()}`;
  const stages: any[] = [];

  try {
    // Ensure DreamFactory record exists
    let factories = await sr.DreamFactory.list();
    let factory: any;
    if (factories.length === 0) {
      factory = await sr.DreamFactory.create({
        factory_name: "Xtreme Dream Factory",
        status: "initializing",
        operating_mode: "full_cycle",
        sleep_cycle_active: true,
        last_sleep_cycle_at: new Date().toISOString()
      });
    } else {
      factory = factories[0];
      await sr.DreamFactory.update(factory.id, {
        operating_mode: "full_cycle",
        sleep_cycle_active: true,
        last_sleep_cycle_at: new Date().toISOString(),
        status: "active"
      });
    }

    // STAGE 1: DISCOVER
    stages.push({ stage: "discover", status: "in_progress", started_at: new Date().toISOString() });
    const discoverRes: any = await base44.functions.invoke("generateProductIdeas", { max_ideas, niche });
    const ideas = discoverRes?.data?.ideas || [];
    stages[0].status = "completed";
    stages[0].ideas_found = ideas.length;

    // STAGE 2: ARCHITECT
    if (auto_architect && ideas.length > 0) {
      stages.push({ stage: "architect", status: "in_progress", started_at: new Date().toISOString() });
      const archResults = [];
      for (const idea of ideas.slice(0, Math.min(2, ideas.length))) {
        try {
          const archRes: any = await base44.functions.invoke("architectProductIdea", { idea_id: idea.idea_id });
          archResults.push({ idea_id: idea.idea_id, title: idea.title, architecture: archRes?.data?.architecture ? "generated" : "failed" });
        } catch (e: any) {
          archResults.push({ idea_id: idea.idea_id, error: e.message });
        }
      }
      stages[1].status = "completed";
      stages[1].architected = archResults.length;
    }

    // STAGE 3: MARKET
    if (auto_market && ideas.length > 0) {
      stages.push({ stage: "market", status: "in_progress", started_at: new Date().toISOString() });
      const marketResults = [];
      for (const idea of ideas.slice(0, Math.min(1, ideas.length))) {
        try {
          const mktRes: any = await base44.functions.invoke("runMarketingEngine", { product_idea_id: idea.idea_id });
          marketResults.push({ idea_id: idea.idea_id, campaign_id: mktRes?.data?.campaign_id, content_created: mktRes?.data?.content_assets_created || 0 });
        } catch (e: any) {
          marketResults.push({ idea_id: idea.idea_id, error: e.message });
        }
      }
      stages[stages.length - 1].status = "completed";
      stages[stages.length - 1].campaigns_created = marketResults.length;
    }

    // STAGE 4: VALIDATE
    stages.push({ stage: "validate", status: "in_progress", started_at: new Date().toISOString() });
    const scoreRes: any = await base44.functions.invoke("runComprehensiveScore", { run_tests: false });
    const verified100 = scoreRes?.data?.verified_100 || {};
    stages[stages.length - 1].status = "completed";
    stages[stages.length - 1].verified_100_state = verified100.state || "unknown";

    // Update DreamFactory
    factories = await sr.DreamFactory.list();
    if (factories.length > 0) {
      await sr.DreamFactory.update(factories[0].id, {
        operating_mode: "sleeping",
        sleep_cycle_active: false,
        health_state: verified100.state === "VERIFIED_100" ? "healthy" : "degraded",
        last_sleep_cycle_at: new Date().toISOString()
      });
    }

    return Response.json({
      status: "success",
      cycle_id: cycleId,
      stages,
      summary: {
        ideas_discovered: ideas.length,
        ideas_architected: auto_architect ? Math.min(2, ideas.length) : 0,
        campaigns_created: auto_market ? Math.min(1, ideas.length) : 0,
        verified_100_state: verified100.state,
        blockers: verified100.blockers || []
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("runDreamFactoryCycle error:", error);
    const factories = await sr.DreamFactory.list();
    if (factories.length > 0) {
      await sr.DreamFactory.update(factories[0].id, {
        sleep_cycle_active: false, status: "active", health_state: "degraded"
      });
    }
    return Response.json({ status: "error", cycle_id: cycleId, error: error.message, stages }, { status: 500 });
  }
}