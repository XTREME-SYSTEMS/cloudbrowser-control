import React, { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { uploadPublicFile } from "@/lib/fileUpload";
import {
  Plus, Trash2, Loader2, MessageSquare, Zap, Mic, Square, Volume2, Copy, Check,
  User, Bot, ArrowUp, PanelLeft, X, Wrench, Search, FolderOpen,
  ChevronDown, Activity, Shield, Terminal, FileText, Puzzle, PieChart,
  MousePointerClick, Play, Cpu, Hash, CircleDot
} from "lucide-react";

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

  const readAloud = async () => {
    setLoadingAudio(true);
    try {
      const res = await base44.functions.invoke("vercelAiGateway", { action: "generateSpeech", text: message.content, voice: "storm" });
      setAudioUrl(res.data.url);
    } catch (err) { alert("Speech generation failed: " + err.message); }
    finally { setLoadingAudio(false); }
  };

  const copyText = () => { navigator.clipboard.writeText(message.content); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isUser ? "bg-blue-600 text-white" : "bg-neutral-800 text-neutral-300 border border-neutral-700"}`}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      <div className={`flex flex-col gap-1 max-w-[80%] ${isUser ? "items-end" : "items-start"}`}>
        <div className={`rounded-2xl px-4 py-2.5 text-sm ${isUser ? "bg-blue-600 text-white" : "bg-neutral-900 text-neutral-200 border border-neutral-800"}`}>
          <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
        </div>
        {audioUrl && <audio controls src={audioUrl} className="w-full max-w-sm h-8" />}
        {!isUser && message.content && (
          <div className="flex items-center gap-1">
            <button onClick={readAloud} disabled={loadingAudio} className="text-xs text-neutral-500 hover:shadow-[0_0_0_1px_#00A2FF] flex items-center gap-1 px-2 py-1 rounded transition-colors">
              {loadingAudio ? <Loader2 className="w-3 h-3 animate-spin" /> : <Volume2 className="w-3 h-3" />}
              {audioUrl ? "Playing" : "Read aloud"}
            </button>
            <button onClick={copyText} className="text-xs text-neutral-500 hover:shadow-[0_0_0_1px_#00A2FF] flex items-center gap-1 px-2 py-1 rounded transition-colors">
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
  const [focused, setFocused] = useState(false);
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

  return (
    <div className={`bg-neutral-900 border rounded-2xl overflow-hidden transition-colors ${focused ? "border-blue-500 shadow-[0_0_0_1px_#3b82f6]" : "border-neutral-700"}`}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Ask anything, build anything..."
        disabled={disabled}
        rows={large ? 2 : 1}
        autoFocus={large}
        className="w-full resize-none bg-transparent px-5 pt-4 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none max-h-48"
        style={{ minHeight: large ? "56px" : "40px" }}
      />
      <div className="flex items-center justify-between px-3 pb-3 pt-1">
        <div className="flex items-center gap-2">
          <button className="p-1.5 rounded-lg text-neutral-400 hover:shadow-[0_0_0_1px_#00A2FF] transition-colors" title="Attach">
            <Plus className="w-4 h-4" />
          </button>
          <button className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-neutral-400 hover:shadow-[0_0_0_1px_#00A2FF] transition-colors">
            <Wrench className="w-3.5 h-3.5" />
            <span>Tools</span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={recording ? stopRecording : startRecording} disabled={disabled || transcribing} className={`p-1.5 rounded-lg transition-colors ${recording ? "bg-red-500 text-white animate-pulse" : "text-neutral-400 hover:shadow-[0_0_0_1px_#00A2FF]"}`} title="Voice input">
            {transcribing ? <Loader2 className="w-4 h-4 animate-spin" /> : recording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <button onClick={handleSend} disabled={!text.trim() || disabled} className="w-8 h-8 rounded-full flex items-center justify-center transition-all bg-blue-600 text-white hover:shadow-[0_0_0_1px_#00A2FF] disabled:bg-neutral-700 disabled:text-neutral-500 disabled:cursor-not-allowed">
            {disabled ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function WorkbenchPanel() {
  const tabs = [Terminal, Wrench, FolderOpen, Puzzle, PieChart, MousePointerClick, Play, Shield, Activity];
  return (
    <aside className="hidden xl:flex w-80 flex-col bg-[#111111] border-l border-neutral-800/50 shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800/50">
        <span className="font-semibold text-sm text-white">Developer Workbench</span>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] text-green-500 font-medium">LIVE</span>
        </div>
      </div>
      <div className="flex items-center justify-around px-2 py-2 border-b border-neutral-800/50">
        {tabs.map((Icon, i) => (
          <button key={i} className="p-2 rounded-lg text-neutral-500 hover:shadow-[0_0_0_1px_#00A2FF] transition-colors">
            <Icon className="w-4 h-4" />
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-2">SEAL Command Kernel</p>
          <p className="text-sm font-medium text-white mb-3">Agent Zero / Apex</p>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {["XTREME SUPER AGENTS", "Agent Zero", "Xtreme Cloud Browser / specialist", "Faultline", "receipt"].map((b, i) => (
              <span key={i} className="text-[10px] text-neutral-400 bg-neutral-800/60 px-2 py-1 rounded">{b}</span>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "COMMANDER", value: "Agent Zero" },
            { label: "PRIMARY OPERATOR", value: "Xtreme Cloud Browser" },
            { label: "VALIDATOR", value: "Faultline" },
            { label: "RUNTIME", value: "LIVE" },
          ].map((card, i) => (
            <div key={i} className="bg-neutral-900/60 border border-neutral-800 rounded-lg p-3">
              <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">{card.label}</p>
              <p className="text-xs font-medium text-white truncate">{card.value}</p>
            </div>
          ))}
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-2">Live Kernel Info</p>
          <div className="flex items-center gap-2 mb-3">
            <Cpu className="w-3.5 h-3.5 text-neutral-400" />
            <span className="text-xs text-neutral-300 font-mono">v2.0.0-seal</span>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <Hash className="w-3.5 h-3.5 text-neutral-400" />
            <span className="text-[10px] text-neutral-500 font-mono truncate">a8f3c2e9b1d4f7a6c0e5b8d3f2a1c9e7</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["xtreme cloud browser", "faultline", "supabase", "github", "railway"].map((s, i) => (
              <span key={i} className="text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-1 rounded-full flex items-center gap-1">
                <CircleDot className="w-2.5 h-2.5" />
                {s} UNBOUND
              </span>
            ))}
          </div>
        </div>
      </div>
    </aside>
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
      const page = await base44.entities.CopilotMessage.filter(
        { source: "ui" },
        { sort: "-created_date", limit: 200, fields: ["conversation_id", "role", "content", "created_date"] }
      );
      const items = page?.items || [];
      const grouped = {};
      for (const m of items) {
        const cid = m.conversation_id;
        if (!grouped[cid]) grouped[cid] = { id: cid, messages: [], lastActivity: m.created_date };
        grouped[cid].messages.push(m);
        if (new Date(m.created_date) > new Date(grouped[cid].lastActivity)) {
          grouped[cid].lastActivity = m.created_date;
        }
      }
      const list = Object.values(grouped).map((g) => {
        const sorted = [...g.messages].sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
        const firstUser = sorted.find((m) => m.role === "user");
        return { id: g.id, title: firstUser?.content?.substring(0, 40) || "New chat", lastActivity: g.lastActivity };
      }).sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
      setConversations(list);
    } catch { setConversations([]); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    setSending(false);
    (async () => {
      try {
        const page = await base44.entities.CopilotMessage.filter(
          { conversation_id: activeId },
          { sort: "created_date", limit: 100 }
        );
        setMessages((page?.items || []).map((m) => ({ role: m.role, content: m.content, metadata: m.metadata })));
      } catch { setMessages([]); }
    })();
  }, [activeId]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, sending]);

  const handleCreate = () => {
    const newConv = { id: `conv_${Date.now()}`, title: "New chat", lastActivity: new Date().toISOString() };
    setConversations([newConv, ...conversations]);
    setActiveId(newConv.id);
    setMessages([]);
    setSidebarOpen(false);
  };

  const handleSend = async (text) => {
    let convId = activeId;
    if (!convId) {
      convId = `conv_${Date.now()}`;
      const newConv = { id: convId, title: text.substring(0, 40), lastActivity: new Date().toISOString() };
      setConversations([newConv, ...conversations]);
      setActiveId(convId);
    }
    setSending(true);
    setError("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    try {
      const res = await base44.functions.invoke("autonomousAgentChat", { message: text, conversation_id: convId });
      const data = res?.data || res;
      if (data.error) { setError(data.error); setSending(false); return; }
      const returnedMsgs = (data.messages || []).map((m) => ({ role: m.role, content: m.content, metadata: m.metadata }));
      if (returnedMsgs.length > 0) {
        setMessages(returnedMsgs);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: data.response || "Done." }]);
      }
      fetchConversations();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleTranscribe = async (file, callback) => {
    try {
      const { file_url } = await uploadPublicFile(file);
      const res = await base44.functions.invoke("vercelAiGateway", { action: "transcribeAudio", audio_url: file_url });
      callback(res.data.text || "");
    } catch (e) { setError("Transcription failed: " + e.message); callback(""); }
  };

  const handleDelete = async (id) => {
    try {
      const page = await base44.entities.CopilotMessage.filter({ conversation_id: id }, { limit: 500, fields: ["id"] });
      const items = page?.items || [];
      for (const m of items) { await base44.entities.CopilotMessage.delete(m.id); }
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
          <span className="font-semibold text-sm text-white">Xtreme GPT</span>
        </div>
        <button onClick={() => setSidebarOpen(false)} className="md:hidden text-neutral-400 hover:shadow-[0_0_0_1px_#00A2FF] p-1">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="px-3 pb-2">
        <button onClick={handleCreate} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-700 text-sm text-neutral-200 hover:shadow-[0_0_0_1px_#00A2FF] transition-colors">
          <Plus className="w-4 h-4" /> New chat
        </button>
      </div>

      <div className="px-3 pb-2 space-y-0.5">
        <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-neutral-400 hover:shadow-[0_0_0_1px_#00A2FF] transition-colors">
          <Search className="w-4 h-4" /> Search
        </button>
        <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-neutral-400 hover:shadow-[0_0_0_1px_#00A2FF] transition-colors">
          <FileText className="w-4 h-4" /> Library
        </button>
        <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-neutral-400 hover:shadow-[0_0_0_1px_#00A2FF] transition-colors">
          <FolderOpen className="w-4 h-4" /> Projects
        </button>
      </div>

      <div className="px-3 pt-3 pb-1">
        <p className="text-[10px] uppercase tracking-wider text-neutral-500 px-1">Recent Activity</p>
      </div>

      <div className="flex-1 overflow-auto px-2 space-y-0.5">
        {loading ? (
          <div className="flex justify-center p-4"><Loader2 className="w-5 h-5 animate-spin text-neutral-500" /></div>
        ) : conversations.length === 0 ? (
          <p className="text-xs text-neutral-500 text-center p-4">No conversations yet</p>
        ) : (
          conversations.map((c) => (
            <div key={c.id} onClick={() => { setActiveId(c.id); setSidebarOpen(false); }} className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${activeId === c.id ? "bg-neutral-800 text-white" : "text-neutral-400 hover:shadow-[0_0_0_1px_#00A2FF]"}`}>
              <MessageSquare className="w-3.5 h-3.5 shrink-0" />
              <span className="text-sm truncate flex-1">{c.title}</span>
              <button onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }} className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:shadow-[0_0_0_1px_#00A2FF] transition-colors">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))
        )}
      </div>
    </>
  );

  return (
    <div className="fixed inset-0 top-0 flex bg-[#0a0a0a] overflow-hidden z-30">
      {/* Left sidebar - desktop */}
      <aside className="hidden md:flex w-64 flex-col bg-[#171717] border-r border-neutral-800/50 shrink-0">
        <Sidebar />
      </aside>

      {/* Left sidebar - mobile drawer */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="w-64 flex-col bg-[#171717] border-r border-neutral-800/50 flex h-full">
            <Sidebar />
          </div>
          <div className="flex-1 bg-black/60" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* Central chat area */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-800/50 shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden text-neutral-400 hover:shadow-[0_0_0_1px_#00A2FF] p-1">
            <PanelLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-white">XTREME SUPER AGENTS</span>
            <ChevronDown className="w-4 h-4 text-neutral-500" />
          </div>
          <div className="w-8" />
        </div>

        {/* Messages scroll area */}
        <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-6 min-h-0">
          <div className="max-w-3xl mx-auto space-y-6">
            {!activeId ? (
              <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
                <h1 className="text-2xl md:text-4xl font-semibold text-white mb-3">What can I help with?</h1>
                <p className="text-sm text-neutral-500 mb-6">Autonomous agent with full system access</p>
                <div className="w-full space-y-1">
                  {SUGGESTIONS.map((s, i) => (
                    <button key={i} onClick={() => { handleCreate(); }} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-neutral-400 hover:shadow-[0_0_0_1px_#00A2FF] transition-colors text-left">
                      <span className="text-base">{s.icon}</span>
                      {s.text}
                    </button>
                  ))}
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[40vh] text-center text-neutral-500">
                <p className="text-sm">Send a message to start. The agent can browse the web, run jobs, manage infra, and more.</p>
              </div>
            ) : (
              <>
                {messages.map((m, i) => <MessageBubble key={i} message={m} />)}
                {sending && <div className="flex items-center gap-2 text-sm text-neutral-500"><Loader2 className="w-4 h-4 animate-spin" /> Thinking...</div>}
              </>
            )}
          </div>
        </div>

        {error && <div className="px-4 py-2 bg-red-950/50 text-red-400 text-sm border-t border-red-900/50 shrink-0">{error}</div>}

        {/* Input pinned to bottom */}
        <div className="px-4 pt-2 pb-1 shrink-0">
          <div className="max-w-3xl mx-auto">
            <ChatInput onSend={handleSend} onTranscribe={handleTranscribe} disabled={sending} large={activeId ? false : true} />
            <p className="text-center text-[10px] text-neutral-600 mt-2">XTREME SUPER AGENTS can make mistakes. Protected actions require approval.</p>
          </div>
        </div>
      </div>

      {/* Right workbench panel */}
      <WorkbenchPanel />
    </div>
  );
}