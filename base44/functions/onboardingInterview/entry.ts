import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

// AI-assisted onboarding interview for new projects.
// Drives an ordered question sequence, then uses InvokeLLM to produce a
// tailored, max-capability, hardened provisioning plan from the answers.

const QUESTIONS = [
  { field: "project_name", label: "Project name", type: "text", prompt: "What would you like to name this new project?" },
  { field: "project_goal", label: "Project goal", type: "text", prompt: "What's the goal — what are you trying to automate or extract?" },
  { field: "target_sites", label: "Target sites", type: "text", prompt: "Which target sites/URLs will the agent operate on? (comma-separated)" },
  {
    field: "connectors", label: "Connectors", type: "multiselect",
    prompt: "Which registered connectors do you want to link to this project?",
    options: [
      { value: "googledrive", label: "Google Drive" },
      { value: "googlesheets", label: "Google Sheets" },
      { value: "gmail", label: "Gmail" },
      { value: "googlecalendar", label: "Google Calendar" },
      { value: "googledocs", label: "Google Docs" },
      { value: "googletasks", label: "Google Tasks" },
      { value: "supabase", label: "Supabase" },
      { value: "hubspot", label: "HubSpot" },
    ],
  },
  {
    field: "scraper_method", label: "Scraper method", type: "select",
    prompt: "Which scraper method should the agent use? (top = stealth / reverse-engineered anti-detection)",
    options: [
      { value: "stealth_reverse", label: "Stealth / Reverse-engineered (max capability)" },
      { value: "standard", label: "Standard headless" },
      { value: "basic", label: "Basic" },
    ],
  },
  {
    field: "captcha_solver", label: "CAPTCHA solver", type: "select",
    prompt: "Which CAPTCHA solver should be active? (self-hosted = zero external dependency)",
    options: [
      { value: "self_hosted", label: "Self-hosted solver (primary)" },
      { value: "external_2captcha", label: "External 2captcha (fallback)" },
      { value: "none", label: "None" },
    ],
  },
  {
    field: "operating_mode", label: "Operating mode", type: "select",
    prompt: "What operating mode should the agent run in?",
    options: [
      { value: "full_operate", label: "Full operate (max capability — read, act, mutate)" },
      { value: "shadow_observe", label: "Shadow / observe (read-only)" },
    ],
  },
  {
    field: "proxy_strategy", label: "Proxy strategy", type: "select",
    prompt: "Which proxy strategy should the agent use to avoid IP blocks?",
    options: [
      { value: "residential_rotating", label: "Residential rotating (max stealth, geo-coupled)" },
      { value: "datacenter", label: "Datacenter (fast, lower stealth)" },
      { value: "bring_own", label: "Bring my own proxy" },
      { value: "none", label: "No proxy (direct)" },
    ],
  },
  {
    field: "target_geo", label: "Target geography", type: "text",
    prompt: "Which countries/regions should sessions appear to originate from? (comma-separated, e.g. US, UK, DE)",
  },
  {
    field: "concurrency", label: "Concurrency", type: "select",
    prompt: "How many concurrent browser sessions should this project run?",
    options: [
      { value: "1", label: "1 (polite / single)" },
      { value: "5", label: "5 (moderate)" },
      { value: "10", label: "10 (high)" },
      { value: "20", label: "20 (very high)" },
      { value: "50", label: "50 (max throughput)" },
    ],
  },
  {
    field: "data_destination", label: "Data destination", type: "multiselect",
    prompt: "Where should extracted data be sent? (select all that apply)",
    options: [
      { value: "googlesheets", label: "Google Sheets" },
      { value: "supabase", label: "Supabase" },
      { value: "webhook", label: "Webhook (HTTP POST)" },
      { value: "email", label: "Email digest" },
      { value: "download", label: "In-app download" },
      { value: "hubspot", label: "HubSpot CRM" },
    ],
  },
  {
    field: "output_format", label: "Output format", type: "select",
    prompt: "What format should extracted results be delivered in?",
    options: [
      { value: "json", label: "JSON (structured)" },
      { value: "csv", label: "CSV (tabular)" },
      { value: "html", label: "HTML (rendered)" },
      { value: "pdf", label: "PDF (document)" },
      { value: "screenshots", label: "Screenshots (visual)" },
    ],
  },
  {
    field: "schedule", label: "Run schedule", type: "select",
    prompt: "How often should this job run?",
    options: [
      { value: "on_demand", label: "On demand (manual trigger)" },
      { value: "hourly", label: "Hourly" },
      { value: "daily", label: "Daily" },
      { value: "weekly", label: "Weekly" },
      { value: "realtime_monitor", label: "Real-time monitor (continuous change detection)" },
    ],
  },
  {
    field: "anti_detect_level", label: "Anti-detection level", type: "select",
    prompt: "How aggressive should anti-detection / stealth be?",
    options: [
      { value: "maximum_stealth", label: "Maximum stealth (fingerprint spoofing, human-like input)" },
      { value: "standard", label: "Standard (basic stealth)" },
      { value: "basic", label: "Basic (minimal)" },
    ],
  },
  {
    field: "compliance_mode", label: "Compliance mode", type: "select",
    prompt: "How should the agent respect site rules?",
    options: [
      { value: "respect_robots", label: "Respect robots.txt & ToS (safe)" },
      { value: "aggressive", label: "Aggressive (ignore robots.txt)" },
      { value: "legal_only", label: "Legal-only (public data, no auth bypass)" },
    ],
  },
  {
    field: "retry_policy", label: "Retry policy", type: "select",
    prompt: "How should the agent handle transient failures?",
    options: [
      { value: "conservative", label: "Conservative (1 retry, long backoff)" },
      { value: "standard", label: "Standard (3 retries, exponential backoff)" },
      { value: "aggressive", label: "Aggressive (5 retries, short backoff + selector re-discovery)" },
    ],
  },
  {
    field: "shadow_first", label: "Shadow-first hardening", type: "select",
    prompt: "Should the first run be a shadow/safe run to map site defenses before going live?",
    options: [
      { value: "shadow_first", label: "Yes — shadow run first, then go live (recommended)" },
      { value: "live", label: "No — go live immediately" },
      { value: "a_b_test", label: "A/B test shadow vs live" },
    ],
  },
];

function isUnanswered(answers, field, type) {
  const v = answers[field];
  if (v === undefined || v === null) return true;
  if (type === "multiselect") return !Array.isArray(v) || v.length === 0;
  if (typeof v === "string") return v.trim() === "";
  return false;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const answers = body.answers || {};
    const action = body.action || "next";

    if (action === "finalize") {
      const llmRes = await base44.integrations.Core.InvokeLLM({
        prompt: `You are the provisioning brain for Cloud Browser, a hardened self-hosted browser-automation platform. A user just completed onboarding. Produce a concise, actionable provisioning plan tailored to their answers. Favor max capability, full hardening, and optimization. Answers: ${JSON.stringify(answers)}`,
        response_json_schema: {
          type: "object",
          properties: {
            summary: { type: "string", description: "One-paragraph plain-language summary of what will be provisioned" },
            recommended_settings: {
              type: "object",
              properties: {
                viewport: { type: "object" },
                stealth: { type: "boolean" },
                captcha_solver: { type: "string" },
                operating_mode: { type: "string" },
                max_concurrent_sessions: { type: "number" },
                enforce_https: { type: "boolean" },
                proxy_strategy: { type: "string" },
                target_geo: { type: "string" },
                concurrency: { type: "number" },
                data_destination: { type: "array", items: { type: "string" } },
                output_format: { type: "string" },
                schedule: { type: "string" },
                anti_detect_level: { type: "string" },
                compliance_mode: { type: "string" },
                retry_policy: { type: "string" },
                shadow_first: { type: "string" },
              },
            },
            risk_notes: { type: "string", description: "Any non-destructive hardening notes" },
          },
          required: ["summary", "recommended_settings"],
        },
      });
      return Response.json({ done: true, config_plan: llmRes });
    }

    const next = QUESTIONS.find((q) => isUnanswered(answers, q.field, q.type));
    if (!next) return Response.json({ done: true });
    return Response.json({ done: false, question: next, progress: { answered: QUESTIONS.filter((q) => !isUnanswered(answers, q.field, q.type)).length, total: QUESTIONS.length } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}