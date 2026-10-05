import React, { useRef, useEffect } from 'react';
import { Send, Mic, Paperclip, Loader2 } from 'lucide-react';

export default function EconomyComposer({ input, setInput, busy, onSend, onError }) {
  const fileRef = useRef(null), recognitionRef = useRef(null);
  useEffect(() => () => recognitionRef.current?.abort(), []);
  const dictate = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return onError('Dictation is not supported by this browser. You can still type your message.');
    recognitionRef.current?.abort();
    const recognition = new Recognition(); recognitionRef.current = recognition;
    recognition.lang = 'en-US'; recognition.interimResults = false;
    recognition.onresult = event => setInput(event.results[0][0].transcript.slice(0, 6000));
    recognition.onerror = event => onError(`Dictation stopped: ${event.error}. Check microphone permission.`);
    recognition.start();
  };
  const attach = async event => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (!/\.(txt|md|csv|json)$/i.test(file.name) || file.size > 20000) return onError('Choose a TXT, Markdown, CSV or JSON file smaller than 20 KB. PDF and image extraction are not available in Economy Chat.');
    try { const text = await file.text(); if (text.length + input.length > 6000) return onError('Message plus file must fit within 6,000 characters.'); setInput(`${input}\n${text}`.trim()); }
    catch (error) { onError(error.message); }
  };
  return <form onSubmit={event => { event.preventDefault(); onSend(); }} className="flex items-end gap-1 rounded-[28px] border border-border/40 bg-muted p-1">
    <input ref={fileRef} type="file" accept=".txt,.md,.csv,.json" className="hidden" onChange={attach} />
    <button type="button" disabled={busy} onClick={() => fileRef.current.click()} aria-label="Read a small text file locally" className="grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-background"><Paperclip className="h-4 w-4" /></button>
    <textarea aria-label="Message" placeholder="Ask Vision Cortex" rows={1} maxLength={6000} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); onSend(); } }} className="min-w-0 flex-1 resize-none rounded-lg bg-transparent py-3 text-base sm:text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
    <button type="button" disabled={busy} onClick={dictate} aria-label="Dictate a message" className="grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-background"><Mic className="h-4 w-4" /></button>
    <button disabled={busy || !input.trim()} aria-label="Send message" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-foreground text-background disabled:opacity-40">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button>
  </form>;
}