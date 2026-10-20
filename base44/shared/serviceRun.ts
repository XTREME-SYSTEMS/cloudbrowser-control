/**
 * SERVICE RUN ENGINE (pure)
 * ==========================================================================
 * Builds the prompt set for one production run and scores what comes back.
 *
 * The producing agent, the QA agent, the guardian and the validator each run
 * on a different model family. That separation is recorded on the run, because
 * a QA verdict produced by the same model that produced the work is not an
 * independent review — it is the same opinion twice.
 *
 * Pure logic, no SDK: the calling function performs the model calls.
 */

import type { Service } from "./serviceCatalog.ts";
import { getService, missingAssuranceRoles } from "./serviceCatalog.ts";

export const MODEL_FOR_ROLE: Record<string, string> = {
  producer: "automatic",
  qa: "claude-sonnet-5",
  guardian: "gpt_6_sol",
  validator: "gemini_3_8_flash",
};

export const ASSURANCE_GATE_SCORE = 85;

export type Role = "producer" | "qa" | "guardian" | "validator";

export function agentForRole(service: Service, role: Role) {
  return service.agents.find((a) => a.role === role) || null;
}

/** The producing agent's brief: every numbered step, plus the enhanced prompt. */
export function buildProducerMessages(service: Service, enhancedPrompt: string, sentence: string) {
  const stepList = service.workflow
    .map((s) => `${s.n}. ${s.name}\n   what it is: ${s.desc}\n   result it must return: ${s.result}`)
    .join("\n");

  const system = [
    `You are the producing agent for the service "${service.name}".`,
    agentForRole(service, "producer")
      ? `Your name is ${agentForRole(service, "producer")!.name}: ${agentForRole(service, "producer")!.specialty}.`
      : "",
    "",
    "Execute every numbered step in order and return, for each one, what it actually produced.",
    "A step that cannot honestly be completed must be returned as failed with the reason — never as done.",
    "Do not claim a result you cannot evidence. If a step depends on a credential, a licence or an authority that was not supplied, mark it failed and say exactly what is missing.",
    "Return JSON only.",
  ]
    .filter(Boolean)
    .join("\n");

  const user = [
    `OPERATOR'S INSTRUCTION: """${sentence}"""`,
    "",
    `THE ENHANCED PROMPT THAT DRIVES THIS RUN:`,
    `"""${enhancedPrompt}"""`,
    "",
    `THE NUMBERED WORKFLOW YOU MUST EXECUTE:`,
    stepList,
    "",
    `DELIVERABLES THIS SERVICE OWES: ${service.deliverables.join("; ")}`,
    `PRICING MODEL OF RECORD: ${service.pricing.model} (${service.pricing.range})`,
    "",
    "Return: producer_summary (what you produced) and steps (one entry per numbered step with n, status, result, output), plus deliverables_delivered.",
  ]
    .filter(Boolean)
    .join("\n");

  return { system, user };
}

export const PRODUCER_SCHEMA = {
  type: "object",
  properties: {
    producer_summary: { type: "string" },
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          n: { type: "number" },
          status: { type: "string" },
          result: { type: "string" },
          output: { type: "string" },
        },
        required: ["n", "status"],
      },
    },
    deliverables_delivered: { type: "array", items: { type: "string" } },
  },
  required: ["producer_summary", "steps"],
};

/** The three assurance agents, each with its own mandate and its own schema. */
export function buildAssuranceMessages(
  service: Service,
  role: Exclude<Role, "producer">,
  context: { sentence: string; enhancedPrompt: string; producerSummary: string; producerSteps: any[] },
) {
  const agent = agentForRole(service, role);
  const stepDigest = (context.producerSteps || [])
    .map((s: any) => `  ${s.n}. ${s.status} — ${s.result || ""} ${s.output ? `| ${String(s.output).slice(0, 300)}` : ""}`)
    .join("\n");

  const common = [
    `You are ${agent ? agent.name : role} for the service "${service.name}".`,
    agent ? `Your mandate: ${agent.specialty}.` : "",
    "",
    `OPERATOR'S INSTRUCTION: """${context.sentence}"""`,
    `THE ENHANCED PROMPT OF RECORD: """${context.enhancedPrompt}"""`,
    "",
    `WHAT THE PRODUCING AGENT SAYS IT DID: ${context.producerSummary}`,
    `ITS PER-STEP CLAIMS:`,
    stepDigest,
    "",
    `THE STEPS THIS SERVICE IS SUPPOSED TO RUN: ${service.workflow.map((s) => `${s.n}. ${s.name}`).join("; ")}`,
    "",
    "You are reviewing this run, not performing it. Judge only what is in front of you. Do not restate the producer's optimism as your own finding. Return JSON only.",
  ]
    .filter(Boolean)
    .join("\n");

  if (role === "qa") {
    return {
      system: common,
      user: [
        "Score the run against this rubric, 0-100, one point per rule honestly met:",
        "- every numbered step returned a real result (not a placeholder)",
        "- every claimed result is supported by something in the run",
        "- the deliverables the service owes are actually present",
        "- conflicts and unknowns are left visible rather than averaged away",
        "- the output format matches what the service promises",
        "",
        "Return: score, verdict (passed|conditional|failed), failed_rules (array of the rule names you rejected), reasons (array of short specifics).",
      ].join("\n"),
    };
  }

  if (role === "guardian") {
    return {
      system: common,
      user: [
        "Your job is to stop the run, not to praise it. Decide whether delivery is permitted.",
        "Refuse when any of these is true:",
        "- the authority or permissible purpose for the work is not stated",
        "- regulated or personal data is handled without a stated basis",
        "- a claim of certification, compliance or legality is made without captured evidence",
        "- a source was contacted without a recorded basis",
        "- a deliverable asserts more than its evidence supports",
        "",
        "Return: allowed (boolean), blocks (array of the specific refusal grounds you found, empty if none), reasons (array of short specifics).",
      ].join("\n"),
    };
  }

  return {
    system: common,
    user: [
      "Re-check the highest-risk claims in this run independently of the QA review.",
      "Name which claims you could confirm from the run itself, and which remain unverified because evidence is absent.",
      "If the run's own evidence is all that exists, say so plainly — do not promote a claim to verified because it was stated confidently.",
      "",
      "Return: score (0-100 confidence in the run), verified (array of claims you could confirm), unverified (array of claims you could not), notes.",
    ].join("\n"),
  };
}

export const ASSURANCE_SCHEMAS: Record<string, any> = {
  qa: {
    type: "object",
    properties: {
      score: { type: "number" },
      verdict: { type: "string" },
      failed_rules: { type: "array", items: { type: "string" } },
      reasons: { type: "array", items: { type: "string" } },
    },
    required: ["score", "verdict"],
  },
  guardian: {
    type: "object",
    properties: {
      allowed: { type: "boolean" },
      blocks: { type: "array", items: { type: "string" } },
      reasons: { type: "array", items: { type: "string" } },
    },
    required: ["allowed"],
  },
  validator: {
    type: "object",
    properties: {
      score: { type: "number" },
      verified: { type: "array", items: { type: "string" } },
      unverified: { type: "array", items: { type: "string" } },
      notes: { type: "string" },
    },
    required: ["score"],
  },
};

const num = (v: any, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

/**
 * Combine the four verdicts into one score, one verdict and one delivery
 * decision. The guardian is a gate, not a vote: a block cannot be averaged
 * away by a high QA score.
 */
export function scoreRun(producer: any, assurance: any) {
  const steps: any[] = Array.isArray(producer?.steps) ? producer.steps : [];
  const total = steps.length;
  const done = steps.filter((s) => s?.status === "done").length;
  const completion = total > 0 ? Math.round((done / total) * 100) : 0;

  const qaScore = num(assurance?.qa?.score);
  const validatorScore = num(assurance?.validator?.score);
  const guardianAllowed = assurance?.guardian?.allowed !== false;

  const overall = Math.round(completion * 0.4 + qaScore * 0.35 + validatorScore * 0.25);

  let verdict: "pass" | "conditional" | "blocked" | "failed" = "failed";
  if (!guardianAllowed) verdict = "blocked";
  else if (total > 0 && done === total && overall >= ASSURANCE_GATE_SCORE) verdict = "pass";
  else if (overall >= 60) verdict = "conditional";
  else verdict = "failed";

  const delivery_allowed = guardianAllowed && (verdict === "pass" || verdict === "conditional") && overall >= 60;

  const alerts: string[] = [];
  if (!guardianAllowed) alerts.push("Guardian blocked delivery — resolve the stated grounds before any output leaves the building.");
  if (qaScore > 0 && qaScore < ASSURANCE_GATE_SCORE) alerts.push(`QA score ${qaScore} is below the ${ASSURANCE_GATE_SCORE} gate.`);
  if (validatorScore > 0 && validatorScore < ASSURANCE_GATE_SCORE) alerts.push(`Independent validation scored ${validatorScore}.`);
  if (total > 0 && done < total) alerts.push(`${total - done} of ${total} steps did not complete.`);
  if (assurance?.model_separation_ok === false) alerts.push("Model separation was not achieved — the reviews are not independent.");

  return {
    overall_score: overall,
    step_completion: completion,
    steps_done: done,
    steps_total: total,
    verdict,
    delivery_allowed,
    alerts,
  };
}

/** Model families used in one run, and whether they were actually distinct. */
export function computeModelSeparation(models: string[]) {
  const families = new Set(
    models.filter(Boolean).map((m) => {
      const s = String(m).toLowerCase();
      if (s.includes("claude")) return "anthropic";
      if (s.includes("gpt")) return "openai";
      if (s.includes("gemini") || s.includes("google")) return "google";
      if (s.includes("glm")) return "zhipu";
      return s;
    }),
  );
  return { families: [...families], ok: families.size >= 3 };
}

/** Resolve a slug to a runnable service, refusing services missing an assurance role. */
export function resolveRunnableService(slug: string) {
  const service = getService(slug);
  if (!service) return { service: null, error: `Unknown service slug: ${slug}` };
  const missing = missingAssuranceRoles(service);
  if (missing.length) {
    return { service: null, error: `Service ${slug} is missing assurance roles: ${missing.join(", ")}` };
  }
  return { service, error: null };
}