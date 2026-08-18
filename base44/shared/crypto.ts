import { secrets } from "base44:runtime";

// ═══════════════════════════════════════════════
// AES-GCM Encryption Module
// Used for encrypting operational secrets (proxy passwords, webhook secrets)
// that must be stored in entity tables but never exposed as plaintext.
// ═══════════════════════════════════════════════

async function getEncryptionKey() {
  const rawKey = secrets.get("ENCRYPTION_KEY");
  if (!rawKey) throw new Error("ENCRYPTION_KEY not configured. Set it in Settings → Secrets.");
  // Derive a 256-bit AES key from the secret string via SHA-256
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawKey));
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/** Encrypt a plaintext string. Returns base64(iv + ciphertext + authTag). */
export async function encrypt(plaintext) {
  if (!plaintext) return null;
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

/** Decrypt a base64(iv + ciphertext + authTag) string. Returns plaintext or null. */
export async function decrypt(encryptedBase64) {
  if (!encryptedBase64) return null;
  try {
    const key = await getEncryptionKey();
    const combined = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    return new TextDecoder().decode(decrypted);
  } catch (e) {
    console.error("Decryption failed:", e.message);
    return null;
  }
}

/** Check if encryption is available (ENCRYPTION_KEY configured). */
export function isEncryptionAvailable() {
  return !!secrets.get("ENCRYPTION_KEY");
}