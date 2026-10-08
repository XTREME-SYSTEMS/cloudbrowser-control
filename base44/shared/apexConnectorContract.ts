export const APEX_CONNECTOR_VERSION = "1.0.0";

export const APEX_OPERATIONS = [
  "health",
  "discover_capabilities",
  "list_agents",
  "agent_task",
  "browser_task",
  "get_job",
  "get_receipt"
] as const;

export type ApexOperation = typeof APEX_OPERATIONS[number];

export const APEX_AGENT_ALLOWLIST = [
  "orchestrator",
  "growth_operator",
  "code_architect",
  "social_strategist",
  "sales_engine",
  "brand_guardian",
  "replicator",
  "swarm"
] as const;

export function isApexOperation(value: unknown): value is ApexOperation {
  return typeof value === "string" && (APEX_OPERATIONS as readonly string[]).includes(value);
}

export function createRequestId(prefix = "apex") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeMessages(input: unknown) {
  if (typeof input === "string" && input.trim()) {
    return [{ role: "user", content: input.trim().slice(0, 12000) }];
  }
  if (!Array.isArray(input)) return [];
  return input
    .filter((m) => m && typeof m === "object")
    .slice(-24)
    .map((m: any) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || "").slice(0, 12000),
    }))
    .filter((m) => m.content);
}
