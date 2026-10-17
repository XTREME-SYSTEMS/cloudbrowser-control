import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";

export default async function(req) {
  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { industry, target_market, buyer_profiles, pipeline_id } = body;

    const buyerContext = buyer_profiles ? `Buyer profiles: ${JSON.stringify(buyer_profiles).slice(0, 2000)}` : "";

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an elite sales strategist and copywriter. Generate complete sales assets for: Industry="${industry}", Target="${target_market}".

${buyerContext}

Generate:
1. SALES PITCHES (3 variants) — 30-second elevator pitch, 2-minute full pitch, written one-pager
2. SALES SCRIPTS — cold call script, warm call script, discovery call script, demo script, closing script
3. OBJECTION REBUTTALS — for the top 15 common objections in this industry (price, timing, trust, competitor, need, authority, etc.)
4. SMS TEMPLATES (10) — short, punchy, compliance-safe SMS sequences for outreach
5. MMS TEMPLATES (5) — with image/media suggestions
6. AI VOICE TEMPLATES (5) — scripts for AI voice calls, with tone, pace, and pause instructions
7. EMAIL SEQUENCES (3 sequences, 5 emails each) — cold outreach, nurture, re-engagement
8. SOCIAL DM TEMPLATES (10) — for LinkedIn, Instagram, Facebook, Twitter outreach
9. SCROLL-STOPPING AD COPY (10) — Facebook/Instagram ad headlines and primary text
10. LANDING PAGE COPY — hero, subhead, CTA, social proof, FAQ
11. UNIQUE OUTREACH METHODS — 5 unconventional methods no one in this industry is using
12. WHATSAPP TEMPLATES (5) — for direct messaging

For each, include:
- The actual copy (ready to use)
- The psychological principle it leverages
- Personalization variables (use [COMPANY], [NAME], [INDUSTRY] placeholders)
- Compliance notes (TCPA, CAN-SPAM, platform rules)

Return structured JSON.`,
      response_json_schema: {
        type: "object",
        properties: {
          sales_pitches: { type: "array", items: { type: "object" } },
          sales_scripts: { type: "array", items: { type: "object" } },
          objection_rebuttals: { type: "array", items: { type: "object" } },
          sms_templates: { type: "array", items: { type: "string" } },
          mms_templates: { type: "array", items: { type: "object" } },
          voice_templates: { type: "array", items: { type: "object" } },
          email_sequences: { type: "array", items: { type: "object" } },
          social_dm_templates: { type: "array", items: { type: "string" } },
          ad_copy: { type: "array", items: { type: "object" } },
          landing_page_copy: { type: "object" },
          unique_methods: { type: "array", items: { type: "string" } },
          whatsapp_templates: { type: "array", items: { type: "string" } }
        }
      }
    });

    if (pipeline_id) {
      await base44.entities.IntelligencePipeline.update(pipeline_id, { sales_assets: result });
    }

    return Response.json({ ok: true, data: result });
  } catch (error) {
    console.error("runSalesAssetGenerator error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}