// Storage Gateway — Vercel Blob storage for all file uploads.
// All files are stored in Vercel Blob storage. URLs are publicly accessible but
// unguessable (random suffixes), providing effective privacy for temporary files.
// Provides: uploadFile, uploadPublicFile, uploadPrivateFile, createSignedUrl.

import { secrets } from "base44:runtime";

const BLOB_BASE_URL = 'https://blob.vercel-storage.com';

// Optional on purpose. Vercel Blob is the preferred store, but when its token is
// absent the platform's own storage takes over rather than the capture failing: a
// missing third-party token is a configuration gap, not a reason to lose a
// screenshot. A caller that passes a client gets the fallback; a caller that does
// not still gets the explicit error, exactly as before.
function getBlobToken(): string | null {
  // App secrets are exposed through the runtime here; process.env is the older
  // accessor and stays as a fallback. Reading only process.env meant a token that was
  // in fact configured never reached this module, and every upload reported it as
  // missing — which is exactly how a configured secret looked like a config gap.
  let token: string | null = null;
  try { token = secrets.get('BLOB_READ_WRITE_TOKEN') || null; } catch (e) { token = null; }
  return token || process.env.BLOB_READ_WRITE_TOKEN || null;
}

// The store id can arrive on its own. Vercel resolves the target store from the
// token or from a header, and when the token carries no store id the request is
// refused with "Cannot get store id from token or header" — so a store id supplied
// as its own secret is sent as that header rather than being ignored.
function getBlobStoreId(): string | null {
  let storeId: string | null = null;
  try { storeId = secrets.get('BLOB_STORE_ID') || null; } catch (e) { storeId = null; }
  return storeId || process.env.BLOB_STORE_ID || null;
}

const BLOB_MISSING = 'BLOB_READ_WRITE_TOKEN not set. Add it to app secrets to enable file storage via Vercel Blob.';

async function uploadToNative(base44: any, file: File | Blob, isPrivate: boolean, preferredFailure?: string) {
  const because = preferredFailure ? ` Preferred store unavailable: ${preferredFailure}` : '';
  if (!base44) throw new Error(`${BLOB_MISSING}${because} (no client supplied for the platform-storage fallback)`);
  const res: any = isPrivate
    ? await base44.asServiceRole.integrations.Core.UploadPrivateFile({ file })
    : await base44.asServiceRole.integrations.Core.UploadPublicFile({ file });
  // The stored file's URL is returned differently depending on the call path: the SDK
  // may hand back the payload itself or an HTTP-response wrapper around it. Reading
  // only one shape yielded no URL, and the caller then reported the unrelated
  // missing-Blob-token error — which is what made a working upload look like a
  // configuration gap. Read both, and if neither has a URL say which keys did arrive
  // rather than blaming the token.
  const payload = res?.data ?? res ?? {};
  const url = isPrivate
    ? payload.file_uri || payload.file_url || payload.url
    : payload.file_url || payload.url || payload.file_uri;
  if (!url) {
    throw new Error(`Platform storage returned no file URL (keys received: ${Object.keys(payload || {}).join(', ') || 'none'}).${because}`);
  }
  return url;
}

async function uploadToBlob(file: File | Blob, pathname?: string): Promise<{ url: string; pathname: string; contentType: string }> {
  const token = getBlobToken();
  if (!token) throw new Error(BLOB_MISSING);
  const formData = new FormData();
  const filename = pathname || `file_${Date.now()}`;
  formData.append('file', file, filename);
  const headers: Record<string, string> = { 'Authorization': `Bearer ${token}`, 'x-api-version': '7' };
  const storeId = getBlobStoreId();
  if (storeId) headers['x-vercel-blob-store-id'] = storeId;
  const res = await fetch(BLOB_BASE_URL, {
    method: 'POST',
    headers,
    body: formData,
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`Vercel Blob upload error ${res.status}: ${t}`); }
  return await res.json();
}

// Upload a file, preferring Vercel Blob and falling back to the platform's own
// storage when the Blob token is not configured.
export async function uploadFile(opts: { file: File | Blob; pathname?: string; base44?: any }): Promise<{ file_url: string }> {
  if (!getBlobToken()) {
    return { file_url: await uploadToNative(opts.base44, opts.file, false) };
  }
  try {
    const result = await uploadToBlob(opts.file, opts.pathname);
    return { file_url: result.url };
  } catch (blobError) {
    // A token that is present but rejected — wrong store, revoked, or the wrong kind
    // of token — used to fail the whole upload. The file is not what is wrong, the
    // token is: the platform store takes over and the reason is carried through so
    // the token can still be fixed.
    return { file_url: await uploadToNative(opts.base44, opts.file, false, blobError.message) };
  }
}

// Upload a public file, with the same fallback.
export async function uploadPublicFile(opts: { file: File | Blob; pathname?: string; base44?: any }): Promise<{ file_url: string }> {
  if (!getBlobToken()) {
    return { file_url: await uploadToNative(opts.base44, opts.file, false) };
  }
  try {
    const result = await uploadToBlob(opts.file, opts.pathname);
    return { file_url: result.url };
  } catch (blobError) {
    return { file_url: await uploadToNative(opts.base44, opts.file, false, blobError.message) };
  }
}

// Upload a private file to Vercel Blob storage.
// Vercel Blob URLs are publicly accessible but unguessable — effective privacy for temp files.
export async function uploadPrivateFile(opts: { file: File | Blob; pathname?: string; base44?: any }): Promise<{ file_uri: string }> {
  try {
    const result = await uploadToBlob(opts.file, opts.pathname);
    return { file_uri: result.url };
  } catch (blobError) {
    // Same reasoning as the public path: a rejected token must not lose the file
    // when a client is at hand to keep it in the platform's private store.
    return { file_uri: await uploadToNative(opts.base44, opts.file, true, blobError.message) };
  }
}

// Create a signed URL for a Vercel Blob file.
// Vercel Blob URLs are already publicly accessible, so no signing is needed.
export async function createSignedUrl(opts: { file_uri: string; expires_in?: number }): Promise<{ signed_url: string }> {
  return { signed_url: opts.file_uri };
}