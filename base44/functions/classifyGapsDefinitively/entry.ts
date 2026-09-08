import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";
import {
  classifyAllTransactions,
  detectIndustry,
  getResolutionPlan,
  type GapType,
} from "../../shared/gapIntelligence.ts";

/**
 * DEEP Gap Intelligence — Definitive Classification
 *
 * Takes a clone project's HAR + DOM + route map and DEFINITIVELY classifies
 * every unclonable backend area using deterministic HTTP evidence rules.
 * No LLM guessing — every classification is backed by concrete evidence.
 *
 * Creates/updates CloneGap records with:
 *   - gap_type (definitively classified)
 *   - classification_evidence (the HTTP proof)
 *   - definitive flag (true = 100% certain)
 *   - industry_detected (for data seeding)
 *
 * Also creates pending GapResolution records for each gap.
 */

export default async function (req: Request) {
  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { clone_project_id } = body;
    if (!clone_project_id)
      return Response.json({ error: "clone_project_id is required" }, { status: 400 });

    // Load the CloneProject
    const project = await base44.entities.CloneProject.get(clone_project_id);
    if (!project)
      return Response.json({ error: "Clone project not found" }, { status: 404 });

    // Load captured assets
    const assets = await base44.entities.CloneAsset.filter({ clone_project_id });
    const harAsset = assets.find((a) => a.asset_type === "har");
    const domAsset = assets.find((a) => a.asset_type === "dom");

    if (!harAsset) {
      return Response.json({
        error: "No network trace found — run cloneFullSite first to capture HAR data",
      }, { status: 400 });
    }

    // Fetch HAR data
    const harResponse = await fetch(harAsset.file_url);
    const harData = await harResponse.json();
    const harEntries = (harData.entries || harData.log?.entries || []).map((e: any) => ({
      url: e.request?.url || e.url || "",
      method: e.request?.method || e.method || "GET",
      status: e.response?.status || e.status || 0,
      requestHeaders: e.request?.headers || e.requestHeaders || {},
      responseHeaders: e.response?.headers || e.responseHeaders || {},
      responseBody: e.response?.content?.text || e.responseBody || "",
      postData: e.request?.postData?.text || e.postData || "",
    }));

    // Fetch DOM content for industry detection
    let htmlContent = "";
    if (domAsset) {
      const domResponse = await fetch(domAsset.file_url);
      htmlContent = await domResponse.text();
    }

    // ═══════════════════════════════════════════
    // 1. DEFINITIVE CLASSIFICATION
    // ═══════════════════════════════════════════
    const classifications = classifyAllTransactions(harEntries);

    // Detect industry for data seeding
    const industry = detectIndustry(project.target_url, htmlContent, harEntries);

    // ═══════════════════════════════════════════
    // 2. CREATE/UPDATE CLONE GAPS
    // ═══════════════════════════════════════════
    const existingGaps = await base44.entities.CloneGap.filter({ clone_project_id });

    // Build a map of existing gaps by endpoint
    const existingByEndpoint = new Map();
    for (const gap of existingGaps) {
      const key = `${gap.inferred_method} ${gap.inferred_endpoint}`;
      existingByEndpoint.set(key, gap);
    }

    const gapRecords = [];
    let definitiveCount = 0;
    const gapTypeCounts: Record<string, number> = {};

    for (const [endpointKey, classification] of classifications) {
      const [method, ...pathParts] = endpointKey.split(" ");
      const endpoint = pathParts.join(" ");

      // Check if gap already exists
      const existing = existingByEndpoint.get(endpointKey);

      const gapData = {
        clone_project_id,
        gap_type: classification.gap_type,
        description: `Unclonable ${classification.gap_type} endpoint: ${method} ${endpoint}`,
        inferred_endpoint: endpoint,
        inferred_method: method,
        classification_evidence: classification.evidence,
        definitive: classification.definitive,
        industry_detected: industry,
        status: "identified",
        confidence_score: classification.confidence,
      };

      if (existing) {
        // Update existing gap with definitive classification
        await base44.entities.CloneGap.update(existing.id, gapData);
        gapRecords.push({ id: existing.id, ...gapData });
      } else {
        // Create new gap
        const created = await base44.entities.CloneGap.create(gapData);
        gapRecords.push(created);
      }

      if (classification.definitive) definitiveCount++;
      gapTypeCounts[classification.gap_type] = (gapTypeCounts[classification.gap_type] || 0) + 1;
    }

    // ═══════════════════════════════════════════
    // 3. CREATE PENDING GAP RESOLUTIONS
    // ═══════════════════════════════════════════
    const resolutionRecords = [];
    for (const gap of gapRecords) {
      // Check if resolution already exists
      const existingRes = await base44.entities.GapResolution.filter({
        clone_project_id,
        clone_gap_id: gap.id,
      });

      if (existingRes.length === 0) {
        const plan = getResolutionPlan(gap.gap_type as GapType);
        const resolution = await base44.entities.GapResolution.create({
          clone_project_id,
          clone_gap_id: gap.id,
          gap_type: gap.gap_type,
          strategy_used: plan.strategies[0],
          strategies_attempted: [],
          classification_evidence: gap.classification_evidence,
          definitive: gap.definitive,
          confidence_score: 0,
          industry_detected: industry,
          status: "pending",
        });

        // Link resolution to gap
        await base44.entities.CloneGap.update(gap.id, {
          resolution_id: resolution.id,
        });

        resolutionRecords.push(resolution);
      } else {
        resolutionRecords.push(existingRes[0]);
      }
    }

    // ═══════════════════════════════════════════
    // 4. UPDATE CLONE PROJECT
    // ═══════════════════════════════════════════
    await base44.entities.CloneProject.update(clone_project_id, {
      gap_count: gapRecords.length,
    });

    return Response.json({
      ok: true,
      clone_project_id,
      industry_detected: industry,
      total_gaps: gapRecords.length,
      definitive_gaps: definitiveCount,
      gap_type_counts: gapTypeCounts,
      resolutions_created: resolutionRecords.length,
      gaps: gapRecords.map((g) => ({
        id: g.id,
        gap_type: g.gap_type,
        endpoint: g.inferred_endpoint,
        method: g.inferred_method,
        definitive: g.definitive,
        confidence: g.confidence_score,
        evidence: g.classification_evidence,
      })),
      __v: DEPLOYMENT_VERSION,
    });
  } catch (error) {
    console.error("classifyGapsDefinitively error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}