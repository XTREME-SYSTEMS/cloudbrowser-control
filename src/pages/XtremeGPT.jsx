import React, { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2, Loader2, MessageSquare, Zap, Mic, Square, Volume2, Copy, Check, User, Bot, ArrowUp, PanelLeft, X, Sparkles } from "lucide-react";
import { Image as ImgComponent } from "@/components/ui/image";

const AGENT_NAME = "autonomous_agent";
const agentsApi = /** @type {any} */ (base44).agents;
const coreIntegrations = /** @type {any} */ (base44.integrations.Core);

const SUGGESTIONS = [
  { icon: "🚀", text: "Generate product ideas from today's Google trends" },
  { icon: "🏗️", text: "Architect a SaaS app for a trending problem" },
  { icon: "📝", text: "Create a week of SEO blog content for a niche" },
  { icon: "🎯", text: "Design an omnichannel marketing campaign" },
];

function MessageBubble({ message }) {
  const [audioUrl, setAudioUrl] = useState(null);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  const isImage = message.metadata?.type === "image" || !!message.image_url;
  const imageUrl = message.metadata?.image_url || message.image_url;

  const readAloud = async () => {
    setLoadingAudio(true);
    try {
      const res = await coreIntegrations.GenerateSpeech({ text: message.content, voice: "storm" });
      setAudioUrl(res.url);
    } catch (err) { alert("Speech generation failed: " + err.message); }
    finally { setLoadingAudio(false); }
  };

  const copyText = () => { navigator.clipboard.writeText(message.content); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isUser ? "bg-blue-500 text-white" : "bg-neutral-200 text-neutral-600"}`}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      <div className={`flex flex-col gap-1 max-w-[75%] ${isUser ? "items-end" : "items-start"}`}>
        <div className={`rounded-2xl px-4 py-2.5 text-sm ${isUser ? "bg-blue-600 text-white" : "bg-neutral-100 text-neutral-800"}`}>
          {isImage && imageUrl ? (
            <div className="space-y-2">
              <ImgComponent src={imageUrl} className="rounded-xl max-w-sm" fittingType="fit" />
              {message.content && <p className="text-xs text-neutral-500 italic">{message.content}</p>}
            </div>
          ) : (
            <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
          )}
        </div>
        {audioUrl && <audio controls src={audioUrl} className="w-full max-w-sm h-8" />}
        {!isUser && !isImage && message.content && (
          <div className="flex items-center gap-1">
            <button onClick={readAloud} disabled={loadingAudio} className="text-xs text-neutral-400 hover:text-neutral-600 flex items-center gap-1 px-2 py-1 rounded transition-colors">
              {loadingAudio ? <Loader2 className="w-3 h-3 animate-spin" /> : <Volume2 className="w-3 h-3" />}
              {audioUrl ? "Playing" : "Read aloud"}
            </button>
            <button onClick={copyText} className="text-xs text-neutral-400 hover:text-neutral-600 flex items-center gap-1 px-2 py-1 rounded transition-colors">
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ChatInput({ onSend, onTranscribe, disabled, large = false }) {
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const handleSend = () => {
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        setTranscribing(true);
        try {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const file = new File([blob], "voice.webm", { type: "audio/webm" });
          await onTranscribe(file, (t) => setText(t));
        } catch (err) { alert("Transcription failed: " + err.message); }
        finally { setTranscribing(false); }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch (err) { alert("Microphone access denied: " + err.message); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      setRecording(false);
    }
  };

  const sizeClasses = large ? "rounded-3xl" : "rounded-2xl";

  return (
    <div className={`bg-white border border-neutral-300 ${sizeClasses} overflow-hidden shadow-lg`}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Message Xtreme GPT..."
        disabled={disabled}
        rows={large ? 2 : 1}
        autoFocus={large}
        className="w-full resize-none bg-transparent px-5 pt-4 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none max-h-48"
        style={{ minHeight: large ? "56px" : "40px" }}
      />
      <div className="flex items-center justify-between px-3 pb-3 pt-1">
        <div className="flex items-center gap-1.5">
          <button onClick={recording ? stopRecording : startRecording} disabled={disabled || transcribing} className={`p-2 rounded-lg transition-colors ${recording ? "bg-red-500 text-white animate-pulse" : "text-neutral-500 hover:bg-neutral-100"}`} title="Voice input">
            {transcribing ? <Loader2 className="w-4 h-4 animate-spin" /> : recording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
        </div>
        <button onClick={handleSend} disabled={!text.trim() || disabled} className="w-9 h-9 rounded-full flex items-center justify-center transition-all bg-blue-600 text-white hover:bg-blue-500 disabled:bg-neutral-200 disabled:text-neutral-400 disabled:cursor-not-allowed">
          {disabled ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

export default function XtremeGPT() {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scrollRef = useRef(null);

  const fetchConversations = useCallback(async () => {
    try {
      const list = await agentsApi.listConversations({ agent_name: AGENT_NAME });
      setConversations(list || []);
    } catch { setConversations([]); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    setSending(false);
    let unsub = () => {};
    (async () => {
      try {
        const conv = await agentsApi.getConversation(activeId);
        setMessages(conv.messages || []);
        unsub = agentsApi.subscribeToConversation(activeId, (data) => {
          setMessages(data.messages || []);
          setSending(false);
        });
      } catch { setMessages([]); }
    })();
    return () => unsub();
  }, [activeId]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, sending]);

  const handleCreate = async () => {
    try {
      const conv = await agentsApi.createConversation({
        agent_name: AGENT_NAME,
        metadata: { name: `Chat ${conversations.length + 1}`, description: "Xtreme GPT conversation" },
      });
      setConversations([conv, ...conversations]);
      setActiveId(conv.id);
      setSidebarOpen(false);
    } catch (err) { setError(err.message); }
  };

  const handleSend = async (text) => {
    if (!activeId) { handleCreate(); return; }
    setSending(true);
    setError("");
    try {
      const conv = conversations.find((c) => c.id === activeId);
      await agentsApi.addMessage(conv, { role: "user", content: text });
    } catch (err) {
      setError(err.message);
      setSending(false);
    }
  };

  const handleTranscribe = async (file, callback) => {
    try {
      const { file_url } = await coreIntegrations.UploadPublicFile({ file });
      const res = await coreIntegrations.TranscribeAudio({ audio_url: file_url });
      callback(typeof res === "string" ? res : (res?.text || ""));
    } catch (e) { setError("Transcription failed: " + e.message); callback(""); }
  };

  const handleDelete = async (id) => {
    try {
      await agentsApi.updateConversation(id, { metadata: { archived: true } });
      setConversations(conversations.filter((c) => c.id !== id));
      if (activeId === id) setActiveId(null);
    } catch { /* ignore */ }
  };

  const Sidebar = () => (
    <>
      <div className="flex items-center justify-between px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-sm text-neutral-900">Xtreme GPT</span>
        </div>
        <button onClick={() => setSidebarOpen(false)} className="md:hidden text-neutral-400 hover:text-neutral-600 p-1">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="px-3 pb-2">
        <button onClick={handleCreate} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-300 text-sm text-neutral-700 hover:bg-neutral-100 transition-colors">
          <Plus className="w-4 h-4" /> New chat
        </button>
      </div>

      <div className="flex-1 overflow-auto px-2 py-2 space-y-0.5">
        {loading ? (
          <div className="flex justify-center p-4"><Loader2 className="w-5 h-5 animate-spin text-neutral-400" /></div>
        ) : conversations.length === 0 ? (
          <p className="text-xs text-neutral-400 text-center p-4">No conversations yet</p>
        ) : (
          conversations.map((c) => (
            <div key={c.id} onClick={() => { setActiveId(c.id); setSidebarOpen(false); }} className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${activeId === c.id ? "bg-neutral-200 text-neutral-900" : "text-neutral-600 hover:bg-neutral-100"}`}>
              <MessageSquare className="w-3.5 h-3.5 shrink-0" />
              <span className="text-sm truncate flex-1">{c.metadata?.name || c.messages?.[0]?.content?.substring(0, 28) || "New chat"}</span>
              <button onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }} className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-red-500 transition-colors">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))
        )}
      </div>
    </>
  );

  return (
    <div className="flex h-[calc(100vh-6rem)] md:h-[calc(100vh-4rem)] bg-white rounded-xl overflow-hidden border border-neutral-200">
      <aside className="hidden md:flex w-64 flex-col bg-neutral-50 border-r border-neutral-200">
        <Sidebar />
      </aside>

      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="w-64 flex-col bg-neutral-50 border-r border-neutral-200 flex h-full">
            <Sidebar />
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-200">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden text-neutral-500 hover:text-neutral-700 p-1">
            <PanelLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-neutral-500">Autonomous Agent · GPT-5</span>
          </div>
          <div className="w-8" />
        </div>

        {!activeId ? (
          <div className="flex-1 flex flex-col items-center justify-center px-4 overflow-auto">
            <div className="w-full max-w-2xl flex flex-col items-center">
              <h1 className="text-3xl md:text-4xl font-semibold text-neutral-900 mb-8 text-center">What can I help with?</h1>
              <div className="w-full">
                <ChatInput onSend={handleSend} onTranscribe={handleTranscribe} disabled={sending} large />
              </div>
              <div className="w-full mt-6 space-y-1">
                {SUGGESTIONS.map((s, i) => (
                  <button key={i} onClick={() => { handleCreate(); }} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition-colors text-left">
                    <span className="text-base">{s.icon}</span>
                    {s.text}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-6">
              <div className="max-w-3xl mx-auto space-y-6">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-neutral-400">
                    <p className="text-sm">Send a message to start. The agent can browse the web, run jobs, manage infra, and more.</p>
                  </div>
                ) : (
                  <>
                    {messages.map((m, i) => <MessageBubble key={i} message={m} />)}
                    {sending && <div className="flex items-center gap-2 text-sm text-neutral-400"><Loader2 className="w-4 h-4 animate-spin" /> Thinking...</div>}
                  </>
                )}
              </div>
            </div>
            {error && <div className="px-4 py-2 bg-red-50 text-red-600 text-sm border-t border-red-200">{error}</div>}
            <div className="px-4 py-3 border-t border-neutral-200">
              <div className="max-w-3xl mx-auto">
                <ChatInput onSend={handleSend} onTranscribe={handleTranscribe} disabled={sending} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}