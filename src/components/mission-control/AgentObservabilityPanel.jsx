import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, RefreshCw, MessageSquare, Wrench, CheckCircle2, XCircle, Users } from "lucide-react";

const AGENT_LABELS = {
  orchestrator: "Orchestrator",
  growth_operator: "Growth Op",
  code_architect: "Code Arch",
  social_strategist: "Social",
  sales_engine: "Sales",
  brand_guardian: "Brand",
  replicator: "Replicator",
  swarm: "Swarm",
};

export default function AgentObservabilityPanel() {
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [convRes, msgRes] = await Promise.all([
        base44.entities.GatewayConversation.filter({}, { sort: "-created_date", limit: 50 }),
        base44.entities.GatewayMessage.filter({ role: "assistant" }, { sort: "-created_date", limit: 50 }),
      ]);
      setConversations(convRes.items || []);
      setMessages(msgRes.items || []);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Compute stats
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const activeConversations = conversations.filter((c) => new Date(c.updated_date || c.created_date).getTime() > dayAgo).length;

  let totalToolCalls = 0, successfulCalls = 0, failedCalls = 0;
  const perAgent = {};
  for (const msg of messages) {
    const calls = msg.tool_calls || [];
    totalToolCalls += calls.length;
    for (const c of calls) {
      if (c.status === "completed") successfulCalls++;
      else if (c.status === "failed") failedCalls++;
    }
    // Count by agent — need to look up conversation
    const conv = conversations.find((c) => c.id === msg.conversation_id);
    if (conv) {
      const a = conv.agent_name;
      if (!perAgent[a]) perAgent[a] = { messages: 0, toolCalls: 0 };
      perAgent[a].messages++;
      perAgent[a].toolCalls += calls.length;
    }
  }
  const successRate = totalToolCalls > 0 ? Math.round((successfulCalls / totalToolCalls) * 100) : 100;

  return (
    <div className="xa-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading font-bold text-lg text-black flex items-center gap-2">
          <Users className="w-5 h-5 text-[#CCBB00]" /> Agent Observability
        </h2>
        <button onClick={load} disabled={loading} className="text-black/50 hover:text-black">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error ? (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
      ) : loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-[#CCBB00]" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <StatCard icon={MessageSquare} label="Active (24h)" value={activeConversations} color="#2563EB" />
            <StatCard icon={Wrench} label="Tool Calls" value={totalToolCalls} color="#8A7300" />
            <StatCard icon={CheckCircle2} label="Success Rate" value={`${successRate}%`} color={successRate >= 80 ? "#16A34A" : "#DC2626"} />
            <StatCard icon={XCircle} label="Failed Calls" value={failedCalls} color="#DC2626" />
          </div>

          <div>
            <div className="text-xs font-semibold text-black/50 uppercase tracking-wide mb-2">Per-Agent Activity</div>
            <div className="space-y-1.5">
              {Object.entries(AGENT_LABELS).map(([key, label]) => {
                const stats = perAgent[key] || { messages: 0, toolCalls: 0 };
                const maxMsgs = Math.max(...Object.values(perAgent).map((s) => s.messages), 1);
                const barWidth = stats.messages > 0 ? (stats.messages / maxMsgs) * 100 : 0;
                return (
                  <div key={key} className="flex items-center gap-3 text-sm">
                    <span className="w-20 font-semibold text-black/70 shrink-0">{label}</span>
                    <div className="flex-1 h-6 bg-[#FAFAFA] rounded-lg overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#FFF7B3] to-[#FFEA00] flex items-center px-2" style={{ width: `${barWidth}%` }}>
                        <span className="text-[10px] font-bold text-black/60">{stats.messages} msgs</span>
                      </div>
                    </div>
                    <span className="w-16 text-xs text-black/50 text-right shrink-0">{stats.toolCalls} calls</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="p-3 rounded-xl bg-[#FAFAFA] border border-[#E5E7EB]">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-black/50 uppercase tracking-wide">{label}</span>
        <Icon className="w-3.5 h-3.5" style={{ color }} />
      </div>
      <div className="font-heading font-black text-xl text-black mt-0.5">{value}</div>
    </div>
  );
}