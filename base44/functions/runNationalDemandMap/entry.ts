import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";

export default async function(req) {
  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { services, pipeline_id } = body;

    const defaultServices = [
      "emergency plumber", "emergency roof repair", "emergency hvac repair",
      "water damage restoration", "storm damage repair", "emergency electrician",
      "emergency locksmith", "emergency pest control", "emergency tree removal",
      "emergency foundation repair", "emergency fence repair", "emergency septic service",
      "emergency well pump repair", "emergency appliance repair", "emergency garage door repair",
    ];
    const serviceList = services?.length ? services : defaultServices;

    // Use LLM with web search to estimate national search demand per state
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a national search demand analyst for emergency and need-based services. Analyze search demand across all 50 US states for these services:

${serviceList.map((s, i) => `${i + 1}. ${s}`).join("\n")}

For EACH service, provide:
1. Estimated national monthly search volume range
2. Top 10 states with highest demand concentration (demand_score 1-10 and reason)
3. Demand type: event-driven (weather/seasonal) vs consistent
4. Key search phrases and modifiers people use
5. Domain pattern assessment: [service-slug]nearme.com and [service-slug]nearyou.com — likely available or taken
6. Typical buyer/lead value in dollars
7. Urgency level 1-10

ALSO provide:
- A national heatmap: for each of the 50 states, an overall_need_score (1-10) and top 3 services for that state
- An opportunity ranking: rank all services by combined score (demand x buyer_value x urgency x domain_availability)

Return structured JSON matching this schema. Mark all volume estimates as MODEL ESTIMATES based on current Google Trends and search data — not verified metrics.`,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          services: {
            type: "array",
            items: {
              type: "object",
              properties: {
                service: { type: "string" },
                national_monthly_searches: { type: "string" },
                demand_type: { type: "string" },
                top_states: { type: "array", items: { type: "object" } },
                key_phrases: { type: "array", items: { type: "string" } },
                nearme_domain: { type: "string" },
                nearyou_domain: { type: "string" },
                domain_assessment: { type: "string" },
                buyer_value: { type: "string" },
                urgency_level: { type: "number" }
              }
            }
          },
          national_heatmap: {
            type: "object",
            properties: {
              states: { type: "array", items: { type: "object" } }
            }
          },
          opportunity_ranking: { type: "array", items: { type: "object" } }
        }
      }
    });

    if (pipeline_id) {
      await base44.entities.IntelligencePipeline.update(pipeline_id, {
        national_demand_map: result,
      });
    }

    return Response.json({ ok: true, data: result });
  } catch (error) {
    console.error("runNationalDemandMap error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}