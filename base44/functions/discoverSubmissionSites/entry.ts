import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { invokeLLM } from '../../shared/vercelAiGateway.ts';
import { searchGatewayWeb } from '../../shared/vercelGateway.ts';

// Directory Submission Discovery Engine
// Finds every website where a business can submit company information
// for online presence building (citations, directories, profiles, review sites).
// Uses Vercel AI Gateway web search + LLM structuring.

const SITE_SCHEMA = {
  type: 'object',
  properties: {
    sites: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          site_name: { type: 'string' },
          url: { type: 'string' },
          signup_url: { type: 'string' },
          category: { type: 'string', enum: ['general_business', 'local_citation', 'industry_specific', 'niche_directory', 'review_site', 'social_profile', 'press_release', 'article_directory', 'forum', 'web_2_0', 'podcast_directory', 'app_directory', 'blog_directory', 'video_directory', 'classified_ads'] },
          submission_type: { type: 'string', enum: ['free', 'paid', 'freemium', 'reciprocal_link'] },
          domain_authority: { type: 'number' },
          industry_relevance: { type: 'string' },
          login_required: { type: 'boolean' },
          notes: { type: 'string' }
        },
        required: ['site_name', 'url', 'category']
      }
    }
  },
  required: ['sites']
};

const SEARCH_QUERIES = (industry: string, location: string) => [
  `best free business directory submission sites ${industry} ${location} 2026 list`,
  `local citation sites ${location} business listing SEO`,
  `${industry} industry directory submission sites list`,
  `free business profile creation sites ${industry} high DA`,
  `social media profile sites for business ${industry} presence`,
  `review sites for ${industry} businesses ${location}`,
  `press release submission sites free ${industry}`,
  `web 2.0 submission sites for SEO backlinks ${industry}`,
  `classified ads sites ${location} business listing`,
  `article directory submission sites ${industry} free`,
  `forum sites for ${industry} industry discussion`,
  `blog directory submission sites ${industry}`,
  `podcast directory submission sites ${industry}`,
  `video sharing sites for business ${industry}`,
  `niche directory sites for ${industry} companies`
];

export default async function(req: any) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const industry = (body.industry || '').trim();
  const location = (body.location || '').trim();
  const categories = Array.isArray(body.categories) ? body.categories : [];
  const maxSites = Math.min(body.max_sites || 200, 500);

  if (!industry) return Response.json({ error: 'industry is required' }, { status: 400 });

  const batchId = `dir_${Date.now()}`;
  const allSites: any[] = [];
  const seenUrls = new Set<string>();

  // Run targeted web searches across multiple directory categories
  const queries = SEARCH_QUERIES(industry, location);
  const queriesToRun = categories.length > 0
    ? queries.filter((_, i) => categories.includes(SEARCH_QUERIES(industry, location)[i]?.split(' ')[0]))
    : queries;

  for (const query of queriesToRun.slice(0, 15)) {
    try {
      const research = await searchGatewayWeb(query);
      // Use LLM to extract structured site list from search results
      const structured = await invokeLLM({
        prompt: `Extract a list of real, specific websites where a business in the "${industry}" industry${location ? ` located in ${location}` : ''} can submit their company information, create a profile, or get listed.

From this web research, identify every distinct website mentioned. For each site, provide:
- site_name: The name of the directory/site
- url: The main website URL
- signup_url: The direct signup or submission URL if mentioned
- category: The type of directory (general_business, local_citation, industry_specific, niche_directory, review_site, social_profile, press_release, article_directory, forum, web_2_0, podcast_directory, app_directory, blog_directory, video_directory, classified_ads)
- submission_type: free, paid, freemium, or reciprocal_link
- domain_authority: Estimated 0-100 (your best estimate)
- industry_relevance: How relevant for this industry
- login_required: Whether an account is needed
- notes: Any submission requirements or notes

Only include REAL sites that actually exist. Do not invent sites. If you are unsure about a specific detail, use null.

Web research results:
${research.summary}

Sources: ${JSON.stringify(research.sources)}`,
        response_json_schema: SITE_SCHEMA,
        model: 'gpt_5_mini'
      });

      for (const site of (structured.sites || [])) {
        const normalizedUrl = (site.url || '').toLowerCase().replace(/\/$/, '').replace(/^https?:\/\//, '');
        if (!normalizedUrl || seenUrls.has(normalizedUrl)) continue;
        seenUrls.add(normalizedUrl);
        allSites.push({
          ...site,
          industry,
          location,
          discovery_batch_id: batchId
        });
      }
    } catch (e) {
      console.error(`Search query failed: ${query}`, e);
    }
  }

  // Deduplicate and cap
  const uniqueSites = allSites.slice(0, maxSites);

  // Save to entity
  let saved = 0;
  if (uniqueSites.length > 0) {
    try {
      const records = uniqueSites.map(s => ({
        site_name: String(s.site_name || '').slice(0, 200),
        url: String(s.url || '').slice(0, 2000),
        signup_url: s.signup_url ? String(s.signup_url).slice(0, 2000) : null,
        category: s.category || 'general_business',
        submission_type: s.submission_type || 'free',
        domain_authority: Number(s.domain_authority) || 0,
        industry_relevance: s.industry_relevance ? String(s.industry_relevance).slice(0, 500) : null,
        login_required: !!s.login_required,
        notes: s.notes ? String(s.notes).slice(0, 1000) : null,
        industry,
        location,
        discovery_batch_id: batchId,
        submission_status: 'discovered'
      }));
      await base44.asServiceRole.entities.DirectorySubmission.bulkCreate(records);
      saved = records.length;
    } catch (e) {
      console.error('Bulk create failed, trying individual:', e);
      for (const rec of uniqueSites) {
        try {
          await base44.asServiceRole.entities.DirectorySubmission.create(rec);
          saved++;
        } catch { /* skip duplicates */ }
      }
    }
  }

  return Response.json({
    ok: true,
    batch_id: batchId,
    industry,
    location,
    total_discovered: uniqueSites.length,
    saved,
    sites: uniqueSites.map(s => ({ site_name: s.site_name, url: s.url, category: s.category, domain_authority: s.domain_authority, submission_type: s.submission_type }))
  });
}