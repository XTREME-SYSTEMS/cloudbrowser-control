import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";

export default async function(req) {
  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { industry, target_market, pipeline_id } = body;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a social media intelligence analyst. Scan social media platforms (Reddit, Twitter/X, Facebook, TikTok, Instagram, LinkedIn, Quora, YouTube comments) for the industry: "${industry}" targeting "${target_market}".

Find and compile:
1. TOP COMPLAINTS — What are people frustrated about? What problems are they posting about? What services fail them?
2. UNMET NEEDS — What do people want that doesn't exist or is hard to find? What are they asking for?
3. DESIRES & WANTS — What are people wishing for? What outcomes do they dream about?
4. SEARCH TRANSLATIONS — Which of these complaints/needs could be solved by: an app, an e-commerce site, a service business, a SaaS tool, or an automated system?
5. TRENDING TOPICS — What's gaining momentum in this space? What's fading?
6. EMOTIONAL TRIGGERS — What emotions (fear, frustration, desire, hope, anger) are driving these posts?
7. VIRAL CONTENT — What content formats are getting the most engagement in this niche?
8. GAPS IN THE MARKET — What are competitors NOT providing that people clearly want?

Return structured JSON with arrays of specific, real-sounding complaints, needs, and opportunities — each with the platform, sentiment, and a translation into a buildable solution.`,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          top_complaints: { type: "array", items: { type: "object", properties: {
            complaint: { type: "string" }, platform: { type: "string" }, sentiment: { type: "string" }, frequency: { type: "string" }
          } } },
          unmet_needs: { type: "array", items: { type: "object", properties: {
            need: { type: "string" }, platform: { type: "string" }, urgency: { type: "number" }
          } } },
          desires: { type: "array", items: { type: "string" } },
          solution_translations: { type: "array", items: { type: "object", properties: {
            problem: { type: "string" }, solution_type: { type: "string" }, description: { type: "string" }, market_size: { type: "string" }
          } } },
          trending_topics: { type: "array", items: { type: "string" } },
          emotional_triggers: { type: "array", items: { type: "object", properties: {
            emotion: { type: "string" }, trigger: { type: "string" }, how_to_use: { type: "string" }
          } } },
          market_gaps: { type: "array", items: { type: "object", properties: {
            gap: { type: "string" }, opportunity: { type: "string" }, competitors_missing_this: { type: "string" }
          } } }
        }
      }
    });

    if (pipeline_id) {
      await base44.entities.IntelligencePipeline.update(pipeline_id, { social_signals: result });
    }

    return Response.json({ ok: true, data: result });
  } catch (error) {
    console.error("runSocialMediaScan error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}