import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

/**
 * Gap Intelligence Playground — Live Test Environment
 *
 * Runs Phase 1 (Acquisition) + Phase 2 (Gap Classification + Resolution)
 * WITHOUT deploying or validating. This lets you verify the gap intelligence
 * engine handles a target correctly before committing to a full clone.
 *
 * Input:  { target_url: string }
 * Output: { ok, project_id, gaps: [...], resolutions: [...], summary: {...} }
 */

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { target_url } = body;

    if (!target_url)
      return Response.json({ error: "target_url is required" }, { status: 400 });

    // ═══════════════════════════════════════════
    // STEP 1: ACQUISITION — capture the site (DOM, HAR, screenshots)
    // ═══════════════════════════════════════════
    const captureRes = await base44.functions.invoke("cloneFullSite", { target_url });
    const capture = captureRes.data || captureRes;
    if (!capture.ok) {
      return Response.json({
        ok: false,
        error: "Acquisition failed: " + (capture.error || "unknown"),
      }, { status: 500 });
    }

    const projectId = capture.project_id;

    // ═══════════════════════════════════════════
    // STEP 2: PROTOCOL TRACE ANALYSIS — audit the captured HAR
    // ═══════════════════════════════════════════
    let auditResult = null;
    try {
      const auditRes = await base44.functions.invoke("siteAudit", { clone_project_id: projectId });
      auditResult = auditRes.data || auditRes;
    } catch (e) {
      // Continue even if audit has partial failures
    }

    // ═══════════════════════════════════════════
    // STEP 3: GAP CLASSIFICATION — definitively classify all gaps
    // ═══════════════════════════════════════════
    let classifyResult = null;
    try {
      const classifyRes = await base44.functions.invoke("classifyGapsDefinitively", { clone_project_id: projectId });
      classifyResult = classifyRes.data || classifyRes;
    } catch (e) {
      // Continue even if classification has partial failures
    }

    // ═══════════════════════════════════════════
    // STEP 4: GAP RESOLUTION — resolve all gaps using multi-strategy engine
    // ═══════════════════════════════════════════
    let resolveResult = null;
    try {
      const resolveRes = await base44.functions.invoke("resolveAllGaps", { clone_project_id: projectId });
      resolveResult = resolveRes.data || resolveRes;
    } catch (e) {
      // Continue even if resolution has partial failures
    }

    // ═══════════════════════════════════════════
    // STEP 5: GATHER RESULTS — collect all gaps and resolutions
    // ═══════════════════════════════════════════
    const gaps = await base44.entities.CloneGap.filter({ clone_project_id: projectId });
    const resolutions = await base44.entities.GapResolution.filter({ clone_project_id: projectId });
    const assets = await base44.entities.CloneAsset.filter({ clone_project_id: projectId });

    // Categorize gaps by autonomy level
    const autonomyMap = {
      template: "fully_autonomous",
      seed_data: "fully_autonomous",
      scrape_similar: "semi_autonomous",
      infer_llm: "inference_engine",
    };

    const gapSummary = gaps.map((g) => {
      const resolution = resolutions.find((r) => r.clone_gap_id === g.id);
      const strategy = resolution?.strategy_used || g.resolution_strategy || "";
      return {
        id: g.id,
        gap_type: g.gap_type,
        description: g.description,
        inferred_endpoint: g.inferred_endpoint,
        inferred_method: g.inferred_method,
        status: g.status,
        confidence_score: g.confidence_score,
        definitive: g.definitive,
        template_matched: g.template_matched,
        resolution_strategy: strategy,
        autonomy_level: autonomyMap[strategy] || "unresolved",
        industry_detected: g.industry_detected,
        classification_evidence: g.classification_evidence || [],
      };
    });

    // Aggregate stats
    const byType = {};
    const byStrategy = {};
    const byAutonomy = { fully_autonomous: 0, semi_autonomous: 0, inference_engine: 0, unresolved: 0 };

    for (const g of gapSummary) {
      byType[g.gap_type] = (byType[g.gap_type] || 0) + 1;
      if (g.resolution_strategy) {
        byStrategy[g.resolution_strategy] = (byStrategy[g.resolution_strategy] || 0) + 1;
      }
      byAutonomy[g.autonomy_level]++;
    }

    const avgConfidence = gaps.length > 0
      ? Math.round(gaps.reduce((sum, g) => sum + (g.confidence_score || 0), 0) / gaps.length)
      : 0;

    // Update project status to indicate playground analysis is complete
    await base44.entities.CloneProject.update(projectId, {
      status: "compiling",
      phase: "compilation",
      gap_count: gaps.length,
    });

    return Response.json({
      ok: true,
      project_id: projectId,
      target_url,
      summary: {
        total_gaps: gaps.length,
        total_resolutions: resolutions.length,
        total_assets: assets.length,
        endpoints_discovered: auditResult?.endpoints_discovered || 0,
        avg_confidence: avgConfidence,
        by_type: byType,
        by_strategy: byStrategy,
        by_autonomy: byAutonomy,
        stack_type: auditResult?.stack_type || "Unknown",
      },
      gaps: gapSummary,
      resolutions: resolutions.map((r) => ({
        id: r.id,
        gap_type: r.gap_type,
        strategy_used: r.strategy_used,
        confidence_score: r.confidence_score,
        definitive: r.definitive,
        template_matched: r.template_matched,
        status: r.status,
        resolution_summary: r.resolution_summary,
      })),
      recommendation: byAutonomy.inference_engine > byAutonomy.fully_autonomous
        ? "This site relies heavily on LLM inference. Review the gaps before proceeding to full clone."
        : "This site is well-suited for autonomous cloning. Most gaps can be resolved deterministically.",
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}