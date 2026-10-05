import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { invokeLLM } from '../../shared/vercelAiGateway.ts';

// Dream Factory — Idea Generator: Scans Google trends and online complaints
// to generate product ideas that solve real problems people are searching for.

export default async function(req: any) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

  const sr = base44.asServiceRole.entities;
  const { categories, max_ideas = 10, niche } = req.body || {};
  const ts = Date.now();

  try {
    const trendPrompt = `You are a world-class market researcher and product strategist.
${niche ? `Focus on the niche: ${niche}.` : "Scan across all major categories."}
${categories ? `Focus on these categories: ${categories.join(", ")}.` : ""}

Search Google and the internet to find the TOP ${max_ideas * 3} things people are actively searching for, complaining about, and struggling with RIGHT NOW that could be solved with an app, software tool, or digital system.

For each, identify:
1. The exact problem people complain about (find real quotes from Reddit, forums, Twitter, review sites)
2. Who is most affected (demographics, locations, situations)
3. What they're searching for on Google (exact search terms)
4. Whether existing solutions exist and what they're missing
5. The trend direction (rising/stable/declining)
6. Whether this could change lives or change the world
7. Estimated market size and willingness to pay
8. What type of product would solve it (web app, mobile app, SaaS, API, etc.)

Prioritize problems that people complain about constantly but nobody has solved well, have rising search trends, could genuinely change lives, have clear monetization paths, and can be built as software.

Return a JSON object with an "ideas" array containing ${max_ideas * 3} ideas, each with:
title, problem_solved, target_audience, solution_summary, product_type, industry,
google_trend_score (0-100), trend_direction, competition_level, market_size_estimate,
monetization_model, price_point_estimate, world_changing_potential (boolean),
complaint_sources (array of {source, quote, url}), search_keywords (array),
competitor_analysis (string)`;

    const trendResult: any = await invokeLLM({
      prompt: trendPrompt,
      add_context_from_internet: true,
      model: "gemini_3_flash",
      response_json_schema: {
        type: "object",
        properties: {
          ideas: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                problem_solved: { type: "string" },
                target_audience: { type: "string" },
                solution_summary: { type: "string" },
                product_type: { type: "string" },
                industry: { type: "string" },
                google_trend_score: { type: "number" },
                trend_direction: { type: "string" },
                competition_level: { type: "string" },
                market_size_estimate: { type: "string" },
                monetization_model: { type: "string" },
                price_point_estimate: { type: "string" },
                world_changing_potential: { type: "boolean" },
                complaint_sources: { type: "array", items: { type: "object" } },
                search_keywords: { type: "array", items: { type: "string" } },
                competitor_analysis: { type: "string" }
              }
            }
          }
        }
      }
    });

    const rawIdeas = trendResult.ideas || [];
    const scoredIdeas = rawIdeas.map((idea: any, idx: number) => ({
      ...idea,
      idea_id: `idea_${ts}_${idx}`,
      build_status: "idea",
      generated_at: new Date().toISOString(),
      validation_score: Math.min(100, (idea.google_trend_score || 50) + (idea.world_changing_potential ? 20 : 0) + (idea.competition_level === "low" ? 15 : idea.competition_level === "none" ? 20 : 0))
    }));

    scoredIdeas.sort((a: any, b: any) => b.validation_score - a.validation_score);
    const topIdeas = scoredIdeas.slice(0, max_ideas);

    await sr.ProductIdea.bulkCreate(topIdeas);

    const factories = await sr.DreamFactory.list();
    if (factories.length > 0) {
      await sr.DreamFactory.update(factories[0].id, {
        ideas_generated: (factories[0].ideas_generated || 0) + topIdeas.length,
        last_discovery_at: new Date().toISOString(),
        operating_mode: "discovering"
      });
    }

    return Response.json({
      status: "success",
      ideas_generated: topIdeas.length,
      ideas: topIdeas.map((i: any) => ({
        idea_id: i.idea_id,
        title: i.title,
        problem_solved: i.problem_solved,
        target_audience: i.target_audience,
        product_type: i.product_type,
        google_trend_score: i.google_trend_score,
        trend_direction: i.trend_direction,
        world_changing_potential: i.world_changing_potential,
        validation_score: i.validation_score,
        monetization_model: i.monetization_model
      })),
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("generateProductIdeas error:", error);
    return Response.json({ status: "error", error: error.message, ideas_generated: 0 }, { status: 500 });
  }
}