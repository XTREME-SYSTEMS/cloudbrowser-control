/**
 * PROMPT ENHANCEMENT ENGINE
 * ==========================================================================
 * The operator types a sentence, or presses a card. This turns either into the
 * brief the run is actually driven by — optimized on five axes at once:
 *
 *   service      — the right service, the exact deliverable it owes
 *   industry     — the standard a buyer in that market expects, named
 *   workflow     — the fixed nine-stage spine, stage by stage for this brief
 *   quality      — what correct means here, and what would make it wrong
 *   automation   — what runs unattended, what waits on a credential, what needs
 *                  the operator's decision
 *
 * Pure logic, no SDK: it builds the messages and the slot list, and the calling
 * function performs the model call. One copy of the standard, so the marketing
 * page, the service pages and the run engine cannot drift apart.
 */

import type { Service } from "./serviceCatalog.ts";
import { SPINE, MAX_ITERATIONS } from "./serviceSpine.ts";

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
  { id: "STD-11", rule: "Name the standard the buyer's market expects this work to meet." },
  { id: "STD-12", rule: "Say which steps run unattended and which wait on a credential, licence or decision." },
];

export type EnhanceInput = {
  sentence: string;
  service?: Service | null;
  stepName?: string | null;
  stepNumber?: number | null;
  surface?: string | null;
  priorContext?: string | null;
  /** The operator's answer to a question a previous run raised. */
  answers?: string | null;
};

/**
 * The enhancement scaffold. Deliberately explicit: it forces the model to fill
 * each slot rather than to write something that merely sounds professional.
 */
export function buildEnhancementMessages(input: EnhanceInput) {
  const { sentence, service, stepName, stepNumber, surface, priorContext, answers } = input;

  const scope = service
    ? [
        `Service: ${service.name} (${service.slug})`,
        `Service promise: ${service.tagline}`,
        `Who buys it: ${service.buyer}`,
        `Pricing model of record: ${service.pricing.model} — ${service.pricing.range}`,
        `Deliverables this service owes: ${service.deliverables.join("; ")}`,
        `Workflow already defined for this service:\n${service.workflow.map((s) => `  ${s.n}. ${s.name} — ${s.desc} → ${s.result}`).join("\n")}`,
        stepName ? `This prompt drives ONE step only: step ${stepNumber ?? ""} ${stepName}. Do not describe the whole service.` : `This prompt drives the whole service run.`,
      ].join("\n")
    : `No catalogue service is bound to this request. Keep the prompt general but keep every standard below.`;

  const system = [
    "You turn a short operator instruction into the single brief that will drive an automated production workflow.",
    "",
    "You are not a copywriter. You are the person who writes the brief that a producing agent, a QA agent, a compliance guardian and an independent validator will all be measured against.",
    "",
    "The workflow this brief drives is fixed and has exactly nine stages, in this order and under these names:",
    ...SPINE.map((s) => `  ${s.n}. ${s.name} — ${s.purpose}`),
    `Stages 5 to 7 repeat inside stage 8 until QA clears, up to ${MAX_ITERATIONS} iterations.`,
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
    answers ? `THE OPERATOR'S ANSWER TO WHAT THE LAST RUN ASKED: "${answers}" — treat this as given, do not ask for it again.` : "",
    "",
    "Produce an enhanced brief with these slots filled from the operator's intent, never invented beyond it.",
    "",
    "DELIVERY AND JUDGEMENT:",
    "- objective: what is produced, as an artefact",
    "- acceptance_criteria: how the output will be judged",
    "- required_evidence: what must accompany every claim",
    "- authority_check: the permissible purpose or basis, or the words AUTHORITY NOT STATED",
    "- refusal_conditions: what must stop the run rather than deliver",
    "- output_format: exact format, units, currency, period",
    "- done_definition: countable completion test",
    "",
    "THE FIVE OPTIMIZATIONS (this is what makes the brief worth running):",
    "- service_fit: why this shape is right for this service, and the exact artefact it owes at the end",
    "- industry_standard: the standard a buyer in this market expects this work to meet, named (the framework, practice or authority — for example hash-bound evidence with retrieval timestamps, chain of custody, four-eyes review, claim-level source citation). If there is no single named authority, state the practice and who expects it.",
    "- stage_plan: one entry per fixed stage, each saying what that stage will actually do for THIS brief (not what the stage is in general)",
    "- quality_definition: what correct means for this deliverable, in checkable terms",
    "- would_be_wrong: the specific failure shapes that must be refused rather than delivered",
    "- automation_notes: which steps run unattended and which wait on a credential, licence, portal login or the operator's decision — naming the exact thing waited on",
    "",
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
    service_fit: { type: "string" },
    industry_standard: { type: "string" },
    stage_plan: {
      type: "array",
      items: {
        type: "object",
        properties: {
          stage: { type: "string" },
          does: { type: "string" },
        },
        required: ["stage", "does"],
      },
    },
    quality_definition: { type: "string" },
    would_be_wrong: { type: "array", items: { type: "string" } },
    automation_notes: { type: "array", items: { type: "string" } },
    prompt: { type: "string" },
    standards_applied: { type: "array", items: { type: "string" } },
    open_questions: { type: "array", items: { type: "string" } },
  },
  required: ["objective", "prompt", "standards_applied"],
};

/** Deterministic stage plan used when the model cannot be reached. */
export function fallbackStagePlan(service: Service | null) {
  return SPINE.map((s) => ({
    stage: s.name,
    does: s.n <= 4
      ? s.purpose
      : s.n === 5
        ? "Re-check every claim in this run on a separate model family and name what stays unverified."
        : s.n === 6
          ? "Score the deliverable against the quality standard and let the guardian refuse delivery."
          : s.n === 7
            ? "State what to change next time, derived from this run."
            : s.n === 8
              ? `Repeat stages 5 to 7 up to ${MAX_ITERATIONS} times while QA is below the gate, recording each attempt and the stop reason.`
              : "Deliver, or refuse, with the verdict and the reason in one line.",
  }));
}

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
    service_fit: service ? `Bound to ${service.name}.` : "No service bound.",
    industry_standard: "Not stated — prompt enhancement did not run.",
    stage_plan: fallbackStagePlan(service),
    quality_definition: "Enhancement did not run, so no quality definition of record exists for this run.",
    would_be_wrong: ["Any result presented as done without a source and a retrieval time."],
    automation_notes: [
      "Unassessed — prompt enhancement did not run, so what waits on a credential is not yet known for this instruction.",
    ],
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
      ``,
      `Fixed stages: ${SPINE.map((s) => s.name).join(" · ")}`,
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
  const staged = Array.isArray(enhanced.stage_plan) ? enhanced.stage_plan.length : 0;
  return `${applied} standards applied, ${staged} stages planned, ${open} open question(s)`;
}

/** Which optimization slots came back empty — the brief is incomplete without them. */
export function missingEnhancementSlots(enhanced: any): string[] {
  if (!enhanced) return ["everything"];
  const required = ["service_fit", "industry_standard", "quality_definition"];
  const missing = required.filter((k) => !enhanced[k]);
  if (!Array.isArray(enhanced.stage_plan) || enhanced.stage_plan.length < SPINE.length) missing.push("stage_plan");
  if (!Array.isArray(enhanced.automation_notes) || enhanced.automation_notes.length === 0) missing.push("automation_notes");
  return missing;
}