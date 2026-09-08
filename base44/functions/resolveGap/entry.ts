import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";
import {
  getResolutionPlan,
  getSeedTemplate,
  extractSeedDataFromContent,
  generateGapCode,
  type GapType,
  type ResolutionStrategy,
} from "../../shared/gapIntelligence.ts";
import { findClosestFunctionalMatch } from "../../shared/cloneTemplates.ts";

/**
 * DEEP Gap Intelligence — Resolve Single Gap
 *
 * Resolves a single CloneGap using the multi-strategy approach:
 *   1. seed_data — scrape the target site's own public data to seed a mock DB
 *   2. scrape_similar — find similar sites and scrape their public APIs
 *   3. template — match against the route template catalog
 *   4. infer_llm — LLM inference fallback (last resort)
 *
 * Each strategy is tried in order; the first viable one wins.
 * The generated code + seed data are stored on the GapResolution record.
 */

export default async function (req: Request) {
  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { gap_id, resolution_id } = body;
    if (!gap_id && !resolution_id)
      return Response.json({ error: "gap_id or resolution_id is required" }, { status: 400 });

    // Load the gap
    let gap;
    if (gap_id) {
      gap = await base44.entities.CloneGap.get(gap_id);
    } else {
      const resolutions = await base44.entities.GapResolution.filter({ id: resolution_id });
      if (resolutions.length === 0)
        return Response.json({ error: "Resolution not found" }, { status: 404 });
      const res = resolutions[0];
      gap = await base44.entities.CloneGap.get(res.clone_gap_id);
    }

    if (!gap) return Response.json({ error: "Gap not found" }, { status: 404 });

    // Load the resolution
    let resolution;
    if (gap.resolution_id) {
      const resolutions = await base44.entities.GapResolution.filter({ id: gap.resolution_id });
      resolution = resolutions[0];
    }
    if (!resolution) {
      // Create one if missing
      const plan = getResolutionPlan(gap.gap_type as GapType);
      resolution = await base44.entities.GapResolution.create({
        clone_project_id: gap.clone_project_id,
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
      await base44.entities.CloneGap.update(gap.id, { resolution_id: resolution.id, status: "classifying" });
    } else {
      await base44.entities.GapResolution.update(resolution.id, { status: "resolving" });
    }

    // Load the clone project for context
    const project = await base44.entities.CloneProject.get(gap.clone_project_id);

    // Get the resolution plan
    const plan = getResolutionPlan(gap.gap_type as GapType);
    const strategiesAttempted: string[] = [];
    let resolved = false;
    let finalCode = "";
    let seedData: Record<string, any[]> | null = null;
    let similarSystems: any[] = [];
    let templateMatched = "";
    let llmInference = "";
    let strategyUsed: ResolutionStrategy | "" = "";
    let confidence = 0;
    let resolutionSummary = "";

    // ═══════════════════════════════════════════
    // EXECUTE STRATEGIES IN ORDER
    // ═══════════════════════════════════════════
    for (const strategy of plan.strategies) {
      strategiesAttempted.push(strategy);

      try {
        if (strategy === "seed_data") {
          // ── STRATEGY 1: Seed data from target site ──
          const assets = await base44.entities.CloneAsset.filter({
            clone_project_id: gap.clone_project_id,
          });
          const domAsset = assets.find((a) => a.asset_type === "dom");

          let htmlContent = "";
          if (domAsset) {
            const domResponse = await fetch(domAsset.file_url);
            htmlContent = await domResponse.text();
          }

          // Extract real data from the site's own content
          const extractedData = extractSeedDataFromContent(htmlContent);

          // Get the industry seed template
          const seedTemplate = getSeedTemplate(
            (gap.industry_detected || "generic") as any
          );

          // Merge extracted data with template defaults
          seedData = { ...extractedData };
          for (const collection of seedTemplate.collections) {
            if (!seedData[collection.name] || seedData[collection.name].length === 0) {
              // Generate synthetic records based on the template
              seedData[collection.name] = Array.from({ length: collection.recordCount }, (_, i) => {
                const record: any = { id: `seed-${collection.name}-${i}` };
                for (const [field, type] of Object.entries(collection.fields)) {
                  if (field === "id") continue;
                  record[field] = generateMockValue(field, type, i, collection.name);
                }
                return record;
              });
            }
          }

          if (Object.keys(seedData).length > 0) {
            strategyUsed = "seed_data";
            confidence = 85;
            resolutionSummary = `Seeded mock database from target site's public content (${Object.keys(seedData).length} collections, ${Object.values(seedData).reduce((s, arr) => s + arr.length, 0)} records)`;
            resolved = true;
          }
        }

        if (strategy === "scrape_similar" && !resolved) {
          // ── STRATEGY 2: Scrape similar systems ──
          // Use LLM with web context to find similar sites and infer their API schemas
          const llmResult = await base44.integrations.Core.InvokeLLM({
            prompt: `You are analyzing a website clone project. The target site is ${project?.target_url} (industry: ${gap.industry_detected}).

There is an unclonable backend gap of type "${gap.gap_type}" at endpoint "${gap.inferred_method} ${gap.inferred_endpoint}".

Find 3-5 SIMILAR websites in the same industry that have PUBLIC API documentation or observable API patterns. For each, infer what the API schema for this type of endpoint would look like.

Return a JSON object with:
{
  "similar_systems": [
    { "url": "https://example-similar-site.com", "inferred_schema": { ... }, "relevance": 0.9 }
  ],
  "inferred_request_schema": { ... },
  "inferred_response_schema": { ... },
  "confidence": 75
}`,
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
                inferred_request_schema: { type: "object" },
                inferred_response_schema: { type: "object" },
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
          // ── STRATEGY 3: Template matching ──
          const template = findClosestFunctionalMatch(
            gap.interaction_pattern || gap.inferred_endpoint || ""
          );
          templateMatched = template.id;
          strategyUsed = "template";
          confidence = 75;
          resolutionSummary = `Matched template "${template.name}" from the route catalog`;
          resolved = true;
        }

        if (strategy === "infer_llm" && !resolved) {
          // ── STRATEGY 4: LLM inference (last resort) ──
          const llmResult = await base44.integrations.Core.InvokeLLM({
            prompt: `You are a backend architect. A website clone has an unclonable gap:

Gap type: ${gap.gap_type}
Endpoint: ${gap.inferred_method} ${gap.inferred_endpoint}
Evidence: ${(gap.classification_evidence || []).join("; ")}
Industry: ${gap.industry_detected}
Target URL: ${project?.target_url}

Generate a mock backend handler (Express.js) that simulates this endpoint. The handler should:
1. Accept the expected request format
2. Return realistic mock data
3. Handle edge cases (missing params, errors)

Return only the JavaScript code, no explanation.`,
          });

          llmInference = llmResult as string;
          strategyUsed = "infer_llm";
          confidence = 60;
          resolutionSummary = "LLM-generated mock handler (last-resort inference)";
          resolved = true;
        }
      } catch (strategyError) {
        console.error(`Strategy ${strategy} failed:`, strategyError);
        // Continue to next strategy
      }

      if (resolved) break;
    }

    // ═══════════════════════════════════════════
    // GENERATE FINAL CODE
    // ═══════════════════════════════════════════
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

    // ═══════════════════════════════════════════
    // UPDATE RECORDS
    // ═══════════════════════════════════════════
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
      error_message: resolved ? "" : "All resolution strategies failed",
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

    return Response.json({
      ok: true,
      gap_id: gap.id,
      resolution_id: resolution.id,
      gap_type: gap.gap_type,
      strategy_used: strategyUsed,
      strategies_attempted: strategiesAttempted,
      confidence,
      resolved,
      resolution_summary: resolutionSummary,
      generated_code: finalCode.substring(0, 500) + (finalCode.length > 500 ? "..." : ""),
      seed_collections: seedData ? Object.keys(seedData) : [],
      seed_record_count: seedData ? Object.values(seedData).reduce((s: number, arr: any[]) => s + arr.length, 0) : 0,
      similar_systems_count: similarSystems.length,
      __v: DEPLOYMENT_VERSION,
    });
  } catch (error) {
    console.error("resolveGap error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Generate a realistic mock value for a field based on its name and type.
 */
function generateMockValue(fieldName: string, fieldType: string, index: number, collectionName: string): any {
  const name = fieldName.toLowerCase();

  if (fieldType === "number") {
    if (name.includes("price") || name.includes("salary")) return Math.round((19 + Math.random() * 480) * 100) / 100;
    if (name.includes("rating")) return Math.round((3 + Math.random() * 2) * 10) / 10;
    if (name.includes("count")) return Math.floor(Math.random() * 100);
    if (name.includes("sqft")) return Math.floor(800 + Math.random() * 3000);
    if (name.includes("bedroom")) return Math.floor(1 + Math.random() * 5);
    if (name.includes("bathroom")) return Math.floor(1 + Math.random() * 3);
    return Math.floor(Math.random() * 100);
  }

  if (fieldType === "boolean") {
    if (name.includes("stock")) return Math.random() > 0.2;
    if (name.includes("remote")) return Math.random() > 0.5;
    return Math.random() > 0.5;
  }

  if (fieldType === "string") {
    if (name.includes("email")) return `user${index}@example.com`;
    if (name.includes("url") || name.includes("image") || name.includes("avatar") || name.includes("logo"))
      return `https://images.unsplash.com/photo-${1500000000000 + index * 1000000}?w=400`;
    if (name.includes("phone")) return `+1-555-${String(index).padStart(4, "0")}`;
    if (name.includes("address")) return `${100 + index} Main St, City ${index}`;
    if (name.includes("name")) {
      const names = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta"];
      return `${names[index % names.length]} ${collectionName.slice(0, -1)}`;
    }
    if (name.includes("title")) return `${collectionName.slice(0, -1)} ${index + 1}`;
    if (name.includes("description")) return `This is a sample ${collectionName.slice(0, -1)} with description ${index + 1}.`;
    if (name.includes("slug")) return `${collectionName}-${index}`;
    if (name.includes("status")) return ["active", "pending", "completed"][index % 3];
    if (name.includes("category")) return ["Category A", "Category B", "Category C"][index % 3];
    if (name.includes("role")) return ["admin", "user", "editor"][index % 3];
    if (name.includes("type")) return ["standard", "premium", "enterprise"][index % 3];
    if (name.includes("currency")) return "USD";
    return `value-${index}`;
  }

  if (fieldType === "array") return [];

  return null;
}