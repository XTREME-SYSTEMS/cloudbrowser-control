import { ToolLoopAgent, tool, stepCountIs } from 'npm:ai@7.0.16';
import { z } from 'npm:zod@4.4.3';
import { createGatewayModels, searchGatewayWeb } from './vercelGateway.ts';
import { getModelForTask } from './aiRouter.ts';
import { GATEWAY_AGENTS, GATEWAY_RULES } from './gatewayAgents.ts';
import { createEntityTools } from './gatewayEntityTools.ts';
import { createFunctionTools } from './gatewayFunctionTools.ts';
import { createConnectorTools } from './gatewayConnectorTools.ts';

export async function runGatewayAgent(base44, { agentName, messages }) {
  const config = GATEWAY_AGENTS[agentName];
  if (!config) throw new Error('Unknown agent.');
  const model = getModelForTask(config.taskType);
  const models = createGatewayModels();
  const receipts = [];
  const agent = new ToolLoopAgent({
    model: models(model.model),
    instructions: `${config.instructions}\n\n${GATEWAY_RULES}`,
    maxOutputTokens: model.maxTokens,
    stopWhen: stepCountIs(8),
    tools: {
      ...createEntityTools(base44, config.entities),
      ...createFunctionTools(base44, agentName),
      ...createConnectorTools(base44, agentName),
      web_search: tool({
        description: 'Research the live public web through Vercel AI Gateway, with source links. Never invent search results or access private competitor analytics.',
        inputSchema: z.object({ query: z.string().min(1).max(1000) }),
        execute: async ({ query }) => await searchGatewayWeb(query),
      }),
    },
    onStepFinish: step => {
      for (const call of step.toolCalls || []) {
        if (receipts.length >= 32) break;
        const result = (step.toolResults || []).find(item => item.toolCallId === call.toolCallId);
        const failure = (step.toolErrors || []).find(item => item.toolCallId === call.toolCallId);
        const output = failure ? { error: String(failure.error?.message || failure.error) } : result?.output;
        const failed = !!failure || output?.success === false || !!output?.error;
        receipts.push({ name: call.toolName, status: failed ? 'failed' : 'completed', arguments_string: JSON.stringify(call.input || {}).slice(0, 1500), results: JSON.stringify(output ?? null).slice(0, 2000) });
      }
    },
  });
  try {
    const result = await agent.generate({ messages, abortSignal: AbortSignal.timeout(90000) });
    const content = result.text?.trim() || result.steps?.map(step => step.text).filter(Boolean).join('\n\n') || 'The execution step limit was reached. Review the recorded actions below before continuing; no further work was performed.';
    return { content: content.slice(0, 32000), tool_calls: receipts, provider: 'vercel_ai_gateway', model: model.model };
  } catch (error) {
    error.tool_calls = receipts;
    throw error;
  }
}