// ═══════════════════════════════════════════════════
// Browser Fingerprint Randomizer — Engine Side
// Ported from base44/shared/fingerprintRandomizer.ts
// Runs via page.addInitScript() to spoof browser APIs
// ═══════════════════════════════════════════════════

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
];

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Singapore',
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pickSubset(arr, min, max) {
  const count = min + Math.floor(Math.random() * (max - min + 1));
  return [...arr].sort(() => Math.random() - 0.5).slice(0, count).sort();
}

export function generateFingerprint() {
  const platform = pick(PLATFORMS);
  const screen = pick(SCREEN_RESOLUTIONS);
  const webgl = pick(WEBGL_CONFIGS);
  const lang = pick(LANGUAGES);
  const timezone = pick(TIMEZONES);
  const chromeVersion = 130 + Math.floor(Math.random() * 5);

  return {
    platform: platform.platform,
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
    webgl,
    canvas: { noiseSeed: Math.floor(Math.random() * 1000000) },
    audio: { sampleRate: pick([44100, 48000]), channelCount: 2 },
    fonts: pickSubset(COMMON_FONTS, 15, 25),
    battery: { level: Math.random(), charging: Math.random() > 0.5 },
    connection: { effectiveType: pick(['4g', '4g', '4g', '3g']), rtt: 50 + Math.floor(Math.random() * 100), downlink: 1 + Math.random() * 10 },
  };
}

/**
 * Generate the init script that Playwright injects via page.addInitScript()
 * This runs before any page scripts and overrides browser fingerprinting APIs
 */
export function getFingerprintInitScript(fingerprint) {
  const fp = fingerprint || generateFingerprint();
  return `
    (function() {
      const fp = ${JSON.stringify(fp)};
      
      // Override navigator.platform
      Object.defineProperty(navigator, 'platform', { get: () => fp.platform });
      
      // Override navigator.vendor
      Object.defineProperty(navigator, 'vendor', { get: () => fp.vendor });
      
      // Override navigator.hardwareConcurrency
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => fp.hardwareConcurrency });
      
      // Override navigator.deviceMemory (if supported)
      if ('deviceMemory' in navigator) {
        Object.defineProperty(navigator, 'deviceMemory', { get: () => fp.deviceMemory });
      }
      
      // Override navigator.maxTouchPoints
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => fp.maxTouchPoints });
      
      // Override navigator.languages
      Object.defineProperty(navigator, 'languages', { get: () => fp.languages });
      Object.defineProperty(navigator, 'language', { get: () => fp.language });
      
      // Override navigator.plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => fp.plugins.map(name => ({
          name,
          filename: name.replace(/\\s/g, '').toLowerCase() + '.pdf',
          description: '',
          length: 1,
        }))
      });
      
      // Override screen dimensions
      Object.defineProperty(screen, 'width', { get: () => fp.screen.width });
      Object.defineProperty(screen, 'height', { get: () => fp.screen.height });
      Object.defineProperty(screen, 'colorDepth', { get: () => fp.screen.colorDepth });
      Object.defineProperty(screen, 'availWidth', { get: () => fp.screen.width });
      Object.defineProperty(screen, 'availHeight', { get: () => fp.screen.height - 40 });
      
      // Canvas noise — add subtle randomization to canvas fingerprinting
      const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function(...args) {
        const ctx = this.getContext('2d');
        if (ctx) {
          const imageData = ctx.getImageData(0, 0, this.width, this.height);
          for (let i = 0; i < imageData.data.length; i += 4) {
            // Subtle noise based on seed
            const noise = (fp.canvas.noiseSeed * (i + 1) % 7) - 3;
            imageData.data[i] = Math.min(255, Math.max(0, imageData.data[i] + noise));
          }
          ctx.putImageData(imageData, 0, 0);
        }
        return origToDataURL.apply(this, args);
      };
      
      // WebGL vendor/renderer spoofing
      const origGetParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(param) {
        // UNMASKED_VENDOR_WEBGL = 37445
        if (param === 37445) return fp.webgl.unmaskedVendor;
        // UNMASKED_RENDERER_WEBGL = 37446
        if (param === 37446) return fp.webgl.unmaskedRenderer;
        return origGetParameter.call(this, param);
      };
      
      // Also override WebGL2
      if (typeof WebGL2RenderingContext !== 'undefined') {
        const origGetParameter2 = WebGL2RenderingContext.prototype.getParameter;
        WebGL2RenderingContext.prototype.getParameter = function(param) {
          if (param === 37445) return fp.webgl.unmaskedVendor;
          if (param === 37446) return fp.webgl.unmaskedRenderer;
          return origGetParameter2.call(this, param);
        };
      }
      
      // AudioContext fingerprinting
      const origCreateOscillator = (window.OfflineAudioContext || window.webkitOfflineAudioContext);
      if (origCreateOscillator) {
        const origStartRendering = origCreateOscillator.prototype.startRendering;
        origCreateOscillator.prototype.startRendering = function() {
          // Override sampleRate
          Object.defineProperty(this, 'sampleRate', { get: () => fp.audio.sampleRate });
          return origStartRendering.call(this);
        };
      }
      
      // navigator.connection
      if (navigator.connection) {
        Object.defineProperty(navigator.connection, 'effectiveType', { get: () => fp.connection.effectiveType });
        Object.defineProperty(navigator.connection, 'rtt', { get: () => fp.connection.rtt });
        Object.defineProperty(navigator.connection, 'downlink', { get: () => fp.connection.downlink });
      }
      
      // Hide webdriver flag
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      
      // Override permissions query
      const origQuery = navigator.permissions.query;
      navigator.permissions.query = function(params) {
        if (params.name === 'notifications') {
          return Promise.resolve({ state: 'prompt', onchange: null });
        }
        return origQuery.call(this, params);
      };
    })();
  `;
}
