import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";

export default async function(req) {
  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { industry, target_market, goals, budget_range, pipeline_id, prior_data } = body;

    const contextStr = prior_data
      ? `Previous intelligence gathered: ${JSON.stringify(prior_data).slice(0, 3000)}`
      : "";

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a master strategist running a Monte Carlo-style simulation for the business: Industry="${industry}", Target="${target_market}", Goals="${goals}", Budget="${budget_range}".

${contextStr}

Generate and evaluate strategy scenarios across these dimensions:
- Market entry approach (5 variants)
- Pricing model (5 variants)
- Customer acquisition channel (5 variants)
- Brand positioning (5 variants)
- Technology stack (5 variants)
- Geographic expansion order (5 variants)
- Partnership/alliance strategy (5 variants)
- Content/marketing approach (5 variants)
- Sales process (5 variants)
- Competitive response (5 variants)

This creates 5^10 = ~9.7M possible combinations. You don't need to run all — instead, generate the 50 most promising DISTINCT strategy combinations, evaluate each on:
- Success probability (0-100%)
- Time to revenue (days)
- Capital efficiency (1-10)
- Risk level (1-10)
- Competitive moat strength (1-10)
- Scalability (1-10)
- Overall score (weighted)

Then rank them and provide:
1. TOP 10 STRATEGIES — full detail on each
2. THE WINNER — the single highest-probability strategy with full execution plan
3. RISK FACTORS — what could go wrong with the winner
4. CONTINGENCY PLANS — backup strategies if the winner fails
5. KEY VARIABLES — which variables most impact the outcome

Return structured JSON.`,
      response_json_schema: {
        type: "object",
        properties: {
          top_strategies: { type: "array", items: { type: "object" } },
          winner: { type: "object" },
          risk_factors: { type: "array", items: { type: "string" } },
          contingency_plans: { type: "array", items: { type: "object" } },
          key_variables: { type: "array", items: { type: "string" } },
          summary: { type: "string" }
        }
      }
    });

    if (pipeline_id) {
      await base44.entities.IntelligencePipeline.update(pipeline_id, { simulation_results: result });
    }

    return Response.json({ ok: true, data: result });
  } catch (error) {
    console.error("runStrategySimulation error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}