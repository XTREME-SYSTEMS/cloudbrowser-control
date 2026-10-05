// Shared module for the Mock-up Studio pipeline (ingest → scan → generate).
// Used by ingestMockup, scanMockup, and generateFromMockup functions.

// Template families from the Website Studio catalog
export const TEMPLATE_FAMILIES = ["Website", "Web App", "Mobile App"];

// Category palette keys from the studio — the scan matches against these
export const TEMPLATE_CATEGORIES = [
  "E-commerce", "SaaS", "Portfolio", "Editorial", "Marketing", "Hospitality",
  "Dashboard", "CRM", "Kanban", "Inbox", "Settings", "Analytics",
  "Fitness", "Wallet", "Food Delivery", "Onboarding",
  "Architecture", "Beauty", "Fashion", "Arts & Culture", "Legal", "Finance",
  "Consulting", "Real Estate", "Travel", "Health", "Restaurant", "Coffee",
  "Construction", "Automotive", "Education", "Music", "Photography",
];

// Maps a detected category to a template family
export function familyForCategory(category) {
  const c = (category || "").toLowerCase();
  if (["dashboard", "crm", "kanban", "inbox", "settings", "analytics"].some(k => c.includes(k))) return "Web App";
  if (["fitness", "wallet", "food delivery", "onboarding", "mobile"].some(k => c.includes(k))) return "Mobile App";
  return "Website";
}

// Builds the AI vision prompt for scanning a mock-up image
export function buildScanPrompt() {
  return `You are an expert UI/UX design analyst and front-end architect. Analyze the provided mock-up image and extract a complete, structured design specification.

Examine the image carefully and identify:
1. The overall layout structure (header, hero, sections, footer, sidebar, etc.)
2. The color palette (extract actual hex colors from the design)
3. Typography style (serif, sans-serif, display, weights, sizes)
4. All visible sections and their content blocks
5. UI components visible (buttons, cards, forms, tables, navigation, etc.)
6. The design style (minimalist, editorial, corporate, playful, dark, light, etc.)
7. The likely category/industry (e-commerce, SaaS, portfolio, restaurant, etc.)
8. The project type (website, web app, mobile app, landing page, platform)
9. Whether a backend is needed (e.g., if there are forms, auth, dashboards, data tables, e-commerce checkout)
10. If backend is needed, what kind (auth, CRUD API, payment, database, etc.)

Return a JSON object with this exact structure:
{
  "project_type": "website" | "web_app" | "mobile_app" | "landing_page" | "platform",
  "category": "the detected industry/category",
  "family": "Website" | "Web App" | "Mobile App",
  "has_backend": boolean,
  "backend_spec": "description of backend needs if has_backend is true, empty string otherwise",
  "design_style": "minimalist" | "editorial" | "corporate" | "playful" | "dark" | "modern" | "classic",
  "color_palette": {
    "primary": "#hex",
    "secondary": "#hex",
    "accent": "#hex",
    "background": "#hex",
    "text": "#hex",
    "muted": "#hex"
  },
  "typography": {
    "heading_font": "font family name or class (serif, sans-serif, display)",
    "body_font": "font family name or class",
    "heading_weight": "font weight",
    "scale": "small" | "medium" | "large"
  },
  "layout": {
    "header_type": "top-nav" | "sidebar" | "minimal" | "none",
    "max_width": "narrow" | "medium" | "wide" | "full",
    "grid": "single" | "two-column" | "three-column" | "grid"
  },
  "sections": [
    {
      "name": "section name (e.g., Hero, Features, Pricing, Footer)",
      "type": "hero" | "features" | "pricing" | "testimonials" | "gallery" | "contact" | "cta" | "stats" | "team" | "faq" | "content" | "footer" | "nav" | "sidebar" | "table" | "form" | "chart" | "kanban" | "list" | "detail",
      "description": "what this section contains and how it is laid out"
    }
  ],
  "components": ["button", "card", "form", "table", "nav", "carousel", "modal", "tabs", "accordion", etc.],
  "content_summary": "a 2-3 sentence summary of what the website/app is about",
  "brand_name": "brand or company name visible in the mock-up, or empty string",
  "responsive": true,
  "notes": "any additional design observations"
}

Be precise and thorough. Extract real hex colors from the image. Identify every visible section. This spec will be used to generate production code.`;
}

// Builds the AI generation prompt for creating complete code from a scan
export function buildGenerationPrompt(scanResult, options) {
  const opts = options || {};
  const includeBackend = opts.includeBackend || scanResult.has_backend;
  const projectType = opts.projectType || scanResult.project_type || "website";

  return `You are a senior full-stack developer and design engineer. Generate complete, production-ready code based on this design specification extracted from an approved mock-up image.

DESIGN SPECIFICATION:
${JSON.stringify(scanResult, null, 2)}

REQUIREMENTS:
1. Generate a single, complete, self-contained HTML file with inline CSS and JavaScript
2. The HTML must be responsive (mobile + desktop)
3. Use modern, clean CSS (flexbox/grid, CSS variables for the color palette)
4. Implement every section identified in the scan with appropriate content
5. Use the exact color palette from the scan
6. Match the typography style from the scan
7. Include working interactions (mobile menu toggle, accordion, tabs, etc. where applicable)
8. Use semantic HTML5 elements
9. Include placeholder content that matches the category and content_summary
10. The code must be ready to deploy — no external dependencies, no build step required
${includeBackend ? `11. Also generate a Node.js/Express backend with:
    - REST API endpoints for the identified backend needs: ${scanResult.backend_spec || "CRUD operations"}
    - Use the color palette's primary color for branding
    - Include basic auth middleware if auth is needed
    - Return the backend code as a separate code block` : ""}

OUTPUT FORMAT:
Return a JSON object with:
{
  "frontend_code": "the complete HTML file as a string",
  ${includeBackend ? `"backend_code": "the complete backend code as a string (Node.js/Express)",` : `"backend_code": "",`}
  "file_structure": "description of the file structure if this were a real project",
  "features_implemented": ["list of features implemented"],
  "notes": "any notes about the generation"
}

Generate real, usable code — no placeholders, no TODOs, no stubs. The HTML must render a beautiful, complete website that matches the mock-up's design language.`;
}

// Validates the scan result has the required fields
export function validateScanResult(result) {
  if (!result || typeof result !== "object") return false;
  const required = ["project_type", "category", "color_palette", "sections"];
  return required.every(k => k in result);
}