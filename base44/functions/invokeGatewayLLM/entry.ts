import { invokeLLM } from '../../shared/vercelAiGateway.ts';

// Gateway LLM wrapper — allows frontend pages to call the Vercel AI Gateway
// without using Base44 integration credits. Accepts the same options as
// base44.integrations.Core.InvokeLLM and delegates to the Vercel AI Gateway.

export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));
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