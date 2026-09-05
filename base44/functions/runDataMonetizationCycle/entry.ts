import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";

// Autonomous Data Monetization Cycle
// Turns scored intelligence artifacts → monetizable data assets → buyer profiles
// → prospect companies → enriched contacts → branded outreach campaigns → scheduled messages

const BRANDS = {
  leadgenerationnearyou: {
    name: "Lead Generation Near You",
    email: "info@leadgenerationnearyou.com",
    domain: "leadgenerationnearyou.com",
    tagline: "High-intent leads, delivered.",
    signature: "Lead Generation Near You\ninfo@leadgenerationnearyou.com\nhttps://leadgenerationnearyou.com"
  },
  hiddenpropertyintel: {
    name: "Hidden Property Intel",
    email: "info@hiddenpropertyintel.com",
    domain: "hiddenpropertyintel.com",
    tagline: "Property intelligence others can't see.",
    signature: "Hidden Property Intel\ninfo@hiddenpropertyintel.com\nhttps://hiddenpropertyintel.com"
  }
};

function pickBrand(dataCategory) {
  // Real estate / property data → Hidden Property Intel; everything else → Lead Gen Near You
  if (dataCategory === "real_estate" || dataCategory === "niche_intel") return "hiddenpropertyintel";
  return "leadgenerationnearyou";
}

export default async function (req) {
  const base44 = createClientFromRequest(req);
  const startedAt = Date.now();
  const stats = {
    artifacts_evaluated: 0,
    data_assets_created: 0,
    buyer_profiles_generated: 0,
    prospects_discovered: 0,
    prospects_enriched: 0,
    campaigns_created: 0,
    messages_scheduled: 0,
    errors: [],
  };

  try {
    // ── 1. Pull high-score intelligence artifacts ──────────────────────────
    const artifacts = await base44.asServiceRole.entities.IntelligenceArtifact.filter({
      confidence_score: { $gte: 60 }
    }, "-created_date", 20);

    stats.artifacts_evaluated = artifacts.length;
    if (artifacts.length === 0) {
      return Response.json({ ok: true, message: "No high-score artifacts to monetize yet", stats, duration_ms: Date.now() - startedAt, __v: DEPLOYMENT_VERSION });
    }

    // ── 2. Score & convert artifacts → DataAssets ─────────────────────────
    const assetBatch = [];
    for (const art of artifacts) {
      // Skip if a DataAsset already exists for this artifact
      const existing = await base44.asServiceRole.entities.DataAsset.filter({ source_artifact_id: art.id }, "-created_date", 1);
      if (existing.length > 0) continue;

      const scoreRes = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a data monetization expert. Evaluate this intelligence artifact for its monetization potential as a sellable data asset.

Artifact title: ${art.title}
Type: ${art.artifact_type}
Content: ${art.content?.slice(0, 1500) || ""}
Vision Cortex analysis: ${(art.vision_cortex_analysis || "").slice(0, 800)}
Tags: ${(art.tags || []).join(", ")}

Return JSON with:
- title: a compelling name for this data asset
- description: what the data contains and why it's valuable to buyers
- data_category: one of real_estate, b2b_leads, consumer_data, market_intel, ai_training, scraped_records, api_access, enriched_datasets, niche_intel, competitive_intel
- data_type: one of dataset, api, lead_list, scraped_records, market_report, enriched_records, niche_intel
- monetization_score (0-100): overall sellability
- freshness_score (0-100)
- uniqueness_score (0-100): how rare vs competitors
- demand_score (0-100): market demand
- estimated_value_usd: per-record or per-dataset value in USD
- pricing_model: per_record, per_dataset, subscription, api_access, or tiered
- ideal_buyer_description: who would buy this and why
- competitive_advantage: why this beats competitor data
- sample_fields: 3-6 field names the data would contain
- tags: 3-5 tags`,
        model: "gemini_3_flash",
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            data_category: { type: "string" },
            data_type: { type: "string" },
            monetization_score: { type: "number" },
            freshness_score: { type: "number" },
            uniqueness_score: { type: "number" },
            demand_score: { type: "number" },
            estimated_value_usd: { type: "number" },
            pricing_model: { type: "string" },
            ideal_buyer_description: { type: "string" },
            competitive_advantage: { type: "string" },
            sample_fields: { type: "array", items: { type: "string" } },
            tags: { type: "array", items: { type: "string" } }
          }
        }
      });

      const s = scoreRes || {};
      assetBatch.push({
        title: s.title || art.title,
        description: s.description || art.content?.slice(0, 500) || "",
        source_artifact_id: art.id,
        data_category: s.data_category || "scraped_records",
        data_type: s.data_type || "scraped_records",
        sample_fields: s.sample_fields || [],
        monetization_score: s.monetization_score || 50,
        freshness_score: s.freshness_score || 50,
        uniqueness_score: s.uniqueness_score || 50,
        demand_score: s.demand_score || 50,
        estimated_value_usd: s.estimated_value_usd || 0,
        pricing_model: s.pricing_model || "per_record",
        ideal_buyer_description: s.ideal_buyer_description || "",
        competitive_advantage: s.competitive_advantage || "",
        status: "scored",
        tags: s.tags || art.tags || [],
        vision_cortex_analysis: art.vision_cortex_analysis || ""
      });
    }

    if (assetBatch.length > 0) {
      await base44.asServiceRole.entities.DataAsset.bulkCreate(assetBatch);
      stats.data_assets_created = assetBatch.length;
    }

    // ── 3. For each new DataAsset, find prospects & build campaigns ───────
    const newAssets = await base44.asServiceRole.entities.DataAsset.filter({ status: "scored" }, "-monetization_score", 10);

    for (const asset of newAssets) {
      const brandKey = pickBrand(asset.data_category);
      const brand = BRANDS[brandKey];

      // 3a. Discover prospect companies via web search
      const prospectRes = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a B2B lead generation researcher. For this data asset, find 5 real companies that would be ideal buyers.

Data asset: ${asset.title}
Category: ${asset.data_category}
Description: ${asset.description}
Ideal buyer: ${asset.ideal_buyer_description}
Sample fields: ${(asset.sample_fields || []).join(", ")}

Search the web for REAL companies that match this buyer profile. For each, return:
- company_name: real company name
- industry: their industry
- website: their real website URL
- contact_name: a likely decision-maker name (best guess from research)
- contact_title: their title (e.g. "Head of Data", "VP Procurement")
- contact_email: best-guess or found email
- linkedin_url: company or contact LinkedIn if found
- estimated_data_budget_usd: annual data acquisition budget estimate
- current_data_providers: data vendors they likely already use
- data_needs: what data they need to acquire
- buying_signals: signals they're in market for data
- match_score (0-100): how well they match the ideal buyer

Return an array of 5 prospects. Only include real, findable companies.`,
        model: "gemini_3_flash",
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            prospects: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  company_name: { type: "string" },
                  industry: { type: "string" },
                  website: { type: "string" },
                  contact_name: { type: "string" },
                  contact_title: { type: "string" },
                  contact_email: { type: "string" },
                  linkedin_url: { type: "string" },
                  estimated_data_budget_usd: { type: "number" },
                  current_data_providers: { type: "array", items: { type: "string" } },
                  data_needs: { type: "array", items: { type: "string" } },
                  buying_signals: { type: "array", items: { type: "string" } },
                  match_score: { type: "number" }
                }
              }
            }
          }
        }
      });

      const prospects = (prospectRes?.prospects || []).filter(p => p.company_name && p.company_name !== "N/A");
      if (prospects.length === 0) {
        stats.errors.push(`No prospects found for asset ${asset.title}`);
        continue;
      }

      // 3b. Create prospect records
      const prospectRecords = prospects.map(p => ({
        company_name: p.company_name,
        industry: p.industry || "",
        website: p.website || "",
        contact_name: p.contact_name || "",
        contact_email: p.contact_email || "",
        contact_title: p.contact_title || "",
        linkedin_url: p.linkedin_url || "",
        estimated_data_budget_usd: p.estimated_data_budget_usd || 0,
        current_data_providers: p.current_data_providers || [],
        data_needs: p.data_needs || [],
        buying_signals: p.buying_signals || [],
        match_score: p.match_score || 50,
        data_asset_id: asset.id,
        status: "qualified",
        source: "vision_cortex_autonomous_search",
        enrichment_data: p,
        vision_cortex_analysis: `Match score ${p.match_score || 50}/100. Budget est. $${p.estimated_data_budget_usd || 0}. Signals: ${(p.buying_signals || []).join("; ")}`,
        last_researched_at: new Date().toISOString()
      }));

      const createdProspects = await base44.asServiceRole.entities.Prospect.bulkCreate(prospectRecords);
      stats.prospects_discovered += createdProspects.length;
      stats.buyer_profiles_generated += 1;

      // 3c. Generate branded email + proposal templates
      const topBudget = Math.max(...prospects.map(p => p.estimated_data_budget_usd || 0).filter(Boolean));
      const offerPrice = Math.round((topBudget > 0 ? topBudget * 0.4 : asset.estimated_value_usd || 500) / 10) * 10;

      const templateRes = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an expert B2B cold outreach copywriter. Create a personalized email campaign for selling this data asset to the prospects found.

Brand: ${brand.name} (${brand.email})
Data asset: ${asset.title}
Description: ${asset.description}
Category: ${asset.data_category}
Competitive advantage: ${asset.competitive_advantage}
Sample fields: ${(asset.sample_fields || []).join(", ")}
Estimated competitor price: $${topBudget || asset.estimated_value_usd || 0}/year
Our offer price: $${offerPrice}

Write:
1. email_subject: a compelling, non-spammy subject line (under 60 chars)
2. email_body_template: a personalized cold email. Use {{contact_name}}, {{company}}, {{data_description}} as placeholders. Keep it under 180 words. Professional, value-first, mention the cost savings vs competitors. End with a soft CTA for a 15-min call. Include this signature:
${brand.signature}
3. proposal_template: a short branded proposal in markdown (under 300 words) with sections: Overview, What's Included, Pricing, Why Us, Next Steps. Reference ${brand.name}.
4. followup_1_subject: follow-up subject (3 days later)
5. followup_1_body: short 80-word follow-up referencing the first email
6. followup_2_body: 60-word value-add follow-up (6 days later) with a different angle
7. followup_3_body: 50-word final break-up email (9 days later)`,
        model: "claude_sonnet_4_6",
        response_json_schema: {
          type: "object",
          properties: {
            email_subject: { type: "string" },
            email_body_template: { type: "string" },
            proposal_template: { type: "string" },
            followup_1_subject: { type: "string" },
            followup_1_body: { type: "string" },
            followup_2_body: { type: "string" },
            followup_3_body: { type: "string" }
          }
        }
      });

      const t = templateRes || {};

      // 3d. Create the campaign
      const campaign = await base44.asServiceRole.entities.OutreachCampaign.create({
        name: `${asset.title} → ${prospects.length} prospects`,
        data_asset_id: asset.id,
        prospect_ids: createdProspects.map(p => p.id),
        sender_email: brand.email,
        sender_name: brand.name,
        brand_entity: brandKey,
        email_subject: t.email_subject || `${asset.title} — data your team can use`,
        email_body_template: t.email_body_template || "",
        proposal_template: t.proposal_template || "",
        offer_price_usd: offerPrice,
        competitor_price_estimate_usd: topBudget || asset.estimated_value_usd || 0,
        follow_up_interval_days: 3,
        max_followups: 3,
        status: "active",
        vision_cortex_strategy: `Targeting ${prospects.length} ${asset.data_category} buyers. Offer $${offerPrice} vs est. competitor spend $${topBudget}. 3-day follow-up cadence.`,
        created_at: new Date().toISOString(),
        activated_at: new Date().toISOString()
      });
      stats.campaigns_created += 1;

      // 3e. Schedule initial + follow-up messages for each prospect
      const now = new Date();
      const messages = [];
      for (const p of createdProspects) {
        const filledBody = (t.email_body_template || "")
          .replace(/{{contact_name}}/g, p.contact_name || "there")
          .replace(/{{company}}/g, p.company_name)
          .replace(/{{data_description}}/g, asset.description?.slice(0, 200) || asset.title);

        // Initial message — scheduled for now (export-ready)
        messages.push({
          campaign_id: campaign.id,
          prospect_id: p.id,
          prospect_email: p.contact_email || "",
          message_type: "initial",
          subject: t.email_subject || "",
          body: filledBody,
          scheduled_for: now.toISOString(),
          status: "scheduled",
          send_method: "export"
        });
        // Follow-ups at +3, +6, +9 days
        const followups = [
          { type: "followup_1", subject: t.followup_1_subject, body: t.followup_1_body, days: 3 },
          { type: "followup_2", subject: `Re: ${t.email_subject || ""}`, body: t.followup_2_body, days: 6 },
          { type: "followup_3", subject: `Re: ${t.email_subject || ""}`, body: t.followup_3_body, days: 9 }
        ];
        for (const f of followups) {
          const filled = (f.body || "")
            .replace(/{{contact_name}}/g, p.contact_name || "there")
            .replace(/{{company}}/g, p.company_name)
            .replace(/{{data_description}}/g, asset.description?.slice(0, 200) || asset.title);
          messages.push({
            campaign_id: campaign.id,
            prospect_id: p.id,
            prospect_email: p.contact_email || "",
            message_type: f.type,
            subject: f.subject || "",
            body: filled,
            scheduled_for: new Date(now.getTime() + f.days * 86400000).toISOString(),
            status: "scheduled",
            send_method: "export"
          });
        }
      }

      if (messages.length > 0) {
        await base44.asServiceRole.entities.OutreachMessage.bulkCreate(messages);
        stats.messages_scheduled += messages.length;
      }

      // Mark asset as in outreach
      await base44.asServiceRole.entities.DataAsset.update(asset.id, { status: "in_outreach" });
      stats.prospects_enriched += createdProspects.length;
    }

    return Response.json({
      ok: true,
      message: "Data monetization cycle complete",
      stats,
      duration_ms: Date.now() - startedAt,
      __v: DEPLOYMENT_VERSION
    });
  } catch (error) {
    stats.errors.push(error.message);
    return Response.json({ ok: false, error: error.message, stats, duration_ms: Date.now() - startedAt, __v: DEPLOYMENT_VERSION }, { status: 500 });
  }
}