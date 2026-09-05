import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Follow the Money — tracks money flows in the AI, data, and data center space
// Uses web search to discover the latest investments, acquisitions, and spending
// then stores them as MoneyTrail records with Vision Cortex interpretation.
//
// Input: { categories?: string[], limit?: number }
// Output: { trails_created, trails_by_category, money_flow_summary, total_tracked }

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const sr = base44.asServiceRole.entities;
    const categories = req.body?.categories || [
      'data_center', 'ai_infrastructure', 'data_acquisition', 'gpu_compute', 'cloud_expansion'
    ];

    const allTrails = [];
    let marketSummary = { total_market_size: 'Unknown', biggest_spender: 'Unknown', elite_priority: 'Data acquisition and AI infrastructure' };

    // Search for latest money flows
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a financial intelligence analyst tracking money flows in the AI, data, and data center space. Search the web for the latest 2025-2026 investments, acquisitions, and spending.

Focus on these categories: ${categories.join(', ')}

For each category, identify the TOP 5 most significant money flows. For each flow:
- entity: Company/fund name (e.g. Microsoft, Google, Amazon, Meta, OpenAI, Nvidia, Blackstone, etc.)
- entity_type: "tech_giant" | "ai_lab" | "hedge_fund" | "private_equity" | "vc_firm" | "data_broker" | "cloud_provider" | "chip_maker" | "government" | "startup"
- flow_type: "investment" | "acquisition" | "spending" | "revenue" | "grant" | "ipo" | "buyback" | "infrastructure_spend"
- amount_usd: Amount in millions (number)
- amount_display: Human-readable (e.g. "$10B", "$500M")
- direction: "inflow" | "outflow" | "circular"
- category: One of the focus categories
- description: What the money is for (2-3 sentences)
- date: Approximate date (YYYY-MM-DD format)
- significance: 1-10 (how significant to the data/AI landscape)
- elite_motive: What strategic motive this reveals (control, monopoly, surveillance, competitive moat, AI dominance, data hoarding, etc.)

Also identify:
- What is the total money flowing into data centers in 2025-2026?
- Who is the biggest spender and why?
- What does the money trail tell us about elite priorities?

Return as JSON: { "flows": [...], "total_market_size": "string", "biggest_spender": "string", "elite_priority": "string" }`,
        add_context_from_internet: true,
        model: 'gemini_3_flash',
        response_json_schema: {
          type: 'object',
          properties: {
            flows: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  entity: { type: 'string' },
                  entity_type: { type: 'string' },
                  flow_type: { type: 'string' },
                  amount_usd: { type: 'number' },
                  amount_display: { type: 'string' },
                  direction: { type: 'string' },
                  category: { type: 'string' },
                  description: { type: 'string' },
                  date: { type: 'string' },
                  significance: { type: 'number' },
                  elite_motive: { type: 'string' },
                },
              },
            },
            total_market_size: { type: 'string' },
            biggest_spender: { type: 'string' },
            elite_priority: { type: 'string' },
          },
        },
      });

      if (res.total_market_size) marketSummary.total_market_size = res.total_market_size;
      if (res.biggest_spender) marketSummary.biggest_spender = res.biggest_spender;
      if (res.elite_priority) marketSummary.elite_priority = res.elite_priority;

      for (const flow of (res.flows || [])) {
        allTrails.push({
          entity_name: flow.entity,
          entity_type: flow.entity_type || 'tech_giant',
          flow_type: flow.flow_type,
          amount_usd: flow.amount_usd || 0,
          amount_display: flow.amount_display || '',
          direction: flow.direction || 'outflow',
          category: flow.category,
          description: flow.description,
          date: flow.date || new Date().toISOString().split('T')[0],
          significance: flow.significance || 5,
          elite_motive: flow.elite_motive || '',
        });
      }

      // Now use Vision Cortex to interpret each money trail
      for (const trail of allTrails) {
        try {
          const interpRes = await base44.integrations.Core.InvokeLLM({
            prompt: `You are Vision Cortex, the intelligence core of Cloud Browser. Interpret this money flow:

Entity: ${trail.entity_name}
Flow: ${trail.flow_type} ${trail.amount_display} (${trail.direction})
Category: ${trail.category}
Description: ${trail.description}
Elite Motive: ${trail.elite_motive}

Provide a strategic interpretation (2-3 sentences):
- What does this money flow reveal about the entity's strategy?
- How does this connect to the broader data acquisition landscape?
- What opportunity or threat does this create for Cloud Browser?

Return as JSON: { "interpretation": "string" }`,
            model: 'gemini_3_flash',
            response_json_schema: {
              type: 'object',
              properties: {
                interpretation: { type: 'string' },
              },
            },
          });
          trail.vision_cortex_interpretation = interpRes.interpretation || '';
        } catch {}
      }
    } catch (e) {
      console.error('Money flow search error:', e.message);
    }

    // Bulk create money trails
    let created = [];
    if (allTrails.length > 0) {
      try {
        created = await sr.MoneyTrail.bulkCreate(allTrails);
      } catch (e) {
        for (let i = 0; i < allTrails.length; i += 50) {
          try {
            const batch = await sr.MoneyTrail.bulkCreate(allTrails.slice(i, i + 50));
            created = created.concat(batch);
          } catch (e2) { console.error('MoneyTrail batch error:', e2.message); }
        }
      }
    }

    // Count by category
    const byCategory = {};
    let totalAmount = 0;
    for (const t of allTrails) {
      byCategory[t.category] = (byCategory[t.category] || 0) + 1;
      totalAmount += t.amount_usd || 0;
    }

    // Get total tracked (all time)
    let totalTracked = 0;
    try {
      const all = await sr.MoneyTrail.list('-created_date', 500);
      totalTracked = all?.length || allTrails.length;
    } catch {}

    return Response.json({
      trails_created: created.length,
      trails_by_category: byCategory,
      total_amount_millions: totalAmount,
      total_tracked: totalTracked,
      money_flow_summary: marketSummary,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}