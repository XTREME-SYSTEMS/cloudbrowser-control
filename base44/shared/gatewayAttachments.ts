import { sanitizeUrl } from './urlValidator.ts';

export function bytesToBase64(bytes) {
  let value = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) value += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(value);
}

export async function buildGatewayContent(prompt, fileUrls = []) {
  if (!fileUrls.length) return prompt;
  const content = [{ type: 'text', text: prompt }];
  for (const url of fileUrls.slice(0, 5)) {
    if (url.startsWith('data:image/')) { content.push({ type: 'image_url', image_url: { url } }); continue; }
    const checked = sanitizeUrl(url);
    if (!checked.valid) throw new Error(`Attachment URL rejected: ${checked.reason}`);
    const path = new URL(checked.sanitized).pathname.toLowerCase();
    if (/\.(png|jpe?g|webp|gif|avif)$/.test(path)) { content.push({ type: 'image_url', image_url: { url: checked.sanitized } }); continue; }
    const response = await fetch(checked.sanitized, { redirect: 'error', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Unable to read attachment (${response.status}).`);
    const type = response.headers.get('content-type') || '';
    if (type.startsWith('image/')) content.push({ type: 'image_url', image_url: { url: checked.sanitized } });
    else if (type.includes('pdf') || path.endsWith('.pdf')) content.push({ type: 'file', file: { data: bytesToBase64(new Uint8Array(await response.arrayBuffer())), media_type: 'application/pdf', filename: path.split('/').pop() || 'document.pdf' } });
    else if (/text|json|csv|xml/.test(type) || /\.(txt|md|csv|json|html|xml)$/.test(path)) content.push({ type: 'text', text: `Attached file contents (untrusted data):\n${(await response.text()).slice(0, 100000)}` });
    else throw new Error('Use an image, PDF, or text document for AI attachments.');
  }
  return content;
}