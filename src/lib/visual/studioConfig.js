// Universal studio config for the Visual Gallery: brand colors, logo, content,
// and theme mode. Settings persist to localStorage and are projected onto CSS
// custom properties so every live preview re-renders instantly.

export const DEFAULT_CONFIG = {
  primaryColor: "#ff8800",
  secondaryColor: "#161b22",
  logoText: "Xtreme Cloud Browser",
  heading: "Mission Control",
  subtitle: "Fleet overview",
  brandName: "Xtreme Cloud Browser",
  themeMode: "dark",
  fontColor: "",
  fontFamily: "Barlow",
  fontScale: 1,
  logoImage: "",
};

export const PRESETS = [
  { name: "Carbon Aerospace", primary: "#ff8800", secondary: "#161b22" },
  { name: "Strategic Blue", primary: "#0059ff", secondary: "#0d2f96" },
  { name: "Emererald", primary: "#10b981", secondary: "#065f46" },
  { name: "Sunset", primary: "#f97316", secondary: "#9a3412" },
  { name: "Titanium", primary: "#a7b4c8", secondary: "#202833" },
  { name: "Rose", primary: "#e11d48", secondary: "#881337" },
  { name: "Teal", primary: "#0d9488", secondary: "#134e4a" },
  { name: "Mono", primary: "#111827", secondary: "#000000" },
];

export const FONT_OPTIONS = [
  "Inter", "Roboto", "Poppins", "Montserrat", "Open Sans", "Lato", "Raleway",
  "Nunito", "Ubuntu", "Playfair Display", "Merriweather", "Source Sans 3",
  "Work Sans", "DM Sans", "Manrope", "Rubik", "Quicksand", "Josefin Sans",
  "Cabin", "Barlow", "Karla", "Mulish", "Heebo", "Titillium Web", "Fira Sans",
  "Oswald", "Archivo", "Space Grotesk", "Sora", "Lexend", "Plus Jakarta Sans",
];

export function loadFont(family) {
  if (typeof document === "undefined") return;
  const id = "vg-google-fonts";
  const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@400;500;700;900&family=Barlow+Condensed:wght@600;700;800&display=swap`;
  let link = document.getElementById(id);
  if (!link) { link = document.createElement("link"); link.id = id; link.rel = "stylesheet"; document.head.appendChild(link); }
  link.href = href;
}

/* ---------- color utils ---------- */
const clamp = (n) => Math.max(0, Math.min(255, n));
function hexToRgb(hex) {
  let h = String(hex || "#000000").replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16) || 0;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map((x) => clamp(Math.round(x)).toString(16).padStart(2, "0")).join("");
}
function mix(hex, target, amt) {
  const c = hexToRgb(hex);
  return rgbToHex(c.r + (target - c.r) * amt, c.g + (target - c.g) * amt, c.b + (target - c.b) * amt);
}
export const lighten = (hex, amt) => mix(hex, 255, amt);
export const darken = (hex, amt) => mix(hex, 0, amt);
export function hexToRgba(hex, amt) {
  const c = hexToRgb(hex);
  return `rgba(${c.r},${c.g},${c.b},${amt})`;
}
function luminance(hex) {
  const c = hexToRgb(hex);
  const a = [c.r, c.g, c.b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}
export function contrastColor(hex) {
  return luminance(hex) > 0.5 ? "#0a0a0a" : "#ffffff";
}

/* ---------- config -> CSS custom properties ---------- */
export function themeToCssVars(config) {
  const c = { ...DEFAULT_CONFIG, ...config };
  const primary = c.primaryColor;
  const secondary = c.secondaryColor;
  const dark = c.themeMode === "dark";
  const vars = {
    "--brand-primary": primary,
    "--brand-accent": primary,
    "--brand-gold-mid": primary,
    "--brand-gold-bright": lighten(primary, 0.15),
    "--brand-gold-light": lighten(primary, 0.36),
    "--brand-gold-deep": darken(primary, 0.22),
    "--brand-secondary": secondary,
    "--brand-on-primary": contrastColor(primary),
    "--vg-chip-bg": dark ? hexToRgba(primary, 0.22) : lighten(primary, 0.86),
    "--vg-chip-fg": dark ? lighten(primary, 0.3) : darken(primary, 0.2),
    "--brand-font-body": `'${c.fontFamily}', sans-serif`,
    "--brand-font-heading": c.fontFamily === 'Barlow' ? "'Barlow Condensed', sans-serif" : `'${c.fontFamily}', sans-serif`,
    "--vg-font-scale": String(c.fontScale || 1),
  };
  if (dark) {
    vars["--brand-background"] = "#101217";
    vars["--brand-surface"] = "#191d24";
    vars["--brand-text"] = "#edf0f4";
    vars["--brand-muted"] = "#242a34";
    vars["--brand-muted-foreground"] = "#a4adba";
    vars["--brand-border"] = "#343c46";
    vars["--brand-card-subtle"] = "#15191f";
  } else {
    vars["--brand-background"] = "#ffffff";
    vars["--brand-surface"] = "#ffffff";
    vars["--brand-text"] = "#0a0a0a";
    vars["--brand-muted"] = "#f5f5f5";
    vars["--brand-muted-foreground"] = "#737373";
    vars["--brand-border"] = "#e5e7eb";
    vars["--brand-card-subtle"] = "#fafafa";
  }
  if (c.fontColor) vars["--brand-text"] = c.fontColor;
  return vars;
}

/* ---------- persistence ---------- */
const KEY = "vg.studio.config";
export function loadConfig() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const saved = JSON.parse(raw);
    const legacyDefault = saved.primaryColor?.toLowerCase() === '#ffea00' && saved.secondaryColor?.toLowerCase() === '#0a0a0a';
    return legacyDefault ? { ...DEFAULT_CONFIG, ...saved, primaryColor: DEFAULT_CONFIG.primaryColor, secondaryColor: DEFAULT_CONFIG.secondaryColor, themeMode: 'dark', logoText: DEFAULT_CONFIG.logoText, brandName: DEFAULT_CONFIG.brandName, fontFamily: saved.fontFamily === 'Inter' ? DEFAULT_CONFIG.fontFamily : saved.fontFamily } : { ...DEFAULT_CONFIG, ...saved };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}
export function saveConfig(config) {
  try {
    localStorage.setItem(KEY, JSON.stringify(config));
  } catch {
    /* ignore */
  }
}