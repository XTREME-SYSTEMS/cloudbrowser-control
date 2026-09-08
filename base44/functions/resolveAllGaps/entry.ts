import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";
import { getResolutionPlan, generateGapCode, type GapType } from "../../shared/gapIntelligence.ts";
import { findClosestFunctionalMatch } from "../../shared/cloneTemplates.ts";

/**
 * DEEP Gap Intelligence — Resolve All Gaps (Orchestrator)
 *
 * Orchestrates the resolution of ALL gaps for a clone project.
 * For each gap, calls the appropriate resolution strategy in order:
 *   1. seed_data → 2. scrape_similar → 3. template → 4. infer_llm
 *
 * This is the main entry point for the "intelligence system that eliminates
 * ambiguity" — every unclonable area gets a pre-planned deep system.
 *
 * Processes gaps in batches to stay within the 60s function timeout.
 * A scheduled workflow re-invokes this to continue processing.
 */

export default async function (req: Request) {
  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { clone_project_id, batch_limit = 5 } = body;
    if (!clone_project_id)
      return Response.json({ error: "clone_project_id is required" }, { status: 400 });

    // Load all pending/unresolved gaps for this project
    const gaps = await base44.entities.CloneGap.filter({ clone_project_id });

    // Filter to gaps that need resolution
    const pendingGaps = gaps.filter(
      (g: any) => g.status === "identified" || g.status === "classifying" || g.status === "unresolved"
    );

    // Take a batch
    const batch = pendingGaps.slice(0, batch_limit);

    if (batch.length === 0) {
      // All gaps resolved — check final status
      const allResolved = gaps.every((g: any) => g.status === "resolved");
      const failedCount = gaps.filter((g: any) => g.status === "unresolved").length;

      return Response.json({
        ok: true,
        clone_project_id,
        status: "complete",
        total_gaps: gaps.length,
        resolved: gaps.filter((g: any) => g.status === "resolved").length,
        failed: failedCount,
        all_resolved: allResolved,
        __v: DEPLOYMENT_VERSION,
      });
    }

    // Load the clone project for context
    const project = await base44.entities.CloneProject.get(clone_project_id);

    const results = [];
    let resolvedCount = 0;
    let failedCount = 0;

    // ═══════════════════════════════════════════
    // PROCESS EACH GAP IN THE BATCH
    // ═══════════════════════════════════════════
    for (const gap of batch) {
      try {
        // Mark as resolving
        await base44.entities.CloneGap.update(gap.id, { status: "classifying" });

        // Load or create resolution record
        let resolution;
        if (gap.resolution_id) {
          const resolutions = await base44.entities.GapResolution.filter({ id: gap.resolution_id });
          resolution = resolutions[0];
        }
        if (!resolution) {
          const plan = getResolutionPlan(gap.gap_type as GapType);
          resolution = await base44.entities.GapResolution.create({
            clone_project_id,
            clone_gap_id: gap.id,
            gap_type: gap.gap_type,
            strategy_used: plan.strategies[0],
            strategies_attempted: [],
            classification_evidence: gap.classification_evidence || [],
            definitive: gap.definitive,
            confidence_score: 0,
            industry_detected: gap.industry_detected,
            status: "resolving",
          });
          await base44.entities.CloneGap.update(gap.id, { resolution_id: resolution.id });
        }

        const plan = getResolutionPlan(gap.gap_type as GapType);
        const strategiesAttempted: string[] = [];
        let resolved = false;
        let finalCode = "";
        let seedData: Record<string, any[]> | null = null;
        let similarSystems: any[] = [];
        let templateMatched = "";
        let llmInference = "";
        let strategyUsed = "";
        let confidence = 0;
        let resolutionSummary = "";

        // Execute strategies in order
        for (const strategy of plan.strategies) {
          strategiesAttempted.push(strategy);

          try {
            if (strategy === "seed_data" && (gap.gap_type === "database" || gap.gap_type === "search")) {
              // ── SEED DATA ──
              const assets = await base44.entities.CloneAsset.filter({ clone_project_id });
              const domAsset = assets.find((a: any) => a.asset_type === "dom");

              let htmlContent = "";
              if (domAsset) {
                const domResponse = await fetch(domAsset.file_url);
                htmlContent = await domResponse.text();
              }

              // Extract real data from site content
              const { extractSeedDataFromContent, getSeedTemplate } = await import("../../shared/gapIntelligence.ts");
              const extractedData = extractSeedDataFromContent(htmlContent);
              const seedTemplate = getSeedTemplate((gap.industry_detected || "generic") as any);

              seedData = { ...extractedData };
              for (const collection of seedTemplate.collections) {
                if (!seedData[collection.name] || seedData[collection.name].length === 0) {
                  seedData[collection.name] = Array.from({ length: collection.recordCount }, (_, i) => {
                    const record: any = { id: `seed-${collection.name}-${i}` };
                    for (const [field, type] of Object.entries(collection.fields)) {
                      if (field === "id") continue;
                      record[field] = generateMockValue(field, type as string, i, collection.name);
                    }
                    return record;
                  });
                }
              }

              if (Object.keys(seedData).length > 0) {
                strategyUsed = "seed_data";
                confidence = 85;
                resolutionSummary = `Seeded ${Object.keys(seedData).length} collections from site content + ${gap.industry_detected} template`;
                resolved = true;
              }
            }

            if (strategy === "scrape_similar" && !resolved) {
              // ── SCRAPE SIMILAR ──
              const llmResult = await base44.integrations.Core.InvokeLLM({
                prompt: `Find 3 similar websites to ${project?.target_url} (industry: ${gap.industry_detected}) that have public "${gap.gap_type}" API patterns. Infer their API schema.

Return JSON: { "similar_systems": [{ "url": "...", "inferred_schema": {}, "relevance": 0.9 }], "confidence": 75 }`,
                add_context_from_internet: true,
                response_json_schema: {
                  type: "object",
                  properties: {
                    similar_systems: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          url: { type: "string" },
                          inferred_schema: { type: "object" },
                          relevance: { type: "number" },
                        },
                      },
                    },
                    confidence: { type: "number" },
                  },
                },
              });

              similarSystems = (llmResult as any).similar_systems || [];
              if (similarSystems.length > 0) {
                strategyUsed = "scrape_similar";
                confidence = (llmResult as any).confidence || 70;
                resolutionSummary = `Scraped ${similarSystems.length} similar systems for schema inference`;
                resolved = true;
              }
            }

            if (strategy === "template" && !resolved) {
              // ── TEMPLATE MATCHING ──
              const template = findClosestFunctionalMatch(gap.interaction_pattern || gap.inferred_endpoint || "");
              templateMatched = template.id;
              strategyUsed = "template";
              confidence = 75;
              resolutionSummary = `Matched template "${template.name}" from route catalog`;
              resolved = true;
            }

            if (strategy === "infer_llm" && !resolved) {
              // ── LLM INFERENCE (last resort) ──
              const llmResult = await base44.integrations.Core.InvokeLLM({
                prompt: `Generate a mock Express.js handler for an unclonable "${gap.gap_type}" endpoint.
Endpoint: ${gap.inferred_method} ${gap.inferred_endpoint}
Evidence: ${(gap.classification_evidence || []).join("; ")}
Industry: ${gap.industry_detected}

Return only JavaScript code.`,
              });
              llmInference = llmResult as string;
              strategyUsed = "infer_llm";
              confidence = 60;
              resolutionSummary = "LLM-generated mock handler";
              resolved = true;
            }
          } catch (strategyError) {
            console.error(`Strategy ${strategy} failed for gap ${gap.id}:`, strategyError);
          }

          if (resolved) break;
        }

        // Generate final code
        if (resolved) {
          const templateCode = templateMatched
            ? findClosestFunctionalMatch(gap.interaction_pattern || gap.inferred_endpoint || "").executableCodeSnippet
            : null;
          finalCode = generateGapCode(
            gap.gap_type as GapType,
            gap.inferred_endpoint || "/api/unknown",
            gap.inferred_method || "POST",
            seedData,
            templateCode || llmInference || null
          );
        }

        // Update records
        const finalStatus = resolved ? "resolved" : "failed";
        const now = new Date().toISOString();

        await base44.entities.GapResolution.update(resolution.id, {
          strategy_used: strategyUsed,
          strategies_attempted: strategiesAttempted,
          confidence_score: confidence,
          generated_code: finalCode,
          seed_data: seedData,
          similar_systems_found: similarSystems,
          template_matched: templateMatched,
          llm_inference: llmInference,
          resolution_summary: resolutionSummary,
          status: finalStatus,
          resolved_at: resolved ? now : null,
          error_message: resolved ? "" : "All strategies failed",
        });

        await base44.entities.CloneGap.update(gap.id, {
          status: finalStatus === "resolved" ? "resolved" : "unresolved",
          resolution_strategy: strategyUsed,
          generated_code: finalCode,
          mock_logic: finalCode,
          seed_data: seedData,
          similar_systems_found: similarSystems,
          template_matched: templateMatched,
          confidence_score: confidence,
        });

        results.push({
          gap_id: gap.id,
          gap_type: gap.gap_type,
          endpoint: gap.inferred_endpoint,
          strategy_used: strategyUsed,
          resolved,
          confidence,
        });

        if (resolved) resolvedCount++;
        else failedCount++;
      } catch (gapError) {
        console.error(`Failed to resolve gap ${gap.id}:`, gapError);
        failedCount++;
        results.push({
          gap_id: gap.id,
          gap_type: gap.gap_type,
          endpoint: gap.inferred_endpoint,
          strategy_used: "",
          resolved: false,
          error: gapError.message,
        });
      }
    }

    // ═══════════════════════════════════════════
    // GENERATE AGGREGATE MOCK BACKEND CODE
    // ═══════════════════════════════════════════
    if (resolvedCount > 0) {
      const allGaps = await base44.entities.CloneGap.filter({ clone_project_id, status: "resolved" });
      const allCode = allGaps.map((g: any) => `// ═══ ${g.gap_type.toUpperCase()} — ${g.inferred_method} ${g.inferred_endpoint} ═══\n${g.generated_code || g.mock_logic || ""}`).join("\n\n");

      const codeFile = new File([allCode], `mock-backend-${clone_project_id}.js`, { type: "text/javascript" });
      const codeUpload = await base44.integrations.Core.UploadFile({ file: codeFile });
      await base44.entities.CloneProject.update(clone_project_id, {
        clone_code_url: codeUpload.file_url,
      });
    }

    const remainingCount = pendingGaps.length - batch.length;

    return Response.json({
      ok: true,
      clone_project_id,
      status: remainingCount > 0 ? "in_progress" : "complete",
      batch_processed: batch.length,
      resolved: resolvedCount,
      failed: failedCount,
      remaining: remainingCount,
      total_gaps: gaps.length,
      results,
      __v: DEPLOYMENT_VERSION,
    });
  } catch (error) {
    console.error("resolveAllGaps error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

function generateMockValue(fieldName: string, fieldType: string, index: number, collectionName: string): any {
  const name = fieldName.toLowerCase();
  if (fieldType === "number") {
    if (name.includes("price")) return Math.round((19 + Math.random() * 480) * 100) / 100;
    if (name.includes("rating")) return Math.round((3 + Math.random() * 2) * 10) / 10;
    if (name.includes("count")) return Math.floor(Math.random() * 100);
    return Math.floor(Math.random() * 100);
  }
  if (fieldType === "boolean") return Math.random() > 0.5;
  if (fieldType === "string") {
    if (name.includes("email")) return `user${index}@example.com`;
    if (name.includes("url") || name.includes("image")) return `https://images.unsplash.com/photo-${1500000000000 + index * 1000000}?w=400`;
    if (name.includes("name")) return `${["Alpha", "Beta", "Gamma", "Delta"][index % 4]} ${collectionName.slice(0, -1)}`;
    if (name.includes("title")) return `${collectionName.slice(0, -1)} ${index + 1}`;
    if (name.includes("description")) return `Sample ${collectionName.slice(0, -1)} ${index + 1}`;
    if (name.includes("status")) return ["active", "pending", "completed"][index % 3];
    return `value-${index}`;
  }
  return null;
}