// Vercel AI Gateway shared client — drop-in replacement for base44.integrations.Core.InvokeLLM.
// Routes all LLM calls through https://ai-gateway.vercel.sh/v1 instead of Base44 integrations.
// OAuth connectors, email, and file storage remain on Base44 (no Vercel equivalent).

const BASE_URL = process.env.VERCEL_AI_GATEWAY_BASE_URL || 'https://ai-gateway.vercel.sh/v1';
const API_KEY = process.env.VERCEL_AI_GATEWAY_API_KEY;

// Base44 InvokeLLM model name → Vercel AI Gateway model ID
const MODEL_MAP: Record<string, string> = {
  automatic: 'openai/gpt-6-astra',
  gpt_5_mini: 'openai/gpt-5-mini',
  gpt_5_4: 'openai/gpt-5.4',
  gpt_5_6_sol: 'openai/gpt-5.6-sol',
  gpt_5_6_luna: 'openai/gpt-5.6-luna',
  gemini_3_flash: 'google/gemini-3-flash',
  gemini_3_1_pro: 'google/gemini-3.1-pro-preview',
  claude_sonnet_4_6: 'anthropic/claude-sonnet-4.6',
  claude_opus_4_6: 'anthropic/claude-opus-4.6',
  claude_opus_4_7: 'anthropic/claude-opus-4.7',
  claude_opus_4_8: 'anthropic/claude-opus-4.8',
  claude_opus_5: 'anthropic/claude-opus-5',
  'claude-sonnet-5': 'anthropic/claude-sonnet-5',
};

function resolveModel(model?: string): string {
  if (!model || model === 'automatic') return MODEL_MAP.automatic;
  return MODEL_MAP[model] || model;
}

interface InvokeLLMOpts {
  prompt: string;
  add_context_from_internet?: boolean;
  response_json_schema?: any;
  file_urls?: string | string[];
  model?: string;
}

/**
 * Drop-in replacement for base44.integrations.Core.InvokeLLM.
 * Returns a string (plain text) or a parsed object (when response_json_schema is provided).
 */
export async function invokeLLM(opts: InvokeLLMOpts): Promise<string | object> {
  if (!API_KEY) throw new Error('VERCEL_AI_GATEWAY_API_KEY not set');

  const model = resolveModel(opts.model);
  const fileUrls = opts.file_urls
    ? (Array.isArray(opts.file_urls) ? opts.file_urls : [opts.file_urls])
    : [];

  // Build message content — multimodal when file_urls are provided
  let messages: any[];
  if (fileUrls.length > 0) {
    const content: any[] = [{ type: 'text', text: opts.prompt }];
    for (const url of fileUrls) {
      const lower = url.toLowerCase();
      if (lower.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
        content.push({ type: 'image_url', image_url: { url } });
      } else if (lower.endsWith('.pdf')) {
        content.push({ type: 'file', file: { url } });
      } else {
        content.push({ type: 'image_url', image_url: { url } });
      }
    }
    messages = [{ role: 'user', content }];
  } else {
    messages = [{ role: 'user', content: opts.prompt }];
  }

  const body: any = { model, messages, stream: false };

  // Structured output (JSON schema)
  if (opts.response_json_schema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: {
        name: 'result',
        schema: opts.response_json_schema,
        strict: false,
      },
    };
  }

  // Web search — replaces Base44's add_context_from_internet
  if (opts.add_context_from_internet) {
    body.tools = [{ type: 'web_search' }];
  }

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Vercel AI Gateway error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';

  if (opts.response_json_schema) {
    try {
      return typeof content === 'string' ? JSON.parse(content) : content;
    } catch {
      return content;
    }
  }

  return content;
}