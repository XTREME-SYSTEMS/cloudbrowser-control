import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const {
      target_url = '',
      agent_prompt = '',
      extraction_schema = null,
      job_template = null,
    } = body;

    // Simulate a test run using LLM — describes what the agent would do on the target site
    const llmResponse = await base44.integrations.Core.InvokeLLM({
      prompt: `You are simulating a test run of a CloudBrowser AI agent. Do NOT actually browse the web — instead, predict what the agent would find and do based on your knowledge.

Target URL: ${target_url}
Agent prompt: ${agent_prompt?.substring(0, 500) || 'none'}
Extraction schema: ${extraction_schema ? JSON.stringify(extraction_schema).substring(0, 500) : 'none'}

Simulate the agent executing on this URL. Generate a JSON test result:
1. status: "pass" | "fail"
2. simulated_steps: array of { step, action, result } — what the agent would do step by step
3. simulated_output: 2-3 sample records of what the extraction would return (matching the schema if provided, otherwise inferred from the site type)
4. issues_detected: array of potential problems (anti-bot, dynamic content, missing data, etc.)
5. recommendations: array of tweaks to improve the agent
6. confidence_score: 0-100 — how confident you are this agent will work on the target site

Be realistic. If the site likely has anti-bot protection, flag it. If the extraction schema doesn't match the site's structure, note it.`,
      add_context_from_internet: true,
      response_json_schema: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          simulated_steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                step: { type: 'string' },
                action: { type: 'string' },
                result: { type: 'string' },
              },
            },
          },
          simulated_output: { type: 'array', items: { type: 'object' } },
          issues_detected: { type: 'array', items: { type: 'string' } },
          recommendations: { type: 'array', items: { type: 'string' } },
          confidence_score: { type: 'number' },
        },
      },
    });

    const testResult = llmResponse.data || llmResponse;

    // Save test result to onboarding profile
    const existing = await base44.entities.OnboardingProfile.filter({}).catch(() => []);
    if (existing.length > 0) {
      await base44.entities.OnboardingProfile.update(existing[0].id, {
        test_result: testResult,
      });
    }

    return Response.json({ success: true, test_result: testResult });
  } catch (error) {
    console.error('testOnboardingSetup error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}