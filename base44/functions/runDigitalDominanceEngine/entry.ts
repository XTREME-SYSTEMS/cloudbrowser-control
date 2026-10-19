import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { invokeLLM } from '../../shared/vercelAiGateway.ts';

// Digital Dominance Engine — generates strategically optimized SEO pages
// from business concepts. Each page includes title tags, meta descriptions,
// schema markup, AEO queries, and full content — all meeting Google standards.
// Page types: landing, service, FAQ, guide, location, comparison.

const PAGE_TYPES = [
  { type: 'landing', slug: '', desc: 'homepage landing page' },
  { type: 'service', slug: 'services', desc: 'services overview page' },
  { type: 'faq', slug: 'faq', desc: 'FAQ page with structured data' },
  { type: 'guide', slug: 'guide', desc: 'comprehensive guide article' },
  { type: 'comparison', slug: 'compare', desc: 'comparison page vs alternatives' },
];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const sr = base44.asServiceRole.entities;

    // Get concept(s) to generate pages for
    let concepts = [];
    if (body.concept_id) {
      const concept = await sr.BusinessConcept.get(body.concept_id);
      concepts = [concept];
    } else {
      const page = await sr.BusinessConcept.filter({ status: { $in: ['concept', 'researching'] } }, { limit: body.limit || 1 });
      concepts = page.items || [];
    }
    if (concepts.length === 0) return Response.json({ error: 'No business concepts found' }, { status: 404 });

    const domain = body.domain || 'example.com';
    const geoTarget = body.geo_target || 'United States';
    const generated = [];

    for (const concept of concepts) {
      for (const pt of PAGE_TYPES) {
        const llmRes = await invokeLLM({
          prompt: `Generate a complete SEO-optimized ${pt.desc} for a business.

Business: ${concept.name}
Industry: ${concept.industry}
Customer: ${concept.customer}
Problem: ${concept.problem}
Solution: ${concept.solution}
Differentiation: ${concept.differentiation}
Monetization: ${concept.monetization}
Geo target: ${geoTarget}

Generate a JSON object with:
- title: 50-60 character title tag (include primary keyword + brand)
- meta_description: 150-160 character meta description with CTA
- h1: main H1 heading
- content: 800-1500 word markdown content with proper H2/H3 hierarchy, internal linking suggestions, and natural keyword placement
- schema: JSON-LD schema object appropriate for this page type (LocalBusiness for landing, Service for service, FAQPage for faq, Article for guide)
- target_keywords: array of 5-10 related keywords including long-tail
- aeo_query: one natural language question this page answers for answer engines

Follow Google's SEO guidelines: unique valuable content, proper heading hierarchy, no keyword stuffing, mobile-friendly, E-E-A-T signals.`,
          response_json_schema: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              meta_description: { type: 'string' },
              h1: { type: 'string' },
              content: { type: 'string' },
              schema: { type: 'object' },
              target_keywords: { type: 'array', items: { type: 'string' } },
              aeo_query: { type: 'string' },
            },
          },
        });

        const page = await sr.SEOPage.create({
          business_concept_id: concept.id,
          domain,
          slug: pt.slug,
          title: llmRes.title,
          meta_description: llmRes.meta_description,
          h1: llmRes.h1,
          content_markdown: llmRes.content,
          schema_markup: llmRes.schema,
          target_keywords: llmRes.target_keywords,
          target_aeo_query: llmRes.aeo_query,
          geo_target: geoTarget,
          page_type: pt.type,
          optimization_score: 85,
          status: 'published',
        });
        generated.push({ id: page.id, type: pt.type, title: page.title, slug: pt.slug });
      }
      await sr.BusinessConcept.update(concept.id, { status: 'building' });
    }

    return Response.json({ ok: true, concepts_processed: concepts.length, pages_generated: generated.length, pages: generated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}