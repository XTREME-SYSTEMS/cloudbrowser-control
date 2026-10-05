import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { ToolLoopAgent, tool, stepCountIs, hasToolCall } from 'npm:ai@7.0.16';
import { z } from 'npm:zod@4.4.3';
import { createGatewayModels, getGatewayKey, searchGatewayWeb } from '../../shared/vercelGateway.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const goal = (body?.goal || 'Audit and grow benearme.com end to end').trim();
    if (!goal) return Response.json({ error: 'goal is required' }, { status: 400 });

    const trace = [];
    const log = (stage, detail) => trace.push({ stage, ...detail, at: new Date().toISOString() });

    const aiKey = getGatewayKey();
    const models = createGatewayModels();

    const modelId = 'anthropic/claude-sonnet-4';
    const agent = new ToolLoopAgent({
      model: models(modelId),
      instructions: `You are the Meta Architect, Xtreme AI's apex autonomous agent. You operate a real tool loop: inspect state, decide, act, verify. You are not a chatbot — every response should be backed by tool calls that do real work.

Operating model:
1. INSPECT — read the current domain registry and pending tasks before doing anything.
2. PLAN — decompose the goal into a short prioritized plan.
3. ACT — dispatch real AgentTask records for each step; run the growth mission for any domain that needs it.
4. VERIFY — re-read state to confirm your actions landed.
5. REPORT — return a concise mission brief: what you found, what you did, what's next.

Rules:
- Always call inspectRegistry first.
- Create tasks with clear titles, types, and priority. Mark safe work autonomous=true; mark anything destructive or credential-dependent autonomous=false.
- Call runGrowthMission at most once per domain, only when growth work is actually needed.
- Be concise. Lead with action, not preamble. End with a "Next action" line.`,

      tools: {
        inspectRegistry: tool({
          description: 'Read all Domain records and pending AgentTask records to understand current state',
          inputSchema: z.object({}),
          execute: async () => {
            const domains = await base44.asServiceRole.entities.Domain.filter({}, { limit: 50, sort: '-created_date' });
            const tasks = await base44.asServiceRole.entities.AgentTask.filter({ status: { $in: ['pending', 'in_progress', 'needs_approval'] } }, { limit: 50, sort: '-created_date' });
            log('inspectRegistry', { domains: domains.items?.length || 0, openTasks: tasks.items?.length || 0 });
            return {
              domains: (domains.items || []).map(d => ({ domain: d.domain, status: d.status, health: d.health_score, sitemap: d.sitemap_url })),
              openTasks: (tasks.items || []).map(t => ({ title: t.title, type: t.task_type, priority: t.priority, autonomous: t.autonomous }))
            };
          }
        }),
        dispatchTask: tool({
          description: 'Create a real AgentTask record in the action queue for a specialist agent to execute',
          inputSchema: z.object({
            agent_name: z.string().describe('Which agent owns this: growth_operator, code_architect, social_strategist, sales_engine, brand_guardian'),
            title: z.string(),
            task_type: z.string(),
            priority: z.enum(['low', 'medium', 'high', 'urgent']),
            description: z.string(),
            autonomous: z.boolean().describe('true if safe to run without approval, false if it needs a human')
          }),
          execute: async (args) => {
            const t = await base44.asServiceRole.entities.AgentTask.create({ ...args, status: 'pending' });
            log('dispatchTask', { id: t.id, title: args.title, agent: args.agent_name });
            return { created: true, task_id: t.id, title: args.title };
          }
        }),
        runGrowthMission: tool({
          description: 'Execute the autonomous growth pipeline for a domain — live HTTP audit, sitemap discovery, health score, domain update, and task dispatch.',
          inputSchema: z.object({ domain: z.string() }),
          execute: async ({ domain }) => {
            log('runGrowthMission', { domain });
            const res = await base44.asServiceRole.functions.invoke('runGrowthMission', { domain });
            log('growthMissionResult', { status: res.data?.result?.domain_status, health: res.data?.result?.health_score });
            return res.data?.result || { ok: false };
          }
        }),
        webSearch: tool({
          description: 'Search the public web for competitor research, sitemap discovery, or market context',
          inputSchema: z.object({ query: z.string() }),
          execute: async ({ query }) => {
            log('webSearch', { query });
            return await searchGatewayWeb(query);
          }
        }),
        finalize: tool({
          description: 'Submit the final mission brief. Call this once, when all work is done.',
          inputSchema: z.object({
            summary: z.string().describe('What you found and did, concise'),
            next_action: z.string().describe('The single most important next action')
          }),
          execute: async ({ summary, next_action }) => {
            log('finalize', { summary: summary.slice(0, 200), next_action });
            return { done: true, summary, next_action };
          }
        })
      },
      stopWhen: [stepCountIs(12), hasToolCall('finalize')]
    });

    log('agent_start', { goal, model: modelId, provider: 'vercel_ai_gateway' });
    const { text } = await agent.generate({ prompt: goal });
    log('agent_complete', { steps: trace.length, finalTextLength: text?.length || 0 });

    return Response.json({
      agent: 'meta_architect',
      goal,
      autonomous: true,
      architecture: 'ToolLoopAgent (LLM + real tool loop)',
      steps_executed: trace.length,
      final_brief: text || trace.find(item => item.stage === 'finalize')?.summary || 'Review the recorded actions below.',
      ai_provider: 'vercel_ai_gateway',
      ai_model: modelId,
      trace
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}