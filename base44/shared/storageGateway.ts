// Storage Gateway — Vercel Blob replacement for base44.integrations.Core file uploads.
// All files are stored in Vercel Blob storage. URLs are publicly accessible but
// unguessable (random suffixes), providing effective privacy for temporary files.
// Replaces: UploadFile, UploadPublicFile, UploadPrivateFile, CreateFileSignedUrl.

const BLOB_BASE_URL = 'https://blob.vercel-storage.com';

function getBlobToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN not set. Add it to app secrets to enable file storage via Vercel Blob.');
  return token;
}

async function uploadToBlob(file: File | Blob, pathname?: string): Promise<{ url: string; pathname: string; contentType: string }> {
  const token = getBlobToken();
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

// Drop-in replacement for base44.integrations.Core.UploadFile / UploadPublicFile
export async function uploadFile(opts: { file: File | Blob; pathname?: string }): Promise<{ file_url: string }> {
  const result = await uploadToBlob(opts.file, opts.pathname);
  return { file_url: result.url };
}

// Drop-in replacement for base44.integrations.Core.UploadPublicFile
export async function uploadPublicFile(opts: { file: File | Blob; pathname?: string }): Promise<{ file_url: string }> {
  const result = await uploadToBlob(opts.file, opts.pathname);
  return { file_url: result.url };
}

// Drop-in replacement for base44.integrations.Core.UploadPrivateFile
// Vercel Blob URLs are publicly accessible but unguessable — effective privacy for temp files.
export async function uploadPrivateFile(opts: { file: File | Blob; pathname?: string }): Promise<{ file_uri: string }> {
  const result = await uploadToBlob(opts.file, opts.pathname);
  return { file_uri: result.url };
}

// Drop-in replacement for base44.integrations.Core.CreateFileSignedUrl
// Vercel Blob URLs are already publicly accessible, so no signing is needed.
export async function createSignedUrl(opts: { file_uri: string; expires_in?: number }): Promise<{ signed_url: string }> {
  return { signed_url: opts.file_uri };
}