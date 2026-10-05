import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';

const VARIATIONS = (kw) => [`${kw}`, `my${kw}`, `the${kw}`, `${kw}hq`, `get${kw}`, `${kw}co`, `${kw}pro`, `best${kw}`];

async function checkDomain(domain) {
  try {
    const res = await fetch(`https://rdap.org/domain/${domain}`, { signal: AbortSignal.timeout(5000), headers: { Accept: 'application/rdap+json' } });
    if (res.status === 404) return { domain, available: true };
    if (res.ok) return { domain, available: false };
    return { domain, available: null, status: res.status };
  } catch (e) { return { domain, available: null, error: e.message }; }
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const expectedSecret = secrets.get('WORKER_SECRET');
    const isWorker = !!(body?.worker_secret && expectedSecret && body.worker_secret === expectedSecret);
    if (!isWorker) { const user = await base44.auth.me(); if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 }); }

    const keywords = (body.keywords || '').split(',').map(k => k.trim().toLowerCase().replace(/[^a-z0-9]/g, '')).filter(Boolean);
    const tlds = (body.tlds || 'com,net,store,online').split(',').map(t => t.trim().replace(/^\./, '').toLowerCase()).filter(Boolean);
    if (keywords.length === 0) return Response.json({ error: 'keywords required' }, { status: 400 });

    const candidates = [];
    for (const kw of keywords) { for (const variation of VARIATIONS(kw)) { for (const tld of tlds) { candidates.push({ domain: `${variation}.${tld}`, tld, keyword: kw }); } } }
    const limited = candidates.slice(0, 200);
    const results = [];
    for (let i = 0; i < limited.length; i += 20) { const batch = limited.slice(i, i + 20); const batchResults = await Promise.all(batch.map(c => checkDomain(c.domain))); results.push(...batchResults); }
    const availableDomains = results.filter(r => r.available === true).map(r => r.domain);
    const records = availableDomains.map(d => { const parts = d.split('.'); const tld = parts[parts.length - 1]; const kw = keywords.find(k => d.includes(k)) || keywords[0] || ''; return { domain: d, tld, keyword: kw, status: 'available' }; });
    if (records.length > 0) { for (let i = 0; i < records.length; i += 500) { await base44.asServiceRole.entities.DomainInventory.bulkCreate(records.slice(i, i + 500)); } }

    return Response.json({ keywords, tlds, candidates_checked: results.length, available_count: availableDomains.length, available_domains: availableDomains });
  } catch (error) { return Response.json({ error: error.message }, { status: 500 }); }
}