import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";
import { buildSimilarSystemQueries, type GapType, type Industry } from "../../shared/gapIntelligence.ts";

/**
 * DEEP Gap Intelligence — Scrape Similar Systems
 *
 * For a given clone project + gap type, searches the web for similar websites
 * in the same industry and scrapes their public API endpoints to infer the
 * schema/shape of the unclonable backend.
 *
 * This is the "intelligence system that scrapes the website for similar systems"
 * — it finds comparable public APIs and uses their structure to infer what
 * the target site's hidden backend looks like.
 */

export default async function (req: Request) {
  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { clone_project_id, gap_type, max_results = 5 } = body;
    if (!clone_project_id || !gap_type)
      return Response.json({ error: "clone_project_id and gap_type are required" }, { status: 400 });

    // Load the clone project
    const project = await base44.entities.CloneProject.get(clone_project_id);
    if (!project) return Response.json({ error: "Clone project not found" }, { status: 404 });

    // Build search queries for similar systems
    const queries = buildSimilarSystemQueries(
      project.target_url,
      (project as any).industry || "generic",
      gap_type as GapType
    );

    // Use LLM with web context to find and analyze similar systems
    const llmText = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a web intelligence agent. I need you to find SIMILAR websites to ${project.target_url} (industry: ${(project as any).industry || "generic"}) that have observable API patterns for "${gap_type}" endpoints.

Search queries to consider:
${queries.map((q, i) => `${i + 1}. ${q}`).join("\n")}

For each similar site you find:
1. Identify the site URL
2. Infer what their ${gap_type} API endpoint schema looks like (request + response)
3. Rate how relevant it is to our target (0-1)

Return up to ${max_results} similar systems. Focus on sites that expose public API documentation, openapi specs, or observable fetch/XHR patterns.

IMPORTANT: Return ONLY a valid JSON object (no markdown, no code fences) with this exact structure:
{"similar_systems":[{"url":"https://example.com","industry":"ecommerce","inferred_schema":{"endpoint":"/api/products","method":"GET"},"relevance":0.85,"reason":"Same industry"}],"aggregate_inferences":{"common_endpoints":["/api/items"],"common_request_fields":["page","limit"],"common_response_fields":["items","total"],"confidence":75}}`,
      add_context_from_internet: true,
    });

    // Parse the LLM response (it returns a string when no json_schema is specified)
    let parsedResult: any = {};
    try {
      const textStr = typeof llmText === "string" ? llmText : JSON.stringify(llmText);
      const jsonMatch = textStr.match(/\{[\s\S]*\}/);
      parsedResult = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch {
      parsedResult = typeof llmText === "object" ? llmText : {};
    }

    const similarSystems = parsedResult.similar_systems || [];
    const aggregateInferences = parsedResult.aggregate_inferences || parsedResult.aggregate_inference || {};

    // Store the similar-systems intelligence as a CloneAsset
    const intelFile = new File(
      [JSON.stringify({ clone_project_id, gap_type, similar_systems: similarSystems, aggregate_inferences: aggregateInferences, generated_at: new Date().toISOString() }, null, 2)],
      `similar-systems-${clone_project_id}-${gap_type}.json`,
      { type: "application/json" }
    );
    const intelUpload = await base44.integrations.Core.UploadFile({ file: intelFile });
    await base44.entities.CloneAsset.create({
      clone_project_id,
      asset_type: "inferred_architecture",
      file_url: intelUpload.file_url,
      status: "inferred",
      viewport: "none",
      metadata: { intelligence_type: "similar_systems", gap_type, systems_count: similarSystems.length },
    });

    return Response.json({
      ok: true,
      clone_project_id,
      gap_type,
      similar_systems_count: similarSystems.length,
      similar_systems: similarSystems.map((s: any) => ({
        url: s.url,
        industry: s.industry,
        relevance: s.relevance,
        reason: s.reason,
      })),
      aggregate_inferences: aggregateInferences,
      intelligence_asset_url: intelUpload.file_url,
      __v: DEPLOYMENT_VERSION,
    });
  } catch (error) {
    console.error("scrapeSimilarSystems error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}