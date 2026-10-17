import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";

export default async function(req) {
  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { industry, target_market, pipeline_id } = body;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a world-class brand strategist and consumer psychologist. Generate 10 DISTINCT brand options for: Industry="${industry}", Target Market="${target_market}".

For EACH of the 10 options, provide:
1. BRAND NAME — memorable, available-sounding, industry-relevant
2. SLOGAN — 3-5 words, emotionally resonant
3. HOOK — the one-liner that stops scrolling
4. COLOR SCHEME — 3-4 hex colors that match the target market's psychology:
   - What colors does this demographic gravitate toward?
   - What colors signal trust/urgency/luxury/affordability for THIS audience?
   - Include the psychological reasoning for each color
5. PERSONALITY TRAITS — 5 traits this brand embodies (e.g. bold, empathetic, authoritative)
6. TARGET PSYCHOLOGY — what psychological profile does this brand attract? (Big Five traits, values, fears, desires)
7. TYPOGRAPHY — font style recommendation (serif/sans-serif/display, weight, feel)
8. VISUAL STYLE — design direction (minimalist, bold, editorial, tech, organic, luxury)
9. MARKET POSITIONING — how this brand differentiates (price leader, premium, accessible, disruptive, heritage)
10. CAMPAIGN ANGLE — the core marketing campaign idea
11. WINNING PSYCHOLOGY TRICK — a lesser-known psychological principle this brand leverages (e.g. scarcity, social proof, anchoring, loss aversion, Zeigarnik effect)

Also include:
- TRENDING STYLES — current design trends that are converting best in this industry
- TOP SECRET TIPS — 3 rarely-discussed branding tricks the top 1% use in this industry
- GOOGLE/FB COMPLIANCE NOTES — what to avoid for ad approval

Return structured JSON with all 10 options.`,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          options: { type: "array", items: { type: "object" } },
          trending_styles: { type: "array", items: { type: "string" } },
          top_secret_tips: { type: "array", items: { type: "string" } },
          compliance_notes: { type: "array", items: { type: "string" } }
        }
      }
    });

    if (pipeline_id) {
      await base44.entities.IntelligencePipeline.update(pipeline_id, { brand_options: result.options || [] });
    }

    return Response.json({ ok: true, data: result });
  } catch (error) {
    console.error("runBrandGenerator error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}