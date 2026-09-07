import { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Bot, Sparkles, X, Loader2, AlertCircle, PanelLeftClose } from "lucide-react";
import MessageBubble from "@/components/ai-chat/MessageBubble";
import ChatInput from "@/components/ai-chat/ChatInput";
import SuggestionsBar from "@/components/copilot/SuggestionsBar";

const AGENT_NAME = "autonomous_agent";

export default function CopilotPanel({ onClose }) {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(true);
  const scrollRef = useRef(null);

  const fetchConversations = useCallback(async () => {
    try {
      const list = await base44.agents.listConversations({ agent_name: AGENT_NAME });
      setConversations(list || []);
      if (list && list.length > 0) setActiveId(list[0].id);
    } catch {
      setConversations([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Subscribe to active conversation updates
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    setSending(false);
    let unsub = () => {};
    (async () => {
      try {
        const conv = await base44.agents.getConversation(activeId);
        setMessages(conv.messages || []);
        unsub = base44.agents.subscribeToConversation(activeId, (data) => {
          setMessages(data.messages || []);
          setSending(false);
        });
      } catch {
        setMessages([]);
      }
    })();
    return () => unsub();
  }, [activeId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (text) => {
    setError("");
    try {
      let conv = activeId ? conversations.find((c) => c.id === activeId) : null;
      if (!conv) {
        conv = await base44.agents.createConversation({
          agent_name: AGENT_NAME,
          metadata: { name: `Copilot ${conversations.length + 1}`, description: "Copilot session" },
        });
        setConversations([conv, ...conversations]);
        setActiveId(conv.id);
      }
      setSending(true);
      await base44.agents.addMessage(conv, { role: "user", content: text });
    } catch (err) {
      setError(err.message);
      setSending(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    const criteria = (suggestion.acceptance_criteria || []).map((c) => `- ${c}`).join("\n");
    const prompt = `Please work on this system enhancement:\n\n**${suggestion.title}**\n${suggestion.description || ""}\n\nPriority: ${suggestion.priority}/3 | Category: ${suggestion.category} | Status: ${suggestion.status}${criteria ? `\n\nAcceptance criteria:\n${criteria}` : ""}`;
    handleSend(prompt);
  };

  const handleUpload = async (file) => {
    if (!activeId) return;
    setSending(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const conv = conversations.find((c) => c.id === activeId);
      await base44.agents.addMessage(conv, { role: "user", content: `I've uploaded a file: ${file.name}`, file_urls: [file_url] });
    } catch (err) {
      setError(err.message);
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-card">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Bot className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">Copilot</p>
            <p className="text-xs text-muted-foreground truncate">Autonomous Agent · Live Edit</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7 shrink-0">
          <PanelLeftClose className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-auto p-3 space-y-3 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !activeId ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <Bot className="w-10 h-10 text-muted-foreground/40" />
            <div>
              <p className="text-sm font-medium">AI Copilot</p>
              <p className="text-xs text-muted-foreground mt-1">Chat with your agent — it can edit UI, run jobs, manage infra, and more in real time.</p>
            </div>
            <Button size="sm" onClick={() => handleSend("Hello! What can you help me with today?")}>
              <Sparkles className="w-3 h-3" /> Start Chatting
            </Button>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-xs text-muted-foreground">Send a message or pick a suggestion below. The agent can edit UI, run jobs, manage infrastructure, and more.</p>
          </div>
        ) : (
          <>
            {messages.map((m, i) => (
              <MessageBubble key={i} message={m} />
            ))}
            {sending && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" /> Agent is working...
              </div>
            )}
          </>
        )}
      </div>

      {error && (
        <div className="px-3 py-1.5 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-xs flex items-center gap-1.5 shrink-0">
          <AlertCircle className="w-3 h-3 shrink-0" /> {error}
        </div>
      )}

      {/* Suggestions bar above input */}
      <SuggestionsBar
        onSuggestionClick={handleSuggestionClick}
        expanded={showSuggestions}
        onToggle={() => setShowSuggestions(!showSuggestions)}
      />

      {/* Input */}
      <ChatInput onSend={handleSend} onUpload={handleUpload} disabled={sending} />
    </div>
  );
}