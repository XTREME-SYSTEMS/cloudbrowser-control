import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";

// Processes pending BrainCommand records — executes them by creating jobs, seeds, or running cycles.
export default async function (req) {
  const base44 = createClientFromRequest(req);
  const startedAt = Date.now();
  const stats = { processed: 0, executed: 0, failed: 0, skipped: 0 };

  const pending = await base44.asServiceRole.entities.BrainCommand.filter({
    status: "pending",
  }, "priority", 20).catch(() => []);

  if (!pending || pending.length === 0) {
    return Response.json({ ok: true, message: "No pending commands", stats, duration_ms: Date.now() - startedAt, __v: DEPLOYMENT_VERSION });
  }

  for (const cmd of pending) {
    stats.processed++;
    const result = { command_id: cmd.id };
    let summary = "";
    let errorMsg = null;

    try {
      // Mark processing
      await base44.asServiceRole.entities.BrainCommand.update(cmd.id, { status: "processing" });

      switch (cmd.command_type) {
        case "create_job": {
          const p = cmd.payload || {};
          const job = await base44.asServiceRole.entities.Job.create({
            name: p.name || `Brain: ${p.url || "scrape job"}`,
            status: "queued",
            start_url: p.url,
            priority: p.priority || cmd.priority || 5,
            session_config: p.session_config || {},
            shadow_mode: p.shadow_mode !== false,
            tags: ["brain-command", cmd.brain_agent || "brain"],
          });
          result.job_id = job.id;
          summary = `Created job '${job.name}' for ${p.url || "N/A"}`;
          break;
        }
        case "scrape_url": {
          const p = cmd.payload || {};
          const job = await base44.asServiceRole.entities.Job.create({
            name: `Brain scrape: ${p.url}`,
            status: "queued",
            start_url: p.url,
            priority: cmd.priority || 5,
            shadow_mode: p.shadow_mode !== false,
            tags: ["brain-command", "scrape", cmd.brain_agent || "brain"],
          });
          result.job_id = job.id;
          summary = `Queued scrape for ${p.url}`;
          break;
        }
        case "add_seed": {
          const p = cmd.payload || {};
          const seed = await base44.asServiceRole.entities.IntelligenceSeed.create({
            source_type: p.source_type || "researched_topic",
            title: p.title || "Brain seed",
            url: p.url,
            description: p.description || "",
            intelligence_category: p.category || "elite_research",
            priority: p.priority || 5,
            status: "pending",
            tags: ["brain-command", cmd.brain_agent || "brain"],
          });
          result.seed_id = seed.id;
          summary = `Added seed '${seed.title}'`;
          break;
        }
        case "run_cycle": {
          await base44.asServiceRole.functions.invoke("runIntelligenceCycle", {});
          summary = "Triggered full intelligence cycle";
          break;
        }
        case "run_monetization": {
          await base44.asServiceRole.functions.invoke("runDataMonetizationCycle", {});
          summary = "Triggered monetization cycle";
          break;
        }
        case "follow_money": {
          await base44.asServiceRole.functions.invoke("followTheMoney", {});
          summary = "Triggered Follow the Money";
          break;
        }
        case "update_strategy": {
          const p = cmd.payload || {};
          await base44.asServiceRole.entities.VisionCortexReflection.create({
            reflection_type: "strategy_refinement",
            title: `Brain strategy update: ${p.title || "untitled"}`,
            observation: p.observation || "",
            insight: p.insight || p.strategy_text || "",
            action_taken: "Received from Brain (V-1)",
            confidence: p.confidence || 70,
            reflection_cycle: p.cycle || Date.now(),
          });
          summary = "Stored strategy as reflection";
          break;
        }
        case "custom": {
          summary = "Custom command acknowledged (no auto-execution)";
          result.note = "Custom commands require manual review";
          break;
        }
        default:
          stats.skipped++;
          summary = `Unknown command type: ${cmd.command_type}`;
      }

      await base44.asServiceRole.entities.BrainCommand.update(cmd.id, {
        status: errorMsg ? "failed" : "executed",
        result,
        result_summary: summary,
        error_message: errorMsg,
        executed_at: new Date().toISOString(),
      });
      if (errorMsg) stats.failed++;
      else stats.executed++;
    } catch (e) {
      errorMsg = e.message;
      stats.failed++;
      await base44.asServiceRole.entities.BrainCommand.update(cmd.id, {
        status: "failed",
        result_summary: `Error: ${e.message}`,
        error_message: e.message,
        executed_at: new Date().toISOString(),
      }).catch(() => {});
    }
  }

  return Response.json({
    ok: stats.failed === 0,
    stats,
    duration_ms: Date.now() - startedAt,
    __v: DEPLOYMENT_VERSION,
  }, { status: 200 });
}