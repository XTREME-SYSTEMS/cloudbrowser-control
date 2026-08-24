// ═══════════════════════════════════════════════
// Offline Speech-to-Text using Whisper tiny (ONNX)
// Zero external API keys. Runs entirely on CPU.
// ═══════════════════════════════════════════════

let _recognizer = null;
let _loadingPromise = null;

async function getRecognizer() {
  if (_recognizer) return _recognizer;
  if (_loadingPromise) return _loadingPromise;

  console.log("[STT] Loading Whisper tiny.en model (first run downloads ~40MB)...");
  const { pipeline } = await import("@xenova/transformers");
  _loadingPromise = pipeline("automatic-speech-recognition", "Xenova/whisper-tiny.en", {
    quantized: true,  // Use quantized model for smaller size + faster inference
  });
  _recognizer = await _loadingPromise;
  _loadingPromise = null;
  console.log("[STT] Whisper model ready");
  return _recognizer;
}

/**
 * Transcribe an audio buffer using Whisper tiny.en (offline, no API key)
 * @param {Buffer} audioBuffer - Raw audio file (MP3, WAV, etc.)
 * @returns {Promise<string|null>} Transcribed text or null on failure
 */
export async function transcribeAudioOffline(audioBuffer) {
  try {
    const recognizer = await getRecognizer();

    // Whisper expects Float32Array samples at 16kHz
    // Transformers.js can decode audio files directly if we pass raw bytes
    // Convert buffer to a Blob-like input that transformers can decode
    const audioData = new Uint8Array(audioBuffer);

    // Use return_timestamps: false for short clips (reCAPTCHA audio is ~5s)
    const output = await recognizer(audioData, {
      chunk_length_s: 10,
      stride_length_s: 2,
      language: "english",
      task: "transcribe",
    });

    const text = output?.text?.trim();
    if (text && text.length > 0) {
      // Clean up: Whisper often returns punctuation, reCAPTCHA wants just numbers
      // e.g., "one seven three two nine" → "179329" or "1 7 3 2 9"
      const cleaned = text.replace(/[.,!?;:'"[\]{}()]/g, "").trim();
      console.log(`[STT] Transcribed: "${text}" → "${cleaned}"`);
      return cleaned;
    }
    return null;
  } catch (e) {
    console.error("[STT] Transcription error:", e.message);
    return null;
  }
}

/**
 * Quick check if the STT engine is available
 */
export function isSTTReady() {
  return _recognizer !== null;
}

// Preload on module import (non-blocking)
getRecognizer().catch((e) => {
  console.warn("[STT] Model preload failed (will retry on first use):", e.message);
});
