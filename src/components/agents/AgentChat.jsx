import React, { useEffect, useRef } from "react";
import { ArrowLeft, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import MessageBubble from "@/components/agents/MessageBubble";
import AgentChatComposer from "@/components/agents/AgentChatComposer";
import useGatewayChat from "@/components/agents/useGatewayChat";

export default function AgentChat({ agentName, agentLabel, onBack }) {
  const { conversation, messages, input, setInput, sending, loading, error, send, initConversation } = useGatewayChat(agentName);
  const scrollRef = useRef(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, sending]);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <div className="flex items-center gap-3 px-4 h-14 border-b border-[#E5E7EB] bg-white">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-[#FAFAFA]"><ArrowLeft className="w-5 h-5" /></button>
        <div className="font-heading font-bold text-black">{agentLabel}</div>
        <span className="xa-pill-badge">Vercel AI Gateway</span>
      </div>
      <div ref={scrollRef} className="xa-scroll flex-1 overflow-y-auto px-4 py-6 space-y-5 bg-white">
        {loading ? (
          <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 animate-spin text-[#CCBB00]" /></div>
        ) : error && !conversation ? (
          <div className="flex flex-col items-center justify-center h-full px-6 text-center">
            <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
            <p className="text-sm font-semibold text-black/70 mb-1">Agent unavailable</p>
            <p className="text-xs text-black/50 mb-4 max-w-xs">{error}</p>
            <button onClick={() => initConversation()} className="xa-btn-outline text-sm">
              <RefreshCw className="w-4 h-4" /> Retry connection
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-black/40 mt-20">Send a message to activate this super-agent.</div>
        ) : messages.map((m, i) => <MessageBubble key={i} message={m} />)}
        {error && conversation && <p role="alert" className="text-sm text-foreground bg-muted border border-border rounded-lg p-3">{error}</p>}
        {sending && <div className="flex items-center gap-2 text-black/40 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Thinking…</div>}
      </div>
      <AgentChatComposer label={agentLabel} input={input} setInput={setInput} send={send} disabled={loading || sending || !conversation} />
    </div>
  );
}