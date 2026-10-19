import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';

// Bidirectional GSC Sync — reads search analytics from Google Search Console
// and updates SEOPage records with live impressions, clicks, position, and CTR.
// Also checks sitemap submission status. This is the persistent bidirectional
// sync that keeps the system's data live with Google's actual indexing data.

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

    let gscToken = null;
    try {
      const conn = await base44.asServiceRole.connectors.getConnection('google_search_console');
      gscToken = conn?.accessToken || null;
    } catch {}
    if (!gscToken) return Response.json({ error: 'Google Search Console not connected' }, { status: 503 });

    // Collect domains from SEOPage records
    const targetDomain = body.domain;
    let pageRes;
    if (targetDomain) {
      pageRes = await sr.SEOPage.filter({ domain: targetDomain, status: 'published' }, { limit: 500 });
    } else {
      pageRes = await sr.SEOPage.filter({ status: 'published' }, { limit: 500 });
    }

    const domainPages = {};
    for (const p of pageRes.items || []) {
      if (!p.domain) continue;
      if (!domainPages[p.domain]) domainPages[p.domain] = [];
      domainPages[p.domain].push(p);
    }

    let totalSynced = 0;
    const domainSummaries = [];

    for (const [domain, pages] of Object.entries(domainPages)) {
      try {
        const siteUrl = domain.startsWith('sc-domain:') ? domain : `https://${domain}`;
        const encoded = encodeURIComponent(siteUrl);
        const startDate = new Date(Date.now() - 28 * 86400000).toISOString().split('T')[0];
        const endDate = new Date().toISOString().split('T')[0];

        // Query by page URL
        const gscRes = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encoded}/searchAnalytics/query`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${gscToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ startDate, endDate, dimensions: ['page'], rowLimit: 1000 }),
        });
        const gscData = await gscRes.json();
        const rows = gscData.rows || [];

        const pageAnalytics = {};
        for (const row of rows) {
          pageAnalytics[row.keys[0]] = {
            impressions: row.impressions || 0, clicks: row.clicks || 0,
            position: row.position || 0, ctr: row.ctr || 0,
          };
        }

        // Check sitemap status
        let sitemapOk = false;
        try {
          const sitemapRes = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encoded}/sitemaps`, {
            headers: { 'Authorization': `Bearer ${gscToken}` },
          });
          const sitemapData = await sitemapRes.json();
          sitemapOk = (sitemapData.sitemapEntry || []).length > 0;
        } catch {}

        let domainSynced = 0;
        for (const page of pages) {
          const pageUrl = page.slug ? `https://${domain}/${page.slug}` : `https://${domain}/`;
          const analytics = pageAnalytics[pageUrl] || pageAnalytics[pageUrl.replace('https://', 'http://')];
          if (analytics) {
            await sr.SEOPage.update(page.id, {
              gsc_impressions: analytics.impressions, gsc_clicks: analytics.clicks,
              gsc_position: analytics.position, gsc_ctr: analytics.ctr,
              gsc_status: analytics.position > 0 ? 'indexed' : 'submitted',
              last_synced_at: new Date().toISOString(),
            });
            domainSynced++; totalSynced++;
          }
        }

        domainSummaries.push({ domain, pages_synced: domainSynced, total_pages: pages.length, sitemap_submitted: sitemapOk });
      } catch (e) {
        domainSummaries.push({ domain, error: e.message });
      }
    }

    return Response.json({
      ok: true, domains_synced: domainSummaries.length,
      pages_synced: totalSynced, domain_summaries: domainSummaries,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}