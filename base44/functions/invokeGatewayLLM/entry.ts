import { invokeLLM } from '../../shared/vercelAiGateway.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Gateway LLM wrapper — allows frontend pages to call the Vercel AI Gateway
// for all LLM completions. Delegates to the Vercel AI Gateway via VERCEL_AI_GATEWAY_API_KEY.

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Sign in to use AI.' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    if (typeof body.prompt !== 'string' || !body.prompt.trim()) return Response.json({ error: 'A prompt is required.' }, { status: 400 });
    const result = await invokeLLM({
      prompt: body.prompt,
      response_json_schema: body.response_json_schema,
      add_context_from_internet: body.add_context_from_internet,
      model: body.model,
      file_urls: body.file_urls,
    });
    return Response.json({ ok: true, result });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}