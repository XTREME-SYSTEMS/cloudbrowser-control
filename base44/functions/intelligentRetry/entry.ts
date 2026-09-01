import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Intelligent retry: analyzes a job error and recommends whether/how to retry.
// Replaces dumb exponential backoff with context-aware strategy.

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { errorMessage, errorStack, jobName, stepType, retryCount, maxRetries, targetUrl } = body;

    if (!errorMessage) {
      return Response.json({ error: 'errorMessage required' }, { status: 400 });
    }

    const prompt = `You are a site reliability engineer for a browser automation platform. Analyze this job error and recommend a retry strategy.

Error message: ${errorMessage}
Error stack: ${errorStack || 'none'}
Job name: ${jobName || 'unknown'}
Failed step type: ${stepType || 'unknown'}
Target URL: ${targetUrl || 'unknown'}
Current retry count: ${retryCount || 0}
Max retries: ${maxRetries || 3}

Classify the error and decide:
1. Should we retry? (some errors are permanent — e.g., 404, invalid selector, auth required)
2. If retry, how long to wait?
3. Should we modify anything before retrying? (e.g., switch proxy, add wait, change selector)

Error categories: network (timeout, DNS, connection refused), captcha (blocked by captcha), bot_detection (DataDome, Cloudflare, PerimeterX), selector (element not found), auth (login required), rate_limit (429), server_error (5xx), permanent (4xx non-rate-limit), unknown.

Return JSON:
{
  "shouldRetry": boolean,
  "category": "one of the categories above",
  "delaySeconds": number (0 if no retry),
  "modifications": ["list of changes to apply before retry, e.g. 'switch_proxy', 'add_wait_5s', 'use_healed_selector'"],
  "reasoning": "brief explanation"
}`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          shouldRetry: { type: 'boolean' },
          category: { type: 'string' },
          delaySeconds: { type: 'number' },
          modifications: { type: 'array', items: { type: 'string' } },
          reasoning: { type: 'string' },
        },
        required: ['shouldRetry', 'category', 'delaySeconds', 'reasoning'],
      },
    });

    return Response.json({ recommendation: result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}