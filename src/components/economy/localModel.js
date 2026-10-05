export async function localModelReply(messages, onProgress) {
  const model = globalThis.LanguageModel;
  if (!model) throw new Error('Local AI is unavailable in this browser. Use supported desktop Chrome or select Groq. No cloud request was made.');
  const options = { expectedInputs: [{ type: 'text', languages: ['en'] }], expectedOutputs: [{ type: 'text', languages: ['en'] }] };
  const availability = await model.availability(options);
  if (availability === 'unavailable') throw new Error('This device does not meet Local AI requirements. Select Groq instead. No cloud request was made.');
  onProgress(availability === 'available' ? 'Thinking on your device…' : 'Preparing the browser model download…');
  const session = await model.create({ ...options, monitor(monitor) { monitor.addEventListener('downloadprogress', event => onProgress(`Downloading local model: ${Math.round(event.loaded * 100)}%`)); } });
  try {
    return await session.prompt([{ role: 'user', content: 'You are Vision Cortex in local chat mode. Help with writing and reasoning. You have no app tools, live data or web browsing. Never claim you performed external actions. Answer in English.' }, ...messages]);
  } finally { session.destroy(); }
}