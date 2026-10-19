import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { invokeLLM } from '../../shared/vercelAiGateway.ts';

// Content Engine: Generates content assets at scale — blogs, SEO articles,
// social posts, video scripts, ad copy, email campaigns. Each piece is
// optimized for Google ranking, emotional resonance, and conversion.

export default async function(req: any) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

  const sr = base44.asServiceRole.entities;
  const {
    product_idea_id, content_type = "blog_post", count = 5,
    target_keywords = [], target_audience, emotional_trigger, platform, campaign_id
  } = req.body || {};

  const ts = Date.now();
  const assets: any[] = [];

  try {
    let productIdea: any = null;
    if (product_idea_id) {
      productIdea = await sr.ProductIdea.get(product_idea_id);
    }

    const batchSize = Math.min(count, 5);
    const batches = Math.ceil(count / batchSize);

    for (let batch = 0; batch < batches; batch++) {
      const batchCount = Math.min(batchSize, count - batch * batchSize);

      const contentPrompt = `You are a world-class content creator and SEO expert.
Generate ${batchCount} pieces of ${content_type} content that:
${productIdea ? `- Promotes: ${productIdea.title} — ${productIdea.solution_summary}` : ""}
${target_audience ? `- Target audience: ${target_audience}` : ""}
${emotional_trigger ? `- Emotional trigger: ${emotional_trigger} (speak to their soul)` : ""}
${target_keywords.length > 0 ? `- Target keywords: ${target_keywords.join(", ")}` : ""}
${platform ? `- Platform: ${platform} (optimize format for this platform)` : ""}

For BLOG POSTS / SEO ARTICLES: Write 1500-2500 words, optimized for Google ranking. Include H1/H2/H3, meta description, FAQ. Answer questions people search for. Use keywords naturally. Compelling hook, valuable body, strong CTA.

For SOCIAL POSTS: Platform-optimized format, scroll-stopping hooks, emotional resonance, clear CTA.

FOR AD COPY: Benefit-driven headlines, emotional + logical appeal, strong CTA, multiple variants.

FOR VIDEO SCRIPTS / SHORT VIDEOS: Hook in first 3 seconds, retention-optimized pacing, emotional arc, clear CTA.

Return JSON with "content" array, each item: title, body, target_keywords, seo_score (0-100), emotional_trigger, viral_potential_score (0-100), google_optimized (boolean)`;

      const result: any = await invokeLLM({
        prompt: contentPrompt,
        model: "gpt_5_4",
        response_json_schema: {
          type: "object",
          properties: {
            content: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  body: { type: "string" },
                  target_keywords: { type: "array", items: { type: "string" } },
                  seo_score: { type: "number" },
                  emotional_trigger: { type: "string" },
                  viral_potential_score: { type: "number" },
                  google_optimized: { type: "boolean" }
                }
              }
            }
          }
        }
      });

      const batchContent = result.content || [];
      for (let i = 0; i < batchContent.length; i++) {
        const c = batchContent[i];
        assets.push({
          asset_id: `asset_${ts}_${batch}_${i}`,
          title: c.title,
          content_type,
          platform: platform || "website",
          body: c.body,
          target_keywords: c.target_keywords || target_keywords,
          seo_score: c.seo_score || 0,
          emotional_trigger: c.emotional_trigger || emotional_trigger,
          viral_potential_score: c.viral_potential_score || 0,
          google_optimized: c.google_optimized || false,
          target_audience: target_audience || (productIdea ? productIdea.target_audience : ""),
          product_idea_id: product_idea_id || null,
          marketing_campaign_id: campaign_id || null,
          generated_at: new Date().toISOString(),
          status: "draft"
        });
      }
    }

    await sr.ContentAsset.bulkCreate(assets);

    const factories = await sr.DreamFactory.list();
    if (factories.length > 0) {
      await sr.DreamFactory.update(factories[0].id, {
        content_created: (factories[0].content_created || 0) + assets.length,
        last_market_at: new Date().toISOString()
      });
    }

    return Response.json({
      status: "success",
      content_type,
      assets_generated: assets.length,
      assets: assets.map(a => ({
        asset_id: a.asset_id, title: a.title, seo_score: a.seo_score,
        viral_potential_score: a.viral_potential_score, google_optimized: a.google_optimized
      })),
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("generateContentAtScale error:", error);
    return Response.json({ status: "error", error: error.message, assets_generated: 0 }, { status: 500 });
  }
}