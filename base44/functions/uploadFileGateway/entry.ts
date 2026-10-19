import { uploadFile, uploadPublicFile, uploadPrivateFile, createSignedUrl } from '../../shared/storageGateway.ts';

// File upload gateway — allows frontend pages to upload files to Vercel Blob
// without using Base44 integration credits. Accepts base64-encoded file data.

function base64ToBlob(b64: string, type: string): Blob {
  const byteChars = atob(b64);
  const byteArrays: Uint8Array[] = [];
  for (let i = 0; i < byteChars.length; i += 512) {
    const slice = byteChars.slice(i, i + 512);
    const byteNumbers = new Array(slice.length);
    for (let j = 0; j < slice.length; j++) byteNumbers[j] = slice.charCodeAt(j);
    byteArrays.push(new Uint8Array(byteNumbers));
  }
  return new Blob(byteArrays, { type });
}

export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, file_data, filename, content_type, file_uri, expires_in } = body;

    if (action === 'upload' || action === 'upload_public') {
      const blob = base64ToBlob(file_data, content_type || 'application/octet-stream');
      const file = new File([blob], filename || `file_${Date.now()}`, { type: content_type });
      const result = action === 'upload_public' ? await uploadPublicFile({ file }) : await uploadFile({ file });
      return Response.json({ ok: true, ...result });
    } else if (action === 'upload_private') {
      const blob = base64ToBlob(file_data, content_type || 'application/octet-stream');
      const file = new File([blob], filename || `file_${Date.now()}`, { type: content_type });
      const result = await uploadPrivateFile({ file });
      return Response.json({ ok: true, ...result });
    } else if (action === 'create_signed_url') {
      const result = await createSignedUrl({ file_uri, expires_in });
      return Response.json({ ok: true, ...result });
    } else {
      return Response.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}