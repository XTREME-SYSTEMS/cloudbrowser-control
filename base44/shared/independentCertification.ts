/**
 * INDEPENDENT CERTIFICATION CONTRACT
 * ==========================================================================
 * The rule that this module exists to enforce: no claim of accuracy may be
 * made by the same process that produced the work.
 *
 * Independence here is STRUCTURAL, not a sentence in a system prompt. Three
 * things make it real:
 *
 *   1. Separate actors. The search path runs on one model family, the QA agent
 *      on a second, the Validator on a third. A model cannot be its own
 *      reviewer, and two reviewers that share a base model share its blind
 *      spots, so they are separated from each other too.
 *
 *   2. No anchoring. QA never sees the search agent's confidence claim, and the
 *      Validator never sees the QA score. Each forms its verdict from the
 *      underlying records alone. A second opinion that begins from the first
 *      opinion is not a second opinion.
 *
 *   3. Deterministic rules outrank every opinion. The checks below are not
 *      weighted, averaged or scored. Any single one failing refuses
 *      certification, no matter how high the model scores are. There is no
 *      arrangement of numbers that can outvote a failed rule.
 *
 * This module is deliberately pure: no SDK, no network, no entity access. It is
 * the contract; the caller decides what to do with the verdict.
 */

export const CERTIFIER_VERSION = "cert-1.0.0";

/**
 * Model separation. These three MUST stay distinct. The search path is the
 * producer; QA and the Validator are the reviewers, and they are placed on
 * different providers from the producer and from each other so that a shared
 * training lineage cannot produce a shared blind spot.
 */
export const SEARCH_PATH_MODEL = "gemini_3_flash";
export const QA_MODEL = "claude_opus_4_8";
export const VALIDATOR_MODEL = "gpt_5_6_sol";

export const CERTIFICATION_THRESHOLDS = {
  minimum_score: 90,
  minimum_independent_sources: 2,
};

export interface BlockingViolation {
  rule: string;
  severity?: string;
  message?: string;
  authority?: string;
}

export interface CorroborationRecord {
  finding_id: string;
  /** Count of INDEPENDENT sources. Two rows from the same register are one source. */
  independent_sources: number;
}

export interface ReverificationRecord {
  finding_id: string;
  /** True when the source was re-fetched and the recorded evidence is still present. */
  evidence_intact: boolean;
  re_fetched: boolean;
  retrieval_status?: string;
  error?: string;
}

export interface CertificationInput {
  search_model?: string;
  qa_model?: string;
  validator_model?: string;
  qa_score?: number | null;
  validator_score?: number | null;
  /** Blocking violations from searchValidation.ts, passed through untouched. */
  blocking_violations?: BlockingViolation[];
  /** Corroboration for findings that are being relied on as critical. */
  corroboration?: CorroborationRecord[];
  /** Mechanical re-verification outcomes for the claimed-verified findings. */
  reverification?: ReverificationRecord[];
  hallucination_flags?: unknown[];
  sources_actually_queried?: unknown[];
  /**
   * Fingerprint of the case content that was actually reviewed, computed by the
   * caller with `caseFingerprint()`. Recorded at certification time so that a
   * later change to the case is detectable, instead of a stale certificate
   * quietly continuing to authorise delivery forever.
   */
  case_fingerprint?: string;
}

export interface CertificationVerdict {
  certified: boolean;
  qa_score: number | null;
  validator_score: number | null;
  overall_score: number | null;
  qa_model: string;
  validator_model: string;
  search_model: string;
  model_separation_ok: boolean;
  failed_rules: string[];
  reasons: string[];
  verified_finding_ids: string[];
  unverified_finding_ids: string[];
  /** What the verdict was reached over. Empty when the caller supplied none. */
  case_fingerprint: string;
  certifier_version: string;
  certified_at: string;
}

interface CheckOutcome {
  rule: string;
  failed: boolean;
  reason: string;
}

const isFiniteScore = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100;

const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

/**
 * CERT-01. The producer, the QA reviewer and the Validator must be three
 * distinct models. If any two coincide, the review is self-assessment and the
 * whole certification is void regardless of the scores.
 */
export function assertModelSeparation(input: {
  search_model?: string;
  qa_model?: string;
  validator_model?: string;
}): { ok: boolean; reason: string; models: string[] } {
  const models = [input.search_model, input.qa_model, input.validator_model].map((m) => (m || "").trim());
  if (models.some((m) => m.length === 0)) {
    return { ok: false, reason: "One or more of the producer, QA and Validator model identities is unrecorded, so separation cannot be demonstrated.", models };
  }
  if (new Set(models).size !== 3) {
    return { ok: false, reason: `Model separation failed: the same model appears more than once across producer, QA and Validator (${models.join(" / ")}). A reviewer sharing the producer's model is self-assessment.`, models };
  }
  return { ok: true, reason: "", models };
}

/**
 * The deterministic certification gate. Every check is independently
 * disqualifying; none of them is weighted and none can be averaged away.
 */
export function evaluateCertification(input: CertificationInput): CertificationVerdict {
  const separation = assertModelSeparation(input);

  const blocking = Array.isArray(input.blocking_violations) ? input.blocking_violations : [];
  const corroboration = Array.isArray(input.corroboration) ? input.corroboration : [];
  const reverification = Array.isArray(input.reverification) ? input.reverification : [];
  const hallucinationFlags = Array.isArray(input.hallucination_flags) ? input.hallucination_flags : [];
  const queried = Array.isArray(input.sources_actually_queried) ? input.sources_actually_queried : [];

  const uncorroborated = corroboration.filter(
    (c) => !(c.independent_sources >= CERTIFICATION_THRESHOLDS.minimum_independent_sources),
  );
  const notIntact = reverification.filter((r) => !r.evidence_intact);

  const checks: CheckOutcome[] = [
    {
      rule: "CERT-01",
      failed: !separation.ok,
      reason: separation.reason,
    },
    {
      rule: "CERT-02",
      failed: !isFiniteScore(input.qa_score) || !isFiniteScore(input.validator_score),
      reason:
        "Both the QA score and the Validator score must be present and within 0-100. A missing verdict is not a passing verdict.",
    },
    {
      rule: "CERT-03",
      failed: blocking.length > 0,
      reason: `Unresolved blocking rule violation(s): ${blocking.map((v) => v.rule).join(", ")}. A blocking rule cannot be overridden by any score.`,
    },
    {
      rule: "CERT-04",
      failed: uncorroborated.length > 0,
      reason: `Finding(s) relied on with fewer than ${CERTIFICATION_THRESHOLDS.minimum_independent_sources} independent sources: ${uncorroborated.map((c) => c.finding_id).join(", ")}.`,
    },
    {
      rule: "CERT-05",
      failed: notIntact.length > 0,
      reason: `Source evidence could not be mechanically re-verified for: ${notIntact.map((r) => `${r.finding_id}${r.retrieval_status ? ` (${r.retrieval_status})` : ""}`).join(", ")}. This is reported as unverified, never as diligence.`,
    },
    {
      rule: "CERT-06",
      failed: hallucinationFlags.length > 0,
      reason: `${hallucinationFlags.length} unresolved hallucination flag(s) remain.`,
    },
    {
      rule: "CERT-07",
      failed:
        !isFiniteScore(input.qa_score) ||
        !isFiniteScore(input.validator_score) ||
        input.qa_score < CERTIFICATION_THRESHOLDS.minimum_score ||
        input.validator_score < CERTIFICATION_THRESHOLDS.minimum_score,
      reason: `Both reviewers must independently reach ${CERTIFICATION_THRESHOLDS.minimum_score}/100. QA: ${input.qa_score ?? "none"} - Validator: ${input.validator_score ?? "none"}.`,
    },
    {
      rule: "CERT-08",
      failed: queried.length === 0,
      reason: "No record of which sources were actually queried. A scope claim with no record of what was searched is unverifiable.",
    },
    {
      // Without this, a case carrying NO evidence at all passed CERT-05
      // vacuously, because there was nothing present to fail. Zero verified
      // sources is an absence of proof, and an absence of proof is not a pass.
      rule: "CERT-09",
      failed: reverification.length === 0 || !reverification.some((r) => r.evidence_intact),
      reason:
        reverification.length === 0
          ? "No recorded source evidence exists for this case, so nothing could be mechanically re-verified. A case with no re-verified source is not a verified case."
          : "No recorded source survived mechanical re-verification. Nothing in this case is currently backed by a source that could be re-fetched.",
    },
  ];

  const failed = checks.filter((c) => c.failed);
  const certified = failed.length === 0;

  const verifiedIds = reverification.filter((r) => r.evidence_intact).map((r) => r.finding_id);
  const unverifiedIds = reverification.filter((r) => !r.evidence_intact).map((r) => r.finding_id);

  const qaScore = isFiniteScore(input.qa_score) ? Math.round(input.qa_score) : null;
  const validatorScore = isFiniteScore(input.validator_score) ? Math.round(input.validator_score) : null;
  const overallScore =
    qaScore === null || validatorScore === null ? null : Math.round((qaScore + validatorScore) / 2);

  return {
    certified,
    qa_score: qaScore,
    validator_score: validatorScore,
    overall_score: overallScore,
    qa_model: (input.qa_model || "").trim(),
    validator_model: (input.validator_model || "").trim(),
    search_model: (input.search_model || "").trim(),
    model_separation_ok: separation.ok,
    failed_rules: failed.map((c) => c.rule),
    reasons: certified ? [] : failed.map((c) => `${c.rule}: ${c.reason}`),
    verified_finding_ids: verifiedIds,
    unverified_finding_ids: unverifiedIds,
    case_fingerprint: (input.case_fingerprint || "").trim(),
    certifier_version: CERTIFIER_VERSION,
    certified_at: new Date().toISOString(),
  };
}

/**
 * One plain statement for the refusal path, so a refusal never has to be
 * interpreted from a score.
 */
export function refusalReason(verdict: CertificationVerdict): string {
  if (verdict.certified) return "";
  return `Not certified (${verdict.failed_rules.join(", ")}). ${verdict.reasons.join(" ")}`;
}

export function isCertified(certification: unknown): boolean {
  const c = certification as CertificationVerdict | null | undefined;
  return c?.certified === true && c?.model_separation_ok === true;
}

/**
 * Deterministic, order-independent fingerprint of the case content a
 * certification claims to have reviewed: the decedent's identity, the heir
 * register, the reconstructed family tree, and the sources and methods
 * recorded. A change to any of those changes the fingerprint, which is how a
 * certificate that has been overtaken by later edits is caught rather than
 * trusted indefinitely.
 *
 * This is a change detector, not a security primitive — nothing is being
 * defended against an adversary — so a compact non-cryptographic digest is
 * sufficient and avoids pulling a dependency into this deliberately pure module.
 */
export function caseFingerprint(record: unknown): string {
  const rec = (record || {}) as Record<string, unknown>;
  const reviewed = {
    deceased_name: rec.deceased_name ?? null,
    deceased_dob: rec.deceased_dob ?? null,
    deceased_dod: rec.deceased_dod ?? null,
    death_location: rec.death_location ?? null,
    heirs: rec.identified_heirs ?? [],
    family_tree: rec.family_tree ?? {},
    sources: rec.sources_checked ?? [],
    methods: rec.methods_used ?? [],
  };
  return `fp1-${digest(canonical(reviewed))}`;
}

/**
 * A certification is stale when the case no longer matches what was reviewed.
 * A certificate with no recorded fingerprint cannot be shown to be current, so
 * it is treated as stale rather than assumed good.
 */
export function isCertificationStale(certification: unknown, currentFingerprint: string): boolean {
  const c = certification as CertificationVerdict | null | undefined;
  if (!c || c.certified !== true) return false; // Already not certified; staleness is moot.
  const recorded = (c.case_fingerprint || "").trim();
  if (recorded.length === 0) return true;
  return recorded !== (currentFingerprint || "").trim();
}

/** Canonical form with sorted object keys, so key order never changes the digest. */
function canonical(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(input: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    a = Math.imul(a ^ code, 16777619) >>> 0;
    b = Math.imul(b ^ (code + i), 2246822519) >>> 0;
  }
  return `${a.toString(16).padStart(8, "0")}${b.toString(16).padStart(8, "0")}`;
}