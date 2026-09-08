import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const {
      primary_goal = '',
      target_websites = [],
      data_to_extract = [],
      ai_capabilities = [],
      automation_tasks = [],
      scale_level = 'small',
      custom_description = '',
      intelligence_data = null,
    } = body;

    const llmResponse = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an expert AI agent architect for CloudBrowser, a browser automation platform.

Based on the user's onboarding answers and intelligence scan, generate a personalized AI agent configuration.

User's answers:
- Primary goal: ${primary_goal}
- Target websites: ${target_websites.join(', ') || 'none'}
- Data to extract: ${data_to_extract.join(', ') || 'none'}
- AI capabilities wanted: ${ai_capabilities.join(', ') || 'none'}
- Automation tasks: ${automation_tasks.join(', ') || 'none'}
- Scale: ${scale_level}
- Custom notes: ${custom_description || 'none'}

Intelligence scan results:
${intelligence_data ? JSON.stringify(intelligence_data).substring(0, 2000) : 'none available'}

Generate a JSON config with:
1. agent_prompt: a detailed system prompt (300-500 words) for the AI agent that will browse the web on the user's behalf. Include:
   - Role and personality
   - Step-by-step instructions for navigating target sites
   - What data to extract and how to structure it
   - How to handle pagination, dynamic content, and anti-bot measures
   - Error handling and retry logic
   - Output format expectations
2. job_template: {
     name: descriptive job name,
     agent_type: "scraper" | "form_filler" | "cloner" | "researcher" | "monitor" | "custom",
     capabilities: array of capability enums ["navigate", "extract", "screenshot", "click", "type", "scroll", "wait", "solve_captcha", "fill_form", "download", "monitor_changes"],
     extraction_schema: JSON schema object for structured output,
     steps: array of step descriptions (natural language)
   }
3. recommended_plan: "free" | "developer" | "startup" | "enterprise"
4. welcome_message: personalized 2-sentence welcome
5. setup_steps: array of 3-5 recommended next steps

Make the agent prompt specific to their target sites and data needs. Reference the intelligence scan where available.`,
      response_json_schema: {
        type: 'object',
        properties: {
          agent_prompt: { type: 'string' },
          job_template: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              agent_type: { type: 'string' },
              capabilities: { type: 'array', items: { type: 'string' } },
              extraction_schema: { type: 'object' },
              steps: { type: 'array', items: { type: 'string' } },
            },
          },
          recommended_plan: { type: 'string' },
          welcome_message: { type: 'string' },
          setup_steps: { type: 'array', items: { type: 'string' } },
        },
      },
    });

    const config = llmResponse.data || llmResponse;

    // Save to onboarding profile
    const existing = await base44.entities.OnboardingProfile.filter({}).catch(() => []);
    if (existing.length > 0) {
      await base44.entities.OnboardingProfile.update(existing[0].id, {
        generated_agent_prompt: config.agent_prompt,
        generated_job_template: config.job_template,
        recommended_plan: config.recommended_plan,
      });
    }

    return Response.json({ success: true, config });
  } catch (error) {
    console.error('generateAgentConfig error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}