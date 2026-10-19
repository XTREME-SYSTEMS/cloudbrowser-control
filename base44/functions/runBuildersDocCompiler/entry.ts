import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";

export default async function(req) {
  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { pipeline_id, output_type, pipeline_data } = body;

    if (!pipeline_id && !pipeline_data) {
      return Response.json({ error: "pipeline_id or pipeline_data required" }, { status: 400 });
    }

    let data = pipeline_data;
    if (pipeline_id) {
      const pipeline = await base44.entities.IntelligencePipeline.get(pipeline_id);
      data = {
        industry: pipeline.industry,
        target_market: pipeline.target_market,
        goals: pipeline.goals,
        national_demand_map: pipeline.national_demand_map,
        social_signals: pipeline.social_signals,
        buyer_profiles: pipeline.buyer_profiles,
        competitor_intel: pipeline.competitor_intel,
        simulation_results: pipeline.simulation_results,
        brand_options: pipeline.brand_options,
        sales_assets: pipeline.sales_assets,
      };
    }

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a senior solutions architect and product strategist. Compile the following intelligence into a comprehensive BUILDERS DOCUMENT that translates raw intelligence into an actionable build plan.

INTELLIGENCE DATA:
${JSON.stringify(data).slice(0, 8000)}

The user wants to translate this into: ${output_type || "a complete system (website, funnel, marketing campaign, and automated lead gen system)"}.

Generate a BUILDERS DOCUMENT containing:
1. EXECUTIVE SUMMARY — what we're building and why
2. SYSTEM ARCHITECTURE — high-level architecture (frontend, backend, database, integrations, automations)
3. PAGE/FUNNEL BLUEPRINT — every page, its purpose, sections, CTAs, and conversion logic
4. DATA MODEL — entities, fields, relationships needed
5. INTEGRATION MAP — which tools/services connect where (Google, social, CRM, email, SMS, payments)
6. AUTOMATION WORKFLOWS — step-by-step automated flows (lead capture → enrichment → routing → follow-up)
7. CONTENT STRATEGY — what content to create, SEO/AEO structure, publishing cadence
8. TECH STACK RECOMMENDATION — specific tools, frameworks, services
9. BUILD SEQUENCE — ordered phases (what to build first, second, etc.)
10. ESTIMATED TIMELINE — days/weeks per phase
11. RESOURCE REQUIREMENTS — roles, skills, hours needed
12. RISK MITIGATION — what could fail and contingency plans
13. SUCCESS METRICS — KPIs and how to measure them
14. ROLLOUT PLAN — how to launch, test, iterate, scale

Format as structured JSON with each section as a key containing detailed content.`,
      response_json_schema: {
        type: "object",
        properties: {
          executive_summary: { type: "string" },
          system_architecture: { type: "string" },
          page_blueprint: { type: "array", items: { type: "object" } },
          data_model: { type: "array", items: { type: "object" } },
          integration_map: { type: "array", items: { type: "object" } },
          automation_workflows: { type: "array", items: { type: "object" } },
          content_strategy: { type: "object" },
          tech_stack: { type: "array", items: { type: "string" } },
          build_sequence: { type: "array", items: { type: "object" } },
          estimated_timeline: { type: "string" },
          resource_requirements: { type: "array", items: { type: "object" } },
          risk_mitigation: { type: "array", items: { type: "object" } },
          success_metrics: { type: "array", items: { type: "string" } },
          rollout_plan: { type: "string" }
        }
      }
    });

    if (pipeline_id) {
      await base44.entities.IntelligencePipeline.update(pipeline_id, { builders_docs: result });
    }

    return Response.json({ ok: true, data: result });
  } catch (error) {
    console.error("runBuildersDocCompiler error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}