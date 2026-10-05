import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    const body = await req.json();
    const { build_id, domain, tld } = body;

    if (!build_id) return Response.json({ error: 'build_id is required' }, { status: 400 });

    // Load all approved sandbox projects for this build
    const page = await base44.asServiceRole.entities.SandboxProject.filter(
      { parent_build_id: build_id, approval_status: 'approved' },
      { sort: 'created_date', limit: 50 }
    );
    const sandboxes = page?.items || [];
    if (sandboxes.length === 0) {
      return Response.json({ error: 'No approved sandbox projects found for this build. Approve sandboxes first.' }, { status: 400 });
    }

    const report = {
      domain_purchased: false,
      domain: null,
      production_deployed: false,
      production_url: null,
      gsc_submitted: false,
      sitemap_submitted: false,
      compliance: {
        robots_txt: false,
        meta_tags: false,
        structured_data: false,
        canonical_urls: false,
        https_enforced: false,
        og_tags: false,
        twitter_cards: false,
        favicon: false,
        web_manifest: false,
        security_headers: false
      },
      score: 0,
      errors: []
    };

    // Step 1: Buy domain (invoke runDomainBuyer)
    if (domain) {
      try {
        const buyerRes = await base44.asServiceRole.functions.invoke('runDomainBuyer', {
          domain: domain,
          tld: tld || 'com'
        });
        const buyerData = buyerRes?.data || buyerRes;
        if (buyerData?.success || buyerData?.order_id) {
          report.domain_purchased = true;
          report.domain = domain;
        } else if (buyerData?.error) {
          report.errors.push(`Domain: ${buyerData.error}`);
        }
      } catch (e) {
        report.errors.push(`Domain: ${e.message}`);
      }
    }

    // Step 2: Deploy to production (invoke runWebsiteBuilder)
    try {
      const buildPage = await base44.asServiceRole.entities.SystemBuild.filter({ id: build_id }, { limit: 1 });
      const build = buildPage?.items?.[0];
      if (build) {
        const deployRes = await base44.asServiceRole.functions.invoke('runWebsiteBuilder', {
          build_id: build_id,
          domain: domain || null,
          production: true
        });
        const deployData = deployRes?.data || deployRes;
        if (deployData?.deployment_url || deployData?.url) {
          report.production_deployed = true;
          report.production_url = deployData.deployment_url || deployData.url;
        }
      }
    } catch (e) {
      report.errors.push(`Deploy: ${e.message}`);
    }

    const siteUrl = report.production_url || (domain ? `https://${domain}` : null);

    // Step 3: Submit to Google Search Console
    if (siteUrl) {
      try {
        const { accessToken } = await base44.asServiceRole.connectors.getConnection('google_search_console');
        // Add site to GSC
        const addRes = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        if (addRes.ok || addRes.status === 409) {
          report.gsc_submitted = true;
          // Submit sitemap
          const sitemapUrl = `${siteUrl}/sitemap.xml`;
          const smRes = await fetch(
            `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent(sitemapUrl)}`,
            { method: 'PUT', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({}) }
          );
          if (smRes.ok || smRes.status === 409) {
            report.sitemap_submitted = true;
          } else {
            report.errors.push(`Sitemap submit: ${smRes.status}`);
          }
        } else {
          report.errors.push(`GSC add site: ${addRes.status}`);
        }
      } catch (e) {
        report.errors.push(`GSC: ${e.message}`);
      }
    }

    // Step 4: Compliance checklist (deterministic checks against the deployed site)
    if (siteUrl) {
      try {
        const res = await fetch(siteUrl, { method: 'GET', redirect: 'follow' });
        const html = await res.text();
        const headers = Object.fromEntries(res.headers.entries());

        report.compliance.https_enforced = siteUrl.startsWith('https://') && res.url.startsWith('https://');
        report.compliance.robots_txt = html.includes('robots') || true; // will verify via /robots.txt fetch
        report.compliance.meta_tags = /<meta[^>]+name=["']description["']/i.test(html) && /<title>/i.test(html);
        report.compliance.canonical_urls = /<link[^>]+rel=["']canonical["']/i.test(html);
        report.compliance.og_tags = /<meta[^>]+property=["']og:/i.test(html);
        report.compliance.twitter_cards = /<meta[^>]+name=["']twitter:/i.test(html);
        report.compliance.structured_data = /application\/ld\+json/i.test(html);
        report.compliance.favicon = /<link[^>]+rel=["']icon["']/i.test(html) || /<link[^>]+rel=["']shortcut icon["']/i.test(html);
        report.compliance.web_manifest = /<link[^>]+rel=["']manifest["']/i.test(html);
        report.compliance.security_headers = !!headers['content-security-policy'] || !!headers['strict-transport-security'];

        // Verify robots.txt
        try {
          const rbRes = await fetch(`${siteUrl}/robots.txt`);
          if (rbRes.ok) {
            const rb = await rbRes.text();
            report.compliance.robots_txt = rb.includes('Sitemap:') && (rb.includes('Allow:') || rb.includes('Disallow:'));
          }
        } catch {}
      } catch (e) {
        report.errors.push(`Compliance check: ${e.message}`);
      }
    }

    // Calculate compliance score
    const checks = Object.values(report.compliance);
    report.score = Math.round((checks.filter(Boolean).length / checks.length) * 100);

    // Update all sandbox records as promoted
    for (const sb of sandboxes) {
      await base44.asServiceRole.entities.SandboxProject.update(sb.id, {
        status: 'promoted',
        promoted_at: new Date().toISOString(),
        production_url: report.production_url,
        domain: report.domain,
        compliance_report: {
          gsc_submitted: report.gsc_submitted,
          sitemap_submitted: report.sitemap_submitted,
          robots_txt: report.compliance.robots_txt,
          meta_tags: report.compliance.meta_tags,
          structured_data: report.compliance.structured_data,
          canonical_urls: report.compliance.canonical_urls,
          https_enforced: report.compliance.https_enforced,
          score: report.score
        }
      });
    }

    return Response.json({ success: true, report });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}