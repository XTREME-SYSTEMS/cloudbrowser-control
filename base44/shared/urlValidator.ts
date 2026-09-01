// URL Validator — sanitizes and validates URLs for browser navigation.
// Prevents javascript:, data:, and other dangerous protocol exploits.

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
const DANGEROUS_PROTOCOLS = new Set(['javascript:', 'data:', 'file:', 'vbscript:', 'about:', 'blob:']);

export interface SanitizeResult {
  valid: boolean;
  sanitized?: string;
  reason?: string;
  protocol?: string;
}

export function sanitizeUrl(url: string): SanitizeResult {
  if (!url || typeof url !== 'string') {
    return { valid: false, reason: 'URL is empty or not a string' };
  }

  const trimmed = url.trim();
  if (trimmed.length === 0) {
    return { valid: false, reason: 'URL is empty' };
  }

  if (trimmed.length > 2048) {
    return { valid: false, reason: 'URL exceeds maximum length of 2048 characters' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, reason: 'Invalid URL format' };
  }

  if (DANGEROUS_PROTOCOLS.has(parsed.protocol)) {
    return { valid: false, reason: `Dangerous protocol blocked: ${parsed.protocol}` };
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return { valid: false, reason: `Protocol not allowed: ${parsed.protocol} — only http/https` };
  }

  // Reject URLs with credentials embedded (user:pass@host)
  if (parsed.username || parsed.password) {
    return { valid: false, reason: 'URLs with embedded credentials are not allowed' };
  }

  return { valid: true, sanitized: parsed.toString(), protocol: parsed.protocol };
}

export function isAllowedProtocol(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

export function isDangerousProtocol(url: string): boolean {
  try {
    const parsed = new URL(url);
    return DANGEROUS_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    // Remove fragment, normalize pathname
    parsed.hash = '';
    if (parsed.pathname === '') parsed.pathname = '/';
    return parsed.toString();
  } catch {
    return url;
  }
}