import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Self-healing selectors: given a broken selector + page context, LLM generates a robust alternative.
// Called by runJob when a wait_for_selector / click / extract step fails.

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { brokenSelector, pageUrl, pageText, pageHtml, stepType, description } = body;

    if (!brokenSelector) {
      return Response.json({ error: 'brokenSelector required' }, { status: 400 });
    }

    // Build context for the LLM — trim HTML to avoid token overflow
    const htmlSnippet = pageHtml ? pageHtml.slice(0, 8000) : '';
    const textSnippet = pageText ? pageText.slice(0, 3000) : '';

    const prompt = `You are a browser automation expert. A Playwright selector has stopped working on a page.

Broken selector: "${brokenSelector}"
Step type: ${stepType || 'unknown'}
Step description: ${description || 'none'}
Page URL: ${pageUrl || 'unknown'}

Page text (first 3000 chars):
${textSnippet}

Page HTML (first 8000 chars):
${htmlSnippet}

Generate a NEW robust CSS selector that would locate the same element. Prefer:
1. data-testid or aria-label attributes
2. role-based selectors
3. Stable class combinations
4. Text-based selectors (text=...)

Return JSON with:
{
  "healedSelector": "the new CSS selector",
  "confidence": 0.0-1.0,
  "strategy": "what approach you used",
  "alternatives": ["fallback selector 1", "fallback selector 2"]
}`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          healedSelector: { type: 'string' },
          confidence: { type: 'number' },
          strategy: { type: 'string' },
          alternatives: { type: 'array', items: { type: 'string' } },
        },
        required: ['healedSelector', 'confidence', 'strategy'],
      },
    });

    return Response.json({ healed: result, original: brokenSelector });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}