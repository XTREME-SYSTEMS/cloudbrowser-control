import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';

export default function useGatewayChat(agentName) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const generation = useRef(0);
  const busy = useRef(false);
  const pending = useRef(null);

  const initConversation = async () => {
    const version = ++generation.current;
    setLoading(true);
    setError(null);
    setConversation(null);
    setMessages([]);
    setInput('');
    setSending(false);
    busy.current = false;
    pending.current = null;
    try {
      const response = await base44.functions.invoke('runGatewayChat', { action: 'start', agent_name: agentName });
      if (version !== generation.current) return;
      if (response.data.error) throw new Error(response.data.error);
      setConversation(response.data.conversation);
    } catch (e) {
      if (version === generation.current) setError(e.response?.data?.error || e.message || 'Unable to connect to Vercel AI Gateway.');
    } finally {
      if (version === generation.current) setLoading(false);
    }
  };

  useEffect(() => {
    initConversation();
    return () => { generation.current += 1; };
  }, [agentName]);

  const send = async () => {
    const text = input.trim();
    if (!text || !conversation || busy.current || loading) return;
    const version = generation.current;
    busy.current = true;
    setSending(true);
    setError(null);
    setInput('');
    const requestKey = pending.current?.text === text ? pending.current.key : crypto.randomUUID();
    pending.current = { text, key: requestKey };
    setMessages(current => [...current.filter(m => m.request_key !== requestKey), { role: 'user', content: text, request_key: requestKey }]);
    try {
      const response = await base44.functions.invoke('runGatewayChat', { action: 'send', conversation_id: conversation.id, content: text, request_key: requestKey });
      if (version !== generation.current) return;
      if (response.data.error) throw new Error(response.data.error);
      setMessages(current => [...current.filter(m => m.request_key !== requestKey), response.data.user_message, response.data.assistant_message]);
      pending.current = null;
    } catch (e) {
      if (version !== generation.current) return;
      const data = e.response?.data;
      if (data?.assistant_message) {
        setMessages(current => [...current.filter(m => m.request_key !== requestKey), data.user_message, data.assistant_message]);
        pending.current = null;
      } else {
        setInput(text);
      }
      setError(data?.error || e.message || 'Vercel AI Gateway could not complete the request.');
    } finally {
      if (version === generation.current) { busy.current = false; setSending(false); }
    }
  };

  return { conversation, messages, input, setInput, loading, sending, error, send, initConversation };
}