/**
 * INVESTIGATOR BRIEF ASSEMBLY
 * ==========================================================================
 * The investigator's screen is a review surface, so what it shows is itself a
 * claim. These functions are pure: they turn a case record, a gate verdict and a
 * kinship summary into the exact rows a reviewer reads, with no I/O, so the
 * mapping the screen depends on is unit-tested rather than only looked at.
 *
 * Two rules the mapping obeys:
 *
 *   • Nothing is promoted by its presence. A case that has no certification, no
 *     approval or no recorded basis renders as exactly that. There is no default
 *     label that reads better than the underlying fact.
 *
 *   • A gap is enumerated, not summarised away. Failed gate rules, unresolved
 *     relationship claims, awaiting conflicts, unrecorded basis and blocked
 *     sources each become their own row naming the rule, so a reviewer can act
 *     on one rather than on an impression.
 */

import type { KinshipSummary } from "./kinshipAdapter.ts";
import type { ExportVerification } from "./exportVerification.ts";

export const INVESTIGATOR_BRIEF_VERSION = "inv-brief/1.0.0";

/** The ActionLog metadata key an investigator assignment is recorded under. */
export const ASSIGNMENT_KIND = "investigator_assignment";

export interface CaseQueueRow {
  id: string;
  case_reference: string;
  deceased_name: string;
  status: string;
  death_location: string;
  created_date: string | null;
  updated_date: string | null;
  certification_status: ExportVerification["certification_status"];
  evidence_status: ExportVerification["evidence_status"];
  investigator_approval: ExportVerification["investigator_approval"];
  /** True only when the shared gate would permit a certified artifact. */
  exportable_as_certified: boolean;
  assigned_to_email: string | null;
  assigned_at: string | null;
  /** Kinship counts, or null when the graph has not been built for this row. */
  relationship_counts: KinshipSummary["counts"] | null;
  no_recorded_basis: boolean | null;
}

export interface ResearchGap {
  /** The rule or engine code behind the gap. */
  code: string;
  /** gate | relationship | evidence | source | identity */
  area: string;
  message: string;
}

/**
 * One row of the review queue. The three verification labels come from the shared
 * gate decision, never from the case's own confidence figure — a producer's
 * self-assessment is not a certification and must not be rendered as one.
 */
export function buildCaseQueueRow(input: {
  record: Record<string, any>;
  verification: ExportVerification;
  assignment?: { assigned_to_email?: string | null; assigned_at?: string | null } | null;
  kinship?: KinshipSummary | null;
}): CaseQueueRow {
  const rec = input.record || {};
  const kin = input.kinship || null;

  return {
    id: String(rec.id || ""),
    case_reference: String(rec.case_reference || ""),
    deceased_name: String(rec.deceased_name || "Unknown"),
    status: String(rec.status || "pending"),
    death_location: String(rec.death_location || ""),
    created_date: rec.created_date ? String(rec.created_date) : null,
    updated_date: rec.updated_date ? String(rec.updated_date) : null,
    certification_status: input.verification.certification_status,
    evidence_status: input.verification.evidence_status,
    investigator_approval: input.verification.investigator_approval,
    exportable_as_certified: input.verification.exportable_as_certified,
    assigned_to_email: input.assignment?.assigned_to_email || null,
    assigned_at: input.assignment?.assigned_at || null,
    relationship_counts: kin ? kin.counts : null,
    no_recorded_basis: kin ? kin.no_recorded_basis : null,
  };
}

/** Plain-language text for each deterministic rule the gate can refuse on. */
const GATE_GAP_MESSAGES: Record<string, string> = {
  "DEL-01": "No independent certification exists for this case, so no certified artifact may be produced.",
  "DEL-02": "The certification is stale: the case changed after it was reviewed and must be re-reviewed.",
  "DEL-03": "Certification is current but no investigator has approved delivery.",
  "DEL-04": "An investigator rejected delivery of this case.",
  "CERT-01": "The producer, QA and Validator did not use three distinct models, so independence is unproven.",
  "CERT-02": "Reviewed findings were not mechanically re-verified against their preserved sources.",
  "CERT-03": "Findings lack independent corroboration from more than one source.",
  "CERT-04": "One or more findings were flagged as unsupported by their own source.",
  "CERT-05": "Recorded confidence is below the certification threshold.",
};

/** Falls back to the raw rule code rather than silently dropping an unknown rule. */
export function gateGapMessage(rule: string): string {
  return GATE_GAP_MESSAGES[rule] || `The delivery gate refused on rule ${rule}.`;
}

export function buildResearchGaps(input: {
  verification: ExportVerification;
  kinship?: KinshipSummary | null;
  blockedSources?: { blocked?: Array<Record<string, any>>; summary?: string } | null;
  deceased_confirmed?: boolean | null;
}): ResearchGap[] {
  const gaps: ResearchGap[] = [];

  for (const rule of input.verification.failed_rules || []) {
    gaps.push({ code: rule, area: "gate", message: gateGapMessage(rule) });
  }

  const kin = input.kinship || null;
  if (kin) {
    if (kin.no_recorded_basis) {
      gaps.push({
        code: "KIN-02",
        area: "relationship",
        message: "No relationship in this case is supported by an establishing record. These are research leads, not established next of kin.",
      });
    }
    if (kin.counts.unresolved > 0) {
      gaps.push({
        code: "KIN-01",
        area: "relationship",
        message: `${kin.counts.unresolved} relationship claim(s) are unresolved for want of a recorded source.`,
      });
    }
    if (kin.counts.conflicts > 0) {
      gaps.push({
        code: "KIN-04",
        area: "relationship",
        message: `${kin.counts.conflicts} recorded conflict(s) await a human decision.`,
      });
    }
    if (kin.counts.unknown_relatives > 0) {
      gaps.push({
        code: "KIN-05",
        area: "relationship",
        message: `${kin.counts.unknown_relatives} named relative(s) carry a relationship term the engine will not infer.`,
      });
    }
    if (kin.counts.rejected > 0) {
      gaps.push({
        code: "KIN-03",
        area: "evidence",
        message: `${kin.counts.rejected} claim(s) rest only on a shared surname, address or co-ownership.`,
      });
    }
  }

  for (const b of input.blockedSources?.blocked || []) {
    const name = String(b?.source || b?.name || "an unnamed source");
    const cred = String(b?.credential_missing || b?.credential || "").trim();
    gaps.push({
      code: "SRC-BLOCKED",
      area: "source",
      message: `${name} was not searched${cred ? ` (missing credential: ${cred})` : ""}. The exclusion is disclosed, not silently skipped.`,
    });
  }

  if (input.deceased_confirmed === false) {
    gaps.push({
      code: "ID-01",
      area: "identity",
      message: "The decedent's identity has not been confirmed against a death record.",
    });
  }

  return gaps;
}

/**
 * The relationship graph as the review screen renders it. Kept separate from the
 * audit rendering so a change to the screen cannot alter what an auditor is shown.
 */
export function summariseKinshipForUi(summary: KinshipSummary | null) {
  if (!summary) {
    return {
      counts: null,
      disclosure: "No relationship graph has been built for this case.",
      no_recorded_basis: null,
      relationships: [] as Array<Record<string, any>>,
      unknown_relatives: [] as Array<Record<string, any>>,
      conflicts: [] as Array<Record<string, any>>,
      merged_identities: [] as Array<Record<string, any>>,
      deceased_branches: [] as Array<Record<string, any>>,
      candidates: [] as Array<Record<string, any>>,
      rule_versions: null,
    };
  }

  const edge = (e: any) => ({
    relative_name: String(e?.relative_name || e?.relative_id || "Unnamed"),
    relation: String(e?.relation || "unknown"),
    status: String(e?.status || "unresolved"),
    historical: e?.historical === true,
    evidence_classes: Array.isArray(e?.evidence_classes) ? e.evidence_classes : [],
    reasons: Array.isArray(e?.reasons) ? e.reasons : [],
  });

  return {
    counts: summary.counts,
    disclosure: summary.disclosure,
    no_recorded_basis: summary.no_recorded_basis,
    relationships: (summary.graph?.edges || []).map(edge),
    unknown_relatives: (summary.graph?.unknown_relatives || []) as Array<Record<string, any>>,
    conflicts: (summary.graph?.conflicts || []) as Array<Record<string, any>>,
    merged_identities: (summary.graph?.merged_identities || []) as Array<Record<string, any>>,
    deceased_branches: (summary.graph?.deceased_branches || []) as Array<Record<string, any>>,
    candidates: (summary.candidates || []) as unknown as Array<Record<string, any>>,
    rule_versions: summary.rule_versions,
  };
}

export interface EvidenceLedgerEntry {
  finding_id: string | null;
  source_url: string | null;
  retrieved_at: string | null;
  content_hash: string | null;
  status: string;
  /** Which case-linked trace carried the record. */
  trace_id: string | null;
}

/**
 * The evidence register across a case's linked traces. A record is only listed
 * with the fields it actually carries: a missing hash stays null and renders as
 * absent rather than being filled in with a placeholder that reads as integrity.
 */
export function buildEvidenceLedger(traces: unknown): EvidenceLedgerEntry[] {
  const list = Array.isArray(traces) ? traces : [];
  const out: EvidenceLedgerEntry[] = [];
  for (const trace of list as Array<Record<string, any>>) {
    const records = trace?.search_results?.evidence_records;
    if (!Array.isArray(records)) continue;
    for (const r of records) {
      if (!r || typeof r !== "object") continue;
      out.push({
        finding_id: r.finding_id ? String(r.finding_id) : null,
        source_url: r.source_url ? String(r.source_url) : null,
        retrieved_at: r.retrieved_at ? String(r.retrieved_at) : null,
        content_hash: r.content_hash ? String(r.content_hash) : null,
        status: String(r.status || "unrecorded"),
        trace_id: trace.id ? String(trace.id) : null,
      });
    }
  }
  return out;
}

/** The latest assignment recorded in the audit trail, or null when unassigned. */
export function latestAssignment(
  auditRows: unknown,
  kind: string = ASSIGNMENT_KIND,
): { assigned_to_email: string | null; assigned_at: string | null } | null {
  const list = Array.isArray(auditRows) ? auditRows : [];
  for (const row of list as Array<Record<string, any>>) {
    const meta = row?.metadata;
    if (!meta || meta.kind !== kind) continue;
    return {
      assigned_to_email: meta.assigned_to_email ? String(meta.assigned_to_email) : null,
      assigned_at: row.timestamp ? String(row.timestamp) : null,
    };
  }
  return null;
}