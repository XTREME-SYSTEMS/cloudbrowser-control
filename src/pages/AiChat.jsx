import { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Sparkles, Bot, Shield, AlertCircle } from "lucide-react";
import MessageBubble from "@/components/ai-chat/MessageBubble";
import ConversationList from "@/components/ai-chat/ConversationList";
import ChatInput from "@/components/ai-chat/ChatInput";

const AGENT_NAME = "autonomous_agent";

export default function AiChat() {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef(null);

  const fetchConversations = useCallback(async () => {
    try {
      const list = await base44.agents.listConversations({ agent_name: AGENT_NAME });
      setConversations(list || []);
    } catch { setConversations([]); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  // Subscribe to active conversation updates
  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
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
      } catch { setMessages([]); }
    })();
    return () => unsub();
  }, [activeId]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleCreate = async () => {
    try {
      const conv = await base44.agents.createConversation({
        agent_name: AGENT_NAME,
        metadata: { name: `Chat ${conversations.length + 1}`, description: "Autonomous agent conversation" },
      });
      setConversations([conv, ...conversations]);
      setActiveId(conv.id);
    } catch (err) { setError(err.message); }
  };

  const handleSend = async (text) => {
    if (!activeId) { setError("Create a conversation first"); return; }
    setSending(true);
    setError("");
    try {
      const conv = conversations.find((c) => c.id === activeId);
      await base44.agents.addMessage(conv, { role: "user", content: text });
    } catch (err) {
      setError(err.message);
      setSending(false);
    }
  };

  const handleUpload = async (file) => {
    if (!activeId) return;
    setSending(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const conv = conversations.find((c) => c.id === activeId);
      await base44.agents.addMessage(conv, { role: "user", content: `I've uploaded a file: ${file.name}`, file_urls: [file_url] });
    } catch (err) { setError(err.message); setSending(false); }
  };

  const handleDelete = async (id) => {
    try {
      await base44.agents.updateConversation(id, { metadata: { archived: true } });
      setConversations(conversations.filter((c) => c.id !== id));
      if (activeId === id) setActiveId(null);
    } catch { /* ignore */ }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] md:h-[calc(100vh-4rem)] -m-4 md:-m-8">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 border-r flex-col bg-card">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center"><Bot className="w-5 h-5 text-primary-foreground" /></div>
            <div><p className="font-heading font-semibold text-sm">Autonomous Agent</p><p className="text-xs text-muted-foreground">Full system access</p></div>
          </div>
        </div>
        <ConversationList
          conversations={conversations}
          activeId={activeId}
          onSelect={setActiveId}
          onCreate={handleCreate}
          onDelete={handleDelete}
        />
      </aside>

      {/* Main chat */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <div>
              <p className="font-medium text-sm">{activeId ? conversations.find((c) => c.id === activeId)?.metadata?.name || "Chat" : "Select or create a chat"}</p>
              <p className="text-xs text-muted-foreground">Sandbox mode active · External actions require confirmation</p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-green-600"><Shield className="w-3.5 h-3.5" /> Secured</div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
          ) : !activeId ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Bot className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-lg font-medium">Start a conversation</p>
              <p className="text-sm text-muted-foreground mb-4">Create a new chat to interact with the autonomous agent</p>
              <Button onClick={handleCreate}><Sparkles className="w-4 h-4" /> New Chat</Button>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-sm text-muted-foreground">Send a message to start. The agent can browse the web, create sessions, run jobs, manage sandboxes, and provision systems.</p>
            </div>
          ) : (
            <>
              {messages.map((m, i) => <MessageBubble key={i} message={m} />)}
              {sending && <div className="flex items-center gap-2 text-sm text-muted-foreground"><div className="w-4 h-4 border-2 border-muted border-t-primary rounded-full animate-spin" /> Agent is working...</div>}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {error && <div className="px-4 py-2 bg-red-50 text-red-600 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>}

        {/* Input */}
        {activeId && <ChatInput onSend={handleSend} onUpload={handleUpload} disabled={sending} />}
      </div>
    </div>
  );
}