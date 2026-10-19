import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { invokeLLM } from '../../shared/vercelAiGateway.ts';

// Dream Factory — Discovery Generator
// Uses web search (Gemini) to automatically find trends, problems, niches,
// keywords, opportunities, audiences, and competitors.

const GENERATOR_PROMPTS = {
  trend: (count, niche) => `You are a world-class trend analyst.
${niche ? `Focus on the niche: ${niche}.` : "Scan across all major categories."}
Search Google and the internet to find the TOP ${count} RISING TRENDS right now — things people are searching for more and more, emerging topics, viral movements, and growing categories.

For each trend, identify:
1. The trend name / topic
2. Why it's trending (what's driving the growth)
3. Search volume estimate (low/medium/high or relative)
4. Trend direction (rising/stable/declining)
5. Related search keywords (5-10)
6. Source URLs where you found this trend
7. How a software product could capitalize on it
8. Opportunity score (0-100)

Return a JSON object with a "results" array of ${count} trends.`,

  problem: (count, niche) => `You are a world-class problem researcher.
${niche ? `Focus on the niche: ${niche}.` : "Scan across all major categories."}
Search Google, Reddit, forums, review sites, and social media to find the TOP ${count} PROBLEMS people are actively complaining about RIGHT NOW that could be solved with software.

For each problem, identify:
1. The exact problem people complain about (find real quotes)
2. Who is most affected (demographics, situations)
3. What they're searching for to solve it
4. How severe / frequent the complaint is
5. Whether existing solutions exist and what they're missing
6. Related search keywords
7. Source URLs (Reddit threads, forum posts, reviews)
8. Opportunity score (0-100) based on pain level + market size

Return a JSON object with a "results" array of ${count} problems.`,

  niche: (count, niche) => `You are a world-class niche discovery expert.
${niche ? `Focus on the broader area: ${niche}.` : "Scan across all major industries."}
Search Google and the internet to find the TOP ${count} UNDERSERVED PROFITABLE NICHES — areas with high demand, rising search interest, but poor existing solutions.

For each niche, identify:
1. The niche name and description
2. Why it's underserved (what's missing)
3. Estimated market size (TAM)
4. Monetization potential (low/medium/high/very_high)
5. Competition level (none/low/medium/high/saturated)
6. Target audience description
7. Related search keywords
8. Source URLs
9. Opportunity score (0-100)

Return a JSON object with a "results" array of ${count} niches.`,

  keyword: (count, niche) => `You are a world-class SEO keyword researcher.
${niche ? `Focus on the niche: ${niche}.` : "Scan across all major categories."}
Search Google and the internet to find the TOP ${count} HIGH-VALUE KEYWORDS — search terms with high intent, rising volume, and low competition that a new product could rank for.

For each keyword, identify:
1. The keyword / search term
2. Estimated search volume (low/medium/high)
3. Competition level (none/low/medium/high/saturated)
4. Search intent (informational/commercial/transactional)
5. CPC estimate (low/medium/high)
6. Related keywords (5-10)
7. What product would capture this traffic
8. Source URLs
9. Opportunity score (0-100)

Return a JSON object with a "results" array of ${count} keywords.`,

  opportunity: (count, niche) => `You are a world-class market opportunity analyst.
${niche ? `Focus on the niche: ${niche}.` : "Scan across all major markets."}
Search Google and the internet to find the TOP ${count} MARKET GAPS AND OPPORTUNITIES — spaces where demand exists but no good solution does, or where existing solutions are failing.

For each opportunity, identify:
1. The opportunity name
2. The gap in the market (what's missing)
3. Why existing solutions fail
4. Estimated market size
5. Monetization potential
6. Competition level
7. What type of product would capture it
8. Related search keywords
9. Source URLs
10. Opportunity score (0-100)

Return a JSON object with a "results" array of ${count} opportunities.`,

  audience: (count, niche) => `You are a world-class audience research analyst.
${niche ? `Focus on the niche: ${niche}.` : "Scan across all major demographics."}
Search Google and the internet to find the TOP ${count} UNDERSERVED AUDIENCES — groups of people with specific needs that aren't being met well by existing products.

For each audience, identify:
1. The audience name / description
2. Demographics (age, location, income, etc.)
3. Their unmet needs and pain points
4. Where they hang out online (subreddits, forums, groups)
5. What they search for
6. What they'd pay for
7. Related search keywords
8. Source URLs
9. Opportunity score (0-100)

Return a JSON object with a "results" array of ${count} audiences.`,

  competitor: (count, niche) => `You are a world-class competitive intelligence analyst.
${niche ? `Focus on the niche: ${niche}.` : "Scan across all major software categories."}
Search Google and the internet to find the TOP ${count} COMPETITORS WITH WEAKNESSES — existing products that are popular but have major complaints, gaps, or vulnerabilities a new product could exploit.

For each competitor, identify:
1. The competitor name
2. What they do
3. Their main weaknesses / complaints (find real reviews)
4. What users wish they did better
5. Market share estimate
6. How a new product could beat them
7. Source URLs (reviews, complaints)
8. Opportunity score (0-100)

Return a JSON object with a "results" array of ${count} competitors.`
};

export default async function(req: any) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

  const sr = base44.asServiceRole.entities;
  const { generator_type = "trend", count = 10, niche } = req.body || {};
  const ts = Date.now();

  const promptFn = GENERATOR_PROMPTS[generator_type];
  if (!promptFn) {
    return Response.json({ error: `Unknown generator type: ${generator_type}. Available: ${Object.keys(GENERATOR_PROMPTS).join(", ")}` }, { status: 400 });
  }

  try {
    const prompt = promptFn(count, niche);

    const result: any = await invokeLLM({
      prompt,
      add_context_from_internet: true,
      model: "gemini_3_flash",
      response_json_schema: {
        type: "object",
        properties: {
          results: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                score: { type: "number" },
                data: { type: "object" },
                source_urls: { type: "array", items: { type: "string" } },
                search_keywords: { type: "array", items: { type: "string" } },
                trend_direction: { type: "string" },
                market_size: { type: "string" },
                monetization_potential: { type: "string" },
                competition_level: { type: "string" }
              }
            }
          }
        }
      }
    });

    const rawResults = result.results || [];
    const records = rawResults.map((r: any, idx: number) => ({
      discovery_type: generator_type,
      title: r.title || `Discovery ${idx + 1}`,
      description: r.description || "",
      score: Math.min(100, Math.max(0, r.score || 0)),
      data: r.data || {},
      source_urls: r.source_urls || [],
      search_keywords: r.search_keywords || [],
      trend_direction: r.trend_direction || "rising",
      market_size: r.market_size || "",
      monetization_potential: r.monetization_potential || "medium",
      competition_level: r.competition_level || "medium",
      generated_at: new Date().toISOString()
    }));

    records.sort((a: any, b: any) => b.score - a.score);

    let saved = [];
    if (records.length > 0) {
      saved = await sr.DiscoveryResult.bulkCreate(records);
    }

    const factories = await sr.DreamFactory.list();
    if (factories.length > 0) {
      await sr.DreamFactory.update(factories[0].id, {
        last_discovery_at: new Date().toISOString(),
        operating_mode: "discovering"
      });
    }

    return Response.json({
      status: "success",
      generator_type,
      results_found: records.length,
      results: records.map((r: any) => ({
        title: r.title,
        description: r.description,
        score: r.score,
        trend_direction: r.trend_direction,
        market_size: r.market_size,
        monetization_potential: r.monetization_potential,
        competition_level: r.competition_level,
        search_keywords: r.search_keywords
      })),
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error(`runDiscoveryGenerator (${generator_type}) error:`, error);
    return Response.json({ status: "error", error: error.message, results_found: 0 }, { status: 500 });
  }
}