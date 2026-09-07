import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const {
      primary_goal,
      target_websites = [],
      data_to_extract = [],
      automation_tasks = [],
      ai_capabilities = [],
      scale_level = 'small',
      preferred_ai_tools = [],
      experience_level = 'beginner',
      custom_description = '',
    } = body;

    // Use LLM to generate intelligent account configuration from answers
    const llmResponse = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an expert at configuring a browser automation SaaS platform called CloudBrowser.
Based on the user's onboarding answers, generate a personalized account configuration.

User's answers:
- Primary goal: ${primary_goal}
- Target websites: ${target_websites.join(', ') || 'none specified'}
- Data to extract: ${data_to_extract.join(', ') || 'none'}
- Automation tasks: ${automation_tasks.join(', ') || 'none'}
- AI capabilities wanted: ${ai_capabilities.join(', ') || 'none'}
- Scale level: ${scale_level}
- Preferred AI tools: ${preferred_ai_tools.join(', ') || 'none'}
- Experience level: ${experience_level}
- Custom description: ${custom_description || 'none'}

Generate a JSON configuration with:
1. recommended_plan: "free" | "developer" | "startup" | "enterprise" (based on scale and needs)
2. recommended_capabilities: array of capabilities to enable ["scraper", "headless_browser", "form_filler", "captcha_solver", "clone_engine", "ai_agent", "proxy_rotation", "stealth_mode"]
3. starter_agents: array of 1-3 suggested agent configs, each with {name, agent_type, instructions, capabilities, target_urls}
4. welcome_message: a personalized welcome message (2-3 sentences)
5. setup_steps: array of recommended next steps (3-5 items)

Be practical and specific. If they want to scrape e-commerce, suggest a product scraper agent. If they want form filling, suggest a form automation agent. Match the plan to their scale.`,
      response_json_schema: {
        type: 'object',
        properties: {
          recommended_plan: { type: 'string', enum: ['free', 'developer', 'startup', 'enterprise'] },
          recommended_capabilities: { type: 'array', items: { type: 'string' } },
          starter_agents: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                agent_type: { type: 'string', enum: ['scraper', 'form_filler', 'cloner', 'researcher', 'monitor', 'custom'] },
                instructions: { type: 'string' },
                capabilities: { type: 'array', items: { type: 'string' } },
                target_urls: { type: 'array', items: { type: 'string' } },
              },
            },
          },
          welcome_message: { type: 'string' },
          setup_steps: { type: 'array', items: { type: 'string' } },
        },
      },
    });

    const aiConfig = llmResponse.data || llmResponse;

    // Save the onboarding profile
    const existing = await base44.entities.OnboardingProfile.filter({ created_by_id: user.id }).catch(() => []);
    let profile;
    if (existing.length > 0) {
      profile = await base44.entities.OnboardingProfile.update(existing[0].id, {
        completed: true,
        completed_at: new Date().toISOString(),
        primary_goal,
        target_websites,
        data_to_extract,
        automation_tasks,
        ai_capabilities,
        scale_level,
        preferred_ai_tools,
        experience_level,
        custom_description,
        ai_generated_config: aiConfig,
        recommended_plan: aiConfig.recommended_plan,
        recommended_capabilities: aiConfig.recommended_capabilities,
        starter_agents_generated: true,
      });
    } else {
      profile = await base44.entities.OnboardingProfile.create({
        completed: true,
        completed_at: new Date().toISOString(),
        primary_goal,
        target_websites,
        data_to_extract,
        automation_tasks,
        ai_capabilities,
        scale_level,
        preferred_ai_tools,
        experience_level,
        custom_description,
        ai_generated_config: aiConfig,
        recommended_plan: aiConfig.recommended_plan,
        recommended_capabilities: aiConfig.recommended_capabilities,
        starter_agents_generated: true,
      });
    }

    // Auto-create starter agents based on LLM recommendations
    const createdAgents = [];
    if (aiConfig.starter_agents && Array.isArray(aiConfig.starter_agents)) {
      for (const agent of aiConfig.starter_agents.slice(0, 3)) {
        try {
          const created = await base44.entities.UserAgent.create({
            name: agent.name,
            description: `Auto-generated from onboarding: ${agent.instructions?.substring(0, 100) || ''}`,
            status: 'draft',
            agent_type: agent.agent_type || 'scraper',
            target_urls: agent.target_urls || target_websites || [],
            instructions: agent.instructions || '',
            capabilities: agent.capabilities || ['navigate', 'extract', 'screenshot'],
            config: { auto_generated: true, source: 'onboarding' },
          });
          createdAgents.push({ id: created.id, name: created.name });
        } catch (e) {
          // Continue if agent creation fails
        }
      }
    }

    // Create or update subscription with recommended plan
    const existingSub = await base44.entities.Subscription.filter({ created_by_id: user.id }).catch(() => []);
    const planLimits = {
      free: { max_concurrent_sessions: 3, max_browser_hours: 1, max_agent_runs: 3, max_search_calls: 1000, max_fetch_calls: 1000, data_retention_days: 7, captcha_solving_enabled: false, stealth_mode: 'none', monthly_price_usd: 0 },
      developer: { max_concurrent_sessions: 25, max_browser_hours: 100, max_agent_runs: 15, max_search_calls: 1000, max_fetch_calls: 1000, max_proxy_gb: 1, data_retention_days: 30, captcha_solving_enabled: true, stealth_mode: 'basic', monthly_price_usd: 29, overage_rate_browser_hr: 0.12, overage_rate_search_1k: 7, overage_rate_fetch_1k: 1, overage_rate_proxy_gb: 12 },
      startup: { max_concurrent_sessions: 100, max_browser_hours: 500, max_agent_runs: 50, max_search_calls: 1000, max_fetch_calls: 10000, max_proxy_gb: 5, data_retention_days: 30, captcha_solving_enabled: true, stealth_mode: 'basic', monthly_price_usd: 99, overage_rate_browser_hr: 0.10, overage_rate_search_1k: 7, overage_rate_fetch_1k: 1, overage_rate_proxy_gb: 10 },
      enterprise: { max_concurrent_sessions: 250, max_browser_hours: 500, max_agent_runs: 100, max_search_calls: 10000, max_fetch_calls: 10000, max_proxy_gb: 5, data_retention_days: 30, captcha_solving_enabled: true, stealth_mode: 'advanced', monthly_price_usd: 0 },
    };
    const limits = planLimits[aiConfig.recommended_plan] || planLimits.free;
    if (existingSub.length === 0) {
      await base44.entities.Subscription.create({
        plan_tier: aiConfig.recommended_plan,
        status: 'active',
        billing_cycle: aiConfig.recommended_plan === 'free' ? 'none' : 'monthly',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        ...limits,
      });
    }

    return Response.json({
      success: true,
      profile_id: profile.id,
      ai_config: aiConfig,
      created_agents: createdAgents,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}