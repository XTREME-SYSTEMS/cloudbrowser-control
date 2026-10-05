export function readChats(userId) {
  const text = localStorage.getItem(`vc-economy-chats:${userId}`);
  if (!text) return [];
  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error('Saved chat history could not be read. Export your browser data before clearing it.');
  return data.filter(chat => chat?.id && Array.isArray(chat.messages));
}
export function saveChat(userId, chat) {
  const rows = readChats(userId);
  const next = [chat, ...rows.filter(row => row.id !== chat.id)].slice(0, 20);
  localStorage.setItem(`vc-economy-chats:${userId}`, JSON.stringify(next));
  window.dispatchEvent(new Event('vision-cortex-chat-created'));
  return next;
}
export function boundedContext(messages) {
  let total = 0;
  const result = [];
  for (const item of messages.slice(-12).reverse()) {
    const content = item.content.slice(0, 6000);
    if (total + content.length > 20000) break;
    result.unshift({ role: item.role, content });
    total += content.length;
  }
  return result;
}
export function exportChat(chat) {
  const url = URL.createObjectURL(new Blob([chat.messages.map(m => `${m.role.toUpperCase()}\n${m.content}`).join('\n\n')], { type: 'text/plain' }));
  const link = document.createElement('a'); link.href = url; link.download = 'vision-cortex-chat.txt'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}