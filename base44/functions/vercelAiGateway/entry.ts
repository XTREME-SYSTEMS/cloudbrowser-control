import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { uploadPublicFile } from '../../shared/storageGateway.ts';

// Vercel AI Gateway — frontend-accessible AI media endpoints.
// Routes speech, transcription, and image generation through Vercel AI Gateway.
// File storage (UploadPublicFile) stays on Base44 (no Vercel equivalent).
//
// Actions:
//   generateSpeech  { text, voice?, language_code? } → { url }
//   transcribeAudio { audio_url }                    → { text }
//   generateImage  { prompt, existing_image_urls? } → { url }

const GATEWAY_ORIGIN = 'https://ai-gateway.vercel.sh';
const API_KEY = process.env.VERCEL_AI_GATEWAY_API_KEY;

// Base44 voice → OpenAI TTS voice
const VOICE_MAP: Record<string, string> = {
  river: 'alloy',
  honey: 'nova',
  sunny: 'shimmer',
  storm: 'onyx',
  spark: 'echo',
};

function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export default async function(req: any) {
  // Read body FIRST via req.json() — createClientFromRequest may consume the stream
  let body: any = {};
  try { body = await req.json(); } catch {}
  const { action } = body || {};

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  if (!API_KEY) return Response.json({ error: 'VERCEL_AI_GATEWAY_API_KEY not set' }, { status: 500 });

  try {
    switch (action) {
      // ===== TEXT-TO-SPEECH (POST /v4/ai/speech-model) =====
      case 'generateSpeech': {
        const { text, voice, language_code } = body;
        if (!text) return Response.json({ error: 'text required' }, { status: 400 });

        const ttsVoice = VOICE_MAP[voice] || voice || 'alloy';
        const res = await fetch(`${GATEWAY_ORIGIN}/v4/ai/speech-model`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'ai-gateway-protocol-version': '0.0.1',
            'ai-speech-model-specification-version': '4',
            'ai-model-id': 'openai/tts-1',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            voice: ttsVoice,
            outputFormat: 'mp3',
            ...(language_code ? { language: language_code } : {}),
          }),
        });

        if (!res.ok) throw new Error(`TTS error ${res.status}: ${await res.text()}`);

        const result = await res.json();
        const audioBytes = base64ToUint8(result.audio);
        const file = new File([audioBytes], `speech_${Date.now()}.mp3`, { type: 'audio/mpeg' });
        const { file_url } = await uploadPublicFile({ file });
        return Response.json({ url: file_url });
      }

      // ===== SPEECH-TO-TEXT (POST /v4/ai/transcription-model) =====
      case 'transcribeAudio': {
        const { audio_url } = body;
        if (!audio_url) return Response.json({ error: 'audio_url required' }, { status: 400 });

        const audioRes = await fetch(audio_url);
        if (!audioRes.ok) throw new Error(`Failed to fetch audio: ${audioRes.status}`);
        const arrayBuffer = await audioRes.arrayBuffer();
        const audioBytes = new Uint8Array(arrayBuffer);
        const base64Audio = uint8ToBase64(audioBytes);

        const res = await fetch(`${GATEWAY_ORIGIN}/v4/ai/transcription-model`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'ai-gateway-protocol-version': '0.0.1',
            'ai-transcription-model-specification-version': '4',
            'ai-model-id': 'openai/whisper-1',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            audio: base64Audio,
            mediaType: 'audio/mpeg',
          }),
        });

        if (!res.ok) throw new Error(`Transcription error ${res.status}: ${await res.text()}`);
        const data = await res.json();
        return Response.json({ text: data.text || '' });
      }

      // ===== IMAGE GENERATION (POST /v1/images/generations) =====
      case 'generateImage': {
        const { prompt, existing_image_urls } = body;
        if (!prompt) return Response.json({ error: 'prompt required' }, { status: 400 });

        const res = await fetch(`${GATEWAY_ORIGIN}/v1/images/generations`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'openai/gpt-image-2',
            prompt,
            n: 1,
          }),
        });
        if (!res.ok) throw new Error(`Image gen error ${res.status}: ${await res.text()}`);
        const data = await res.json();
        const url = data.data?.[0]?.url || (data.data?.[0]?.b64_json ? `data:image/png;base64,${data.data[0].b64_json}` : null);
        return Response.json({ url });
      }

      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error: any) {
    console.error('vercelAiGateway error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}