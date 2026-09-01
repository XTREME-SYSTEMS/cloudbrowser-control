// Anti-Bot Bypass Strategy Module
// Provides bypass strategies for Akamai, DataDome, PerimeterX, Kasada, Imperva, Arkose Labs
// Uses existing platform capabilities: fingerprint randomization, human behavior, proxy rotation, stealth options

export interface BypassStrategy {
  system: string;
  detected: boolean;
  strategy: string[];
  recommendedConfig: {
    proxyType: string;
    fingerprintLevel: string;
    behaviorLevel: string;
    captchaProvider: string;
    additionalHeaders: Record<string, string>;
  };
  confidence: number;
}

const STRATEGIES: Record<string, Omit<BypassStrategy, 'detected'>> = {
  akamai: {
    system: 'Akamai Bot Manager',
    strategy: [
      'Use residential/mobile proxy with ASN matching target site',
      'Enable full fingerprint randomization (WebGL, Canvas, AudioContext)',
      'Enable human behavior simulation (mouse bezier + typing jitter)',
      'Set realistic TLS fingerprint matching browser UA',
      'Block sensor script endpoints via network interception',
      'Use persistent profile with valid cookies from prior visit',
    ],
    recommendedConfig: {
      proxyType: 'residential',
      fingerprintLevel: 'full',
      behaviorLevel: 'high',
      captchaProvider: 'none',
      additionalHeaders: { 'sec-ch-ua': '"Chromium";v="131", "Not_A Brand";v="24"' },
    },
    confidence: 0.75,
  },
  datadome: {
    system: 'DataDome',
    strategy: [
      'Use residential proxy with city-level geo-targeting',
      'Enable fingerprint randomization with consistent session identity',
      'Simulate human behavior with realistic scroll + click patterns',
      'Pre-warm session with non-bot navigation before target page',
      'Use mobile proxy for highest trust score',
      'Rotate proxy on each DataDome challenge',
    ],
    recommendedConfig: {
      proxyType: 'mobile',
      fingerprintLevel: 'full',
      behaviorLevel: 'high',
      captchaProvider: '2captcha',
      additionalHeaders: { 'accept-language': 'en-US,en;q=0.9' },
    },
    confidence: 0.70,
  },
  perimeterx: {
    system: 'PerimeterX (HUMAN)',
    strategy: [
      'Use residential proxy with consistent IP per session',
      'Enable full fingerprint randomization',
      'Simulate human mouse movement with bezier curves + pauses',
      'Set realistic viewport and device memory values',
      'Pre-warm with human-like browsing pattern',
      'Handle PX cookies via persistent profile',
    ],
    recommendedConfig: {
      proxyType: 'residential',
      fingerprintLevel: 'full',
      behaviorLevel: 'high',
      captchaProvider: 'none',
      additionalHeaders: {},
    },
    confidence: 0.72,
  },
  kasada: {
    system: 'Kasada',
    strategy: [
      'Use residential proxy with matching ASN',
      'Enable full fingerprint randomization including TLS',
      'Simulate realistic browser environment with all APIs',
      'Pre-warm session with organic navigation',
      'Use persistent profile to maintain trust',
      'Block Kasada sensor script collection',
    ],
    recommendedConfig: {
      proxyType: 'residential',
      fingerprintLevel: 'full',
      behaviorLevel: 'high',
      captchaProvider: 'none',
      additionalHeaders: {},
    },
    confidence: 0.65,
  },
  imperva: {
    system: 'Imperva/Incapsula',
    strategy: [
      'Use residential proxy with geo-targeting',
      'Enable fingerprint randomization',
      'Simulate human behavior with delays',
      'Handle Incapsula cookies via persistent profile',
      'Pre-warm session before target page',
      'Use realistic TLS fingerprint',
    ],
    recommendedConfig: {
      proxyType: 'residential',
      fingerprintLevel: 'full',
      behaviorLevel: 'medium',
      captchaProvider: '2captcha',
      additionalHeaders: {},
    },
    confidence: 0.70,
  },
  arkose: {
    system: 'Arkose Labs (FunCaptcha)',
    strategy: [
      'Use residential proxy with city-level targeting',
      'Enable full fingerprint randomization',
      'Simulate human behavior before challenge',
      'Use LLM vision solver for image puzzles',
      'Fallback to 2captcha/anticaptcha provider',
      'Pre-warm session with organic browsing',
    ],
    recommendedConfig: {
      proxyType: 'residential',
      fingerprintLevel: 'full',
      behaviorLevel: 'high',
      captchaProvider: '2captcha',
      additionalHeaders: {},
    },
    confidence: 0.68,
  },
  geetest: {
    system: 'GeeTest',
    strategy: [
      'Use residential proxy with geo-targeting',
      'Enable full fingerprint randomization',
      'Simulate human behavior with realistic drag patterns',
      'Use LLM vision solver for slider/image puzzles',
      'Fallback to 2captcha/anticaptcha provider for GeeTest v3/v4',
      'Pre-warm session before challenge',
    ],
    recommendedConfig: {
      proxyType: 'residential',
      fingerprintLevel: 'full',
      behaviorLevel: 'high',
      captchaProvider: '2captcha',
      additionalHeaders: {},
    },
    confidence: 0.65,
  },
};

export function getBypassStrategy(system: string): BypassStrategy | null {
  const key = system.toLowerCase().replace(/[^a-z]/g, '');
  const strategy = STRATEGIES[key];
  if (!strategy) return null;
  return { ...strategy, detected: true };
}

export function getAllBypassStrategies(): BypassStrategy[] {
  return Object.values(STRATEGIES).map(s => ({ ...s, detected: true }));
}

export function generateSessionConfigForBypass(system: string): {
  proxyType: string;
  fingerprintLevel: string;
  behaviorLevel: string;
  captchaProvider: string;
  additionalHeaders: Record<string, string>;
  strategy: string[];
} | null {
  const strategy = getBypassStrategy(system);
  if (!strategy) return null;
  return {
    ...strategy.recommendedConfig,
    strategy: strategy.strategy,
  };
}