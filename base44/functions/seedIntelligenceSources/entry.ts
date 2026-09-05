import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Seed & Source Intelligence System
// Discovers and seeds the top intelligence sources for browser automation and data acquisition:
// - Top 10 highest-rated AI tools for data ingestion/acquisition
// - Top 100 keywords, phrases, trending topics, researched topics in scraping/data
// - Top scraping strategies and playbooks
// - Top 100 scraped websites (most popular scraping targets)
// - Elite research on why data/data centers are critical
//
// Input: { categories?: string[] }
// Output: { seeds_created, seeds_by_category, batch_id }

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const sr = base44.asServiceRole.entities;
    const batchId = `seed-${Date.now()}`;
    const categories = req.body?.categories || [
      'ai_tools', 'data_acquisition', 'scraping_strategies', 'playbooks',
      'trending_topics', 'keywords', 'top_websites', 'elite_motives', 'data_centers', 'money_flows'
    ];

    const allSeeds = [];

    // 1. Top 10 AI tools for data ingestion & acquisition
    if (categories.includes('ai_tools') || categories.includes('data_acquisition')) {
      try {
        const res = await base44.integrations.Core.InvokeLLM({
          prompt: `You are an intelligence researcher focused on browser automation and data acquisition. Search the web and identify the TOP 10 highest-rated AI tools and platforms specifically for data ingestion, data acquisition, and automated data extraction in 2025-2026.

For each tool, provide:
- name: The tool name
- url: The official website
- description: What it does and why it's top-rated (2-3 sentences)
- category: "ai_tool" or "data_acquisition_tool" or "data_ingestion_platform"
- rank: 1-10
- key_strengths: 2-3 bullet points on why it's elite

Focus on tools like: Bright Data, Oxylabs, ScrapingBee, Apify, Browserless, Browserbase, Zyte, Scrapfly, Crawlee, Playwright-based platforms, AI-powered extraction tools, etc.

Return as JSON array of 10 objects.`,
          add_context_from_internet: true,
          model: 'gemini_3_flash',
          response_json_schema: {
            type: 'object',
            properties: {
              tools: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    url: { type: 'string' },
                    description: { type: 'string' },
                    category: { type: 'string' },
                    rank: { type: 'number' },
                    key_strengths: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
            },
          },
        });

        for (const tool of (res.tools || [])) {
          allSeeds.push({
            source_type: tool.category || 'ai_tool',
            title: tool.name,
            url: tool.url,
            description: tool.description,
            intelligence_category: 'ai_tools',
            priority: tool.rank <= 3 ? 1 : tool.rank <= 6 ? 2 : 3,
            status: 'pending',
            rank: tool.rank,
            seed_batch: batchId,
            tags: tool.key_strengths || [],
            vision_cortex_analysis: `Top-ranked AI tool (#${tool.rank}) for data acquisition. Strengths: ${(tool.key_strengths || []).join(', ')}`,
          });
        }
      } catch (e) { console.error('AI tools seed error:', e.message); }
    }

    // 2. Top 100 keywords, phrases, trending topics, researched topics
    if (categories.includes('keywords') || categories.includes('trending_topics')) {
      try {
        const res = await base44.integrations.Core.InvokeLLM({
          prompt: `You are an SEO and market intelligence expert focused on the browser automation, web scraping, and data acquisition industry. Search the web for current 2025-2026 trends.

Generate the TOP 100 most important keywords, phrases, trending topics, and top-researched topics in the web scraping and data acquisition space. Include:
- High-volume search terms (e.g. "web scraping API", "headless browser", "proxy rotation")
- Trending topics (e.g. "AI-powered scraping", "anti-bot bypass", "CAPTCHA solving")
- Researched topics (e.g. "scraping legality", "data compliance", "GDPR scraping")
- Strategic phrases (e.g. "data acquisition strategy", "competitive intelligence automation")
- Technical terms (e.g. "CDP automation", "fingerprint randomization", "TLS spoofing")

For each, provide:
- term: The keyword/phrase
- type: "keyword" | "trending_phrase" | "trending_topic" | "researched_topic"
- search_volume_estimate: "high" | "medium" | "low"
- relevance: 1-10 (how relevant to browser automation)
- why_it_matters: 1 sentence on why this term matters

Return as JSON array of 100 objects.`,
          add_context_from_internet: true,
          model: 'gemini_3_flash',
          response_json_schema: {
            type: 'object',
            properties: {
              terms: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    term: { type: 'string' },
                    type: { type: 'string' },
                    search_volume_estimate: { type: 'string' },
                    relevance: { type: 'number' },
                    why_it_matters: { type: 'string' },
                  },
                },
              },
            },
          },
        });

        for (const [i, term] of (res.terms || []).entries()) {
          allSeeds.push({
            source_type: term.type || 'keyword',
            title: term.term,
            description: term.why_it_matters,
            intelligence_category: 'keywords',
            priority: term.relevance >= 8 ? 1 : term.relevance >= 5 ? 2 : 3,
            status: 'pending',
            rank: i + 1,
            seed_batch: batchId,
            tags: [term.search_volume_estimate, `relevance-${term.relevance}`],
            vision_cortex_analysis: `Top keyword/phrase (#${i + 1}) in scraping/data acquisition. Search volume: ${term.search_volume_estimate}. Relevance: ${term.relevance}/10.`,
          });
        }
      } catch (e) { console.error('Keywords seed error:', e.message); }
    }

    // 3. Top scraping strategies and playbooks
    if (categories.includes('scraping_strategies') || categories.includes('playbooks')) {
      try {
        const res = await base44.integrations.Core.InvokeLLM({
          prompt: `You are a master of web scraping and data acquisition strategy. Search the web for the latest 2025-2026 strategies.

Identify the TOP 20 most effective scraping strategies and playbooks used by elite data acquisition teams. Include:
- Anti-bot bypass strategies (Cloudflare, Datadome, PerimeterX, Akamai)
- Proxy rotation strategies (residential vs datacenter, geo-targeting)
- CAPTCHA solving strategies (self-solve vs paid fallback)
- Human behavior simulation strategies
- Scale strategies (distributed scraping, rate limiting avoidance)
- Compliance strategies (robots.txt, ToS, GDPR)
- AI-powered extraction strategies (LLM-based parsing, visual recognition)
- Data pipeline strategies (ETL, storage, real-time processing)

For each, provide:
- name: Strategy name
- type: "scraping_strategy" or "playbook"
- description: What the strategy is (2-3 sentences)
- playbook_steps: 3-5 concrete steps to execute
- difficulty: "beginner" | "intermediate" | "advanced" | "elite"
- effectiveness: 1-10

Return as JSON array of 20 objects.`,
          add_context_from_internet: true,
          model: 'gemini_3_flash',
          response_json_schema: {
            type: 'object',
            properties: {
              strategies: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    type: { type: 'string' },
                    description: { type: 'string' },
                    playbook_steps: { type: 'array', items: { type: 'string' } },
                    difficulty: { type: 'string' },
                    effectiveness: { type: 'number' },
                  },
                },
              },
            },
          },
        });

        for (const [i, strat] of (res.strategies || []).entries()) {
          allSeeds.push({
            source_type: strat.type || 'scraping_strategy',
            title: strat.name,
            description: strat.description,
            intelligence_category: 'scraping_strategies',
            priority: strat.effectiveness >= 8 ? 1 : 2,
            status: 'pending',
            rank: i + 1,
            seed_batch: batchId,
            tags: [strat.difficulty, `effectiveness-${strat.effectiveness}`],
            vision_cortex_analysis: `Elite strategy (#${i + 1}): ${strat.name}. Difficulty: ${strat.difficulty}. Effectiveness: ${strat.effectiveness}/10. Steps: ${(strat.playbook_steps || []).join(' → ')}`,
          });
        }
      } catch (e) { console.error('Strategies seed error:', e.message); }
    }

    // 4. Top 100 scraped websites (most popular scraping targets)
    if (categories.includes('top_websites')) {
      try {
        const res = await base44.integrations.Core.InvokeLLM({
          prompt: `You are a web scraping intelligence analyst. Search the web for the most commonly scraped websites in 2025-2026.

Identify the TOP 100 most-scraped websites across categories:
- E-commerce (Amazon, eBay, Walmart, etc.)
- Real estate (Zillow, Realtor, Redfin)
- Job boards (LinkedIn, Indeed, Glassdoor)
- Social media (Twitter/X, Instagram, TikTok)
- News (CNN, Reuters, Bloomberg)
- Directories (Yelp, Yellow Pages)
- Travel (Booking, Expedia, Airbnb)
- Financial (Yahoo Finance, Stock sites)
- Classifieds (Craigslist, Gumtree)
- Review sites (Trustpilot, G2)
- Data aggregators (Crunchbase, PitchBook)

For each, provide:
- name: Website name
- url: Base URL
- category: Category (e-commerce, real_estate, etc.)
- why_scraped: Why people scrape it (1 sentence)
- difficulty: "easy" | "medium" | "hard" | "extreme" (anti-bot level)
- data_value: 1-10 (how valuable the data is)

Return as JSON array of 100 objects.`,
          add_context_from_internet: true,
          model: 'gemini_3_flash',
          response_json_schema: {
            type: 'object',
            properties: {
              sites: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    url: { type: 'string' },
                    category: { type: 'string' },
                    why_scraped: { type: 'string' },
                    difficulty: { type: 'string' },
                    data_value: { type: 'number' },
                  },
                },
              },
            },
          },
        });

        for (const [i, site] of (res.sites || []).entries()) {
          allSeeds.push({
            source_type: 'top_website',
            title: site.name,
            url: site.url,
            description: site.why_scraped,
            intelligence_category: 'top_websites',
            priority: site.data_value >= 8 ? 1 : 2,
            status: 'pending',
            rank: i + 1,
            seed_batch: batchId,
            tags: [site.category, site.difficulty, `value-${site.data_value}`],
            vision_cortex_analysis: `Top scraping target (#${i + 1}): ${site.name}. Category: ${site.category}. Difficulty: ${site.difficulty}. Data value: ${site.data_value}/10.`,
          });
        }
      } catch (e) { console.error('Top websites seed error:', e.message); }
    }

    // 5. Elite research — why data/data centers are critical
    if (categories.includes('elite_motives') || categories.includes('data_centers')) {
      try {
        const res = await base44.integrations.Core.InvokeLLM({
          prompt: `You are a geopolitical and economic intelligence analyst. Search the web for the latest 2025-2026 information on why elite corporations, governments, and billionaires are driving so hard for data and data centers.

Research and provide:
1. The TOP 10 reasons elites are investing billions in data and data centers
2. The TOP 10 data center investments and expansions (company, amount, location)
3. The strategic motives behind data acquisition (AI training, surveillance, competitive moats, monopoly control)
4. What elites are searching for and hoarding (training data, behavioral data, biometric data, financial data)
5. The "data as oil" thesis and its implications

For each reason/investment, provide:
- title: Short title
- description: Detailed explanation (3-4 sentences)
- entities: Key companies/people involved
- amount: Investment amount if applicable
- motive: The underlying strategic motive
- significance: 1-10

Return as JSON with reasons (array of 10), investments (array of 10), and motives (array of 10).`,
          add_context_from_internet: true,
          model: 'gemini_3_flash',
          response_json_schema: {
            type: 'object',
            properties: {
              reasons: { type: 'array', items: { type: 'object', properties: {
                title: { type: 'string' }, description: { type: 'string' }, entities: { type: 'array', items: { type: 'string' } }, motive: { type: 'string' }, significance: { type: 'number' },
              } } },
              investments: { type: 'array', items: { type: 'object', properties: {
                title: { type: 'string' }, description: { type: 'string' }, amount: { type: 'string' }, entities: { type: 'array', items: { type: 'string' } }, significance: { type: 'number' },
              } } },
              motives: { type: 'array', items: { type: 'object', properties: {
                title: { type: 'string' }, description: { type: 'string' }, significance: { type: 'number' },
              } } },
            },
          },
        });

        for (const [i, reason] of (res.reasons || []).entries()) {
          allSeeds.push({
            source_type: 'elite_research',
            title: reason.title,
            description: reason.description,
            intelligence_category: 'elite_motives',
            priority: 1,
            status: 'pending',
            rank: i + 1,
            seed_batch: batchId,
            tags: (reason.entities || []).slice(0, 3),
            vision_cortex_analysis: `Elite motive (#${i + 1}): ${reason.title}. Motive: ${reason.motive}. Significance: ${reason.significance}/10. Entities: ${(reason.entities || []).join(', ')}`,
          });
        }
        for (const [i, inv] of (res.investments || []).entries()) {
          allSeeds.push({
            source_type: 'data_center_intel',
            title: inv.title,
            description: inv.description,
            intelligence_category: 'data_centers',
            priority: 1,
            status: 'pending',
            rank: i + 1,
            seed_batch: batchId,
            tags: [inv.amount].filter(Boolean),
            vision_cortex_analysis: `Data center investment (#${i + 1}): ${inv.title}. Amount: ${inv.amount}. Entities: ${(inv.entities || []).join(', ')}. Significance: ${inv.significance}/10.`,
          });
        }
        for (const [i, motive] of (res.motives || []).entries()) {
          allSeeds.push({
            source_type: 'elite_research',
            title: motive.title,
            description: motive.description,
            intelligence_category: 'elite_motives',
            priority: 1,
            status: 'pending',
            rank: i + 1,
            seed_batch: batchId,
            tags: [`significance-${motive.significance}`],
            vision_cortex_analysis: `Strategic motive (#${i + 1}): ${motive.title}. Significance: ${motive.significance}/10.`,
          });
        }
      } catch (e) { console.error('Elite research seed error:', e.message); }
    }

    // 6. Money flow sources
    if (categories.includes('money_flows')) {
      try {
        const res = await base44.integrations.Core.InvokeLLM({
          prompt: `You are a financial intelligence analyst tracking money flows in the AI, data, and data center space. Search the web for 2025-2026.

Identify the TOP 20 most significant money flows related to data and AI:
- Data center investments (Microsoft, Google, Amazon, Meta, Apple)
- AI infrastructure spending (GPU purchases, chip investments)
- Data acquisition deals (licensing, acquisitions, partnerships)
- AI startup funding rounds
- Cloud infrastructure expansion

For each, provide:
- entity: Company/fund name
- flow_type: "investment" | "acquisition" | "spending" | "revenue"
- amount: Dollar amount (e.g. "$10B", "$500M")
- category: "data_center" | "ai_infrastructure" | "data_acquisition" | "gpu_compute" | "cloud_expansion"
- description: What the money is for (2 sentences)
- date: Approximate date
- significance: 1-10
- elite_motive: What strategic motive this reveals

Return as JSON array of 20 objects.`,
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
                    flow_type: { type: 'string' },
                    amount: { type: 'string' },
                    category: { type: 'string' },
                    description: { type: 'string' },
                    date: { type: 'string' },
                    significance: { type: 'number' },
                    elite_motive: { type: "string" },
                  },
                },
              },
            },
          },
        });

        for (const [i, flow] of (res.flows || []).entries()) {
          allSeeds.push({
            source_type: 'money_trail_source',
            title: `${flow.entity} — ${flow.amount} — ${flow.category}`,
            description: flow.description,
            intelligence_category: 'money_flows',
            priority: flow.significance >= 8 ? 1 : 2,
            status: 'pending',
            rank: i + 1,
            seed_batch: batchId,
            tags: [flow.category, flow.flow_type, flow.amount],
            vision_cortex_analysis: `Money flow (#${i + 1}): ${flow.entity} ${flow.flow_type} ${flow.amount} in ${flow.category}. Motive: ${flow.elite_motive}. Significance: ${flow.significance}/10.`,
          });
        }
      } catch (e) { console.error('Money flow seed error:', e.message); }
    }

    // Bulk create all seeds
    let created = [];
    if (allSeeds.length > 0) {
      try {
        created = await sr.IntelligenceSeed.bulkCreate(allSeeds);
      } catch (e) {
        // If bulk fails, try in smaller batches
        for (let i = 0; i < allSeeds.length; i += 50) {
          try {
            const batch = await sr.IntelligenceSeed.bulkCreate(allSeeds.slice(i, i + 50));
            created = created.concat(batch);
          } catch (e2) { console.error('Batch create error:', e2.message); }
        }
      }
    }

    // Count by category
    const byCategory = {};
    for (const s of allSeeds) {
      byCategory[s.intelligence_category] = (byCategory[s.intelligence_category] || 0) + 1;
    }

    return Response.json({
      seeds_created: created.length,
      seeds_requested: allSeeds.length,
      seeds_by_category: byCategory,
      batch_id: batchId,
      categories_processed: categories,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}