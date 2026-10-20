import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { caseToFamilyGraph } from "../../shared/kinshipAdapter.ts";
import { caseFingerprint } from "../../shared/independentCertification.ts";
import {
  APPROVAL_ACTION_TYPE,
  buildApprovalMap,
  resolveExportVerification,
} from "../../shared/exportVerification.ts";
import {
  ASSIGNMENT_KIND,
  INVESTIGATOR_BRIEF_VERSION,
  buildCaseQueueRow,
  buildEvidenceLedger,
  buildResearchGaps,
  latestAssignment,
  summariseKinshipForUi,
} from "../../shared/investigatorBrief.ts";

/**
 * getInvestigatorCaseBrief
 * ==========================================================================
 * The read side of the investigator command center.
 *
 * Two things it deliberately does NOT do:
 *
 *   • It never computes a verification label of its own. Every certification,
 *     evidence and approval label comes from resolveExportVerification, the same
 *     module the three spreadsheet exports and the report delivery gate use, so
 *     the screen, the spreadsheet and the PDF cannot disagree about one case.
 *
 *   • It never lets the client say who it is. Access is an admin role check
 *     performed here, against the caller's own token, before any elevation.
 *
 * Elevation note: HeirSearch's read rule is scoped to the case's creator or its
 * client email, and it carries no admin branch. An investigator reviewing a case
 * they did not create therefore cannot read it user-scoped, so reads below run
 * service-side AFTER the admin check above. The check is the authorization; the
 * elevation only avoids a second, narrower rule re-deciding it.
 *
 * Input:  { heir_search_id?, limit? }
 * Output: { ok, queue } or { ok, brief }
 */
export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Authentication required" }, { status: 401 });
    }
    if (user.role !== "admin") {
      return Response.json(
        { error: "Investigator access requires an admin role. Ask a workspace admin to grant it." },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const caseId = body.heir_search_id ? String(body.heir_search_id) : "";
    const limit = Math.min(Math.max(Number(body.limit) || 25, 1), 50);
    const search = body.search ? String(body.search).trim().slice(0, 120) : "";

    const db = base44.asServiceRole.entities;

    if (caseId) {
      const brief = await buildBrief(db, caseId, user);
      if (!brief) {
        return Response.json({ error: "Case not found" }, { status: 404 });
      }
      return Response.json({ ok: true, brief });
    }

    const queue = await buildQueue(db, limit, user, search);
    return Response.json({ ok: true, queue });
  } catch (error) {
    console.error("getInvestigatorCaseBrief error:", error?.message || error);
    return Response.json(
      { error: error?.message || "Unable to assemble the investigator brief" },
      { status: 500 },
    );
  }
}

/* ------------------------------------------------------------------ */
/* Queue                                                               */
/* ------------------------------------------------------------------ */

async function buildQueue(db: any, limit: number, user: any, search: string) {
  // Search runs on the server. A box that narrowed only the page already held in
  // memory would quietly answer a different question from the one it asks.
  const query = search
    ? {
        $or: [
          { deceased_name: { $regex: escapeRegex(search), $options: "i" } },
          { case_reference: { $regex: escapeRegex(search), $options: "i" } },
          { death_location: { $regex: escapeRegex(search), $options: "i" } },
        ],
      }
    : {};

  const page = await db.HeirSearch.filter(query, { sort: "-created_date", limit });
  const cases: any[] = page?.items || (Array.isArray(page) ? page : []);
  if (cases.length === 0) {
    return { cases: [], counts: emptyCounts(), search, viewer: viewerOf(user), gate_version: null, brief_version: INVESTIGATOR_BRIEF_VERSION };
  }

  const ids = cases.map((c) => c.id).filter(Boolean);

  // One approvals query for the whole page, and one audit query for the
  // assignments: an N+1 lookup per row is how a review queue becomes slow enough
  // that people stop opening it.
  const [approvalsRes, auditRes] = await Promise.allSettled([
    db.Approval.filter(
      { action_type: APPROVAL_ACTION_TYPE, target: { $in: ids } },
      { sort: "-created_date", limit: 200 },
    ),
    db.AuditLog.filter(
      { entity_type: "HeirSearch", action: "update" },
      { sort: "-created_date", limit: 200 },
    ),
  ]);

  const approvals = approvalsRes.status === "fulfilled" ? approvalsRes.value : null;
  const auditRows = auditRes.status === "fulfilled" ? auditRes.value : null;
  // A register we could not read authorises nothing; buildApprovalMap(null) is {}.
  const approvalMap = buildApprovalMap(approvals);
  const assignments = assignmentMap(auditRows);

  let gate_version: string | null = null;
  const rows = cases.map((record) => {
    const verification = resolveExportVerification({
      certification: record.certification || null,
      investigator_review: approvalMap[record.id] || null,
      current_fingerprint: caseFingerprint(record),
    });
    gate_version = gate_version || verification.gate_version;

    const kinship = caseToFamilyGraph(record);
    return buildCaseQueueRow({
      record,
      verification,
      assignment: assignments[record.id] || null,
      kinship,
    });
  });

  return {
    cases: rows,
    counts: {
      total: rows.length,
      certified: rows.filter((r) => r.certification_status === "CERTIFIED").length,
      stale: rows.filter((r) => r.certification_status === "STALE").length,
      not_certified: rows.filter((r) => r.certification_status === "NOT CERTIFIED").length,
      approved: rows.filter((r) => r.investigator_approval === "APPROVED").length,
      rejected: rows.filter((r) => r.investigator_approval === "REJECTED").length,
      awaiting_approval: rows.filter((r) => r.investigator_approval === "PENDING").length,
      deliverable: rows.filter((r) => r.exportable_as_certified).length,
      unassigned: rows.filter((r) => !r.assigned_to_email).length,
      no_recorded_basis: rows.filter((r) => r.no_recorded_basis === true).length,
    },
    search,
    viewer: viewerOf(user),
    gate_version,
    brief_version: INVESTIGATOR_BRIEF_VERSION,
  };
}

/** A user's search term is text, not a pattern. */
function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function emptyCounts() {
  return {
    total: 0, certified: 0, stale: 0, not_certified: 0,
    approved: 0, rejected: 0, awaiting_approval: 0,
    deliverable: 0, unassigned: 0, no_recorded_basis: 0,
  };
}

function viewerOf(user: any) {
  return { email: user?.email || "", role: user?.role || "", name: user?.full_name || "" };
}

/* ------------------------------------------------------------------ */
/* Single-case brief                                                   */
/* ------------------------------------------------------------------ */

async function buildBrief(db: any, caseId: string, user: any) {
  const record = await db.HeirSearch.get(caseId).catch(() => null);
  if (!record) return null;

  const [approvalsRes, auditRes, tracesRes] = await Promise.allSettled([
    db.Approval.filter(
      { action_type: APPROVAL_ACTION_TYPE, target: caseId },
      { sort: "-created_date", limit: 25 },
    ),
    db.AuditLog.filter(
      { entity_type: "HeirSearch", entity_id: caseId },
      { sort: "-created_date", limit: 50 },
    ),
    record.deceased_name
      ? db.SkipTrace.filter(
          { target_owner_name: record.deceased_name },
          { sort: "-created_date", limit: 10 },
        )
      : Promise.resolve([]),
  ]);

  const approvalRows = settledList(approvalsRes);
  const auditRows = settledList(auditRes);
  const traces = settledList(tracesRes);

  const verification = resolveExportVerification({
    certification: record.certification || null,
    investigator_review: buildApprovalMap(approvalRows)[caseId] || null,
    current_fingerprint: caseFingerprint(record),
  });

  const kinship = caseToFamilyGraph(record);
  const blocked = record.blocked_sources || null;

  return {
    brief_version: INVESTIGATOR_BRIEF_VERSION,
    gate_version: verification.gate_version,
    viewer: viewerOf(user),
    case: record,
    verification,
    certification: record.certification || null,
    kinship: summariseKinshipForUi(kinship),
    lineage: {
      case_fingerprint: caseFingerprint(record),
      certification_fingerprint: record.certification?.case_fingerprint || null,
      certification_stamp: record.certification?.stamp || null,
      certified_at: record.certification?.certified_at || null,
    },
    approvals: approvalRows.map((a: any) => ({
      id: a.id,
      status: a.status,
      approved_by: a.approved_by || null,
      approved_at: a.approved_at || null,
      reason: a.reason || null,
      requested_by: a.requested_by || null,
      requested_at: a.requested_at || null,
      created_date: a.created_date || null,
    })),
    assignment: latestAssignment(auditRows),
    evidence_ledger: buildEvidenceLedger(traces),
    linked_traces: traces.map((t: any) => ({
      id: t.id,
      status: t.status,
      confidence_score: Number(t.confidence_score) || 0,
      target_owner_name: t.target_owner_name || "",
      evidence_record_count: Array.isArray(t.search_results?.evidence_records)
        ? t.search_results.evidence_records.length
        : 0,
      evidence_verified: t.search_results?.evidence_verified === true,
      verification_status: t.search_results?.verification_status || null,
      sources_checked: (t.sources_checked || []).length,
      methods_used: (t.methods_used || []).length,
      duration_ms: Number(t.search_duration_ms) || 0,
    })),
    source_coverage: {
      sources_checked: record.sources_checked || [],
      methods_used: record.methods_used || [],
      blocked_sources: blocked,
      data_categories: record.authorization?.data_categories || [],
      permissible_purpose: record.authorization?.permissible_purpose || null,
      legal_matter: record.authorization?.legal_matter || null,
      asserted_by_email: record.authorization?.asserted_by_email || null,
      asserted_at: record.authorization?.asserted_at || null,
    },
    gaps: buildResearchGaps({
      verification,
      kinship,
      blockedSources: blocked,
      deceased_confirmed: record.deceased_confirmed === true ? true : false,
    }),
    audit: auditRows.map((a: any) => ({
      id: a.id,
      action: a.action,
      description: a.description || "",
      user_email: a.user_email || null,
      timestamp: a.timestamp || a.created_date || null,
      kind: a.metadata?.kind || null,
    })),
  };
}

function settledList(result: any): any[] {
  if (!result || result.status !== "fulfilled") return [];
  const value = result.value;
  if (Array.isArray(value)) return value;
  return Array.isArray(value?.items) ? value.items : [];
}

/**
 * The newest assignment per case, read from the audit trail rather than a case
 * field: an assignment is a decision someone made, so it belongs in the same
 * append-only record as the approvals and the delivery receipts.
 */
function assignmentMap(auditRows: any) {
  const list = Array.isArray(auditRows) ? auditRows : auditRows?.items || [];
  const byCase: Record<string, any[]> = {};
  for (const row of list) {
    if (row?.metadata?.kind !== ASSIGNMENT_KIND) continue;
    const id = row.entity_id ? String(row.entity_id) : "";
    if (!id) continue;
    (byCase[id] = byCase[id] || []).push(row);
  }
  const out: Record<string, any> = {};
  for (const id of Object.keys(byCase)) {
    out[id] = latestAssignment(byCase[id]);
  }
  return out;
}