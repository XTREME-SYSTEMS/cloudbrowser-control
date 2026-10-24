// Storage Gateway — Vercel Blob storage for all file uploads.
// All files are stored in Vercel Blob storage. URLs are publicly accessible but
// unguessable (random suffixes), providing effective privacy for temporary files.
// Provides: uploadFile, uploadPublicFile, uploadPrivateFile, createSignedUrl.

const BLOB_BASE_URL = 'https://blob.vercel-storage.com';

// Optional on purpose. Vercel Blob is the preferred store, but when its token is
// absent the platform's own storage takes over rather than the capture failing: a
// missing third-party token is a configuration gap, not a reason to lose a
// screenshot. A caller that passes a client gets the fallback; a caller that does
// not still gets the explicit error, exactly as before.
function getBlobToken(): string | null {
  return process.env.BLOB_READ_WRITE_TOKEN || null;
}

const BLOB_MISSING = 'BLOB_READ_WRITE_TOKEN not set. Add it to app secrets to enable file storage via Vercel Blob.';

async function uploadToNative(base44: any, file: File | Blob, isPrivate: boolean) {
  if (!base44) return null;
  const res = isPrivate
    ? await base44.asServiceRole.integrations.Core.UploadPrivateFile({ file })
    : await base44.asServiceRole.integrations.Core.UploadPublicFile({ file });
  return (isPrivate ? res?.file_uri : res?.file_url) || null;
}

async function uploadToBlob(file: File | Blob, pathname?: string): Promise<{ url: string; pathname: string; contentType: string }> {
  const token = getBlobToken();
  if (!token) throw new Error(BLOB_MISSING);
  const formData = new FormData();
  const filename = pathname || `file_${Date.now()}`;
  formData.append('file', file, filename);
  const res = await fetch(BLOB_BASE_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'x-api-version': '7' },
    body: formData,
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`Vercel Blob upload error ${res.status}: ${t}`); }
  return await res.json();
}

// Upload a file, preferring Vercel Blob and falling back to the platform's own
// storage when the Blob token is not configured.
export async function uploadFile(opts: { file: File | Blob; pathname?: string; base44?: any }): Promise<{ file_url: string }> {
  if (!getBlobToken()) {
    const url = await uploadToNative(opts.base44, opts.file, false);
    if (url) return { file_url: url };
    throw new Error(BLOB_MISSING);
  }
  const result = await uploadToBlob(opts.file, opts.pathname);
  return { file_url: result.url };
}

// Upload a public file, with the same fallback.
export async function uploadPublicFile(opts: { file: File | Blob; pathname?: string; base44?: any }): Promise<{ file_url: string }> {
  if (!getBlobToken()) {
    const url = await uploadToNative(opts.base44, opts.file, false);
    if (url) return { file_url: url };
    throw new Error(BLOB_MISSING);
  }
  const result = await uploadToBlob(opts.file, opts.pathname);
  return { file_url: result.url };
}

// Upload a private file to Vercel Blob storage.
// Vercel Blob URLs are publicly accessible but unguessable — effective privacy for temp files.
export async function uploadPrivateFile(opts: { file: File | Blob; pathname?: string }): Promise<{ file_uri: string }> {
  const result = await uploadToBlob(opts.file, opts.pathname);
  return { file_uri: result.url };
}

// Create a signed URL for a Vercel Blob file.
// Vercel Blob URLs are already publicly accessible, so no signing is needed.
export async function createSignedUrl(opts: { file_uri: string; expires_in?: number }): Promise<{ signed_url: string }> {
  return { signed_url: opts.file_uri };
}