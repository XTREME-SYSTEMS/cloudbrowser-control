import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

/**
 * Autonomous Swarm Orchestrator
 *
 * Called by the scheduled workflow every 5 minutes.
 * Requires NO human trigger or command — runs 24/7.
 *
 * Loop:
 * 1. Pick up pending SwarmTasks (max 5 per cycle to respect rate limits)
 * 2. For each task, execute the agent's work via runSkipTrace
 * 3. Update task status and results
 * 4. If no pending tasks, check for pending SkipTrace records and spawn tasks
 * 5. Return cycle summary
 */

const MAX_TASKS_PER_CYCLE = 5;

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    const cycleStart = Date.now();
    const cycleId = `swarm_cycle_${cycleStart}`;
    let tasksProcessed = 0;
    let tasksSucceeded = 0;
    let tasksFailed = 0;
    let tasksSpawned = 0;
    const agentStats: Record<string, { processed: number; succeeded: number; failed: number }> = {
      property_researcher: { processed: 0, succeeded: 0, failed: 0 },
      people_finder: { processed: 0, succeeded: 0, failed: 0 },
      data_enricher: { processed: 0, succeeded: 0, failed: 0 },
    };

    // Step 1: Pick up pending SwarmTasks, ordered by priority then oldest first
    const pendingTasks = await base44.asServiceRole.entities.SwarmTask.filter(
      { status: "pending" },
      "priority",
      MAX_TASKS_PER_CYCLE
    );

    if (pendingTasks.length === 0) {
      // Step 4: No pending tasks — check for pending SkipTrace records and spawn tasks
      const pendingTraces = await base44.asServiceRole.entities.SkipTrace.filter(
        { status: "pending" },
        "-created_date",
        5
      );

      if (pendingTraces.length > 0) {
        const newTasks: any[] = [];
        for (const trace of pendingTraces) {
          await base44.asServiceRole.entities.SkipTrace.update(trace.id, { status: "searching" });

          newTasks.push({
            agent_name: "property_researcher",
            task_type: "property_search",
            target_data: {
              property_address: trace.target_property_address || "",
              owner_name: trace.target_owner_name || "",
              phone: trace.target_phone || "",
              email: trace.target_email || "",
              company: trace.target_company || "",
            },
            status: "pending",
            priority: "normal",
            skip_trace_id: trace.id,
            batch_id: trace.batch_id || `auto_${trace.id}`,
            assigned_at: new Date().toISOString(),
          });
        }
        if (newTasks.length > 0) {
          await base44.asServiceRole.entities.SwarmTask.bulkCreate(newTasks);
          tasksSpawned = newTasks.length;
        }
      }

      return Response.json({
        status: "idle",
        cycle_id: cycleId,
        tasks_processed: 0,
        tasks_spawned: tasksSpawned,
        message: "No pending tasks. Scanned for new work.",
        duration_ms: Date.now() - cycleStart,
      });
    }

    // Step 2-3: Execute each pending task
    for (const task of pendingTasks) {
      tasksProcessed++;
      if (!agentStats[task.agent_name]) agentStats[task.agent_name] = { processed: 0, succeeded: 0, failed: 0 };
      agentStats[task.agent_name].processed++;

      try {
        await base44.asServiceRole.entities.SwarmTask.update(task.id, {
          status: "running",
          assigned_at: new Date().toISOString(),
        });

        const td = task.target_data || {};
        const traceRaw: any = await base44.functions.invoke("runSkipTraceFallback", {
          property_address: td.property_address || td.address || "",
          owner_name: td.owner_name || td.name || "",
          phone: td.phone || "",
          email: td.email || "",
          company: td.company || "",
          batch_id: task.batch_id,
        });
        const traceResponse = traceRaw?.data ?? traceRaw;

        if (isVerifiedTraceResult(traceResponse)) {
          await base44.asServiceRole.entities.SwarmTask.update(task.id, {
            status: "completed",
            result_data: traceResponse,
            result_summary: `Agent ${task.agent_name} completed ${task.task_type} with verified source evidence`,
            confidence_score: Number(traceResponse.confidence_score) || 0,
            completed_at: new Date().toISOString(),
            duration_ms: Date.now() - cycleStart,
          });
          tasksSucceeded++;
          agentStats[task.agent_name].succeeded++;
        } else {
          const failureMessage = "Research returned no verifiable source evidence; candidate data requires review and the task cannot be marked completed.";
          await base44.asServiceRole.entities.SwarmTask.update(task.id, {
            status: "failed",
            result_data: traceResponse,
            result_summary: "Unverified candidate data; human review required",
            confidence_score: 0,
            error_message: failureMessage,
            notes: failureMessage,
            completed_at: new Date().toISOString(),
            duration_ms: Date.now() - cycleStart,
          });
          try {
            await base44.asServiceRole.entities.HealingFlag.create({
              flag_type: "validation_failure",
              source_entity: "SwarmTask",
              source_id: task.id,
              source_title: `${task.agent_name} / ${task.task_type}`,
              error_message: failureMessage,
              retry_count: 0,
              max_retries: 3,
              status: "flagged",
              flagged_at: new Date().toISOString(),
              cycle_id: cycleId,
            });
          } catch (_flagErr) {
            // Preserve the task failure even if the optional flag cannot be written.
          }
          tasksFailed++;
          agentStats[task.agent_name].failed++;
        }
      } catch (err: any) {
        await base44.asServiceRole.entities.SwarmTask.update(task.id, {
          status: "failed",
          error_message: err.message || "Unknown error",
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - cycleStart,
        });

        // Create a HealingFlag so the audit → repair → validate pipeline can handle it
        try {
          await base44.asServiceRole.entities.HealingFlag.create({
            flag_type: "task_failure",
            source_entity: "SwarmTask",
            source_id: task.id,
            source_title: `${task.agent_name} / ${task.task_type}`,
            error_message: err.message || "Unknown error",
            retry_count: 0,
            max_retries: 3,
            status: "flagged",
            flagged_at: new Date().toISOString(),
            cycle_id: cycleId,
          });
        } catch (flagErr) {
          // Non-fatal — flag creation should not block the swarm
        }

        tasksFailed++;
        agentStats[task.agent_name].failed++;
      }
    }

    return Response.json({
      status: "executed",
      cycle_id: cycleId,
      tasks_processed: tasksProcessed,
      tasks_succeeded: tasksSucceeded,
      tasks_failed: tasksFailed,
      tasks_spawned: 0,
      agent_stats: agentStats,
      duration_ms: Date.now() - cycleStart,
      message: `Autonomous swarm cycle complete: ${tasksSucceeded}/${tasksProcessed} tasks succeeded`,
    });
  } catch (err: any) {
    console.error("runAutonomousSwarm error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

function isVerifiedTraceResult(result: any): boolean {
  if (result?.status !== "found" || result?.evidence_verified !== true || result?.verification_status !== "verified") return false;
  if (!Array.isArray(result?.evidence_records)) return false;
  return result.evidence_records.some((record: any) => {
    if (!record || record.status !== "verified" || typeof record.finding_id !== "string" || !record.finding_id.trim()) return false;
    if (typeof record.retrieved_at !== "string" || !Number.isFinite(Date.parse(record.retrieved_at))) return false;
    if (typeof record.content_hash !== "string" || !/^[a-f0-9]{64}$/i.test(record.content_hash)) return false;
    try {
      const url = new URL(record.source_url);
      return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname);
    } catch {
      return false;
    }
  });
}
