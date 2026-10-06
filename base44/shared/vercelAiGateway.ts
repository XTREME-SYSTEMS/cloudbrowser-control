// Vercel AI Gateway shared client — drop-in replacement for base44.integrations.Core.InvokeLLM.
// Routes all LLM calls through https://ai-gateway.vercel.sh/v1 instead of Base44 integrations.
import { getGatewayKey, searchGatewayWeb } from './vercelGateway.ts';
import { buildGatewayContent } from './gatewayAttachments.ts';

const BASE_URL = 'https://ai-gateway.vercel.sh/v1';

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
  const API_KEY = getGatewayKey();

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

  // Web search — replaces Base44's add_context_from_internet.
  // Vercel AI Gateway requires a provider-specific tool type with a config.query.
  // We use perplexity_search (good at synthesizing web content into answers).
  if (opts.add_context_from_internet) {
    body.tools = [{
      type: 'vercel:perplexity_search',
      config: {
        query: opts.prompt.substring(0, 400),
        max_results: 5,
      },
    }];
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

// ─── Image Generation — replaces Core.GenerateImage ─────────────────────────
export async function generateImage(opts: { prompt: string; model?: string; size?: string; n?: number; existing_image_urls?: string[] }): Promise<{ url: string }> {
  const API_KEY = getGatewayKey();
  const model = opts.model || 'openai/dall-e-3';
  const body: any = { model, prompt: opts.prompt, n: opts.n || 1, size: opts.size || '1024x1024', response_format: 'url' };
  const res = await fetch(`${BASE_URL}/images/generations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`Vercel AI Gateway image error ${res.status}: ${t}`); }
  const data = await res.json();
  const url = data.data?.[0]?.url;
  if (!url) throw new Error('Vercel AI Gateway returned no image URL');
  return { url };
}

// ─── Speech Generation — replaces Core.GenerateSpeech ───────────────────────
export async function generateSpeech(opts: { text: string; voice?: string; language_code?: string; model?: string }): Promise<{ url: string }> {
  const API_KEY = getGatewayKey();
  const model = opts.model || 'openai/tts-1';
  const voiceMap: Record<string, string> = { river: 'alloy', honey: 'nova', sunny: 'shimmer', storm: 'onyx', spark: 'fable' };
  const voice = voiceMap[opts.voice || 'river'] || 'alloy';
  const res = await fetch(`${BASE_URL}/audio/speech`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: opts.text.slice(0, 5000), voice, response_format: 'mp3' }),
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`Vercel AI Gateway speech error ${res.status}: ${t}`); }
  const buffer = await res.arrayBuffer();
  const blob = new Blob([buffer], { type: 'audio/mpeg' });
  const file = new File([blob], `tts_${Date.now()}.mp3`, { type: 'audio/mpeg' });
  try {
    const { uploadFile } = await import('./storageGateway.ts');
    const result = await uploadFile({ file });
    return { url: result.file_url };
  } catch {
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    return { url: `data:audio/mpeg;base64,${base64}` };
  }
}

// ─── Audio Transcription — replaces Core.TranscribeAudio ─────────────────────
export async function transcribeAudio(opts: { audio_url: string; model?: string }): Promise<string> {
  const API_KEY = getGatewayKey();
  const model = opts.model || 'openai/whisper-1';
  const audioRes = await fetch(opts.audio_url);
  const audioBlob = await audioRes.blob();
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.mp3');
  formData.append('model', model);
  const res = await fetch(`${BASE_URL}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}` },
    body: formData,
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`Vercel AI Gateway transcription error ${res.status}: ${t}`); }
  const data = await res.json();
  return data.text || '';
}

// ─── Data Extraction — replaces Core.ExtractDataFromUploadedFile ────────────
export async function extractDataFromFile(opts: { file_url: string; json_schema: object; model?: string }): Promise<{ status: string; output: any; details?: string }> {
  const API_KEY = getGatewayKey();
  const lower = opts.file_url.toLowerCase();
  const isImage = lower.match(/\.(jpg|jpeg|png|gif|webp)$/);
  if (isImage) {
    const result = await invokeLLM({
      prompt: `Extract data from this image and return JSON matching this schema:\n${JSON.stringify(opts.json_schema)}`,
      file_urls: [opts.file_url],
      response_json_schema: opts.json_schema,
      model: opts.model,
    });
    return { status: 'success', output: result };
  }
  const fileRes = await fetch(opts.file_url);
  const fileText = await fileRes.text();
  const result = await invokeLLM({
    prompt: `Extract data from the following file content and return JSON matching this schema:\n${JSON.stringify(opts.json_schema)}\n\nFile content:\n${fileText.substring(0, 100000)}`,
    response_json_schema: opts.json_schema,
    model: opts.model,
  });
  return { status: 'success', output: result };
}