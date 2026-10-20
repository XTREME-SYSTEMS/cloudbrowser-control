/**
 * EXPORT VERIFICATION INDICATORS
 * ==========================================================================
 * A spreadsheet is a delivery surface, and a spreadsheet travels. It gets
 * filtered, sorted, mailed on, pasted into a filing and read months later by
 * someone who never saw the case. A row that carries a "Confidence %" beside a
 * person's name reads as a verified finding whether or not anyone ever certified
 * it, and a spreadsheet has no watermark to say otherwise.
 *
 * So every exported record carries three explicit indicators:
 *
 *   Certification Status   CERTIFIED | STALE | NOT CERTIFIED
 *   Evidence Status        VERIFIED | PARTIAL | UNVERIFIED
 *   Investigator Approval  APPROVED | REJECTED | PENDING
 *
 * Three columns rather than one because they answer three different questions:
 * was the work independently reviewed, is there source evidence behind it, and
 * did a person take responsibility for releasing it. A case can hold verified
 * sources without certification, or be certified on partial sourcing, and a
 * reader is entitled to see which.
 *
 * These are resolved from the case record server-side, never from the caller's
 * payload. A client that posts its own confidence figure cannot thereby make a
 * row look verified, and an export with no case behind it reads UNVERIFIED —
 * because "uncertified" is a fact about a case, not a default we may assume
 * upward when the linkage is missing.
 *
 * The decision is not re-implemented here. It comes from decideDelivery, so a
 * spreadsheet and a report cannot disagree about the same case.
 */

import {
  decideDelivery,
  type DeliveryDecision,
  type InvestigatorReview,
} from "./deliveryGate.ts";
import { caseFingerprint, type CertificationVerdict } from "./independentCertification.ts";

/** The action_type an investigator approval for a case's report delivery is recorded under. */
export const APPROVAL_ACTION_TYPE = "heir_search_report_approval";

export const EXPORT_VERIFICATION_COLUMNS = [
  "Certification Status",
  "Evidence Status",
  "Investigator Approval",
] as const;

export type CertificationStatusLabel = "CERTIFIED" | "STALE" | "NOT CERTIFIED";
export type EvidenceStatusLabel = "VERIFIED" | "PARTIAL" | "UNVERIFIED";
export type ApprovalStatusLabel = "APPROVED" | "REJECTED" | "PENDING";

export interface ExportVerification {
  certification_status: CertificationStatusLabel;
  evidence_status: EvidenceStatusLabel;
  investigator_approval: ApprovalStatusLabel;
  /** True only when the gate would permit a certified artifact for this case. */
  exportable_as_certified: boolean;
  gate_version: string;
  failed_rules: string[];
  /** The three labels in the exact order EXPORT_VERIFICATION_COLUMNS declares. */
  row: string[];
}

/**
 * Spreadsheet column letter for a 1-based index, correct past column Z
 * (34 -> "AH"), so a header range never silently reads the wrong width.
 */
export function columnLetter(index: number): string {
  let n = Math.max(1, Math.floor(index));
  let out = "";
  while (n > 0) {
    out = String.fromCharCode(65 + ((n - 1) % 26)) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/**
 * The first column where a sheet's existing header disagrees with the layout an
 * export writes, or null when they align.
 *
 * Positional on purpose: a spreadsheet is read positionally. A person's name
 * sitting under "Status" is wrong however the reader filters or sorts it
 * afterwards, and no amount of column naming repairs it. Two writers with
 * different layouts sharing one tab is the way this happens in practice.
 */
export function findColumnConflict(
  expected: readonly string[],
  existing: readonly string[],
): { index: number; expected: string; existing: string } | null {
  for (let i = 0; i < expected.length; i++) {
    const actual = String(existing[i] ?? "");
    if (actual !== expected[i]) {
      return { index: i, expected: expected[i], existing: actual };
    }
  }
  return null;
}

export function resolveExportVerification(input: {
  certification?: CertificationVerdict | Record<string, unknown> | null;
  investigator_review?: InvestigatorReview | null;
  current_fingerprint?: string | null;
}): ExportVerification {
  const certification = input.certification || null;
  const decision = decideDelivery({
    mode: "certified",
    certification,
    investigator_review: input.investigator_review || null,
    current_fingerprint: input.current_fingerprint || null,
  });

  const certification_status = certificationLabel(decision);
  const evidence_status = evidenceLabel(decision, certification);
  const investigator_approval = approvalLabel(decision);

  return {
    certification_status,
    evidence_status,
    investigator_approval,
    exportable_as_certified: decision.allowed,
    gate_version: decision.gate_version,
    failed_rules: decision.failed_rules,
    row: [certification_status, evidence_status, investigator_approval],
  };
}

function certificationLabel(decision: DeliveryDecision): CertificationStatusLabel {
  if (!decision.certification_live) return "NOT CERTIFIED";
  if (decision.certification_stale) return "STALE";
  return "CERTIFIED";
}

function approvalLabel(decision: DeliveryDecision): ApprovalStatusLabel {
  if (decision.investigator_rejected) return "REJECTED";
  if (decision.investigator_approved) return "APPROVED";
  return "PENDING";
}

/**
 * Evidence status describes the sources behind a case, which is a different
 * question from whether the case was certified. When no review has run there are
 * no mechanically re-verified findings, so an unreviewed case may never claim
 * VERIFIED and must not be left blank either.
 */
function evidenceLabel(
  decision: DeliveryDecision,
  certification: Record<string, unknown> | null,
): EvidenceStatusLabel {
  const c = (certification || {}) as Record<string, unknown>;
  const verified = Array.isArray(c.verified_finding_ids) ? c.verified_finding_ids.length : 0;
  const unverified = Array.isArray(c.unverified_finding_ids) ? c.unverified_finding_ids.length : 0;

  if (!decision.certification_live) return verified > 0 ? "PARTIAL" : "UNVERIFIED";
  if (verified === 0) return "UNVERIFIED";
  if (unverified > 0) return "PARTIAL";
  return "VERIFIED";
}

/**
 * An Approval record as the gate expects it. Pending, expired and revoked
 * approvals grant nothing: only a granted approval authorises delivery, and a
 * rejection is carried through as a rejection rather than as absence.
 */
export function approvalRecordToReview(
  record: Record<string, unknown> | null | undefined,
): InvestigatorReview | null {
  if (!record) return null;
  const status = String(record.status || "");
  const approvedBy = record.approved_by ? String(record.approved_by) : undefined;
  const approvedAt = record.approved_at ? String(record.approved_at) : undefined;

  if (status === "granted") {
    return { approved: true, approved_by_email: approvedBy, approved_at: approvedAt };
  }
  if (status === "rejected") {
    return {
      rejected: true,
      rejection_reason: record.reason ? String(record.reason) : undefined,
      approved_by_email: approvedBy,
      approved_at: approvedAt,
    };
  }
  return {};
}

/** Approval rows keyed by the case they belong to, latest row winning. */
export function buildApprovalMap(
  approvals: unknown,
): Record<string, InvestigatorReview> {
  const list = Array.isArray(approvals)
    ? approvals
    : Array.isArray((approvals as any)?.items)
      ? (approvals as any).items
      : [];
  const map: Record<string, InvestigatorReview> = {};
  for (const row of list) {
    const target = row?.target ? String(row.target) : "";
    if (!target || map[target]) continue; // rows arrive newest-first
    const review = approvalRecordToReview(row);
    if (review) map[target] = review;
  }
  return map;
}

/**
 * Resolve verification for a case given whatever linkage an export carries.
 * When no case can be found the export is UNVERIFIED rather than optimistic.
 */
export async function resolveCaseVerificationForExport(
  base44: any,
  linkage: { heir_search_id?: string | null; case_reference?: string | null },
): Promise<ExportVerification & { case_id: string | null; case_found: boolean }> {
  const record = await loadCase(base44, linkage);
  if (!record) {
    return {
      ...resolveExportVerification({}),
      case_id: null,
      case_found: false,
    };
  }

  const review = await loadInvestigatorReview(base44, record.id);
  return {
    ...resolveExportVerification({
      certification: record.certification || null,
      investigator_review: review,
      current_fingerprint: caseFingerprint(record),
    }),
    case_id: record.id,
    case_found: true,
  };
}

async function loadCase(
  base44: any,
  linkage: { heir_search_id?: string | null; case_reference?: string | null },
): Promise<any | null> {
  const id = linkage.heir_search_id;
  if (id) {
    const byId = await base44.entities.HeirSearch.get(id).catch(() => null);
    if (byId) return byId;
  }

  const reference = String(linkage.case_reference || "").trim();
  if (!reference) return null;

  try {
    const found = await base44.entities.HeirSearch.filter(
      { case_reference: reference },
      { sort: "-created_date", limit: 1 },
    );
    const items = Array.isArray(found) ? found : found?.items || [];
    return items[0] || null;
  } catch {
    return null;
  }
}

async function loadInvestigatorReview(
  base44: any,
  caseId: string,
): Promise<InvestigatorReview | null> {
  try {
    const approvals = await base44.entities.Approval.filter(
      { action_type: APPROVAL_ACTION_TYPE, target: caseId },
      { sort: "-created_date", limit: 1 },
    );
    return buildApprovalMap(approvals)[caseId] || null;
  } catch {
    // A lookup failure is not an approval. Delivery stays unauthorised.
    return null;
  }
}