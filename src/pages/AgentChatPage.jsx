import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import AgentChat from "@/components/agents/AgentChat";

const LABELS = {
  orchestrator: "The Orchestrator",
  growth_operator: "Growth Operator",
  code_architect: "Code Architect",
  social_strategist: "Social Strategist",
  sales_engine: "Sales Engine",
  brand_guardian: "Brand Guardian",
  replicator: "The Replicator",
  swarm: "The Swarm"
};

export default function AgentChatPage() {
  const { agentName } = useParams();
  const navigate = useNavigate();
  const label = LABELS[agentName] || "Agent";
  return <AgentChat agentName={agentName} agentLabel={label} onBack={() => navigate("/")} />;
}