import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { invokeLLM } from '../../shared/vercelAiGateway.ts';

// Marketing Engine: Takes a product idea and creates a comprehensive marketing
// campaign. Finds the exact target market, creates messaging strategy,
// identifies every digital method to reach them, and generates content.

export default async function(req: any) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

  const sr = base44.asServiceRole.entities;
  const { product_idea_id, budget = 0 } = req.body || {};
  if (!product_idea_id) return Response.json({ error: 'product_idea_id is required' }, { status: 400 });

  const ts = Date.now();

  try {
    const idea: any = await sr.ProductIdea.get(product_idea_id);
    if (!idea) return Response.json({ error: 'Product idea not found' }, { status: 404 });

    const marketPrompt = `You are a world-class marketing strategist and growth hacker.
Research the internet to find the EXACT target market for this product and design
a comprehensive marketing campaign that will reach them everywhere they are.

PRODUCT:
- Title: ${idea.title}
- Problem: ${idea.problem_solved}
- Solution: ${idea.solution_summary}
- Target Audience: ${idea.target_audience}
- Industry: ${idea.industry}
- Monetization: ${idea.monetization_model}
- Price: ${idea.price_point_estimate}
- Search Keywords: ${(idea.search_keywords || []).join(", ")}

Find and document:
1. EXACT TARGET MARKET: demographics, psychographics, pain_points, online_locations (subreddits, forums, groups), geographic_locations, search_terms
2. MESSAGING STRATEGY: how to speak to them in a way that resonates with their soul
3. EVERY DIGITAL METHOD: google_ads, meta_ads, tiktok_ads, youtube_ads, organic_seo, social_organic, email, content_marketing, directory_submission, form_automation, backlink_building, influencer_outreach, forum_engagement, quora_answers, reddit_posts, press_release
4. FOLLOWER GROWTH STRATEGY: how to multiply followers faster than any competitor
5. DIGITAL PRESENCE PLAN: every URL/directory to submit company info to, every profile to create, every backlink to build

Return JSON: target_market (object), messaging_strategy (string), channels (array of strings),
follower_growth_strategy (string), digital_presence_actions (array of {action, target_url}),
content_plan (array of {content_type, topic, platform, keywords}), projected_reach, projected_conversions, budget_allocation (object)`;

    const marketResult: any = await invokeLLM({
      prompt: marketPrompt,
      add_context_from_internet: true,
      model: "gemini_3_flash",
      response_json_schema: {
        type: "object",
        properties: {
          target_market: { type: "object" },
          messaging_strategy: { type: "string" },
          channels: { type: "array" },
          follower_growth_strategy: { type: "string" },
          digital_presence_actions: { type: "array" },
          content_plan: { type: "array" },
          projected_reach: { type: "number" },
          projected_conversions: { type: "number" },
          budget_allocation: { type: "object" }
        }
      }
    });

    const campaign: any = await sr.MarketingCampaign.create({
      campaign_id: `camp_${ts}`,
      name: `${idea.title} — Omnichannel Launch`,
      product_idea_id,
      campaign_type: "omnichannel",
      target_market: marketResult.target_market,
      messaging_strategy: marketResult.messaging_strategy,
      channels: marketResult.channels || [],
      budget_estimate: budget,
      projected_reach: marketResult.projected_reach || 0,
      projected_conversions: marketResult.projected_conversions || 0,
      digital_presence_actions: (marketResult.digital_presence_actions || []).map((a: any) => ({ ...a, status: "pending" })),
      follower_growth_target: Math.floor((marketResult.projected_reach || 10000) * 0.05),
      start_date: new Date().toISOString(),
      status: "researching"
    });

    // Generate initial content batch
    const contentPlan = marketResult.content_plan || [];
    const contentAssets: any[] = [];

    for (const plan of contentPlan.slice(0, 10)) {
      try {
        const contentResult: any = await invokeLLM({
          prompt: `Create a ${plan.content_type} about "${plan.topic}" for ${plan.platform}.
Target keywords: ${(plan.keywords || []).join(", ")}
Audience: ${idea.target_audience}
Product: ${idea.title} — ${idea.solution_summary}
Make it Google-optimized, emotionally resonant, platform-optimized, conversion-focused.
Return JSON: { title, body, seo_score, viral_potential_score, google_optimized }`,
          model: "gpt_5_4",
          response_json_schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              body: { type: "string" },
              seo_score: { type: "number" },
              viral_potential_score: { type: "number" },
              google_optimized: { type: "boolean" }
            }
          }
        });

        contentAssets.push({
          asset_id: `asset_${ts}_${contentAssets.length}`,
          title: contentResult.title,
          content_type: plan.content_type || "blog_post",
          platform: plan.platform || "website",
          body: contentResult.body,
          target_keywords: plan.keywords || [],
          seo_score: contentResult.seo_score || 0,
          viral_potential_score: contentResult.viral_potential_score || 0,
          google_optimized: contentResult.google_optimized || false,
          target_audience: idea.target_audience,
          product_idea_id,
          marketing_campaign_id: campaign.id,
          generated_at: new Date().toISOString(),
          status: "draft"
        });
      } catch (e) {
        console.error("Content generation error for plan item:", e);
      }
    }

    if (contentAssets.length > 0) {
      await sr.ContentAsset.bulkCreate(contentAssets);
    }

    await sr.MarketingCampaign.update(campaign.id, {
      content_assets: contentAssets.map(a => a.asset_id),
      status: "creating_content"
    });

    const factories = await sr.DreamFactory.list();
    if (factories.length > 0) {
      await sr.DreamFactory.update(factories[0].id, {
        campaigns_launched: (factories[0].campaigns_launched || 0) + 1,
        content_created: (factories[0].content_created || 0) + contentAssets.length,
        last_market_at: new Date().toISOString()
      });
    }

    return Response.json({
      status: "success",
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      target_market: marketResult.target_market,
      channels: marketResult.channels,
      messaging_strategy: marketResult.messaging_strategy,
      content_assets_created: contentAssets.length,
      digital_presence_actions: (marketResult.digital_presence_actions || []).length,
      follower_growth_strategy: marketResult.follower_growth_strategy,
      projected_reach: marketResult.projected_reach,
      projected_conversions: marketResult.projected_conversions,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("runMarketingEngine error:", error);
    return Response.json({ status: "error", error: error.message }, { status: 500 });
  }
}