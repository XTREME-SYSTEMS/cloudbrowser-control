// Anti-Bot Detection — identifies which anti-bot system a page is using based on
// page content, scripts, headers, and behavioral signals. Enables targeted bypass strategies.

export type AntiBotSystem =
  | 'cloudflare'
  | 'akamai'
  | 'datadome'
  | 'perimeterx'
  | 'kasada'
  | 'imperva'
  | 'arkose_labs'
  | 'shape_security'
  | 'distil_networks'
  | 'recaptcha_v2'
  | 'recaptcha_v3'
  | 'hcaptcha'
  | 'turnstile'
  | 'geetest'
  | 'none';

export interface DetectionResult {
  detected: AntiBotSystem;
  confidence: number;
  signals: string[];
  recommendedAction: string;
}

interface Signal {
  system: AntiBotSystem;
  patterns: RegExp[];
  headers?: string[];
  scripts?: string[];
}

const SIGNALS: Signal[] = [
  {
    system: 'cloudflare',
    patterns: [/cf-browser-verification/i, /cf-chl-/i, /__cf_bm/i, /cloudflare/i, /cf-ray/i],
    headers: ['cf-ray', 'cf-cache-status', 'server: cloudflare'],
    scripts: ['/cdn-cgi/challenge-platform/', 'cloudflare'],
  },
  {
    system: 'akamai',
    patterns: [/akamai/i, /_abck=/i, /bm_sz=/i, /ak_bmsc/i],
    headers: ['x-akamai-transformed', 'set-cookie: _abck'],
    scripts: ['akamai', '/_bm/'],
  },
  {
    system: 'datadome',
    patterns: [/datadome/i, /dd_cookie_/i, /datadome\.co/i],
    headers: ['x-datadome', 'set-cookie: datadome'],
    scripts: ['datadome.co'],
  },
  {
    system: 'perimeterx',
    patterns: [/perimeterx/i, /_pxhd=/i, /px-captcha/i, /pxhd/i],
    headers: ['x-px', 'set-cookie: _px'],
    scripts: ['px-cdn.net', 'perimeterx.net'],
  },
  {
    system: 'kasada',
    patterns: [/kasada/i, /kd_/i, /kp_/i, /_kpsdk/i],
    headers: ['x-kpsdk-ct', 'set-cookie: _kpsdk'],
    scripts: ['kasada.io'],
  },
  {
    system: 'imperva',
    patterns: [/imperva/i, /incapsula/i, /visid_incap/i, /incap_ses/i],
    headers: ['x-iinfo', 'set-cookie: visid_incap'],
    scripts: ['incapsula.com'],
  },
  {
    system: 'arkose_labs',
    patterns: [/arkose/i, /funcaptcha/i, /arkoselabs/i, /fk_/i],
    scripts: ['arkoselabs.com', 'funcaptcha.com'],
  },
  {
    system: 'shape_security',
    patterns: [/shape/i, /shape_security/i, /sb_/i, /_shape_/i],
    headers: ['x-shape'],
  },
  {
    system: 'distil_networks',
    patterns: [/distil/i, /distilnetworks/i, /_dnnid/i],
    scripts: ['distilnetworks.com'],
  },
  {
    system: 'recaptcha_v2',
    patterns: [/g-recaptcha/i, /recaptcha.*sitekey/i, /www\.google\.com\/recaptcha/i],
    scripts: ['recaptcha/api.js', 'grecaptcha'],
  },
  {
    system: 'recaptcha_v3',
    patterns: [/grecaptcha.*execute/i, /recaptcha.*v3/i, /grecaptcha.*render.*v3/i],
    scripts: ['recaptcha/releases/', 'grecaptcha.execute'],
  },
  {
    system: 'hcaptcha',
    patterns: [/h-captcha/i, /hcaptcha/i, /hcaptcha\.com/i],
    scripts: ['hcaptcha.com', 'h-captcha'],
  },
  {
    system: 'turnstile',
    patterns: [/cf-turnstile/i, /turnstile/i, /challenges\.cloudflare\.com/i],
    scripts: ['challenges.cloudflare.com/turnstile'],
  },
  {
    system: 'geetest',
    patterns: [/geetest/i, /gt_/i, /gee_test/i],
    scripts: ['geetest.com', 'gt.js'],
  },
];

export function detectAntiBot(
  html: string,
  headers?: Record<string, string>,
  scripts?: string[]
): DetectionResult {
  const signals: string[] = [];
  let bestMatch: AntiBotSystem = 'none';
  let bestScore = 0;

  for (const signal of SIGNALS) {
    let score = 0;
    const matchedSignals: string[] = [];

    // Check HTML patterns
    for (const pattern of signal.patterns) {
      if (pattern.test(html)) {
        score += 2;
        matchedSignals.push(`pattern: ${pattern.source}`);
      }
    }

    // Check headers
    if (headers) {
      const headerStr = Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\n').toLowerCase();
      for (const header of signal.headers || []) {
        if (headerStr.includes(header.toLowerCase())) {
          score += 3;
          matchedSignals.push(`header: ${header}`);
        }
      }
    }

    // Check scripts
    if (scripts) {
      const scriptStr = scripts.join('\n').toLowerCase();
      for (const script of signal.scripts || []) {
        if (scriptStr.includes(script.toLowerCase())) {
          score += 2;
          matchedSignals.push(`script: ${script}`);
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = signal.system;
      signals.push(...matchedSignals);
    }
  }

  const confidence = bestScore > 0 ? Math.min(bestScore / 7, 1) : 0;

  const recommendedActions: Record<AntiBotSystem, string> = {
    cloudflare: 'Use Turnstile solver + residential proxy + TLS fingerprint matching',
    akamai: 'Use sensor data generation + residential proxy + human behavior simulation',
    datadome: 'Use residential proxy + canvas fingerprint randomization + human behavior',
    perimeterx: 'Use residential proxy + human behavior simulation + cookie rotation',
    kasada: 'Use custom Chromium + TLS fingerprint + sensor data',
    imperva: 'Use residential proxy + cookie management + human behavior',
    arkose_labs: 'Use Arkose Labs solver + residential proxy',
    shape_security: 'Use device fingerprint spoofing + behavioral biometrics',
    distil_networks: 'Use residential proxy + fingerprint randomization',
    recaptcha_v2: 'Use reCAPTCHA v2 solver (self or 2captcha)',
    recaptcha_v3: 'Use residential proxy + human behavior + score optimization',
    hcaptcha: 'Use hCaptcha solver (self or 2captcha)',
    turnstile: 'Use Turnstile solver (self or 2captcha)',
    geetest: 'Use GeeTest solver',
    none: 'No anti-bot system detected — standard automation',
  };

  return {
    detected: bestMatch,
    confidence,
    signals: signals.slice(0, 5),
    recommendedAction: recommendedActions[bestMatch],
  };
}

export function getAllDetectedSystems(
  html: string,
  headers?: Record<string, string>,
  scripts?: string[]
): AntiBotSystem[] {
  const detected: AntiBotSystem[] = [];
  for (const signal of SIGNALS) {
    let found = false;
    for (const pattern of signal.patterns) {
      if (pattern.test(html)) { found = true; break; }
    }
    if (!found && headers) {
      const headerStr = JSON.stringify(headers).toLowerCase();
      for (const header of signal.headers || []) {
        if (headerStr.includes(header.toLowerCase())) { found = true; break; }
      }
    }
    if (found) detected.push(signal.system);
  }
  return detected;
}