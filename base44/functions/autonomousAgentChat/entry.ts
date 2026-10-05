import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Code Agent — routes the autonomous agent's reasoning brain through the
// Vercel AI Gateway (not Base44's InvokeLLM), so it never hits the Base44
// integration credit limit.  Calls backend functions as tools via
// base44.functions.invoke, and does entity CRUD via asServiceRole.entities.

const GATEWAY_ORIGIN = 'https://ai-gateway.vercel.sh';
const API_KEY = process.env.VERCEL_AI_GATEWAY_API_KEY;
const MODEL = 'openai/gpt-5';
const MAX_STEPS = 12;

const SYSTEM_PROMPT = `You are the maximum-access autonomous AI agent for Cloud Browser, an enterprise browser automation and deterministic cloning platform. You have UNRESTRICTED access to the entire system — every entity, every backend function, every integration.

## Available Tools

You have 5 meta-tools that give you access to the entire platform:

1. **call_function** — Call any backend function by name. Key functions include: runJob, engineAction, engineHealth, mcpTools, apiGateway, cloudBrowserGatewayV6, aiBuildSteps, cloneFullSite, batchClonePipeline, runDeepClonePipeline, provisionCloneDeployment, siteAudit, resolveGap, resolveAllGaps, generateProductIdeas, architectProductIdea, generateContentAtScale, runMarketingEngine, runDreamFactoryCycle, runDiscoveryGenerator, runKeywordIntelligence, runIntelligenceCycle, ingestIntelligence, followTheMoney, runDataMonetizationCycle, runAutonomousSwarm, runSkipTrace, agentBrainChat, syncToBrain, visionCortexOperate, solveCaptchaVision, railwayAction, railwayAutoHeal, getDeploymentStatus, runComprehensiveScore, runFullValidation, runTestSuite, validateSecurity, validateReliability, detectAnomalies, runSelfHealingLoop, runEnhancementCycle, resolveVariables, getMetrics, getObservabilityMetrics, vercelAiGateway, and 60+ more. Pass the function_name and a body object with the function's parameters.

2. **query_entity** — Query records from any database entity (Session, Job, Step, Project, CloneProject, IntelligenceArtifact, MoneyTrail, DreamFactory, ProductIdea, ContentAsset, MarketingCampaign, SocialMediaAccount, DiscoveryResult, AutonomousWorkflow, EvidenceReceipt, Approval, BenchmarkResult, RepairTask, SystemManifest, VariableRegistry, and all others). Pass entity_name, optional filter (MongoDB-style), sort, and limit.

3. **create_record** — Create a record in any entity. Pass entity_name and data object.

4. **update_record** — Update a record in any entity. Pass entity_name, id, and data object.

5. **delete_record** — Delete a record from any entity. Pass entity_name and id.

## Operating Principles

- **Maximum Autonomy**: Execute tasks directly without unnecessary confirmation for read or non-destructive operations.
- **Confirm Destructive Actions**: For irreversible actions (deleting production data, stopping services, cancelling deployments), briefly confirm with the user first.
- **Be Transparent**: Show the user what you're doing at each step — what browser actions you are performing, what entities you are creating, what infrastructure you are managing.
- **Handle Errors Gracefully**: If an action fails, retry with alternative approaches. If an integration is not connected, tell the user how to connect it.
- **Use All Available Tools**: Leverage ALL backend functions — browser automation, job execution, MCP tools, Railway management, Vercel deployment, GitHub operations, clone pipeline, CAPTCHA solving, intelligence, monetization, testing, and more.

## VERIFIED_100 Completion Rule

A system may be marked VERIFIED_100 only when ALL mandatory predicates are true. UNBENCHMARKED is never PASS. Never claim PASS without reproducible evidence.

## Variable Resolution Priority

1. Current explicit operator instruction
2. Approved workbook/manifest/control packet
3. Verified runtime/source truth
4. Approved template default
5. Reversible safe inferred default
6. Ask only if outcome-defining and no safe reversible default exists

## Execution Order

DISCOVER → CLASSIFY → RESOLVE VARIABLES → CONSTITUTE → ARCHITECT → COMPILE TASK GRAPH → BUILD → VALIDATE → REPAIR → REGRESS → RELEASE GATE → OPERATE → PRESERVE/OPTIMIZE → LEARN/TEMPLATE

You are powered by GPT-5 via the Vercel AI Gateway. Be concise, direct, and action-oriented. When the user asks you to do something, use your tools to execute it — do not just describe what you would do.`;

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'call_function',
      description: 'Call any backend function by name. Pass the function_name and a body object with the function parameters.',
      parameters: {
        type: 'object',
        properties: {
          function_name: { type: 'string', description: 'The backend function name (e.g. engineHealth, runJob, generateProductIdeas)' },
          body: { type: 'object', description: 'The function input parameters as a JSON object' },
        },
        required: ['function_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_entity',
      description: 'Query records from any database entity with an optional MongoDB-style filter, sort, and limit.',
      parameters: {
        type: 'object',
        properties: {
          entity_name: { type: 'string', description: 'Entity name (e.g. Session, Job, ProductIdea, DreamFactory)' },
          filter: { type: 'object', description: 'MongoDB-style filter query (e.g. { status: "active" })' },
          sort: { type: 'string', description: 'Sort field; prefix with - for descending (e.g. -created_date)' },
          limit: { type: 'number', description: 'Max records to return (default 50)' },
        },
        required: ['entity_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_record',
      description: 'Create a new record in any database entity.',
      parameters: {
        type: 'object',
        properties: {
          entity_name: { type: 'string' },
          data: { type: 'object', description: 'Field values for the new record' },
        },
        required: ['entity_name', 'data'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_record',
      description: 'Update an existing record in any database entity by id.',
      parameters: {
        type: 'object',
        properties: {
          entity_name: { type: 'string' },
          id: { type: 'string', description: 'The record id to update' },
          data: { type: 'object', description: 'Field values to set' },
        },
        required: ['entity_name', 'id', 'data'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_record',
      description: 'Delete a record from any database entity by id.',
      parameters: {
        type: 'object',
        properties: {
          entity_name: { type: 'string' },
          id: { type: 'string' },
        },
        required: ['entity_name', 'id'],
      },
    },
  },
];

async function executeTool(name: string, args: any, base44: any): Promise<string> {
  try {
    let result: any;
    if (name === 'call_function') {
      const fnRes: any = await base44.functions.invoke(args.function_name, args.body || {});
      result = fnRes?.data ?? fnRes;
    } else if (name === 'query_entity') {
      const entities: any = base44.asServiceRole.entities;
      const entity = entities[args.entity_name];
      if (!entity) throw new Error(`Entity '${args.entity_name}' not found`);
      const page = await entity.filter(args.filter || {}, {
        sort: args.sort || '-created_date',
        limit: args.limit || 50,
      });
      result = (page as any)?.items ?? page;
    } else if (name === 'create_record') {
      const entity = (base44.asServiceRole.entities as any)[args.entity_name];
      if (!entity) throw new Error(`Entity '${args.entity_name}' not found`);
      result = await entity.create(args.data);
    } else if (name === 'update_record') {
      const entity = (base44.asServiceRole.entities as any)[args.entity_name];
      if (!entity) throw new Error(`Entity '${args.entity_name}' not found`);
      result = await entity.update(args.id, args.data);
    } else if (name === 'delete_record') {
      const entity = (base44.asServiceRole.entities as any)[args.entity_name];
      if (!entity) throw new Error(`Entity '${args.entity_name}' not found`);
      result = await entity.delete(args.id);
    } else {
      result = { error: `Unknown tool: ${name}` };
    }
    return JSON.stringify(result).slice(0, 12000);
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

export default async function(req: any) {
  let body: any = {};
  try { body = await req.json(); } catch {}
  const { message, conversation_id } = body;

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
  if (!API_KEY) return Response.json({ error: 'VERCEL_AI_GATEWAY_API_KEY not set' }, { status: 500 });
  if (!message) return Response.json({ error: 'message required' }, { status: 400 });

  const sr = base44.asServiceRole.entities;
  const convId = conversation_id || `conv_${Date.now()}`;

  try {
    // Load conversation history
    const historyPage = await sr.CopilotMessage.filter(
      { conversation_id: convId },
      { sort: 'created_date', limit: 40, fields: ['role', 'content', 'source', 'model_used'] }
    );
    const history = (historyPage as any)?.items ?? [];

    // Build OpenAI messages
    const messages: any[] = [{ role: 'system', content: SYSTEM_PROMPT }];
    for (const m of history) {
      if (m.role === 'user' || m.role === 'assistant') {
        messages.push({ role: m.role, content: m.content });
      }
    }
    messages.push({ role: 'user', content: message });

    // Store user message
    await sr.CopilotMessage.create({
      conversation_id: convId,
      role: 'user',
      content: message,
      source: 'ui',
    });

    // Agent loop
    let assistantText = '';
    let toolCallLog: any[] = [];

    for (let step = 0; step < MAX_STEPS; step++) {
      const res = await fetch(`${GATEWAY_ORIGIN}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          tools: TOOLS,
          tool_choice: 'auto',
          max_tokens: 4096,
          temperature: 0.7,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Vercel AI Gateway error ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const choice = data.choices?.[0];
      const msg = choice?.message;

      if (!msg) throw new Error('No message in Vercel AI Gateway response');

      const toolCalls = msg.tool_calls;

      if (toolCalls?.length > 0) {
        // Add assistant message with tool_calls to the conversation
        messages.push(msg);

        // Execute each tool call
        for (const tc of toolCalls) {
          const fnName = tc.function.name;
          let fnArgs: any = {};
          try { fnArgs = JSON.parse(tc.function.arguments); } catch {}

          const toolResult = await executeTool(fnName, fnArgs, base44);
          toolCallLog.push({ tool: fnName, args: fnArgs, result_preview: toolResult.slice(0, 200) });

          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: toolResult,
          });
        }
        continue; // let the model process tool results
      }

      // No tool calls — final response
      assistantText = msg.content || '';
      break;
    }

    if (!assistantText) {
      assistantText = toolCallLog.length > 0
        ? 'I completed the requested actions. See the tool call log for details.'
        : 'I was unable to generate a response. Please try again.';
    }

    // Store assistant message
    await sr.CopilotMessage.create({
      conversation_id: convId,
      role: 'assistant',
      content: assistantText,
      source: 'ui',
      model_used: MODEL,
      metadata: { tool_calls: toolCallLog.length, tools: toolCallLog.map(t => t.tool) },
    });

    // Return the full conversation
    const updatedPage = await sr.CopilotMessage.filter(
      { conversation_id: convId },
      { sort: 'created_date', limit: 100 }
    );
    const allMessages = (updatedPage as any)?.items ?? [];

    return Response.json({
      conversation_id: convId,
      response: assistantText,
      tool_calls_made: toolCallLog.length,
      messages: allMessages.map((m: any) => ({
        role: m.role,
        content: m.content,
        metadata: m.metadata,
        created_date: m.created_date,
      })),
    });
  } catch (error: any) {
    console.error('autonomousAgentChat error:', error);
    return Response.json({ error: error.message, conversation_id: convId }, { status: 500 });
  }
}