import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { target_urls = [], primary_goal = '' } = body;

    if (!target_urls.length) {
      return Response.json({ error: 'No target URLs provided' }, { status: 400 });
    }

    // Use LLM with web search to gather intelligence about the target sites
    const llmResponse = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an expert web automation analyst. Analyze these target websites and their industry to build an intelligence profile for a browser automation platform.

Target websites: ${target_urls.join(', ')}

User's primary goal: ${primary_goal}

Research these websites and their industry. Generate a JSON intelligence report with:
1. site_summaries: array of { url, site_type, description, key_pages, data_available }
   - site_type: "ecommerce" | "directory" | "news" | "saas" | "social" | "real_estate" | "jobs" | "other"
   - key_pages: list of important page types (product pages, listings, search results, etc.)
   - data_available: what structured data can be extracted
2. industry_intelligence: {
     common_patterns: recurring site structures in this industry,
     anti_bot_measures: likely captcha/protection systems,
     recommended_approach: best scraping strategy,
     rate_limit_considerations: how to avoid getting blocked
   }
3. recommended_capabilities: which CloudBrowser capabilities to enable ["scraper", "headless_browser", "form_filler", "captcha_solver", "clone_engine", "ai_agent", "proxy_rotation", "stealth_mode"]
4. extraction_strategy: {
     primary_selectors: likely CSS selectors or patterns for key data,
     pagination_pattern: how the site paginates,
     dynamic_content: whether JS rendering is needed
   }

Be specific and practical. This intelligence will configure the user's AI agents.`,
      add_context_from_internet: true,
      response_json_schema: {
        type: 'object',
        properties: {
          site_summaries: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                url: { type: 'string' },
                site_type: { type: 'string' },
                description: { type: 'string' },
                key_pages: { type: 'array', items: { type: 'string' } },
                data_available: { type: 'array', items: { type: 'string' } },
              },
            },
          },
          industry_intelligence: {
            type: 'object',
            properties: {
              common_patterns: { type: 'string' },
              anti_bot_measures: { type: 'string' },
              recommended_approach: { type: 'string' },
              rate_limit_considerations: { type: 'string' },
            },
          },
          recommended_capabilities: { type: 'array', items: { type: 'string' } },
          extraction_strategy: {
            type: 'object',
            properties: {
              primary_selectors: { type: 'string' },
              pagination_pattern: { type: 'string' },
              dynamic_content: { type: 'boolean' },
            },
          },
        },
      },
    });

    const intelligence = llmResponse.data || llmResponse;

    // Save to onboarding profile
    const existing = await base44.entities.OnboardingProfile.filter({}).catch(() => []);
    if (existing.length > 0) {
      await base44.entities.OnboardingProfile.update(existing[0].id, {
        intelligence_data: intelligence,
      });
    }

    return Response.json({ success: true, intelligence });
  } catch (error) {
    console.error('scanTargetIntelligence error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}