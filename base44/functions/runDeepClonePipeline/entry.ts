import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";

/**
 * DEEP Master Orchestrator — runDeepClonePipeline
 *
 * Executes the full 4-phase DEEP clone pipeline end-to-end:
 *   Phase 1: Acquisition  → cloneFullSite (capture DOM, HAR, screenshots)
 *   Phase 2: Compilation   → siteAudit + reconstructBackend (map endpoints, infer gaps)
 *   Phase 3: Validation     → visual + functional parity scoring with self-healing
 *   Phase 4: Egress         → provisionCloneDeployment (GitHub + Vercel)
 *
 * Self-healing loop: if parity < 100%, retries up to max_iterations (default 5).
 */

export default async function (req) {
  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { target_url, target_name, skip_deployment } = body;

    if (!target_url) return Response.json({ error: "target_url is required" }, { status: 400 });

    // ═══════════════════════════════════════════
    // PHASE 1: ACQUISITION — cloneFullSite
    // ═══════════════════════════════════════════
    const phase1 = await base44.functions.invoke("cloneFullSite", { target_url, target_name });
    const phase1Data = phase1.data || phase1;
    if (!phase1Data.ok) {
      return Response.json({ ok: false, error: "Phase 1 (Acquisition) failed: " + (phase1Data.error || "unknown"), phase: "acquisition" }, { status: 500 });
    }
    const projectId = phase1Data.project_id;

    // ═══════════════════════════════════════════
    // PHASE 2a: PROTOCOL TRACE ANALYSIS — siteAudit
    // ═══════════════════════════════════════════
    const phase2a = await base44.functions.invoke("siteAudit", { clone_project_id: projectId });
    const phase2aData = phase2a.data || phase2a;
    if (!phase2aData.ok) {
      await base44.entities.CloneProject.update(projectId, { status: "failed", error_message: "Phase 2a (siteAudit) failed: " + (phase2aData.error || "unknown") });
      return Response.json({ ok: false, error: "Phase 2a failed: " + (phase2aData.error || "unknown"), phase: "compilation", project_id: projectId }, { status: 500 });
    }

    // ═══════════════════════════════════════════
    // PHASE 2b: BACKEND SYNTHESIS — reconstructBackend
    // ═══════════════════════════════════════════
    const phase2b = await base44.functions.invoke("reconstructBackend", { clone_project_id: projectId });
    const phase2bData = phase2b.data || phase2b;
    if (!phase2bData.ok) {
      await base44.entities.CloneProject.update(projectId, { status: "failed", error_message: "Phase 2b (reconstructBackend) failed: " + (phase2bData.error || "unknown") });
      return Response.json({ ok: false, error: "Phase 2b failed: " + (phase2bData.error || "unknown"), phase: "compilation", project_id: projectId }, { status: 500 });
    }

    // Update project to validating
    await base44.entities.CloneProject.update(projectId, { status: "validating", phase: "validation" });

    // ═══════════════════════════════════════════
    // PHASE 3: VALIDATION — Self-healing loop
    // ═══════════════════════════════════════════
    let parityScore = 0;
    let visualScore = 0;
    let functionalScore = 0;
    let iteration = 0;
    const maxIterations = 5;
    let validationPassed = false;

    while (!validationPassed && iteration < maxIterations) {
      iteration++;
      await base44.entities.CloneProject.update(projectId, {
        inference_iterations: iteration,
      });

      // Visual validation: analyze desktop screenshot
      try {
        const project = await base44.entities.CloneProject.get(projectId);
        if (project.desktop_screenshot_url) {
          const visualResult = await base44.integrations.Core.InvokeLLM({
            prompt: "Analyze this screenshot of a cloned website. Score the visual completeness from 0 to 100 based on how complete and well-rendered the page appears (layout, content, styling). Return a score and brief notes.",
            file_urls: [project.desktop_screenshot_url],
            response_json_schema: {
              type: "object",
              properties: {
                visual_score: { type: "number" },
                notes: { type: "string" },
                issues: { type: "array", items: { type: "string" } },
              },
            },
          });
          visualScore = visualResult.visual_score || 80;

          await base44.entities.CloneValidationResult.create({
            clone_project_id: projectId,
            validation_category: "visual_dom",
            score: visualScore,
            max_score: 100,
            details: visualResult.notes || "Visual validation",
            failed_nodes: visualResult.issues || [],
            iteration,
            validated_at: new Date().toISOString(),
            screenshot_diff_url: project.desktop_screenshot_url,
          });
        }
      } catch {
        visualScore = 80;
      }

      // Functional validation: check endpoint coverage
      try {
        const project = await base44.entities.CloneProject.get(projectId);
        const endpointCount = project.endpoint_count || 0;
        const gapCount = project.gap_count || 0;
        const gaps = await base44.entities.CloneGap.filter({ clone_project_id: projectId });
        const unresolvedGaps = gaps.filter((g) => g.status === "identified" || g.status === "unresolved").length;
        const resolvedGaps = gaps.filter((g) => g.status === "inferred" || g.status === "resolved").length;
        functionalScore = gapCount > 0
          ? Math.round(((endpointCount + resolvedGaps) / (endpointCount + gapCount)) * 100)
          : 100;

        await base44.entities.CloneValidationResult.create({
          clone_project_id: projectId,
          validation_category: "endpoint_interactive",
          score: functionalScore,
          max_score: 100,
          details: `${endpointCount} endpoints captured, ${resolvedGaps} gaps resolved, ${unresolvedGaps} unresolved`,
          failed_nodes: unresolvedGaps > 0 ? [`${unresolvedGaps} unresolved gaps`] : [],
          iteration,
          validated_at: new Date().toISOString(),
        });
      } catch {
        functionalScore = 80;
      }

      // Viewport compliance
      try {
        const project = await base44.entities.CloneProject.get(projectId);
        const viewportScore = (project.desktop_screenshot_url && project.mobile_screenshot_url) ? 100 : 50;
        await base44.entities.CloneValidationResult.create({
          clone_project_id: projectId,
          validation_category: "viewport_compliance",
          score: viewportScore,
          max_score: 100,
          details: project.desktop_screenshot_url && project.mobile_screenshot_url
            ? "Both desktop and mobile viewports captured"
            : "Missing one or more viewport captures",
          failed_nodes: [],
          iteration,
          validated_at: new Date().toISOString(),
        });
      } catch {}

      // Compute parity: (Visual * 0.5) + (Functional * 0.5)
      parityScore = Math.round((visualScore * 0.5 + functionalScore * 0.5));

      await base44.entities.CloneProject.update(projectId, {
        parity_score: parityScore,
        visual_score: visualScore,
        functional_score: functionalScore,
      });

      if (parityScore >= 100) {
        validationPassed = true;
        break;
      }

      // Self-heal: re-run reconstructBackend to pick up any template changes
      if (iteration < maxIterations) {
        try {
          await base44.functions.invoke("reconstructBackend", { clone_project_id: projectId });
        } catch {}
      }
    }

    // ═══════════════════════════════════════════
    // PHASE 4: EGRESS — provisionCloneDeployment
    // ═══════════════════════════════════════════
    let deploymentResult = null;
    if (validationPassed && !skip_deployment) {
      try {
        const deploy = await base44.functions.invoke("provisionCloneDeployment", { clone_project_id: projectId });
        deploymentResult = deploy.data || deploy;
      } catch (err) {
        deploymentResult = { ok: false, error: err.message };
      }
    }

    // Final project update
    await base44.entities.CloneProject.update(projectId, {
      status: deploymentResult?.ok ? "deployed" : (validationPassed ? "validating" : "failed"),
      completed_at: new Date().toISOString(),
    });

    return Response.json({
      ok: true,
      project_id: projectId,
      pipeline: {
        phase1_acquisition: { ok: true, assets_captured: phase1Data.assets_captured, endpoints_discovered: phase1Data.endpoints_discovered },
        phase2a_audit: { ok: true, endpoints: phase2aData.endpoints_discovered, gaps: phase2aData.gaps_identified },
        phase2b_synthesis: { ok: true, stack_type: phase2bData.stack_type, routes: phase2bData.total_routes, gaps_resolved: phase2bData.gaps_resolved },
        phase3_validation: { ok: validationPassed, parity_score: parityScore, visual_score: visualScore, functional_score: functionalScore, iterations: iteration },
        phase4_egress: deploymentResult,
      },
      deployed_url: deploymentResult?.deployed_url || null,
      __v: DEPLOYMENT_VERSION,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}