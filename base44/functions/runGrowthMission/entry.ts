import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const targetDomain = (body?.domain || 'benearme.com').trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    const trace = [];
    const log = (stage, detail) => trace.push({ stage, ...detail });

    const found = await base44.asServiceRole.entities.Domain.filter({ domain: targetDomain }, { limit: 1 });
    let domain = found.items?.[0];
    log('load_domain', { found: !!domain, id: domain?.id || null });

    if (!domain) {
      domain = await base44.asServiceRole.entities.Domain.create({ domain: targetDomain, canonical_url: `https://${targetDomain}`, status: 'onboarding' });
      log('create_domain', { id: domain.id });
    }

    let robotsStatus = 'unknown';
    let sitemapUrl = '';
    try {
      const r = await fetch(`https://${targetDomain}/robots.txt`, { method: 'GET' });
      robotsStatus = r.ok ? 'present' : `http_${r.status}`;
      if (r.ok) { const txt = await r.text(); const sm = txt.split('\n').map(l => l.trim()).find(l => /^sitemap:/i.test(l)); if (sm) sitemapUrl = sm.replace(/^sitemap:\s*/i, ''); }
    } catch (e) { robotsStatus = `fetch_error: ${e.message}`; }
    log('fetch_robots', { robotsStatus, sitemapUrl });

    if (!sitemapUrl) {
      for (const candidate of [`https://${targetDomain}/sitemap.xml`, `https://${targetDomain}/sitemap_index.xml`]) {
        try { const r = await fetch(candidate, { method: 'GET' }); if (r.ok) { sitemapUrl = candidate; break; } } catch (_) {}
      }
    }
    log('discover_sitemap', { sitemapUrl });

    let urlCount = 0; let sitemapOk = false;
    if (sitemapUrl) {
      try { const r = await fetch(sitemapUrl, { method: 'GET' }); sitemapOk = r.ok; if (r.ok) { const xml = await r.text(); urlCount = (xml.match(/<loc>/g) || []).length; } } catch (e) { sitemapOk = false; }
    }
    log('inspect_sitemap', { sitemapOk, urlCount });

    let health = 0;
    if (robotsStatus === 'present') health += 25;
    if (sitemapOk) health += 35;
    if (urlCount > 0) health += Math.min(20, Math.floor(urlCount / 5));
    health = Math.min(100, health);
    log('compute_health', { health });

    const updated = await base44.asServiceRole.entities.Domain.update(domain.id, {
      status: sitemapOk ? 'active' : 'issues', sitemap_url: sitemapUrl || null, robots_status: robotsStatus,
      health_score: health, next_action: sitemapOk ? 'Submit sitemap to Search Console + configure GA4' : 'Generate and publish a sitemap', last_audit: new Date().toISOString()
    });
    log('update_domain', { id: updated.id, status: updated.status, health: updated.health_score });

    const task1 = await base44.asServiceRole.entities.AgentTask.create({ agent_name: 'growth_operator', title: `Submit sitemap for ${targetDomain}`, task_type: 'submit_sitemap', priority: 'high', description: `Autonomous dispatch: submit ${sitemapUrl || 'pending sitemap'} to Google Search Console for ${targetDomain}.`, autonomous: true, status: 'pending' });
    log('create_task', { id: task1.id, type: 'submit_sitemap', autonomous: true });

    const task2 = await base44.asServiceRole.entities.AgentTask.create({ agent_name: 'growth_operator', title: `Configure GA4 property for ${targetDomain}`, task_type: 'configure_ga4', priority: 'medium', description: `Autonomous dispatch: create GA4 property + web stream for ${targetDomain}. Requires Google API credentials.`, autonomous: false, status: 'pending' });
    log('create_task', { id: task2.id, type: 'configure_ga4', autonomous: false });

    return Response.json({ domain: targetDomain, autonomous: true, llm_used: false, stages_executed: trace.length, result: { robots_status: robotsStatus, sitemap_url: sitemapUrl, sitemap_ok: sitemapOk, urls_in_sitemap: urlCount, health_score: health, domain_status: updated.status, domain_id: updated.id, tasks_created: [task1.id, task2.id] }, trace });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}