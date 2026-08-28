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