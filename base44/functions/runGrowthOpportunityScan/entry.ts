import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { invokeLLM } from '../../shared/vercelAiGateway.ts';

// Daily Growth Opportunity Scan — reads GSC search analytics, identifies
// keyword gaps, quick wins (page 2 rankings), CTR optimization opportunities,
// and uses LLM + web search to discover niche insights and competitor
// piggybacking opportunities. Creates GrowthOpportunity records for each.

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const expectedSecret = secrets.get('WORKER_SECRET');
    const isWorker = !!(body?.worker_secret && expectedSecret && body.worker_secret === expectedSecret);
    if (!isWorker) {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sr = base44.asServiceRole.entities;

    // Get GSC connector token
    let gscToken = null;
    try {
      const conn = await base44.asServiceRole.connectors.getConnection('google_search_console');
      gscToken = conn?.accessToken || null;
    } catch {}

    // Collect domains from SEOPage records
    const domains = new Set();
    if (body.domain) {
      domains.add(body.domain);
    } else if (gscToken) {
      const pageRes = await sr.SEOPage.filter({ status: 'published' }, { limit: 500, fields: ['domain'] });
      for (const p of pageRes.items || []) { if (p.domain) domains.add(p.domain); }
    }
    if (domains.size === 0) domains.add('example.com');

    const opportunities = [];

    for (const domain of domains) {
      if (!gscToken) continue;
      try {
        const siteUrl = domain.startsWith('sc-domain:') ? domain : `https://${domain}`;
        const encoded = encodeURIComponent(siteUrl);
        const startDate = new Date(Date.now() - 28 * 86400000).toISOString().split('T')[0];
        const endDate = new Date().toISOString().split('T')[0];

        const gscRes = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encoded}/searchAnalytics/query`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${gscToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ startDate, endDate, dimensions: ['query'], rowLimit: 100 }),
        });
        const gscData = await gscRes.json();
        const rows = gscData.rows || [];

        for (const row of rows) {
          const query = row.keys[0];
          const impressions = row.impressions || 0;
          const clicks = row.clicks || 0;
          const position = row.position || 0;
          const ctr = row.ctr || 0;

          // Quick win: page 2 rankings (positions 11-20)
          if (position >= 11 && position <= 20 && impressions > 20) {
            const opp = await sr.GrowthOpportunity.create({
              domain, opportunity_type: 'content_gap',
              title: `Quick win: "${query}" at position ${position.toFixed(1)} — push to page 1`,
              description: `${impressions} monthly impressions at position ${position.toFixed(1)}. Content optimization could push this to page 1 for an estimated ${Math.round(impressions * 0.15)} additional clicks/month.`,
              keyword: query, search_volume: impressions, current_position: position,
              estimated_traffic: Math.round(impressions * 0.15), priority: 'P0',
              action_required: 'Optimize existing content or create new content targeting this query with better on-page SEO',
              status: 'new', discovered_at: new Date().toISOString(),
            });
            opportunities.push({ id: opp.id, type: 'content_gap', keyword: query });
          }

          // CTR optimization: high impressions, low CTR, page 1
          if (impressions > 50 && ctr < 0.03 && position <= 10) {
            const opp = await sr.GrowthOpportunity.create({
              domain, opportunity_type: 'keyword_gap',
              title: `Optimize CTR for "${query}" — ${impressions} impressions, ${(ctr * 100).toFixed(1)}% CTR`,
              description: `Position ${position.toFixed(1)} with ${impressions} impressions but only ${(ctr * 100).toFixed(1)}% CTR. Better title tag and meta description could double clicks.`,
              keyword: query, search_volume: impressions, current_position: position,
              estimated_traffic: Math.round(impressions * 0.05), priority: 'P1',
              action_required: 'Rewrite title tag and meta description to improve click-through rate',
              status: 'new', discovered_at: new Date().toISOString(),
            });
            opportunities.push({ id: opp.id, type: 'keyword_gap', keyword: query });
          }
        }
      } catch (e) { /* skip domain on error */ }
    }

    // LLM-powered niche insights + competitor piggybacking + AEO opportunities
    try {
      const llmRes = await invokeLLM({
        prompt: `You are a digital dominance strategist for domains: ${[...domains].join(', ')}.
Identify 5 high-impact growth opportunities:
1. Niche insights — underserved long-tail keywords or content clusters
2. Competitor piggybacking — keywords where competitors rank but we don't
3. AEO opportunities — questions we should answer to capture answer engine traffic
4. Geo expansion — cities/regions we should target
5. Social trends — trending topics we should create content around

Return a JSON object with an "opportunities" array, each having: type (one of: niche_insight, competitor_piggyback, aeo_opportunity, geo_expansion, social_trend), title, description, keyword, action_required, priority (P0-P3).`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            opportunities: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  title: { type: 'string' },
                  description: { type: 'string' },
                  keyword: { type: 'string' },
                  action_required: { type: 'string' },
                  priority: { type: 'string' },
                },
              },
            },
          },
        },
      });

      for (const opp of (llmRes.opportunities || []).slice(0, 5)) {
        const validTypes = ['niche_insight', 'competitor_piggyback', 'aeo_opportunity', 'geo_expansion', 'social_trend'];
        const type = validTypes.includes(opp.type) ? opp.type : 'niche_insight';
        const record = await sr.GrowthOpportunity.create({
          domain: [...domains][0] || '', opportunity_type: type,
          title: opp.title, description: opp.description, keyword: opp.keyword || '',
          priority: ['P0', 'P1', 'P2', 'P3'].includes(opp.priority) ? opp.priority : 'P2',
          action_required: opp.action_required, ai_recommendation: opp.description,
          status: 'new', discovered_at: new Date().toISOString(),
        });
        opportunities.push({ id: record.id, type, title: record.title });
      }
    } catch (e) { /* best effort LLM insights */ }

    return Response.json({
      ok: true, domains_scanned: domains.size,
      opportunities_discovered: opportunities.length, opportunities,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}