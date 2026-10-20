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
import { SPINE, stageKeyForStep, MAX_ITERATIONS } from "./serviceSpine.ts";

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
  // The service's own steps are presented under the fixed stage each one lands
  // in, so what comes back lines up with the nine-stage record without guessing.
  const stepList = SPINE.map((stage) => {
    if (stage.n > 4) return "";
    const mine = service.workflow.filter(
      (s, i) => stageKeyForStep(s, i, service.workflow.length) === stage.key,
    );
    if (mine.length === 0) {
      return `${stage.name.toUpperCase()} — no domain step of this service lands here; state in one line what this stage does for this brief.`;
    }
    return [
      stage.name.toUpperCase(),
      ...mine.map((s) => `  ${s.n}. ${s.name}\n     what it is: ${s.desc}\n     result it must return: ${s.result}`),
    ].join("\n");
  })
    .filter(Boolean)
    .join("\n\n");

  const system = [
    `You are the producing agent for the service "${service.name}".`,
    agentForRole(service, "producer")
      ? `Your name is ${agentForRole(service, "producer")!.name}: ${agentForRole(service, "producer")!.specialty}.`
      : "",
    "",
    "Execute every numbered step in order and return, for each one, what it actually produced.",
    "A step that cannot honestly be completed must be returned as failed with the reason — never as done.",
    "Do not claim a result you cannot evidence. If a step depends on a credential, a licence, a portal login or an authority that was not supplied, mark it failed, set credential_missing to the exact missing item, and do not invent evidence for it.",
    "For every step that reached a real source, return evidence[] carrying the exact source URL, the time you retrieved it, what it proves and the method used. Never return an evidence entry for a source you did not actually reach: a fabricated URL is worse than an honest gap, and it is treated as a failed run.",
    "Where a detail is missing but you can proceed on a stated assumption, proceed: set decision_required with blocking=false, put the assumption you are working on in working_assumption, and carry on. The question is then surfaced to the operator on the finished result rather than stopping the run.",
    "Set decision_required.blocking=true, and stop, only when no honest work is possible without the answer — for example a target list you would have to invent, an authority nobody stated, or a destination you do not know. Never invent a URL, a legal basis or a recipient in order to look complete.",
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
    "Return:",
    "- producer_summary: what you produced, in plain language",
    "- steps: one entry per numbered step with n, name, status, result, output, evidence[], credential_missing, unattended",
    "- deliverables_delivered: which of the service's deliverables actually exist in this result",
    "- decision_required: only if a step genuinely cannot proceed without the operator — question plus options",
    "Every numbered step must appear, including the ones you could not complete.",
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
          name: { type: "string" },
          status: { type: "string" },
          result: { type: "string" },
          output: { type: "string" },
          unattended: { type: "boolean" },
          credential_missing: { type: "string" },
          evidence: {
            type: "array",
            items: {
              type: "object",
              properties: {
                finding: { type: "string" },
                source_url: { type: "string" },
                retrieved_at: { type: "string" },
                method: { type: "string" },
                hash: { type: "string" },
              },
              required: ["finding", "source_url"],
            },
          },
        },
        required: ["n", "status"],
      },
    },
    deliverables_delivered: { type: "array", items: { type: "string" } },
    decision_required: {
      type: "object",
      properties: {
        question: { type: "string" },
        options: { type: "array", items: { type: "string" } },
        step_n: { type: "number" },
        blocking: { type: "boolean" },
        working_assumption: { type: "string" },
      },
      required: ["question"],
    },
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

  // Reviewers are shown the stage the work landed in and the evidence claimed for
  // it, so a step that claims a result with nothing behind it is visible to them.
  const stageDigest = (context.stageResults || [])
    .map((s: any) => `  ${s.n}. ${s.name} [${s.status}] — ${s.result || "no result"}`)
    .join("\n");

  const evidenceDigest = (context.evidence || []).length
    ? (context.evidence || [])
        .map((e: any) => `  step ${e.step_n}: ${e.source_url || "NO URL"} (retrieved ${e.retrieved_at || "NO TIME"}) — ${e.verification}`)
        .join("\n")
    : "  NONE. No evidence was captured for this run.";

  const gapDigest = (context.unavailable || []).length
    ? (context.unavailable || []).map((u: any) => `  step ${u.step_n}: ${u.missing}`).join("\n")
    : "  none stated";

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
    `THE NINE FIXED STAGES AND WHAT EACH RETURNED SO FAR:`,
    stageDigest || "  none yet",
    "",
    `EVIDENCE CLAIMED, WITH SOURCE AND RETRIEVAL TIME:`,
    evidenceDigest,
    "",
    `SOURCE THE RUN SAYS IT COULD NOT REACH, AND WHAT WAS MISSING:`,
    gapDigest,
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
export function scoreRun(producer: any, assurance: any, evidenceEval?: any) {
  const steps: any[] = Array.isArray(producer?.steps) ? producer.steps : [];
  const total = steps.length;
  const done = steps.filter((s) => s?.status === "done").length;
  const completion = total > 0 ? Math.round((done / total) * 100) : 0;

  const qaScore = num(assurance?.qa?.score);
  const validatorScore = num(assurance?.validator?.score);
  const guardianAllowed = assurance?.guardian?.allowed !== false;
  const separationOk = assurance?.model_separation_ok !== false;

  const overall = Math.round(completion * 0.35 + qaScore * 0.35 + validatorScore * 0.3);

  const evaluation = evidenceEval || {
    status: "absent",
    verified_live: 0,
    claimed_unverified: 0,
    total: 0,
    unevidenced_steps: [],
  };
  const unevidenced: any[] = Array.isArray(evaluation.unevidenced_steps) ? evaluation.unevidenced_steps : [];
  const incomplete = steps.filter((s) => s?.status !== "done");
  const missingCredential = incomplete.find((s) => s?.credential_missing);

  // The order of these checks is the order of refusal, and each one is a stated
  // ground rather than a score. A green result is only reachable when every one
  // of them passes.
  let verdict: "delivered" | "conditional" | "blocked" | "failed" = "failed";
  let block_reason = "";

  if (!separationOk) {
    verdict = "blocked";
    block_reason = "The reviews did not run on separate model families, so they are not independent.";
  } else if (!guardianAllowed) {
    verdict = "blocked";
    block_reason = Array.isArray(assurance?.guardian?.blocks) && assurance.guardian.blocks.length
      ? `Guardian refused: ${assurance.guardian.blocks[0]}`
      : "The guardian refused delivery.";
  } else if (total === 0) {
    verdict = "failed";
    block_reason = "No step produced anything to assess.";
  } else if (incomplete.length > 0) {
    verdict = "blocked";
    block_reason = missingCredential
      ? `Step ${missingCredential.n} needs ${missingCredential.credential_missing}, which has not been supplied.`
      : `${incomplete.length} of ${total} steps did not complete.`;
  } else if (qaScore < ASSURANCE_GATE_SCORE) {
    verdict = "blocked";
    block_reason = `QA scored ${qaScore}, below the ${ASSURANCE_GATE_SCORE} gate.`;
  } else if (validatorScore < ASSURANCE_GATE_SCORE) {
    verdict = "blocked";
    block_reason = `Independent validation scored ${validatorScore}, below the ${ASSURANCE_GATE_SCORE} gate.`;
  } else if (unevidenced.length > 0) {
    verdict = "blocked";
    block_reason = `Step ${unevidenced[0].n} claims a result with no evidence and no named missing credential.`;
  } else if (evaluation.status === "verified_live") {
    verdict = "delivered";
  } else if (evaluation.status === "claimed_unverified") {
    // The reviews passed, but nothing has been mechanically re-fetched. This is
    // a working result, not a final deliverable, and it is labelled as one.
    verdict = "conditional";
    block_reason = "Reviews passed on evidence the producing agent asserted but nothing has re-verified. Releasable as a working result, not as a final deliverable.";
  } else {
    verdict = "blocked";
    block_reason = "No evidence was captured for the work.";
  }

  const delivery_allowed = verdict === "delivered";

  const alerts: string[] = [];
  if (!separationOk) alerts.push("Model separation was not achieved — the reviews are not independent.");
  if (!guardianAllowed) alerts.push("Guardian blocked delivery — resolve the stated grounds before any output leaves the building.");
  if (qaScore > 0 && qaScore < ASSURANCE_GATE_SCORE) alerts.push(`QA score ${qaScore} is below the ${ASSURANCE_GATE_SCORE} gate.`);
  if (validatorScore > 0 && validatorScore < ASSURANCE_GATE_SCORE) alerts.push(`Independent validation scored ${validatorScore}.`);
  if (total > 0 && done < total) alerts.push(`${total - done} of ${total} steps did not complete.`);
  if (unevidenced.length > 0) alerts.push(`${unevidenced.length} step(s) claim a result with nothing behind them.`);
  if (evaluation.status === "claimed_unverified") alerts.push("Evidence is claimed but not mechanically re-verified — delivery is withheld at working-result level.");
  if (Array.isArray(evidenceEval?.unavailable) && evidenceEval.unavailable.length) {
    alerts.push(`${evidenceEval.unavailable.length} source(s) could not be reached and are disclosed on the run.`);
  }

  return {
    overall_score: overall,
    step_completion: completion,
    steps_done: done,
    steps_total: total,
    verdict,
    delivery_allowed,
    block_reason,
    evidence_status: evaluation.status,
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

// ── EVIDENCE, NOT ASSERTIONS ───────────────────────────────────────────────

export type EvidenceEntry = {
  step_n: number;
  step_name: string;
  finding: string;
  source_url: string;
  retrieved_at: string;
  method: string;
  hash: string;
  verification: "claimed_unverified" | "verified_live" | "failed_reverification";
};

export type SourceGap = {
  step_n: number;
  step_name: string;
  missing: string;
  note: string;
};

const isHttpUrl = (v: any) => typeof v === "string" && /^https?:\/\/[^\s]+$/i.test(v.trim());

/**
 * Pull the evidence out of the producing agent's steps.
 *
 * Nothing here upgrades a claim. An entry that came back from the producing
 * agent is `claimed_unverified` until something re-fetches it and the bytes
 * still match. That status is what the delivery gate reads, which is why a run
 * cannot reach "delivered" on the strength of its own assurance.
 */
export function collectEvidence(producerSteps: any[]) {
  const evidence: EvidenceEntry[] = [];
  const unavailable: SourceGap[] = [];
  const unevidenced_steps: { n: number; name: string }[] = [];

  (producerSteps || []).forEach((step) => {
    const n = Number(step?.n) || 0;
    const name = String(step?.name || `step ${n}`);
    const claimed = Array.isArray(step?.evidence) ? step.evidence : [];
    const credential = typeof step?.credential_missing === "string" ? step.credential_missing.trim() : "";

    claimed.forEach((e: any) => {
      if (!e) return;
      evidence.push({
        step_n: n,
        step_name: name,
        finding: String(e.finding || e.what_it_proves || "").slice(0, 500),
        source_url: typeof e.source_url === "string" ? e.source_url.trim() : "",
        retrieved_at: typeof e.retrieved_at === "string" ? e.retrieved_at : "",
        method: String(e.method || "").slice(0, 200),
        hash: String(e.hash || ""),
        verification: "claimed_unverified",
      });
    });

    // A real gap names a credential, licence or authority. "none" is not a gap,
    // and must never be listed as one.
    const realGap = credential && !/^(none|n\/?a|no|nothing|not applicable|-+)$/i.test(credential);
    if (realGap) {
      unavailable.push({
        step_n: n,
        step_name: name,
        missing: credential,
        note: String(step?.result || "").slice(0, 300),
      });
    }

    // Done, with nothing behind it and no named missing credential: an assertion.
    if (step?.status === "done" && claimed.length === 0 && !credential) {
      unevidenced_steps.push({ n, name });
    }
  });

  return { evidence, unavailable, unevidenced_steps };
}

/**
 * The evidence gate. Only `verified_live` clears it; a run whose evidence is
 * merely claimed can reach a working result but never a final delivery.
 */
export function evaluateEvidence(evidence: EvidenceEntry[], unevidenced_steps: any[], unavailable: SourceGap[] = []) {
  const usable = (evidence || []).filter((e) => isHttpUrl(e.source_url));
  const verified_live = usable.filter((e) => e.verification === "verified_live").length;
  const claimed = usable.filter((e) => e.verification !== "verified_live").length;
  const status = verified_live > 0 && claimed === 0
    ? "verified_live"
    : usable.length > 0
      ? "claimed_unverified"
      : "absent";

  return {
    status,
    verified_live,
    claimed_unverified: claimed,
    total: usable.length,
    discarded_no_url: (evidence || []).length - usable.length,
    unevidenced_steps: unevidenced_steps || [],
    unavailable,
  };
}

// ── REVISION (the work inside stage 8) ─────────────────────────────────────

export function buildRevisionMessages(
  service: Service,
  context: {
    sentence: string;
    enhancedPrompt: string;
    producerSummary: string;
    producerSteps: any[];
    failedRules: string[];
    blocks: string[];
    qaScore: number;
  },
) {
  const agent = agentForRole(service, "producer");
  const stepDigest = (context.producerSteps || [])
    .map((s: any) => `  ${s.n}. ${s.status} — ${s.result || ""} ${s.output ? `| ${String(s.output).slice(0, 400)}` : ""}`)
    .join("\n");

  const system = [
    `You are ${agent ? agent.name : "the producing agent"} for the service "${service.name}".`,
    agent ? `Your mandate: ${agent.specialty}.` : "",
    "",
    "Your previous pass was reviewed and refused. Fix exactly the grounds that were named and nothing else.",
    "Changing things that were not criticised is out of scope. Fixing the criticism by dropping a step, or by softening a claim instead of supporting it, is also out of scope.",
    "If a ground cannot be cleared honestly, say so on that step rather than dressing it up.",
    "Return JSON only.",
  ]
    .filter(Boolean)
    .join("\n");

  const user = [
    `OPERATOR'S INSTRUCTION: """${context.sentence}"""`,
    "",
    `THE BRIEF OF RECORD: """${context.enhancedPrompt}"""`,
    "",
    `YOUR PREVIOUS RESULT: ${context.producerSummary}`,
    `YOUR PREVIOUS PER-STEP CLAIMS:`,
    stepDigest || "  (none recorded)",
    "",
    `QA SCORED IT ${context.qaScore}, and named these failed rules:`,
    (context.failedRules || []).length ? context.failedRules.map((r) => `  - ${r}`).join("\n") : "  (none named)",
    "",
    `THE GUARDIAN NAMED THESE GROUNDS:`,
    (context.blocks || []).length ? context.blocks.map((b) => `  - ${b}`).join("\n") : "  (the guardian did not block)",
    "",
    "Return the full workflow again:",
    "- producer_summary: what changed and what it now is",
    "- steps: every numbered step, same shape as before, with n, name, status, result, output, evidence[], credential_missing",
    "- revisions_made: array of the specific changes you made, one per ground cleared",
  ]
    .filter(Boolean)
    .join("\n");

  return { system, user };
}

export const REVISION_SCHEMA = {
  type: "object",
  properties: {
    producer_summary: { type: "string" },
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          n: { type: "number" },
          name: { type: "string" },
          status: { type: "string" },
          result: { type: "string" },
          output: { type: "string" },
          credential_missing: { type: "string" },
          evidence: {
            type: "array",
            items: {
              type: "object",
              properties: {
                finding: { type: "string" },
                source_url: { type: "string" },
                retrieved_at: { type: "string" },
                method: { type: "string" },
              },
              required: ["finding", "source_url"],
            },
          },
        },
        required: ["n", "status"],
      },
    },
    revisions_made: { type: "array", items: { type: "string" } },
  },
  required: ["producer_summary", "steps"],
};

// ── AUTO-RECOMMENDATION (stage 7) ──────────────────────────────────────────

export function buildRecommendationMessages(
  service: Service,
  context: {
    sentence: string;
    scored: any;
    assurance: any;
    evidenceEval: any;
    stageDigest: string;
    iterations: any[];
  },
) {
  const system = [
    `You turn one finished run of "${service.name}" into what to do differently next time.`,
    "",
    "Derive everything from this run. Do not offer generic advice, and do not recommend anything the run already did well.",
    "Where the run was held back by a missing credential, a missing licence or a missing authority, name that item — that is the recommendation.",
    "Return JSON only.",
  ].join("\n");

  const user = [
    `OPERATOR'S INSTRUCTION: """${context.sentence}"""`,
    "",
    `VERDICT: ${context.scored?.verdict} at ${context.scored?.overall_score}/100.`,
    `WHY DELIVERY WAS DECIDED THAT WAY: ${context.scored?.block_reason || "delivery permitted"}`,
    "",
    `QA: ${num(context.assurance?.qa?.score)}/100 — failed rules: ${(context.assurance?.qa?.failed_rules || []).join("; ") || "none"}`,
    `GUARDIAN: ${context.assurance?.guardian?.allowed === false ? "refused" : "permitted"} — grounds: ${(context.assurance?.guardian?.blocks || []).join("; ") || "none"}`,
    `VALIDATOR: ${num(context.assurance?.validator?.score)}/100 — unverified: ${(context.assurance?.validator?.unverified || []).join("; ") || "none"}`,
    "",
    `EVIDENCE: ${context.evidenceEval?.status} (${context.evidenceEval?.verified_live || 0} live-verified, ${context.evidenceEval?.claimed_unverified || 0} claimed only, ${context.evidenceEval?.unevidenced_steps?.length || 0} steps with nothing).`,
    `SOURCES THE RUN COULD NOT REACH: ${(context.evidenceEval?.unavailable || []).map((u: any) => `step ${u.step_n} needs ${u.missing}`).join("; ") || "none stated"}`,
    "",
    `WHAT EACH STAGE RETURNED:`,
    context.stageDigest || "  (none)",
    "",
    `ITERATIONS RUN: ${(context.iterations || []).length}`,
    "",
    "Return:",
    "- recommendations: what to change next time, each actionable and specific to this service",
    "- risks_to_watch: what would invalidate this result if it changed",
  ].join("\n");

  return { system, user };
}

export const RECOMMENDATION_SCHEMA = {
  type: "object",
  properties: {
    recommendations: { type: "array", items: { type: "string" } },
    risks_to_watch: { type: "array", items: { type: "string" } },
  },
  required: ["recommendations"],
};

/** One readable line for the whole run's state, for a queue row or the result header. */
export function oneLineRunState(run: any): string {
  if (!run) return "no run";
  if (run.verdict === "delivered") return `Delivered — ${run.overall_score}/100, evidence re-verified.`;
  if (run.verdict === "conditional") return `Working result — reviews passed, evidence not re-verified yet.`;
  if (run.verdict === "blocked") return `Delivery refused — ${run.block_reason || "the stated ground was not cleared"}`;
  if (run.status === "running") return `Running — ${run.current_stage || "starting"}.`;
  return `Failed — ${run.error || run.block_reason || "the run did not complete"}`;
}

/** The iteration cap the engine will honour, whatever the caller asks for. */
export function resolveIterationCap(requested: any): number {
  const n = Number(requested);
  if (!Number.isFinite(n) || n < 1) return MAX_ITERATIONS;
  return Math.min(Math.floor(n), MAX_ITERATIONS);
}