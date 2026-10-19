import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { invokeLLM } from '../../shared/vercelAiGateway.ts';

// Universal System Generator: Takes a ProductIdea and produces a complete,
// deterministic system architecture that can be built autonomously.
// Works for any site type, any industry, any scale.

export default async function(req: any) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

  const sr = base44.asServiceRole.entities;
  const { idea_id } = req.body || {};
  if (!idea_id) return Response.json({ error: 'idea_id is required' }, { status: 400 });

  try {
    const idea: any = await sr.ProductIdea.get(idea_id);
    if (!idea) return Response.json({ error: 'Product idea not found' }, { status: 404 });

    const archPrompt = `You are a world-class system architect and universal generator.
You can design ANY type of system — web app, mobile app, SaaS, marketplace, AI agent,
automation tool, content site, dashboard — for ANY industry, ANY scale.

Design a complete, production-ready system architecture for this product:

PRODUCT IDEA:
- Title: ${idea.title}
- Problem: ${idea.problem_solved}
- Target Audience: ${idea.target_audience}
- Solution: ${idea.solution_summary}
- Product Type: ${idea.product_type}
- Industry: ${idea.industry}
- Monetization: ${idea.monetization_model}
- Price Point: ${idea.price_point_estimate}

Research similar successful products online and design an architecture that:
1. Is BETTER than existing solutions
2. Can be built autonomously by AI agents
3. Produces 100% validated code (every component has validation criteria)
4. Scales from 1 user to millions
5. Is self-healing and self-monitoring

Output a complete architecture spec as JSON with:
- system_name, system_type, tech_stack (object with frontend, backend, database, hosting, integrations)
- entities (array of {name, description, key_fields, relationships})
- pages (array of {name, route, purpose, components})
- backend_functions (array of {name, purpose, inputs, outputs})
- validation_criteria (array of {dimension, criteria, automated_check})
- build_order (array of ordered steps)
- estimated_build_time, estimated_complexity (1-10)
- key_differentiators (array), monetization_flow, growth_mechanism, self_healing_plan`;

    const archResult: any = await invokeLLM({
      prompt: archPrompt,
      add_context_from_internet: true,
      model: "gemini_3_flash",
      response_json_schema: {
        type: "object",
        properties: {
          system_name: { type: "string" },
          system_type: { type: "string" },
          tech_stack: { type: "object" },
          entities: { type: "array" },
          pages: { type: "array" },
          backend_functions: { type: "array" },
          validation_criteria: { type: "array" },
          build_order: { type: "array" },
          estimated_build_time: { type: "string" },
          estimated_complexity: { type: "number" },
          key_differentiators: { type: "array" },
          monetization_flow: { type: "string" },
          growth_mechanism: { type: "string" },
          self_healing_plan: { type: "string" }
        }
      }
    });

    await sr.ProductIdea.update(idea_id, {
      system_architecture: archResult,
      build_status: "architecting",
      architected_at: new Date().toISOString()
    });

    const factories = await sr.DreamFactory.list();
    if (factories.length > 0) {
      await sr.DreamFactory.update(factories[0].id, { last_build_at: new Date().toISOString() });
    }

    return Response.json({
      status: "success",
      idea_id,
      title: idea.title,
      architecture: archResult,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("architectProductIdea error:", error);
    return Response.json({ status: "error", error: error.message }, { status: 500 });
  }
}