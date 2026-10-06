import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

import { getGatewayKey } from '../../shared/vercelGateway.ts';
import { runAutonomousGatewayAgent } from '../../shared/autonomousGatewayAgent.ts';

export default async function(req: any) {
  let body: any = {};
  try { body = await req.json(); } catch {}
  const { message, conversation_id } = body;

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
  getGatewayKey();
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

    const messages: any[] = [];
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

    const result = await runAutonomousGatewayAgent(base44, { messages });
    const assistantText = result.content;
    const toolCallLog = result.tool_calls;

    // Store assistant message
    await sr.CopilotMessage.create({
      conversation_id: convId,
      role: 'assistant',
      content: assistantText,
      source: 'ui',
      model_used: result.model,
      metadata: { tool_calls: toolCallLog.length, tools: toolCallLog.map(t => t.name), provider: result.provider },
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