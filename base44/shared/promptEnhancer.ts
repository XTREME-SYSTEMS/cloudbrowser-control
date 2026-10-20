/**
 * PROMPT ENHANCEMENT ENGINE
 * ==========================================================================
 * The operator types a sentence. This turns it into the prompt that actually
 * drives a page, a service or a single step — shaped by the same standards
 * the managed-services industry holds itself to, not by the operator's
 * phrasing.
 *
 * Pure logic, no SDK: it builds the messages and the scoring rules, and the
 * calling function does the model call. That keeps it testable and keeps one
 * copy of the standard.
 */

import type { Service } from "./serviceCatalog.ts";

/** The standards every enhanced prompt is measured against. */
export const PROMPT_STANDARDS = [
  { id: "STD-01", rule: "State the deliverable as an artefact, not an activity." },
  { id: "STD-02", rule: "Name the acceptance criteria the output will be judged on." },
  { id: "STD-03", rule: "Name the evidence that must accompany the output." },
  { id: "STD-04", rule: "State the authority under which the work is done, or flag it missing." },
  { id: "STD-05", rule: "Name what must cause a refusal instead of a delivery." },
  { id: "STD-06", rule: "Require every claim to carry its source and retrieval date." },
  { id: "STD-07", rule: "Require unsupported or conflicting findings to be left visible, never smoothed over." },
  { id: "STD-08", rule: "Fix the output format, units, currency and period before collection starts." },
  { id: "STD-09", rule: "Define what 'done' means in countable terms." },
  { id: "STD-10", rule: "Keep the operator's own words as the intent of record — enhance, never replace." },
];

export type EnhanceInput = {
  sentence: string;
  service?: Service | null;
  stepName?: string | null;
  stepNumber?: number | null;
  surface?: string | null;
  priorContext?: string | null;
};

/**
 * The enhancement scaffold. Deliberately explicit: it forces the model to fill
 * each slot rather than to write something that merely sounds professional.
 */
export function buildEnhancementMessages(input: EnhanceInput) {
  const { sentence, service, stepName, stepNumber, surface, priorContext } = input;

  const scope = service
    ? [
        `Service: ${service.name} (${service.slug})`,
        `Service promise: ${service.tagline}`,
        `Who buys it: ${service.buyer}`,
        `Pricing model of record: ${service.pricing.model} — ${service.pricing.range}`,
        `Workflow already defined for this service:\n${service.workflow.map((s) => `  ${s.n}. ${s.name} — ${s.desc} → ${s.result}`).join("\n")}`,
        stepName ? `This prompt drives ONE step only: step ${stepNumber ?? ""} ${stepName}. Do not describe the whole service.` : `This prompt drives the whole service run.`,
      ].join("\n")
    : `No catalogue service is bound to this request. Keep the prompt general but keep every standard below.`;

  const system = [
    "You turn a short operator instruction into the single prompt that will drive an automated production workflow.",
    "",
    "You are not a copywriter. You are the person who writes the brief that a specialist agent, a QA agent, a compliance guardian and an independent validator will all be measured against.",
    "",
    "RULES:",
    ...PROMPT_STANDARDS.map((s) => `- ${s.id}: ${s.rule}`),
    "",
    "Return JSON only. No prose outside the JSON.",
  ].join("\n");

  const user = [
    `OPERATOR'S OWN WORDS (this is the intent of record):`,
    `"""${sentence}"""`,
    "",
    `CONTEXT:`,
    scope,
    surface ? `Surface the prompt will run from: ${surface}` : "",
    priorContext ? `Prior context to respect: ${priorContext}` : "",
    "",
    "Produce an enhanced prompt with these slots filled from the operator's intent, never invented beyond it:",
    "- objective: what is produced, as an artefact",
    "- acceptance_criteria: how the output will be judged",
    "- required_evidence: what must accompany every claim",
    "- authority_check: the permissible purpose or basis, or the words AUTHORITY NOT STATED",
    "- refusal_conditions: what must stop the run rather than deliver",
    "- output_format: exact format, units, currency, period",
    "- done_definition: countable completion test",
    "- prompt: the full enhanced prompt as one continuous instruction, ready to hand to the producing agent",
    "- standards_applied: array of the STD ids you actually applied",
    "- open_questions: array of anything the operator must answer before this can run (empty if none)",
  ]
    .filter(Boolean)
    .join("\n");

  return { system, user };
}

/** JSON schema for the enhancement call. Root must be an object. */
export const ENHANCEMENT_SCHEMA = {
  type: "object",
  properties: {
    objective: { type: "string" },
    acceptance_criteria: { type: "array", items: { type: "string" } },
    required_evidence: { type: "array", items: { type: "string" } },
    authority_check: { type: "string" },
    refusal_conditions: { type: "array", items: { type: "string" } },
    output_format: { type: "string" },
    done_definition: { type: "string" },
    prompt: { type: "string" },
    standards_applied: { type: "array", items: { type: "string" } },
    open_questions: { type: "array", items: { type: "string" } },
  },
  required: ["objective", "prompt", "standards_applied"],
};

/**
 * Deterministic fallback used when the enhancement model is unavailable.
 * Never fabricates a standard: it states plainly that enhancement did not run.
 */
export function fallbackEnhancement(sentence: string, service: Service | null) {
  const stepLines = service
    ? service.workflow.map((s) => `${s.n}. ${s.name} — ${s.desc} → ${s.result}`).join("\n")
    : "No service bound.";
  return {
    objective: sentence,
    acceptance_criteria: [],
    required_evidence: [],
    authority_check: "AUTHORITY NOT STATED",
    refusal_conditions: ["Any step whose authority is not stated"],
    output_format: "As defined by the service deliverables",
    done_definition: "Every numbered step returns a result",
    prompt: [
      `ENHANCEMENT MODEL UNAVAILABLE — this is the operator's instruction unimproved.`,
      ``,
      `Instruction: ${sentence}`,
      ``,
      service ? `Service: ${service.name}` : "",
      service ? `Deliverables expected: ${service.deliverables.join("; ")}` : "",
      ``,
      `Workflow to execute:`,
      stepLines,
    ]
      .filter(Boolean)
      .join("\n"),
    standards_applied: [],
    open_questions: ["Prompt enhancement could not run — review the instruction before executing."],
  };
}

/** Compact one-line summary of an enhancement, for logs and monitoring rows. */
export function summarizeEnhancement(enhanced: any): string {
  if (!enhanced) return "no enhancement";
  const applied = Array.isArray(enhanced.standards_applied) ? enhanced.standards_applied.length : 0;
  const open = Array.isArray(enhanced.open_questions) ? enhanced.open_questions.length : 0;
  return `${applied} standards applied, ${open} open question(s)`;
}