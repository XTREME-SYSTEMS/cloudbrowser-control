// Browser Fingerprint Randomizer — generates randomized but realistic browser fingerprints
// for WebGL, Canvas, AudioContext, fonts, plugins, and platform to avoid detection.

export interface FingerprintConfig {
  platform: string;
  platformVersion: string;
  userAgent: string;
  language: string;
  languages: string[];
  timezone: string;
  screen: { width: number; height: number; colorDepth: number };
  hardwareConcurrency: number;
  deviceMemory: number;
  maxTouchPoints: number;
  vendor: string;
  product: string;
  productSub: string;
  plugins: string[];
  mimeTypes: string[];
  webgl: {
    vendor: string;
    renderer: string;
    unmaskedVendor: string;
    unmaskedRenderer: string;
  };
  canvas: { noiseSeed: number };
  audio: { sampleRate: number; channelCount: number };
  fonts: string[];
  battery: { level: number; charging: boolean };
  connection: { effectiveType: string; rtt: number; downlink: number };
}

const PLATFORMS = [
  { platform: 'Win32', ua: 'Windows NT 10.0', vendor: 'Google Inc.', productSub: '20030107' },
  { platform: 'MacIntel', ua: 'Macintosh; Intel Mac OS X 10_15_7', vendor: 'Apple Computer, Inc.', productSub: '20030107' },
  { platform: 'Linux x86_64', ua: 'X11; Linux x86_64', vendor: 'Google Inc.', productSub: '20030107' },
];

const SCREEN_RESOLUTIONS = [
  { width: 1920, height: 1080, colorDepth: 24 },
  { width: 1366, height: 768, colorDepth: 24 },
  { width: 1440, height: 900, colorDepth: 24 },
  { width: 1536, height: 864, colorDepth: 24 },
  { width: 2560, height: 1440, colorDepth: 24 },
];

const WEBGL_CONFIGS = [
  { vendor: 'Google Inc. (Google)', renderer: 'ANGLE (Intel)', unmaskedVendor: 'Google Inc. (Intel)', unmaskedRenderer: 'Intel(R) Iris(R) Plus Graphics' },
  { vendor: 'Google Inc. (Google)', renderer: 'ANGLE (NVIDIA)', unmaskedVendor: 'Google Inc. (NVIDIA)', unmaskedRenderer: 'NVIDIA GeForce GTX 1660' },
  { vendor: 'Google Inc. (Google)', renderer: 'ANGLE (AMD)', unmaskedVendor: 'Google Inc. (AMD)', unmaskedRenderer: 'AMD Radeon RX 580' },
  { vendor: 'Google Inc. (Google)', renderer: 'ANGLE (Apple)', unmaskedVendor: 'Google Inc. (Apple)', unmaskedRenderer: 'Apple M1' },
];

const COMMON_FONTS = [
  'Arial', 'Arial Black', 'Arial Narrow', 'Calibri', 'Cambria', 'Candara',
  'Comic Sans MS', 'Consolas', 'Courier', 'Courier New', 'Georgia',
  'Helvetica', 'Helvetica Neue', 'Impact', 'Lucida Console', 'Lucida Sans Unicode',
  'Microsoft Sans Serif', 'Palatino Linotype', 'Segoe UI', 'Tahoma',
  'Times', 'Times New Roman', 'Trebuchet MS', 'Verdana',
];

const COMMON_PLUGINS = [
  'PDF Viewer', 'Chrome PDF Viewer', 'Chromium PDF Viewer', 'Microsoft Edge PDF Viewer',
  'WebKit built-in PDF',
];

const LANGUAGES = [
  { language: 'en-US', languages: ['en-US', 'en'] },
  { language: 'en-GB', languages: ['en-GB', 'en'] },
  { language: 'es-ES', languages: ['es-ES', 'es'] },
  { language: 'fr-FR', languages: ['fr-FR', 'fr'] },
  { language: 'de-DE', languages: ['de-DE', 'de'] },
  { language: 'pt-BR', languages: ['pt-BR', 'pt'] },
  { language: 'ja-JP', languages: ['ja-JP', 'ja', 'en'] },
];

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Sao_Paulo', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'Asia/Tokyo', 'Asia/Singapore', 'Australia/Sydney',
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickSubset<T>(arr: T[], min: number, max: number): T[] {
  const count = min + Math.floor(Math.random() * (max - min + 1));
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).sort();
}

export function generateFingerprint(): FingerprintConfig {
  const platform = pick(PLATFORMS);
  const screen = pick(SCREEN_RESOLUTIONS);
  const webgl = pick(WEBGL_CONFIGS);
  const lang = pick(LANGUAGES);
  const timezone = pick(TIMEZONES);

  const chromeVersion = 130 + Math.floor(Math.random() * 5);

  return {
    platform: platform.platform,
    platformVersion: platform.ua,
    userAgent: `Mozilla/5.0 (${platform.ua}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion}.0.0.0 Safari/537.36`,
    language: lang.language,
    languages: lang.languages,
    timezone,
    screen,
    hardwareConcurrency: pick([4, 8, 12, 16]),
    deviceMemory: pick([4, 8, 16]),
    maxTouchPoints: pick([0, 0, 0, 1, 5, 10]),
    vendor: platform.vendor,
    product: 'Gecko',
    productSub: platform.productSub,
    plugins: pickSubset(COMMON_PLUGINS, 3, 5),
    mimeTypes: ['application/pdf', 'text/pdf'],
    webgl,
    canvas: { noiseSeed: Math.floor(Math.random() * 1000000) },
    audio: { sampleRate: pick([44100, 48000]), channelCount: 2 },
    fonts: pickSubset(COMMON_FONTS, 15, 25),
    battery: { level: Math.random(), charging: Math.random() > 0.5 },
    connection: {
      effectiveType: pick(['4g', '4g', '4g', '3g']),
      rtt: 50 + Math.floor(Math.random() * 100),
      downlink: 1 + Math.random() * 10,
    },
  };
}

// Validate that a fingerprint config has all required fields and realistic values
export function validateFingerprint(fp: FingerprintConfig): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  if (!fp.platform) issues.push('Missing platform');
  if (!fp.userAgent || !fp.userAgent.includes('Chrome/')) issues.push('Invalid or missing userAgent');
  if (!fp.webgl?.vendor) issues.push('Missing WebGL vendor');
  if (!fp.webgl?.renderer) issues.push('Missing WebGL renderer');
  if (fp.screen.width < 800 || fp.screen.height < 600) issues.push('Unrealistic screen resolution');
  if (fp.hardwareConcurrency < 1 || fp.hardwareConcurrency > 64) issues.push('Unrealistic hardware concurrency');
  if (fp.deviceMemory < 1 || fp.deviceMemory > 64) issues.push('Unrealistic device memory');
  if (!fp.timezone) issues.push('Missing timezone');
  if (!fp.language) issues.push('Missing language');
  if (fp.fonts.length < 5) issues.push('Too few fonts');
  if (fp.canvas.noiseSeed < 0) issues.push('Invalid canvas noise seed');

  return { valid: issues.length === 0, issues };
}