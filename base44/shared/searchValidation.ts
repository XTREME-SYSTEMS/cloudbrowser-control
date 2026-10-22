/**
 * STRICT SEARCH VALIDATION — PERMISSIBLE PURPOSE, EVIDENCE AND IDENTITY GATES
 * ==========================================================================
 * Derived from the professional standards of the three leading skip-tracing
 * data companies and the statutes they operate under:
 *
 *   TLOxp (TransUnion)   — subscriber terms carry an explicit "Permissible Use"
 *                          clause; permissible purpose is defined by FCRA §604
 *                          [15 U.S.C. §1681b]. Data is furnished "under the
 *                          following circumstances and no other".
 *   Tracers              — investigator-led research software; the standard it
 *                          sets is currency and completeness of the source data,
 *                          so a stale or unavailable source must be reported as
 *                          such rather than silently treated as a null result.
 *   LexisNexis Risk      — identity verification and due-diligence posture; the
 *                          standard it sets is that identity is established by
 *                          corroborating records, not by a single match.
 *
 * The governing compliance frameworks are FCRA (§604 permissible purpose and
 * §607(b) maximum possible accuracy), DPPA (driver records have their own
 * permitted-use list and are narrower than FCRA), GLBA (financial information),
 * and the Genealogical Proof Standard / FRE 702 for the evidentiary output.
 *
 * Every rule below is either BLOCKING, MAJOR or MINOR. A single BLOCKING
 * violation fails the whole result — `ok` is false and the caller must refuse
 * the operation. There is no scoring that can outvote a blocking rule.
 *
 * This module is deliberately pure: no SDK, no network, no entity access. It is
 * the rule table, and the caller decides what to do with the verdict.
 */

export type Severity = "blocking" | "major" | "minor";

export interface Violation {
  rule: string;
  severity: Severity;
  field: string;
  message: string;
  authority: string;
}

export interface ValidationResult {
  ok: boolean;
  violations: Violation[];
  checked: number;
  summary: string;
}

/* ------------------------------------------------------------------ */
/* Permissible purposes                                                */
/* ------------------------------------------------------------------ */

/**
 * FCRA §604 [15 U.S.C. §1681b] permits a consumer report to be furnished
 * "under the following circumstances and no other". This is the enumerated
 * list, not a suggestion. Anything not on it is not a permissible purpose.
 */
export const PERMISSIBLE_PURPOSES = [
  { id: "court_order", label: "Court order or federal grand jury subpoena", authority: "FCRA §604(a)(1)-(2)" },
  { id: "consumer_written_instruction", label: "Written instruction of the consumer", authority: "FCRA §604(a)(2)" },
  { id: "business_transaction", label: "Legitimate business need — transaction initiated by the consumer", authority: "FCRA §604(a)(3)(F)(i)" },
  { id: "account_review_collection", label: "Review or collection of an account", authority: "FCRA §604(a)(3)(A)" },
  { id: "litigation", label: "Litigation — locating a party or witness, or asset recovery", authority: "FCRA §604(a)(3)(F) / attorney as fiduciary" },
  { id: "fiduciary_duty", label: "Fiduciary duty — estate, probate or trust administration", authority: "State probate code / FCRA §604(a)(3)(F)" },
  { id: "legal_compliance", label: "Compliance with federal, state or local law", authority: "DPPA §2721(b)(1) / GLBA" },
  { id: "government_authorized", label: "Authorized government or law-enforcement function", authority: "DPPA §2721(b)(1) / FCRA §604(a)(1)" },
] as const;

export type PermissiblePurposeId = (typeof PERMISSIBLE_PURPOSES)[number]["id"];

export function listPermissiblePurposes() {
  return PERMISSIBLE_PURPOSES.map((p) => ({ ...p }));
}

export function isPermissiblePurpose(id: unknown): id is PermissiblePurposeId {
  return typeof id === "string" && PERMISSIBLE_PURPOSES.some((p) => p.id === id);
}

/**
 * Data categories that carry their own, narrower authorised-use test. Holding a
 * general FCRA permissible purpose does NOT authorise these.
 *
 *   credit_header  — FCRA-regulated consumer report data
 *   driver_record  — DPPA. Narrower than FCRA; needs a DPPA permitted use.
 *   financial      — GLBA non-public personal information.
 *   medical        — PHI. Never searched without specific authorisation.
 */
export const REGULATED_DATA_CATEGORIES: Record<string, { authority: string; allowedPurposes: PermissiblePurposeId[] }> = {
  credit_header: {
    authority: "FCRA §604",
    allowedPurposes: ["court_order", "consumer_written_instruction", "business_transaction", "account_review_collection", "litigation", "fiduciary_duty"],
  },
  driver_record: {
    authority: "DPPA §2721(b) — narrower than FCRA",
    allowedPurposes: ["court_order", "legal_compliance", "government_authorized", "litigation", "fiduciary_duty"],
  },
  financial: {
    authority: "GLBA — non-public personal information",
    allowedPurposes: ["court_order", "consumer_written_instruction", "legal_compliance", "government_authorized", "fiduciary_duty"],
  },
  medical: {
    authority: "HIPAA / state medical privacy",
    allowedPurposes: ["court_order", "government_authorized", "legal_compliance"],
  },
};

/* ------------------------------------------------------------------ */
/* Rule runner                                                         */
/* ------------------------------------------------------------------ */

function runChecks(input: Record<string, unknown>, checks: Array<(i: any) => Violation | null>): ValidationResult {
  const violations: Violation[] = [];
  for (const check of checks) {
    const v = check(input);
    if (v) violations.push(v);
  }
  const blocking = violations.filter((v) => v.severity === "blocking");
  const ok = blocking.length === 0;
  return {
    ok,
    violations,
    checked: checks.length,
    summary: ok
      ? `Passed ${checks.length} checks`
      : `Failed ${blocking.length} blocking rule(s): ${blocking.map((v) => v.rule).join(", ")}`,
  };
}

const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

/* ------------------------------------------------------------------ */
/* AUTH — runs on every search before any source is contacted          */
/* ------------------------------------------------------------------ */

export interface SearchAuthorization {
  permissible_purpose?: string;
  legal_matter?: string;
  case_reference?: string;
  requested_by_id?: string;
  requested_by_email?: string;
  subject_name?: string;
  data_categories?: string[];
  jurisdiction?: string;
}

/**
 * The per-search gate. This runs BEFORE retrieval. A search that fails here
 * must not touch a data source, because the purpose is what authorises the
 * access — it is not paperwork generated afterwards.
 */
export interface AuthGateOptions {
  /**
   * Whether the legal matter and the case/docket reference are required.
   * Defaults to true. A caller that records the permissible purpose on its own
   * says so explicitly here, rather than the gate being loosened for everyone.
   */
  requireReferences?: boolean;
}

export function validateSearchRequest(input: SearchAuthorization, options: AuthGateOptions = {}): ValidationResult {
  const requireReferences = options.requireReferences !== false;
  return runChecks(input as any, [
    (i) =>
      isPermissiblePurpose(i.permissible_purpose)
        ? null
        : {
            rule: "AUTH-01",
            severity: "blocking",
            field: "permissible_purpose",
            message: isNonEmptyString(i.permissible_purpose)
              ? `"${i.permissible_purpose}" is not an enumerated permissible purpose. FCRA §604 permits furnishing "under the following circumstances and no other".`
              : "No permissible purpose declared. A search must state the authority it is conducted under before any source is contacted.",
            authority: "FCRA §604 [15 U.S.C. §1681b]",
          },

    (i) =>
      (!requireReferences || isNonEmptyString(i.legal_matter))
        ? null
        : {
            rule: "AUTH-02",
            severity: "blocking",
            field: "legal_matter",
            message:
              "No legal matter documented. The specific matter the search serves must be recorded on the request, not reconstructed later.",
            authority: "FCRA §604 / DPPA §2721(b) / GLBA records-retention expectations",
          },

    (i) =>
      (!requireReferences || isNonEmptyString(i.case_reference))
        ? null
        : {
            rule: "AUTH-03",
            severity: "blocking",
            field: "case_reference",
            message:
              "No case, docket or matter reference supplied. A search with no traceable reference cannot be justified to the data provider or to a court.",
            authority: "TLOxp subscriber terms — permissible use must be evidenced",
          },

    (i) =>
      isNonEmptyString(i.requested_by_id) || isNonEmptyString(i.requested_by_email)
        ? null
        : {
            rule: "AUTH-04",
            severity: "blocking",
            field: "requested_by_id",
            message:
              "No identified requesting operator. Permissible purpose is asserted by a person who is accountable for it, never by the system on its own behalf.",
            authority: "FCRA §604 — the recipient certifies its purpose",
          },

    (i) => {
      const cats = Array.isArray(i.data_categories) ? i.data_categories : [];
      if (cats.length === 0) return null;
      const offending: string[] = [];
      for (const cat of cats) {
        const rule = REGULATED_DATA_CATEGORIES[cat];
        if (!rule) continue;
        if (!rule.allowedPurposes.includes(i.permissible_purpose)) offending.push(`${cat} (${rule.authority})`);
      }
      if (offending.length === 0) return null;
      return {
        rule: "AUTH-05",
        severity: "blocking",
        field: "data_categories",
        message:
          `The declared purpose "${i.permissible_purpose}" does not authorise: ${offending.join(", ")}. ` +
          "These categories carry their own permitted-use test and a general FCRA purpose is not sufficient.",
        authority: "DPPA §2721(b) / GLBA / HIPAA",
      };
    },

    (i) =>
      isNonEmptyString(i.subject_name)
        ? null
        : {
            rule: "AUTH-06",
            severity: "major",
            field: "subject_name",
            message: "No subject recorded. A search that cannot name its subject cannot be audited.",
            authority: "FCRA §607(b) — maximum possible accuracy",
          },
  ]);
}

/* ------------------------------------------------------------------ */
/* EVIDENCE — the promotion ladder                                     */
/* ------------------------------------------------------------------ */

/**
 * A finding may only advance through these states in order. "Verified" is not
 * a label the system may apply to itself on the strength of a model's output.
 */
export const EVIDENCE_STATES = [
  "unverified_candidate",
  "source_retrieved",
  "identity_corroborated",
  "relationship_documented",
  "investigator_reviewed",
  "report_approved",
] as const;

export type EvidenceState = (typeof EVIDENCE_STATES)[number];

export const EVIDENCE_STATE_ORDER: Record<EvidenceState, number> = {
  unverified_candidate: 0,
  source_retrieved: 1,
  identity_corroborated: 2,
  relationship_documented: 3,
  investigator_reviewed: 4,
  report_approved: 5,
};

export interface FindingRecord {
  state?: string;
  finding_id?: string;
  source_url?: string;
  source_reference?: string;
  retrieved_at?: string;
  content_hash?: string;
  extraction_method?: string;
  llm_confidence?: number;
  retrieval_status?: string;
  evidence_excerpt?: string;
  identity_association?: string;
  corroborating_sources?: unknown[];
  conflicting_sources?: unknown[];
  investigator_review_status?: string;
}

const SHA256_HEX = /^[a-f0-9]{64}$/i;

/**
 * Language that describes an ABSENCE of records. When this appears on a
 * retrieval whose status is a failure, the failure is being reported as a
 * negative finding — which asserts the source was searched and returned
 * nothing. Deliberately does not match genuine transport errors.
 */
const ABSENCE_PHRASING = /\b(no|not|zero|nothing)\b.*\b(records?|results?|matches|hits?|entries|found|data)\b/i;

export function validateEvidenceRecord(f: FindingRecord): ValidationResult {
  return runChecks(f as any, [
    (i) =>
      EVIDENCE_STATES.includes(i.state)
        ? null
        : {
            rule: "EVID-01",
            severity: "blocking",
            field: "state",
            message: `Unknown evidence state "${i.state}". A finding must occupy one of the six defined ladder states.`,
            authority: "Internal evidence model",
          },

    (i) => {
      const rank = EVIDENCE_STATE_ORDER[i.state as EvidenceState];
      if (rank === undefined || rank <= 0) return null;
      const hasSource = isNonEmptyString(i.source_url) || isNonEmptyString(i.source_reference);
      return hasSource
        ? null
        : {
            rule: "EVID-02",
            severity: "blocking",
            field: "source_url",
            message: `A finding at "${i.state}" asserts a retrieved source but records none. AI-generated research output is a candidate lead, not a record.`,
            authority: "Genealogical Proof Standard element 2 / FRE 702(b)",
          };
    },

    (i) => {
      const rank = EVIDENCE_STATE_ORDER[i.state as EvidenceState];
      if (rank === undefined || rank < EVIDENCE_STATE_ORDER.identity_corroborated) return null;
      return isNonEmptyString(i.content_hash)
        ? null
        : {
            rule: "EVID-03",
            severity: "blocking",
            field: "content_hash",
            message: "No content hash. Without a hash of the retrieved bytes, the exhibit cannot be shown to be the same document later.",
            authority: "FRE 901(a) — authentication / chain of custody",
          };
    },

    (i) => {
      const rank = EVIDENCE_STATE_ORDER[i.state as EvidenceState];
      if (rank === undefined || rank < EVIDENCE_STATE_ORDER.identity_corroborated) return null;
      if (!isNonEmptyString(i.content_hash)) return null;
      return SHA256_HEX.test(i.content_hash)
        ? null
        : {
            rule: "EVID-04",
            severity: "blocking",
            field: "content_hash",
            message: "Content hash is not a 64-character SHA-256 hex digest.",
            authority: "Internal evidence model",
          };
    },

    (i) => {
      const rank = EVIDENCE_STATE_ORDER[i.state as EvidenceState];
      if (rank === undefined || rank < EVIDENCE_STATE_ORDER.source_retrieved) return null;
      return isNonEmptyString(i.retrieved_at) && Number.isFinite(Date.parse(i.retrieved_at))
        ? null
        : {
            rule: "EVID-05",
            severity: "blocking",
            field: "retrieved_at",
            message: "No valid retrieval timestamp. Currency is part of the record's weight, and a source's content changes over time.",
            authority: "Tracers standard — currency and completeness of source data",
          };
    },

    (i) => {
      const rank = EVIDENCE_STATE_ORDER[i.state as EvidenceState];
      if (rank === undefined || rank < EVIDENCE_STATE_ORDER.source_retrieved) return null;
      return isNonEmptyString(i.extraction_method)
        ? null
        : {
            rule: "EVID-06",
            severity: "major",
            field: "extraction_method",
            message: "No extraction method recorded, so the reader cannot tell whether a value was transcribed, parsed or inferred.",
            authority: "FRE 702(c) — the method must be replicable",
          };
    },

    (i) => {
      const rank = EVIDENCE_STATE_ORDER[i.state as EvidenceState];
      if (rank === undefined || rank < EVIDENCE_STATE_ORDER.identity_corroborated) return null;
      return i.llm_confidence === undefined || i.llm_confidence === null
        ? null
        : {
            rule: "EVID-07",
            severity: "blocking",
            field: "llm_confidence",
            message:
              "A model confidence value is present on a finding that claims corroboration. Model confidence is not evidence and must never be the basis of a verified state.",
            authority: "Internal evidence model — AI output is a candidate lead",
          };
    },

    (i) => {
      const rank = EVIDENCE_STATE_ORDER[i.state as EvidenceState];
      if (rank === undefined || rank < EVIDENCE_STATE_ORDER.relationship_documented) return null;
      return isNonEmptyString(i.identity_association)
        ? null
        : {
            rule: "EVID-08",
            severity: "blocking",
            field: "identity_association",
            message: "No statement of which identity this finding is attached to.",
            authority: "FCRA §607(b) — maximum possible accuracy",
          };
    },

    (i) => {
      const rank = EVIDENCE_STATE_ORDER[i.state as EvidenceState];
      if (rank === undefined || rank < EVIDENCE_STATE_ORDER.investigator_reviewed) return null;
      return isNonEmptyString(i.investigator_review_status)
        ? null
        : {
            rule: "EVID-09",
            severity: "blocking",
            field: "investigator_review_status",
            message: "A finding claiming investigator review records no review outcome, and no reviewer.",
            authority: "Investigative practice — a signer owns the conclusion",
          };
    },
  ]);
}

/**
 * A retrieval that failed is an ERROR, never a negative result. Recording an
 * unreachable source as "nothing found" asserts that the source was searched and
 * returned nothing, which is a different and false statement.
 */
export function validateRetrievalOutcome(outcome: { status?: string; http_status?: number; error?: string; source_url?: string }): ValidationResult {
  return runChecks(outcome as any, [
    (i) => {
      const ok = i.status === "retrieved";
      const failed = ["failed", "error", "blocked", "timeout", "not_found", "redirected"].includes(i.status);
      if (!ok && !failed) {
        return {
          rule: "RETR-01",
          severity: "blocking",
          field: "status",
          message: `Retrieval status "${i.status}" is not a recognised outcome. Every fetch resolves to retrieved, not_found, redirected, blocked, timeout, failed or error.`,
          authority: "Internal retrieval model",
        };
      }
      if (failed && !isNonEmptyString(i.error) && i.http_status === undefined) {
        return {
          rule: "RETR-02",
          severity: "major",
          field: "error",
          message: `Retrieval "${i.status}" records no cause. A silent failure cannot be distinguished from a genuine absence of records.`,
          authority: "Tracers standard — source availability must be reported",
        };
      }
      return null;
    },

    (i) =>
      ["failed", "error", "blocked", "timeout"].includes(i.status) &&
      isNonEmptyString(i.error) &&
      ABSENCE_PHRASING.test(i.error)
        ? {
            rule: "RETR-03",
            severity: "blocking",
            field: "error",
            message:
              "A transport failure is being recorded as 'no records found'. That silently converts an unavailable source into a negative finding, and in a report it reads as diligence.",
            authority: "Genealogical Proof Standard element 1 — exhaustive search",
          }
        : null,
  ]);
}

/* ------------------------------------------------------------------ */
/* IDENTITY AND RELATIONSHIP — never inferred from a shared attribute   */
/* ------------------------------------------------------------------ */

export interface RelationshipClaim {
  person_a?: string;
  person_b?: string;
  relationship?: string;
  basis?: string[];
  supporting_sources?: unknown[];
  conflicting_dates?: unknown[];
  same_name_ambiguity?: boolean;
  discriminator?: string;
}

const WEAK_BASES = ["shared_address", "same_surname", "shared_property", "shared_phone", "same_city"];

export function validateRelationship(claim: RelationshipClaim): ValidationResult {
  return runChecks(claim as any, [
    (i) => {
      const basis = Array.isArray(i.basis) ? i.basis : [];
      if (basis.length === 0) {
        return {
          rule: "IDENT-01",
          severity: "blocking",
          field: "basis",
          message: "Relationship asserted with no recorded basis.",
          authority: "Genealogical Proof Standard element 3 — documented analysis",
        };
      }
      const onlyWeak = basis.every((b: string) => WEAK_BASES.includes(b));
      return onlyWeak
        ? {
            rule: "IDENT-02",
            severity: "blocking",
            field: "basis",
            message:
              `Relationship rests only on shared-attribute inference (${basis.join(", ")}). Co-residence, a shared surname or shared property does not establish kinship — unrelated people share all three.`,
            authority: "Genealogical Proof Standard — kinship requires an affirmative record",
          }
        : null;
    },

    (i) =>
      (Array.isArray(i.supporting_sources) ? i.supporting_sources : []).length > 0
        ? null
        : {
            rule: "IDENT-03",
            severity: "blocking",
            field: "supporting_sources",
            message: "No supporting document attached to the relationship.",
            authority: "Genealogical Proof Standard element 2 — source citations",
          },

    (i) => {
      const supporting = Array.isArray(i.supporting_sources) ? i.supporting_sources : [];
      return supporting.length >= 2
        ? null
        : {
            rule: "IDENT-04",
            severity: "major",
            field: "supporting_sources",
            message: "Only one source supports this relationship. Independent corroboration is required before it can be relied on.",
            authority: "LexisNexis Risk posture — identity is established by corroborating records",
          };
    },

    (i) =>
      i.same_name_ambiguity === true && !isNonEmptyString(i.discriminator)
        ? {
            rule: "IDENT-05",
            severity: "blocking",
            field: "discriminator",
            message:
              "Two people share this name and no discriminator separates them. A date of birth, an address period or a record identifier is required; a name match alone is not an identification.",
            authority: "FCRA §607(b) — maximum possible accuracy (matching procedure)",
          }
        : null,

    (i) => {
      const conflicts = Array.isArray(i.conflicting_dates) ? i.conflicting_dates : [];
      if (conflicts.length === 0) return null;
      return isNonEmptyString(i.reasoning ?? i.discriminator) || conflicts.some((c: any) => isNonEmptyString(c?.resolution))
        ? null
        : {
            rule: "IDENT-06",
            severity: "major",
            field: "conflicting_dates",
            message:
              "Conflicting dates are present and none is recorded as a conflict. A conflict must be surfaced as a conflict, never silently resolved in favour of the tidier value.",
            authority: "Genealogical Proof Standard element 4 — resolution of conflicting evidence",
          };
    },
  ]);
}

/* ------------------------------------------------------------------ */
/* REPORT — what the system may and may not assert                     */
/* ------------------------------------------------------------------ */

export interface ReportClaim {
  declares_heir?: boolean;
  declares_legal_conclusion?: boolean;
  states_pending_as_fact?: boolean;
  sources_actually_queried?: unknown[];
  limitations_recorded?: boolean;
  investigator_approval?: string;
  version?: string;
}

export function validateReport(claim: ReportClaim): ValidationResult {
  return runChecks(claim as any, [
    (i) =>
      i.declares_heir === true
        ? {
            rule: "REP-01",
            severity: "blocking",
            field: "declares_heir",
            message:
              "The report declares a legal heir. The system produces candidate relationships for qualified investigator and legal review; it does not determine heirship.",
            authority: "Unauthorised practice of law / BCG standards",
          }
        : null,

    (i) =>
      i.declares_legal_conclusion === true
        ? {
            rule: "REP-02",
            severity: "blocking",
            field: "declares_legal_conclusion",
            message: "The report asserts a legal conclusion. That is the court's determination, not the system's.",
            authority: "FRE 702 — an expert assists the trier of fact, and does not decide",
          }
        : null,

    (i) =>
      (Array.isArray(i.sources_actually_queried) ? i.sources_actually_queried : []).length > 0
        ? null
        : {
            rule: "REP-03",
            severity: "blocking",
            field: "sources_actually_queried",
            message: "The report records no sources actually queried. A scope claim with no record of what was searched is unverifiable.",
            authority: "Genealogical Proof Standard element 1 — exhaustive search",
          },

    (i) =>
      i.limitations_recorded === true
        ? null
        : {
            rule: "REP-04",
            severity: "major",
            field: "limitations_recorded",
            message: "No limitations statement. What the research could not establish is part of the report.",
            authority: "Investigative practice",
          },

    (i) =>
      isNonEmptyString(i.investigator_approval)
        ? null
        : {
            rule: "REP-05",
            severity: "blocking",
            field: "investigator_approval",
            message: "No approving investigator. An approved report carries a named signer who can be deposed.",
            authority: "FRE 702(c) — the witness owns the method",
          },

    (i) =>
      isNonEmptyString(i.version)
        ? null
        : {
            rule: "REP-06",
            severity: "major",
            field: "version",
            message: "No report version. A delivered document must be reproducible at the version served.",
            authority: "Internal release discipline",
          },
  ]);
}

/* ------------------------------------------------------------------ */
/* Convenience                                                         */
/* ------------------------------------------------------------------ */

export function blockingRules(result: ValidationResult): Violation[] {
  return result.violations.filter((v) => v.severity === "blocking");
}

/**
 * One call the search path can make. Never throws — returns a verdict.
 */
export function authorizeSearch(input: SearchAuthorization, options: AuthGateOptions = {}): ValidationResult {
  return validateSearchRequest(input, options);
}