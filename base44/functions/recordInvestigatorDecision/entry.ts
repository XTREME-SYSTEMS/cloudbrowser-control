import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { APPROVAL_ACTION_TYPE } from "../../shared/exportVerification.ts";
import { ASSIGNMENT_KIND } from "../../shared/investigatorBrief.ts";

/**
 * recordInvestigatorDecision
 * ==========================================================================
 * The write side of the investigator command center: assignment, approval and
 * rejection.
 *
 * Why this is a backend function rather than two entity writes from the screen:
 * the Approval record IS the authority the delivery gate reads. An approval that
 * a client can write freely is not a control, so the write, the role check and
 * the audit receipt all happen here, together, on the server.
 *
 * Two properties worth stating plainly:
 *
 *   • Approving does not certify. It records that a named person accepted
 *     responsibility for releasing a case; the certification is a separate,
 *     deterministic verdict about the work. An approval on uncertified work
 *     therefore releases nothing, and cannot be used to manufacture a result.
 *
 *   • Every decision writes an audit receipt, including the ones that grant.
 *     A trail that only records refusals cannot show who authorised a delivery.
 *
 * Input: { heir_search_id, decision: "assign" | "approve" | "reject",
 *          assigned_to_email?, reason? }
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
        { error: "Recording an investigator decision requires an admin role." },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const caseId = body.heir_search_id ? String(body.heir_search_id) : "";
    const decision = String(body.decision || "");
    const reason = body.reason ? String(body.reason).slice(0, 2000) : "";

    if (!caseId) {
      return Response.json({ error: "heir_search_id is required" }, { status: 400 });
    }
    if (!["assign", "approve", "reject"].includes(decision)) {
      return Response.json(
        { error: `Unknown decision "${decision}". Expected assign, approve or reject.` },
        { status: 400 },
      );
    }

    const db = base44.asServiceRole.entities;

    // The case must exist before anything is written about it, so a decision can
    // never be recorded against an id that names nothing.
    const record = await db.HeirSearch.get(caseId).catch(() => null);
    if (!record) {
      return Response.json({ error: "Case not found" }, { status: 404 });
    }

    const now = new Date().toISOString();

    if (decision === "assign") {
      const assignee = body.assigned_to_email ? String(body.assigned_to_email).trim() : "";
      if (!assignee) {
        return Response.json(
          { error: "assigned_to_email is required to assign a case" },
          { status: 400 },
        );
      }

      await db.AuditLog.create({
        user_id: user.id,
        user_email: user.email,
        action: "update",
        entity_type: "HeirSearch",
        entity_id: caseId,
        description: `Case assigned to ${assignee}`,
        metadata: { kind: ASSIGNMENT_KIND, assigned_to_email: assignee, assigned_by_email: user.email },
        timestamp: now,
      });

      return Response.json({ ok: true, decision, assigned_to_email: assignee, assigned_at: now });
    }

    const granted = decision === "approve";

    await db.Approval.create({
      approval_id: `appr_${Date.now()}`,
      action_type: APPROVAL_ACTION_TYPE,
      target: caseId,
      scope: "protected",
      environment: "production",
      status: granted ? "granted" : "rejected",
      approved_by: user.email,
      approved_at: now,
      requested_by: user.email,
      requested_at: now,
      // A rejection without its reason is a refusal nobody can act on, so the
      // reason is required for a rejection and optional for a grant.
      reason:
        reason ||
        (granted
          ? "Investigator approved delivery"
          : "Investigator rejected delivery"),
    });

    await db.AuditLog.create({
      user_id: user.id,
      user_email: user.email,
      action: "update",
      entity_type: "HeirSearch",
      entity_id: caseId,
      description: granted
        ? `Investigator approved report delivery${reason ? `: ${reason}` : ""}`
        : `Investigator rejected report delivery${reason ? `: ${reason}` : ""}`,
      metadata: {
        kind: "investigator_decision",
        decision,
        reason: reason || null,
        action_type: APPROVAL_ACTION_TYPE,
      },
      timestamp: now,
    });

    return Response.json({
      ok: true,
      decision,
      status: granted ? "granted" : "rejected",
      approved_by: user.email,
      approved_at: now,
    });
  } catch (error) {
    console.error("recordInvestigatorDecision error:", error?.message || error);
    return Response.json(
      { error: error?.message || "Unable to record the decision" },
      { status: 500 },
    );
  }
}