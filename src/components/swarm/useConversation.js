import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

export function useConversation(conversationId) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!conversationId) { setMessages([]); setLoading(false); return; }
    try {
      const page = await base44.entities.GatewayMessage.filter(
        { conversation_id: conversationId },
        { sort: 'created_date', limit: 100 }
      );
      setMessages(page.items || []);
    } catch { setMessages([]); }
    setLoading(false);
  }, [conversationId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!conversationId) return;
    const unsub = base44.entities.GatewayMessage.subscribe((event) => {
      if (event.data?.conversation_id === conversationId) load();
    });
    return unsub;
  }, [conversationId, load]);

  return { messages, loading, reload: load };
}