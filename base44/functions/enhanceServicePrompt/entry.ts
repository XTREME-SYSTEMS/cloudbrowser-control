import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { getService } from '../../shared/serviceCatalog.ts';
import {
  buildEnhancementMessages,
  ENHANCEMENT_SCHEMA,
  fallbackEnhancement,
  summarizeEnhancement,
  PROMPT_STANDARDS,
} from '../../shared/promptEnhancer.ts';

/**
 * Prompt enhancement.
 *
 * Takes a plain sentence and returns the prompt that will actually drive a
 * page, a service or a single numbered step — shaped against the operating
 * standards rather than against the operator's phrasing.
 *
 * Available to any signed-in operator: it costs one model call and it is the
 * front door to every other function here.
 */
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const sentence = typeof body?.sentence === 'string' ? body.sentence.trim() : '';
    if (!sentence) {
      return Response.json({ error: 'A sentence to enhance is required.' }, { status: 400 });
    }

    const service = getService(body?.service_slug);
    if (body?.service_slug && !service) {
      return Response.json({ error: `Unknown service: ${body.service_slug}` }, { status: 400 });
    }

    const input = {
      sentence,
      service,
      stepName: body?.step_name || null,
      stepNumber: typeof body?.step_number === 'number' ? body.step_number : null,
      surface: body?.surface || null,
      priorContext: body?.prior_context || null,
    };

    const { system, user: userPrompt } = buildEnhancementMessages(input);

    let enhanced = null;
    let enhancementRan = false;
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `${system}\n\n---\n\n${userPrompt}`,
        response_json_schema: ENHANCEMENT_SCHEMA,
      });
      if (result && typeof result === 'object' && result.prompt) {
        enhanced = result;
        enhancementRan = true;
      } else if (typeof result === 'string') {
        const parsed = JSON.parse(result);
        if (parsed?.prompt) {
          enhanced = parsed;
          enhancementRan = true;
        }
      }
    } catch (error) {
      console.error('[enhanceServicePrompt] enhancement model unavailable:', error?.message);
    }

    if (!enhanced) {
      enhanced = fallbackEnhancement(sentence, service);
    }

    return Response.json({
      success: true,
      enhancement_ran: enhancementRan,
      service: service ? { slug: service.slug, name: service.name, workflow_steps: service.workflow.length } : null,
      standards_catalogue: PROMPT_STANDARDS,
      enhanced,
      summary: summarizeEnhancement(enhanced),
    });
  } catch (error) {
    console.error('[enhanceServicePrompt] failed:', error?.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}