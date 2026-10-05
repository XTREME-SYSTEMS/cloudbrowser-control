import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { invokeLLM } from '../../shared/vercelAiGateway.ts';
import { hashKey } from '../../shared/crypto.ts';

// Copilot Relay — bridges ChatGPT (via MCP) to the Copilot panel.
// ChatGPT calls copilot_send to chat through the Copilot, and copilot_receive to read responses.
// All LLM calls use GPT models (gpt_5_4) via InvokeLLM.

const SYSTEM_PROMPT = `You are the CloudBrowser Copilot, powered by ChatGPT (GPT-5). You help operators manage the Xtreme CloudBrowser platform — a universal browser automation runtime.

Your capabilities:
- Browser automation: create sessions, navigate, click, type, extract data, screenshot
- Job management: create and run browser automation jobs
- Infrastructure: Railway, GitHub, Vercel deployments
- Intelligence: keyword research, intelligence ingestion, autonomous workflows
- Clone pipeline: capture, audit, reconstruct, deploy site clones
- System governance: approvals, evidence receipts, audit logs

When asked to perform an action, explain what you'll do and use the browser_control MCP tool to execute it.
Be concise, transparent, and proactive. Confirm before destructive actions.`;

export default async function(req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const requestId = req.headers.get('x-request-id') || 'relay_' + Date.now();

  try {
    const body = await req.json();
    const { action, message, conversation_id, api_key } = body;

    // ── Auth: API key (ChatGPT via MCP) OR authenticated admin ──
    let authenticated = false;
    let authName = 'anonymous';
    const apiKey = api_key || (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (apiKey) {
      const keyHash = await hashKey(apiKey);
      const keys = await base44.asServiceRole.entities.ApiKey.filter({ key_hash: keyHash, active: true });
      if (keys.length) {
        if (keys[0].expires_at && new Date(keys[0].expires_at) < new Date()) {
          return Response.json({ error: 'API key expired' }, { status: 401 });
        }
        authenticated = true;
        authName = keys[0].name || 'api_key';
      }
    }
    if (!authenticated) {
      try {
        const user = await base44.auth.me();
        if (user && user.role === 'admin') {
          authenticated = true;
          authName = user.email || user.id;
        }
      } catch (e) {}
    }
    if (!authenticated) return Response.json({ error: 'Authentication required' }, { status: 401 });

    // ── Handle actions ──
    if (action === 'copilot_send' || action === 'send') {
      if (!message) return Response.json({ error: 'message is required' }, { status: 400 });

      // Store the incoming ChatGPT message
      const userMsg = await base44.asServiceRole.entities.CopilotMessage.create({
        conversation_id: conversation_id || 'mcp_default',
        role: 'user',
        content: message,
        source: 'mcp',
        created_date: new Date().toISOString(),
      });

      // Fetch recent conversation context (last 10 messages)
      const recent = await base44.asServiceRole.entities.CopilotMessage.list('-created_date', 10);
      const history = recent.reverse().map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));

      // Generate response using GPT model
      const conversationContext = history.map(m => `${m.role}: ${m.content}`).join('\n\n');
      const prompt = `${SYSTEM_PROMPT}\n\n--- Conversation history ---\n${conversationContext}\n\n--- New message from ChatGPT ---\n${message}\n\nRespond as the CloudBrowser Copilot. If the user wants to perform a browser action, describe what you would do and suggest using the browser_control tool.`;

      const llmRes = await invokeLLM({
        prompt,
        model: 'gpt_5_4',
      });

      const responseText = typeof llmRes === 'string' ? llmRes : JSON.stringify(llmRes);

      // Store the assistant response
      const assistantMsg = await base44.asServiceRole.entities.CopilotMessage.create({
        conversation_id: conversation_id || 'mcp_default',
        role: 'assistant',
        content: responseText,
        source: 'mcp',
        model_used: 'gpt_5_4',
        created_date: new Date().toISOString(),
      });

      return Response.json({
        status: 'ok',
        message_id: userMsg.id,
        response_id: assistantMsg.id,
        response: responseText,
        model: 'gpt_5_4',
        request_id: requestId,
      });

    } else if (action === 'copilot_receive' || action === 'receive') {
      // Return recent messages for ChatGPT to read
      const msgs = await base44.asServiceRole.entities.CopilotMessage.list('-created_date', 20);
      return Response.json({
        messages: msgs.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          source: m.source,
          model_used: m.model_used,
          created_at: m.created_date,
        })),
        count: msgs.length,
        request_id: requestId,
      });

    } else if (action === 'copilot_history' || action === 'history') {
      // Return conversation history
      const convId = conversation_id || 'mcp_default';
      const allMsgs = await base44.asServiceRole.entities.CopilotMessage.filter({ conversation_id: convId });
      return Response.json({
        conversation_id: convId,
        messages: allMsgs.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          source: m.source,
          created_at: m.created_date,
        })),
        count: allMsgs.length,
        request_id: requestId,
      });

    } else {
      return Response.json({ error: `Unknown action: ${action}. Use 'send', 'receive', or 'history'.` }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error.message, request_id: requestId }, { status: 500 });
  }
}