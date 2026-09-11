import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * Batch Skip Trace Orchestrator
 *
 * Accepts a list of property inputs, creates a batch, assigns each to the
 * appropriate swarm agent (Property Researcher → People Finder → Data Enricher),
 * and runs the full skip trace pipeline for each.
 *
 * Each property gets a SwarmTask per agent, all linked by batch_id.
 */

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { targets, batch_id } = body as { targets: any[]; batch_id?: string };

    if (!targets || !Array.isArray(targets) || targets.length === 0) {
      return Response.json({ error: "targets array is required" }, { status: 400 });
    }

    const batchId = batch_id || `batch_${Date.now()}`;
    const startTime = Date.now();

    // Create SwarmTask records for each target × agent
    const tasks: any[] = [];
    for (const target of targets) {
      // Property Researcher task (always first)
      tasks.push({
        agent_name: "property_researcher",
        task_type: "property_search",
        target_data: target,
        status: "pending",
        priority: target.priority || "normal",
        batch_id: batchId,
        assigned_at: new Date().toISOString(),
      });

      // People Finder task (runs after property research identifies owner)
      tasks.push({
        agent_name: "people_finder",
        task_type: "people_search",
        target_data: target,
        status: "pending",
        priority: target.priority || "normal",
        batch_id: batchId,
        assigned_at: new Date().toISOString(),
      });

      // Data Enricher task (runs last to cross-reference and deduplicate)
      tasks.push({
        agent_name: "data_enricher",
        task_type: "data_enrichment",
        target_data: target,
        status: "pending",
        priority: target.priority || "normal",
        batch_id: batchId,
        assigned_at: new Date().toISOString(),
      });
    }

    const createdTasks = await base44.entities.SwarmTask.bulkCreate(tasks);

    // Run skip trace for each target (sequentially to respect rate limits)
    const results: any[] = [];
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      try {
        // Mark property_researcher task as running
        const propTask = createdTasks[i * 3];
        await base44.entities.SwarmTask.update(propTask.id, { status: "running" });

        // Invoke the existing skip trace engine
        const traceResponse: any = await base44.functions.invoke("runSkipTrace", {
          property_address: target.property_address || "",
          owner_name: target.owner_name || "",
          phone: target.phone || "",
          email: target.email || "",
          company: target.company || "",
          batch_id: batchId,
        });

        const traceData = traceResponse.data || traceResponse;

        // Update property_researcher task with results
        await base44.entities.SwarmTask.update(propTask.id, {
          status: "completed",
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          result_data: { owner_name: traceData.found_owner_name, property_data: traceData },
          result_summary: traceData.found_owner_name
            ? `Identified owner: ${traceData.found_owner_name}`
            : "Owner not found in property records",
          confidence_score: traceData.confidence_score || 0,
          skip_trace_id: traceData.skip_trace_id,
        });

        // Update people_finder task
        const peopleTask = createdTasks[i * 3 + 1];
        await base44.entities.SwarmTask.update(peopleTask.id, {
          status: "completed",
          completed_at: new Date().toISOString(),
          result_data: {
            phone_numbers: traceData.phone_numbers || [],
            emails: traceData.emails || [],
            addresses: traceData.addresses || [],
          },
          result_summary: `${(traceData.phone_numbers || []).length} phones, ${(traceData.emails || []).length} emails found`,
          confidence_score: traceData.confidence_score || 0,
          skip_trace_id: traceData.skip_trace_id,
        });

        // Update data_enricher task
        const enrichTask = createdTasks[i * 3 + 2];
        await base44.entities.SwarmTask.update(enrichTask.id, {
          status: "completed",
          completed_at: new Date().toISOString(),
          result_data: {
            social_profiles: traceData.social_profiles || [],
            relatives: traceData.relatives || [],
            sources: traceData.sources || [],
            methods: traceData.methods || [],
          },
          result_summary: `${(traceData.social_profiles || []).length} social profiles, ${(traceData.relatives || []).length} relatives, ${(traceData.sources || []).length} sources checked`,
          confidence_score: traceData.confidence_score || 0,
          skip_trace_id: traceData.skip_trace_id,
        });

        results.push({
          target: target.property_address || target.owner_name || target.phone || target.email,
          status: traceData.status || (traceData.error ? "failed" : "found"),
          owner_name: traceData.found_owner_name || "",
          confidence: traceData.confidence_score || 0,
          skip_trace_id: traceData.skip_trace_id,
          error: traceData.error,
        });
      } catch (err: any) {
        // Mark all 3 tasks for this target as failed
        for (let j = 0; j < 3; j++) {
          const task = createdTasks[i * 3 + j];
          if (task) {
            await base44.entities.SwarmTask.update(task.id, {
              status: "failed",
              completed_at: new Date().toISOString(),
              error_message: err.message,
            });
          }
        }
        results.push({
          target: target.property_address || target.owner_name || target.phone || target.email,
          status: "failed",
          error: err.message,
        });
      }
    }

    const totalDuration = Date.now() - startTime;
    const found = results.filter((r) => r.status === "found").length;
    const partial = results.filter((r) => r.status === "partial").length;
    const failed = results.filter((r) => r.status === "failed").length;

    return Response.json({
      ok: true,
      batch_id: batchId,
      total: targets.length,
      found,
      partial,
      failed,
      duration_ms: totalDuration,
      results,
    });
  } catch (error: any) {
    console.error("Batch skip trace error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}