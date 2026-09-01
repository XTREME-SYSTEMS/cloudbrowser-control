// TLS Fingerprint Module
// Generates and validates TLS/JA3/JA4 fingerprints for anti-bot evasion
// Matches TLS handshake parameters to browser user agent for consistency

export interface TLSFingerprint {
  ja3_hash: string;
  ja4: string;
  tls_version: string;
  cipher_suites: number[];
  extensions: number[];
  supported_groups: number[];
  alpn: string[];
  signature_algorithms: number[];
}

// Common browser TLS profiles — matches real browser handshakes
const BROWSER_PROFILES: Record<string, Omit<TLSFingerprint, 'ja3_hash' | 'ja4'>> = {
  chrome_131: {
    tls_version: 'TLS 1.3',
    cipher_suites: [4865, 4866, 4867, 49195, 49199, 49196, 49200, 52393, 52392, 49195, 49199, 52393],
    extensions: [0, 23, 65281, 10, 11, 35, 16, 5, 34, 51, 43, 13, 45, 28, 27],
    supported_groups: [29, 23, 30, 25, 24, 256, 257],
    alpn: ['h2', 'http/1.1'],
    signature_algorithms: [1027, 1283, 1535, 1281, 1539, 2055, 2056, 2057],
  },
  chrome_120: {
    tls_version: 'TLS 1.3',
    cipher_suites: [4865, 4866, 4867, 49195, 49199, 49196, 49200, 52393, 52392, 49195, 49199, 52393],
    extensions: [0, 23, 65281, 10, 11, 35, 16, 5, 34, 51, 43, 13],
    supported_groups: [29, 23, 30, 25, 24, 256, 257],
    alpn: ['h2', 'http/1.1'],
    signature_algorithms: [1027, 1283, 1535, 1281, 1539, 2055, 2056, 2057],
  },
  firefox_133: {
    tls_version: 'TLS 1.3',
    cipher_suites: [4865, 4866, 4867, 49195, 49199, 49196, 49200, 52393, 52392],
    extensions: [0, 23, 65281, 10, 11, 35, 16, 5, 34, 51, 43, 13, 45, 28, 27, 17513],
    supported_groups: [29, 23, 30, 25, 24, 256, 257],
    alpn: ['h2', 'http/1.1'],
    signature_algorithms: [1027, 1283, 1535, 1281, 1539, 2055, 2056, 2057],
  },
  safari_17: {
    tls_version: 'TLS 1.3',
    cipher_suites: [4865, 4866, 4867, 49195, 49199, 49196, 49200, 52393, 52392],
    extensions: [0, 23, 65281, 10, 11, 35, 16, 5, 34, 51, 43, 13, 45, 28, 27],
    supported_groups: [29, 23, 30, 25, 24],
    alpn: ['h2', 'http/1.1'],
    signature_algorithms: [1027, 1283, 1535, 1281, 1539, 2055, 2056, 2057],
  },
};

function generateJa3Hash(fp: Omit<TLSFingerprint, 'ja3_hash' | 'ja4'>): string {
  // Simplified JA3 hash — concatenates TLS params and hashes
  const ja3String = `${fp.tls_version},${fp.cipher_suites.join('-')},${fp.extensions.join('-')},${fp.supported_groups.join('-')},0`;
  // Simple hash (not crypto-grade, but deterministic for fingerprinting)
  let hash = 0;
  for (let i = 0; i < ja3String.length; i++) {
    const char = ja3String.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(32, '0');
}

function generateJa4(fp: Omit<TLSFingerprint, 'ja3_hash' | 'ja4'>): string {
  // JA4 format: t13d301200_h2_e3b1b5b2b3b4
  const version = fp.tls_version === 'TLS 1.3' ? 't13' : 't12';
  const cipherCount = fp.cipher_suites.length.toString().padStart(2, '0');
  const extCount = fp.extensions.length.toString().padStart(2, '0');
  const alpn = fp.alpn.includes('h2') ? 'h2' : 'h1';
  return `${version}d${cipherCount}${extCount}00_${alpn}_${generateJa3Hash(fp).substring(0, 12)}`;
}

export function generateTLSFingerprint(browserProfile?: string): TLSFingerprint {
  const profiles = Object.keys(BROWSER_PROFILES);
  const profile = browserProfile || profiles[Math.floor(Math.random() * profiles.length)];
  const base = BROWSER_PROFILES[profile];
  if (!base) {
    // Default to Chrome 131
    const fallback = BROWSER_PROFILES.chrome_131;
    return { ...fallback, ja3_hash: generateJa3Hash(fallback), ja4: generateJa4(fallback) };
  }
  return { ...base, ja3_hash: generateJa3Hash(base), ja4: generateJa4(base) };
}

export function validateTLSFingerprint(fp: TLSFingerprint): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!fp.ja3_hash || fp.ja3_hash.length < 16) errors.push('Invalid JA3 hash');
  if (!fp.ja4 || !fp.ja4.startsWith('t1')) errors.push('Invalid JA4 string');
  if (!fp.tls_version) errors.push('Missing TLS version');
  if (fp.cipher_suites.length < 5) errors.push('Insufficient cipher suites');
  if (fp.extensions.length < 5) errors.push('Insufficient extensions');
  if (!fp.alpn.includes('h2')) errors.push('Missing HTTP/2 ALPN');
  return { valid: errors.length === 0, errors };
}

export function matchFingerprintToUA(userAgent: string): TLSFingerprint {
  const ua = userAgent.toLowerCase();
  if (ua.includes('firefox')) return generateTLSFingerprint('firefox_133');
  if (ua.includes('safari') && !ua.includes('chrome')) return generateTLSFingerprint('safari_17');
  if (ua.includes('chrome/131')) return generateTLSFingerprint('chrome_131');
  return generateTLSFingerprint('chrome_120');
}

export function getSupportedProfiles(): string[] {
  return Object.keys(BROWSER_PROFILES);
}