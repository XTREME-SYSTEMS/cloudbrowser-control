import { base44 } from '@/api/base44Client';

const aliases = new Map();
const listeners = new Map();
const normalize = conversation => ({ ...conversation, id: conversation.legacy_id || conversation.id, gateway_id: conversation.id, metadata: conversation.metadata || {} });
const check = response => { if (response.data.error) throw new Error(response.data.error); return response.data; };

async function readGateway(conversation) {
  const { items } = await base44.entities.GatewayMessage.filter({ conversation_id: conversation.gateway_id || conversation.id }, { sort: '-created_date', limit: 100 });
  return { ...conversation, messages: items.reverse().map(message => ({ ...message, created_at: message.created_date })) };
}

async function getConversation(id) {
  const target = aliases.get(id) || id;
  const { items } = await base44.entities.GatewayConversation.filter({ $or: [{ id: target }, { legacy_id: id }] }, { limit: 1 });
  if (items[0]) { aliases.set(id, items[0].id); return await readGateway(normalize(items[0])); }
  // Read-only compatibility for saved native history. This never starts native AI.
  return await base44.agents.getConversation(id);
}

async function createConversation(options) {
  const data = check(await base44.functions.invoke('runGatewayChat', { action: 'start', agent_name: options.agent_name, metadata: options.metadata }));
  return normalize(data.conversation);
}

async function addMessage(conversation, message) {
  let current = await getConversation(conversation.id);
  if (!current.gateway_id) {
    const data = check(await base44.functions.invoke('runGatewayChat', { action: 'start', agent_name: current.agent_name || 'autonomous_agent', metadata: current.metadata, legacy_id: current.id, history: (current.messages || []).slice(-24) }));
    aliases.set(current.id, data.conversation.id);
    current = normalize(data.conversation);
  }
  let data;
  try {
    data = check(await base44.functions.invoke('runGatewayChat', { action: 'send', conversation_id: current.gateway_id, content: message.content, file_urls: message.file_urls || [], request_key: crypto.randomUUID() }));
    return data;
  } finally {
    const updated = await getConversation(conversation.id);
    for (const callback of listeners.get(conversation.id) || []) callback(updated);
  }
}

export const gatewayConversations = {
  createConversation, getConversation, addMessage,
  async listConversations({ agent_name }) {
    const page = await base44.entities.GatewayConversation.filter({ agent_name, archived: { $ne: true } }, { sort: '-updated_date', limit: 50 });
    const migrated = new Set(page.items.map(item => item.legacy_id).filter(Boolean));
    const legacy = await base44.agents.listConversations({ agent_name }).catch(() => []);
    const conversations = page.items.map(normalize);
    for (const item of legacy || []) if (!migrated.has(item.id) && !item.metadata?.archived) conversations.push(item);
    return conversations;
  },
  async updateConversation(id, { metadata }) {
    const conversation = await getConversation(id);
    if (!conversation.gateway_id) return await base44.agents.updateConversation(id, { metadata });
    return await base44.entities.GatewayConversation.update(conversation.gateway_id, { metadata: { ...conversation.metadata, ...metadata }, ...(metadata.archived !== undefined ? { archived: metadata.archived } : {}) });
  },
  subscribeToConversation(id, callback) {
    if (!listeners.has(id)) listeners.set(id, new Set());
    listeners.get(id).add(callback);
    const unsubscribe = base44.entities.GatewayMessage.subscribe(event => {
      if (event.data?.conversation_id === (aliases.get(id) || id)) getConversation(id).then(callback);
    });
    return () => { unsubscribe(); listeners.get(id)?.delete(callback); };
  },
};