import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { engagement_id, pipeline_id } = body;

    if (!engagement_id && !pipeline_id) {
      return Response.json({ error: 'engagement_id or pipeline_id required' }, { status: 400 });
    }

    let engagement = null;
    let pipeline = null;

    if (engagement_id) {
      engagement = await base44.entities.ClientEngagement.get(engagement_id);
      if (engagement.pipeline_id) {
        pipeline = await base44.entities.IntelligencePipeline.get(engagement.pipeline_id);
      }
    } else {
      pipeline = await base44.entities.IntelligencePipeline.get(pipeline_id);
    }

    // Pull brand options from pipeline or engagement
    const brandOptions = pipeline?.brand_options || [];
    const winningBrand = Array.isArray(brandOptions) && brandOptions.length > 0 ? brandOptions[0] : null;
    const salesAssets = pipeline?.sales_assets || {};
    const buildersDocs = pipeline?.builders_docs || {};
    const simulation = pipeline?.simulation_results || {};
    const buyerProfiles = pipeline?.buyer_profiles || [];
    const socialSignals = pipeline?.social_signals || [];
    const competitorIntel = pipeline?.competitor_intel || [];

    // Use LLM to synthesize a structured, machine-readable build spec
    const context = {
      industry: pipeline?.industry || engagement?.industry,
      target_market: pipeline?.target_market || engagement?.target_market,
      geo_focus: pipeline?.geo_focus || engagement?.geo_focus,
      goals: pipeline?.goals || engagement?.business_goals,
      budget: pipeline?.budget_range || engagement?.budget_range,
      timeline: pipeline?.timeline || engagement?.timeline,
      success_metrics: engagement?.success_metrics || [],
      differentiators: engagement?.differentiators,
      brand_preferences: engagement?.brand_preferences,
      winning_brand: winningBrand,
      sales_assets: salesAssets,
      builders_docs: buildersDocs,
      simulation: simulation,
      buyer_profiles: buyerProfiles,
      social_signals: socialSignals,
      competitor_intel: competitorIntel,
    };

    const llmResponse = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a senior software architect generating a machine-readable build specification for an autonomous coding agent.

Given the following client discovery intelligence, produce a COMPLETE, UNAMBIGUOUS build spec JSON that a coding agent can execute with zero interpretation needed.

Context:
${JSON.stringify(context, null, 2)}

Generate a build spec with this EXACT structure:
{
  "spec_version": "1.0",
  "project": { "name", "industry", "target_market", "geo_focus", "positioning_statement" },
  "brand": { "name", "tagline", "primary_color", "secondary_color", "accent_color", "heading_font", "body_font", "voice", "personality_traits": [] },
  "pages": [ { "slug", "type", "title", "meta_description", "h1", "sections": [ { "type", "heading", "content_summary", "components": [] } ], "seo": { "target_keywords": [], "schema_type" } } ],
  "entities": [ { "name", "description", "fields": [ { "name", "type", "required", "description" } ], "rls": "owner" } ],
  "integrations": [ { "name", "purpose", "required_scopes": [] } ],
  "automations": [ { "name", "trigger", "action", "description" } ],
  "lead_capture": { "forms": [ { "name", "fields": [], "webhook", "crm_sync" } ], "crm": "hubspot" },
  "seo_aeo": { "target_keywords": [], "aeo_questions": [], "schema_types": [], "sitemap_strategy" },
  "deployment": { "frontend": "vercel", "backend": "railway", "database": "supabase", "domain_strategy": "subdomain_first" },
  "success_metrics": [ { "metric", "target", "measurement_method" } ],
  "build_sequence": [ { "step", "task", "agent", "dependencies": [] } ],
  "qa_checklist": [ { "check", "category", "auto_or_manual" } ]
}

Rules:
- Every page must have a slug, type (landing|service|location|blog|faq|contact|about|pricing), and at least 3 sections
- Generate at least 6 pages (homepage + 5 core)
- Generate at least 2 entities (Lead + one industry-specific)
- Generate at least 3 automations
- Generate at least 5 lead capture forms across pages
- Build sequence must have at least 10 ordered steps
- QA checklist must have at least 15 checks
- Be specific and actionable — no placeholders, no "TODO", no "to be determined"
- Use the winning brand if available; if not, derive from industry best practices
- Target the specific geo_focus and market in every section`,
      response_json_schema: {
        type: "object",
        properties: {
          spec: {
            type: "object",
            properties: {
              spec_version: { type: "string" },
              project: { type: "object" },
              brand: { type: "object" },
              pages: { type: "array" },
              entities: { type: "array" },
              integrations: { type: "array" },
              automations: { type: "array" },
              lead_capture: { type: "object" },
              seo_aeo: { type: "object" },
              deployment: { type: "object" },
              success_metrics: { type: "array" },
              build_sequence: { type: "array" },
              qa_checklist: { type: "array" }
            }
          }
        }
      },
      model: "claude-sonnet-5"
    });

    const spec = llmResponse.spec || llmResponse;
    const specVersion = new Date().toISOString();

    // Save to engagement
    if (engagement) {
      await base44.entities.ClientEngagement.update(engagement_id, {
        build_spec: spec,
        build_spec_version: specVersion,
        factory_status: "spec_ready",
        factory_progress: 25,
        factory_stage_log: [
          ...(engagement.factory_stage_log || []),
          { stage: "spec_generation", status: "complete", timestamp: specVersion, message: "Build spec generated" }
        ]
      });
    }

    return Response.json({
      ok: true,
      spec,
      spec_version: specVersion,
      engagement_id: engagement_id || null,
      pipeline_id: pipeline_id || null
    });
  } catch (error) {
    console.error('generateBuildSpec error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}