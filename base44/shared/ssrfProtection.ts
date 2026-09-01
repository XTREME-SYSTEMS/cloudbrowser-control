// SSRF Protection — validates URLs to prevent Server-Side Request Forgery attacks.
// Blocks private IP ranges, cloud metadata endpoints, localhost, and non-HTTP protocols.

const PRIVATE_IP_PATTERNS = [
  /^127\./,                          // Loopback
  /^10\./,                           // Private class A
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Private class B
  /^192\.168\./,                     // Private class C
  /^169\.254\./,                     // Link-local
  /^0\./,                            // Current network
  /^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\./, // Carrier-grade NAT
  /^::1$/,                           // IPv6 loopback
  /^fc00:/,                          // IPv6 unique local
  /^fe80:/,                          // IPv6 link-local
  /^fd/,                             // IPv6 private
];

const METADATA_ENDPOINTS = new Set([
  '169.254.169.254',
  'metadata.google.internal',
  'metadata.aws.internal',
  '100.100.100.200',   // Alibaba Cloud metadata
  'metadata.azure.com', // Azure metadata
]);

export function isPrivateIP(ip: string): boolean {
  return PRIVATE_IP_PATTERNS.some(pattern => pattern.test(ip));
}

export function isMetadataEndpoint(hostname: string): boolean {
  return METADATA_ENDPOINTS.has(hostname.toLowerCase());
}

export interface UrlValidationOptions {
  allowlist?: string[];
  blocklist?: string[];
  enforceHttps?: boolean;
  allowPrivateIps?: boolean;
}

export interface UrlValidationResult {
  valid: boolean;
  reason?: string;
  sanitized?: string;
  hostname?: string;
  protocol?: string;
}

export function validateUrl(url: string, options?: UrlValidationOptions): UrlValidationResult {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, reason: 'Invalid URL format' };
  }

  // Protocol check
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, reason: `Protocol '${parsed.protocol}' not allowed — only http/https` };
  }

  // HTTPS enforcement
  if (options?.enforceHttps && parsed.protocol !== 'https:') {
    return { valid: false, reason: 'HTTPS required but URL uses HTTP' };
  }

  const hostname = parsed.hostname;

  // Metadata endpoint check
  if (isMetadataEndpoint(hostname)) {
    return { valid: false, reason: 'Cloud metadata endpoint blocked (SSRF protection)' };
  }

  // Private IP check
  if (!options?.allowPrivateIps && isPrivateIP(hostname)) {
    return { valid: false, reason: `Private/internal IP address blocked: ${hostname}` };
  }

  // Localhost check
  if (!options?.allowPrivateIps && (hostname === 'localhost' || hostname === '0.0.0.0' || hostname === '[::]')) {
    return { valid: false, reason: 'Localhost blocked' };
  }

  // Allowlist check
  if (options?.allowlist && options.allowlist.length > 0) {
    const domain = hostname.replace(/^www\./, '');
    const isAllowed = options.allowlist.some(allowed => {
      const clean = allowed.replace(/^www\./, '').replace(/^\*\./, '');
      return domain === clean || domain.endsWith(`.${clean}`) || (allowed.startsWith('*.') && domain.endsWith(clean));
    });
    if (!isAllowed) {
      return { valid: false, reason: `Domain '${hostname}' not in allowlist` };
    }
  }

  // Blocklist check
  if (options?.blocklist && options.blocklist.length > 0) {
    const domain = hostname.replace(/^www\./, '');
    const isBlocked = options.blocklist.some(blocked => {
      const clean = blocked.replace(/^www\./, '').replace(/^\*\./, '');
      return domain === clean || domain.endsWith(`.${clean}`) || (blocked.startsWith('*.') && domain.endsWith(clean));
    });
    if (isBlocked) {
      return { valid: false, reason: `Domain '${hostname}' is blocklisted` };
    }
  }

  return { valid: true, sanitized: parsed.toString(), hostname, protocol: parsed.protocol };
}

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}