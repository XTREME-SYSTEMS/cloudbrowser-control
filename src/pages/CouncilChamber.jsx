import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import {
  Plus, Trash2, Loader2, MessageSquare, Send, Eye, ShieldCheck, Scale,
  DollarSign, Award, Compass, Zap, AlertTriangle, CheckCircle2, XCircle,
  PanelLeft, X, Sparkles, BookOpen, Gavel, Activity, User, ArrowUp
} from "lucide-react";

const COUNCIL_MEMBERS = [
  { name: "Safety Warden", icon: ShieldCheck, color: "#ef4444", role: "Chief Safety Officer" },
  { name: "Ethics Officer", icon: Scale, color: "#a855f7", role: "Compliance & Policy Guardian" },
  { name: "Resource Guardian", icon: DollarSign, color: "#22c55e", role: "Cost & Quota Monitor" },
  { name: "Quality Inspector", icon: Award, color: "#3b82f6", role: "Production Readiness Auditor" },
  { name: "Strategic Advisor", icon: Compass, color: "#f59e0b", role: "Long-Term Vision Keeper" },
];

const VERDICT_META = {
  allow: { icon: CheckCircle2, color: "#22c55e", label: "ALLOWED" },
  block: { icon: XCircle, color: "#ef4444", label: "BLOCKED" },
  conditional: { icon: AlertTriangle, color: "#f59e0b", label: "CONDITIONAL" },
  inconclusive: { icon: AlertTriangle, color: "#71717a", label: "INCONCLUSIVE" },
};

const SUGGESTIONS = [
  { icon: "🛡️", text: "Should GPT buy 50 domains in batch without individual review?" },
  { icon: "🚀", text: "Can GPT promote 3 sandboxes to production simultaneously?" },
  { icon: "💰", text: "Is it safe to let GPT spend $200 on infrastructure today?" },
  { icon: "📋", text: "Should GPT submit 10 sites to Google Search Console at once?" },
];

function memberByName(name) {
  return COUNCIL_MEMBERS.find((m) => m.name === name);
}

function ChatBubble({ entry }) {
  const isUser = entry.author === "You";
  const isSystem = entry.author === "System" || entry.author === "Resolution" || entry.author === "Foresight";
  const member = memberByName(entry.author);
  const Icon = member?.icon || (isUser ? User : Sparkles);
  const color = member?.color || (entry.author === "Resolution" ? "#10b981" : entry.author === "Foresight" ? "#3b82f6" : "#71717a");

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
        style={{ background: `${color}20`, border: `1px solid ${color}40` }}
      >
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className={`flex flex-col gap-1 max-w-[78%] ${isUser ? "items-end" : "items-start"}`}>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold" style={{ color }}>{entry.author}</span>
          {entry.kind === "veto" && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400">VETO</span>}
          {entry.kind === "warning" && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400">WARNING</span>}
          {entry.kind === "foresight" && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400">FORESIGHT</span>}
        </div>
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? "bg-blue-600 text-white"
              : isSystem
              ? "bg-neutral-800 text-neutral-200 border border-neutral-700"
              : "bg-neutral-800/80 text-neutral-100"
          }`}
          style={!isUser && !isSystem ? { borderLeft: `2px solid ${color}` } : {}}
        >
          <p className="whitespace-pre-wrap break-words">{entry.content}</p>
        </div>
      </div>
    </div>
  );
}

function ChatInput({ onSend, disabled, placeholder }) {
  const [text, setText] = useState("");
  const handleSend = () => {
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText("");
  };
  return (
    <div className="bg-neutral-800/80 border border-neutral-700 rounded-2xl overflow-hidden shadow-lg">
      <div className="flex items-end gap-2 px-3 py-2.5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none max-h-32"
          style={{ minHeight: "24px" }}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || disabled}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-all bg-blue-600 text-white hover:bg-blue-500 disabled:bg-neutral-700 disabled:text-neutral-500 disabled:cursor-not-allowed shrink-0"
        >
          {disabled ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

export default function CouncilChamber() {
  const navigate = useNavigate();
  const [deliberations, setDeliberations] = useState([]);
  const [doctrines, setDoctrines] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [activeDelib, setActiveDelib] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [watchdogRunning, setWatchdogRunning] = useState(false);
  const [watchdogReport, setWatchdogReport] = useState(null);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showDoctrine, setShowDoctrine] = useState(false);
  const scrollRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const [dPage, docPage] = await Promise.all([
        base44.entities.CouncilDeliberation.filter({}, { sort: "-created_date", limit: 50 }),
        base44.entities.Doctrine.filter({}, { sort: "-weight", limit: 20 })
      ]);
      setDeliberations(dPage?.items || []);
      setDoctrines(docPage?.items || []);
    } catch (e) {
      setError("Failed to load: " + e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!activeId) { setActiveDelib(null); return; }
    const d = deliberations.find((x) => x.id === activeId);
    setActiveDelib(d || null);
  }, [activeId, deliberations]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [activeDelib, sending]);

  const activeTranscript = useMemo(() => {
    if (!activeDelib) return [];
    try { return JSON.parse(activeDelib.transcript || "[]"); } catch { return []; }
  }, [activeDelib]);

  const activeTally = useMemo(() => {
    if (!activeDelib) return [];
    try { return JSON.parse(activeDelib.vote_tally || "[]"); } catch { return []; }
  }, [activeDelib]);

  const handleSend = async (text) => {
    setSending(true);
    setError("");
    try {
      const res = await base44.functions.invoke("councilSession", {
        action: text,
        trigger: "manual"
      });
      const data = res?.data || res;
      if (data.error) { setError(data.error); setSending(false); return; }
      await load();
      // Select the newest deliberation
      const newPage = await base44.entities.CouncilDeliberation.filter({}, { sort: "-created_date", limit: 1 });
      if (newPage?.items?.[0]) setActiveId(newPage.items[0].id);
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  const handleWatchdog = async () => {
    setWatchdogRunning(true);
    setError("");
    try {
      const res = await base44.functions.invoke("councilWatchdog", {});
      const data = res?.data || res;
      if (data.error) { setError(data.error); setWatchdogRunning(false); return; }
      setWatchdogReport(data.report);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setWatchdogRunning(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await base44.entities.CouncilDeliberation.delete(id);
      setDeliberations(deliberations.filter((d) => d.id !== id));
      if (activeId === id) setActiveId(null);
    } catch { /* ignore */ }
  };

  const handleNew = () => {
    setActiveId(null);
    setActiveDelib(null);
    setSidebarOpen(false);
  };

  const verdict = activeDelib ? (VERDICT_META[activeDelib.verdict] || VERDICT_META.inconclusive) : null;
  const VerdictIcon = verdict?.icon;

  const Sidebar = () => (
    <>
      <div className="flex items-center justify-between px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-red-500 to-purple-600 flex items-center justify-center">
            <Gavel className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-sm text-neutral-100">Oversight Council</span>
        </div>
        <button onClick={() => setSidebarOpen(false)} className="md:hidden text-neutral-500 hover:text-neutral-300 p-1">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Watchdog status */}
      <div className="px-3 pb-2">
        <button
          onClick={handleWatchdog}
          disabled={watchdogRunning}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-800/60 border border-neutral-700 text-sm text-neutral-300 hover:bg-neutral-700/60 transition-colors disabled:opacity-50"
        >
          {watchdogRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className={`w-4 h-4 ${watchdogReport?.status === "NOMINAL" ? "text-green-500" : watchdogReport?.status === "ELEVATED" ? "text-red-500" : "text-amber-500"}`} />}
          <span className="flex-1 text-left">
            {watchdogRunning ? "Scanning…" : watchdogReport ? `Watchdog: ${watchdogReport.status}` : "Run Watchdog"}
          </span>
          {watchdogReport?.alerts?.length > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400">{watchdogReport.alerts.length}</span>
          )}
        </button>
      </div>

      {/* New deliberation */}
      <div className="px-3 pb-2">
        <button onClick={handleNew} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-700 text-sm text-neutral-200 hover:bg-neutral-800 transition-colors">
          <Plus className="w-4 h-4" /> New deliberation
        </button>
      </div>

      {/* Doctrine toggle */}
      <div className="px-3 pb-2">
        <button
          onClick={() => setShowDoctrine(!showDoctrine)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 transition-colors"
        >
          <BookOpen className="w-4 h-4" />
          Doctrine Library
          <span className="text-[10px] text-neutral-600 ml-auto">{doctrines.length}</span>
        </button>
      </div>

      {/* Deliberation list */}
      <div className="flex-1 overflow-auto px-2 py-2 space-y-0.5 xa-scroll">
        {loading ? (
          <div className="flex justify-center p-4"><Loader2 className="w-5 h-5 animate-spin text-neutral-600" /></div>
        ) : deliberations.length === 0 ? (
          <p className="text-xs text-neutral-600 text-center p-4">No deliberations yet</p>
        ) : (
          deliberations.map((d) => {
            const v = VERDICT_META[d.verdict] || VERDICT_META.inconclusive;
            const VIcon = v.icon;
            return (
              <div
                key={d.id}
                onClick={() => { setActiveId(d.id); setSidebarOpen(false); }}
                className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${activeId === d.id ? "bg-neutral-800 text-neutral-100" : "text-neutral-400 hover:bg-neutral-800/50"}`}
              >
                <VIcon className="w-3.5 h-3.5 shrink-0" style={{ color: v.color }} />
                <span className="text-sm truncate flex-1">{d.topic.substring(0, 42)}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(d.id); }}
                  className="opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Council members */}
      <div className="px-3 py-3 border-t border-neutral-800 space-y-1">
        <div className="text-[10px] font-bold text-neutral-600 uppercase tracking-wider px-1 mb-1.5">Council Members</div>
        {COUNCIL_MEMBERS.map((m) => {
          const MIcon = m.icon;
          return (
            <div key={m.name} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-neutral-800/50">
              <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: `${m.color}20`, border: `1px solid ${m.color}40` }}>
                <MIcon className="w-3 h-3" style={{ color: m.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-neutral-300 truncate">{m.name}</div>
                <div className="text-[10px] text-neutral-600 truncate">{m.role}</div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

  return (
    <div className="flex h-[calc(100vh-6rem)] md:h-[calc(100vh-4rem)] bg-[#0a0a0a] rounded-xl overflow-hidden border border-neutral-800">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-72 flex-col bg-neutral-900 border-r border-neutral-800">
        <Sidebar />
      </aside>

      {/* Mobile drawer */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="w-72 flex-col bg-neutral-900 border-r border-neutral-800 flex h-full">
            <Sidebar />
          </div>
          <div className="flex-1 bg-black/60" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-800">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden text-neutral-500 hover:text-neutral-300 p-1">
            <PanelLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-500" />
            <span className="text-sm text-neutral-400">
              {activeDelib ? "Council Deliberation" : "Oversight Council · Claude Sonnet 4.6"}
            </span>
            {verdict && activeDelib && (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ color: verdict.color, background: `${verdict.color}20` }}>
                {verdict.label}
              </span>
            )}
          </div>
          <div className="w-8" />
        </div>

        {/* Watchdog alerts banner */}
        {watchdogReport?.alerts?.length > 0 && (
          <div className="px-4 py-2 bg-red-950/50 border-b border-red-900/50 space-y-1">
            {watchdogReport.alerts.slice(0, 2).map((a, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-red-300">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{a.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* Content */}
        {!activeId ? (
          <div className="flex-1 flex flex-col items-center justify-center px-4 overflow-auto">
            <div className="w-full max-w-2xl flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-purple-600 flex items-center justify-center mb-4">
                <Gavel className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl md:text-3xl font-semibold text-neutral-100 mb-2 text-center">Address the Council</h1>
              <p className="text-sm text-neutral-500 mb-6 text-center max-w-md">
                Five autonomous agents monitor GPT's actions. Describe what GPT wants to do — they'll debate, vote, and decide whether to allow or block it.
              </p>
              <div className="w-full">
                <ChatInput onSend={handleSend} disabled={sending} placeholder="Describe the action for the council to review…" />
              </div>
              <div className="w-full mt-6 space-y-1">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(s.text)}
                    disabled={sending}
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200 transition-colors text-left disabled:opacity-50"
                  >
                    <span className="text-base">{s.icon}</span>
                    {s.text}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : showDoctrine ? (
          <div className="flex-1 overflow-auto px-4 py-6">
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="w-5 h-5 text-amber-500" />
                <h2 className="text-lg font-semibold text-neutral-100">Compounded Doctrine</h2>
                <button onClick={() => setShowDoctrine(false)} className="ml-auto text-xs text-neutral-500 hover:text-neutral-300">← Back to chat</button>
              </div>
              <p className="text-sm text-neutral-500 mb-4">Safety insights the council has compounded from past deliberations.</p>
              <div className="space-y-2">
                {doctrines.length === 0 ? (
                  <p className="text-sm text-neutral-600 text-center py-8">No doctrine yet. Convene the council to begin compounding.</p>
                ) : doctrines.map((d) => (
                  <div key={d.id} className="p-3 rounded-xl bg-neutral-900 border border-neutral-800">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400">{d.category}</span>
                      <span className="font-bold text-xs text-neutral-200">{d.topic}</span>
                      {d.weight > 1 && <span className="text-[10px] text-green-500 font-bold">×{d.weight}</span>}
                    </div>
                    <p className="text-xs text-neutral-400">{d.insight}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Chat thread */}
            <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-6">
              <div className="max-w-3xl mx-auto space-y-5">
                {/* User's original action */}
                {activeDelib && (
                  <ChatBubble entry={{ author: "You", content: activeDelib.topic, kind: "message" }} />
                )}
                {/* Council transcript */}
                {activeTranscript.map((t, i) => (
                  <ChatBubble key={i} entry={t} />
                ))}
                {/* Vote tally */}
                {activeTally.length > 0 && (
                  <div className="flex flex-wrap gap-2 py-2">
                    {activeTally.map((v, i) => (
                      <span key={i} className="text-[11px] px-2.5 py-1 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-300">
                        <strong style={{ color: memberByName(v.agent)?.color || "#a1a1aa" }}>{v.agent}</strong>: {v.vote}
                      </span>
                    ))}
                  </div>
                )}
                {/* Resolution */}
                {activeDelib?.resolution && (
                  <ChatBubble entry={{ author: "Resolution", content: activeDelib.resolution, kind: "foresight" }} />
                )}
                {/* Foresight */}
                {activeDelib?.foresight && (
                  <ChatBubble entry={{ author: "Foresight", content: activeDelib.foresight, kind: "foresight" }} />
                )}
                {sending && (
                  <div className="flex items-center gap-2 text-sm text-neutral-500">
                    <Loader2 className="w-4 h-4 animate-spin" /> Council deliberating…
                  </div>
                )}
              </div>
            </div>

            {/* Input */}
            {error && <div className="px-4 py-2 bg-red-950/50 text-red-400 text-sm border-t border-red-900/50">{error}</div>}
            <div className="px-4 py-3 border-t border-neutral-800">
              <div className="max-w-3xl mx-auto">
                <ChatInput onSend={handleSend} disabled={sending} placeholder="Address the council with a new action to review…" />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}