import { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import {
  Bot, X, Send, Loader2, Sparkles, Target, Trash2, ChevronLeft,
  Zap, Brain, MessageSquare,
} from "lucide-react";

const SUGGESTIONS = [
  { label: "Deep Skip Trace", icon: Target, text: "Run a deep skip trace on a property owner. I'll provide the name and address." },
  { label: "Find Heirs", icon: Sparkles, text: "Help me find heirs for a deceased person. I'll give you the details." },
  { label: "Trace Contacts", icon: Zap, text: "Find phone numbers and emails for someone. I'll give you the name." },
  { label: "Full Intelligence", icon: Brain, text: "Run a full intelligence sweep on a target. I'll provide what I know." },
];

export default function AutonomousChatPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState(() =>
    localStorage.getItem("autonomous_conv_id") || ""
  );
  const [toolCalls, setToolCalls] = useState(0);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        scrollToBottom();
        inputRef.current?.focus();
      }, 100);
    }
  }, [open, messages, scrollToBottom]);

  const loadHistory = useCallback(async () => {
    if (!conversationId) return;
    setLoadingHistory(true);
    try {
      const res = await base44.entities.CopilotMessage.filter(
        { conversation_id: conversationId },
        { sort: "created_date", limit: 100, fields: ["role", "content", "created_date", "metadata"] }
      );
      const items = res.items || res || [];
      setMessages(items.map(m => ({
        role: m.role,
        content: m.content,
        created_date: m.created_date,
        tool_calls: m.metadata?.tool_calls || 0,
      })));
    } catch (e) {
      console.error("History load failed:", e);
    } finally {
      setLoadingHistory(false);
    }
  }, [conversationId]);

  useEffect(() => {
    if (open && conversationId && messages.length === 0) {
      loadHistory();
    }
  }, [open, conversationId, loadHistory, messages.length]);

  const send = async (text) => {
    const msg = text || input;
    if (!msg.trim() || sending) return;
    setInput("");
    setSending(true);

    const userMsg = { role: "user", content: msg, created_date: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    scrollToBottom();

    try {
      const response = await base44.functions.invoke("autonomousAgentChat", {
        message: msg,
        conversation_id: conversationId || undefined,
      });
      const data = response.data || response;
      if (data.error) {
        setMessages(prev => [...prev, { role: "assistant", content: `Error: ${data.error}` }]);
      } else {
        if (data.conversation_id) {
          setConversationId(data.conversation_id);
          localStorage.setItem("autonomous_conv_id", data.conversation_id);
        }
        setToolCalls(data.tool_calls_made || 0);
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages.map(m => ({
            role: m.role,
            content: m.content,
            created_date: m.created_date,
            tool_calls: m.metadata?.tool_calls || 0,
          })));
        } else if (data.response) {
          setMessages(prev => [...prev, { role: "assistant", content: data.response }]);
        }
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: `Connection error: ${e.message}` }]);
    } finally {
      setSending(false);
      scrollToBottom();
    }
  };

  const clearConversation = () => {
    const newId = `conv_${Date.now()}`;
    setConversationId(newId);
    localStorage.setItem("autonomous_conv_id", newId);
    setMessages([]);
    setToolCalls(0);
  };

  return (
    <>
      {/* Toggle Tab */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-50 flex items-center gap-2 px-3 py-4 rounded-l-xl border border-r-0 border-primary/40 bg-card text-primary hover:bg-primary/10 transition-all group"
          style={{ boxShadow: "-4px 0 16px rgba(0,163,255,0.15)", writingMode: "vertical-rl" }}
          title="Open Autonomous Agent"
        >
          <Bot className="w-5 h-5 group-hover:scale-110 transition-transform" style={{ writingMode: "horizontal-tb" }} />
          <span className="font-display font-semibold text-sm tracking-widest uppercase rotate-180">Agent</span>
        </button>
      )}

      {/* Slide-in Panel */}
      <div
        className={`fixed top-0 right-0 h-full z-50 w-full max-w-md flex flex-col border-l border-primary/20 bg-sidebar transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ boxShadow: open ? "-8px 0 32px rgba(0,0,0,0.4)" : "none" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0" style={{ background: "rgba(0,163,255,0.04)" }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative w-9 h-9 flex items-center justify-center shrink-0">
              <div className="absolute inset-0 rounded-full border border-primary/40" style={{ boxShadow: "0 0 12px rgba(0,163,255,0.3)" }} />
              <Bot className="w-4 h-4 text-primary relative z-10" />
            </div>
            <div className="min-w-0">
              <div className="font-heading font-bold text-sm text-white tracking-wide truncate">AUTONOMOUS AGENT</div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] text-primary/70 font-display tracking-widest uppercase">Full Access · Memory Active</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {toolCalls > 0 && (
              <Badge>{toolCalls} tools</Badge>
            )}
            <button onClick={clearConversation} title="New conversation" className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all">
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={() => setOpen(false)} title="Close panel" className="p-1.5 rounded-md text-muted-foreground hover:text-white hover:bg-white/10 transition-all">
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto xa-scroll px-4 py-4 space-y-4">
          {loadingHistory && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          )}
          {!loadingHistory && messages.length === 0 && (
            <div className="text-center py-8 space-y-4">
              <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border border-primary/30 animate-pulse" style={{ boxShadow: "0 0 20px rgba(0,163,255,0.2)" }} />
                <Bot className="w-7 h-7 text-primary" />
              </div>
              <div>
                <p className="font-heading font-semibold text-sm text-white">Autonomous Agent Ready</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                  Full autonomy. Zero limitations. Persistent memory across sessions. Can run deep skip traces, heir searches, and all intelligence operations.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2">
                {SUGGESTIONS.map(({ label, icon: Icon, text }) => (
                  <button
                    key={label}
                    onClick={() => send(text)}
                    className="flex flex-col items-start gap-1 p-2.5 rounded-lg border border-white/8 bg-white/2 hover:border-primary/40 hover:bg-primary/8 transition-all text-left group"
                  >
                    <Icon className="w-4 h-4 text-primary/70 group-hover:text-primary" />
                    <span className="text-xs font-display font-semibold text-neutral-300 group-hover:text-white">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <MessageBubble key={i} message={m} />
          ))}
          {sending && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground pl-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              <span className="font-display tracking-wide">Agent thinking...</span>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-white/5 p-3" style={{ background: "rgba(5,8,13,0.6)" }}>
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Command the agent... (Shift+Enter for new line)"
                rows={1}
                className="w-full px-3 py-2.5 pr-10 rounded-lg text-sm resize-none max-h-32 xa-scroll bg-white/3 border border-white/8 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground/50 transition-all"
                style={{ minHeight: "42px" }}
              />
            </div>
            <button
              onClick={() => send()}
              disabled={!input.trim() || sending}
              className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/15 border border-primary/40 text-primary hover:bg-primary/25 hover:border-primary/60 transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
              style={{ boxShadow: "0 0 12px rgba(0,163,255,0.15)" }}
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex items-center justify-between mt-1.5 px-1">
            <span className="text-[9px] text-muted-foreground/60 font-display tracking-widest uppercase">Autonomous · Deep Search Capable</span>
            {conversationId && (
              <span className="text-[9px] text-muted-foreground/40 font-mono truncate max-w-[120px]">{conversationId.slice(-8)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Backdrop on mobile */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}

function Badge({ children }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-display font-bold tracking-widest uppercase bg-primary/10 text-primary border border-primary/20">
      {children}
    </span>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
        isUser ? "bg-primary/15 border border-primary/30" : "bg-white/5 border border-white/10"
      }`}>
        {isUser ? <MessageSquare className="w-3.5 h-3.5 text-primary" /> : <Bot className="w-3.5 h-3.5 text-neutral-300" />}
      </div>
      <div className={`max-w-[78%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <div className={`px-3 py-2 rounded-xl text-sm leading-relaxed ${
          isUser
            ? "bg-primary/12 border border-primary/25 text-foreground rounded-tr-sm"
            : "bg-white/4 border border-white/8 text-foreground rounded-tl-sm"
        }`}>
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        </div>
        {!isUser && message.tool_calls > 0 && (
          <div className="flex items-center gap-1 px-1">
            <Zap className="w-2.5 h-2.5 text-primary/60" />
            <span className="text-[9px] text-primary/60 font-display tracking-widest uppercase">{message.tool_calls} tool calls executed</span>
          </div>
        )}
      </div>
    </div>
  );
}