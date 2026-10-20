import React, { useState } from "react";
import { UserCheck, Clock, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StatusPill from "@/components/investigator/StatusPill";

/**
 * Investigator approval and case assignment.
 *
 * Approving records that a named person accepted responsibility for releasing a
 * case. It does not certify anything: a certification is a separate, deterministic
 * verdict about the work, so approving uncertified work releases nothing.
 */
export default function ApprovalPanel({ brief, onDecision, onAssign, busy }) {
  const [reason, setReason] = useState("");
  const [assignee, setAssignee] = useState(brief?.assignment?.assigned_to_email || "");

  const approval = brief?.verification?.investigator_approval;

  const decide = (decision) => {
    onDecision(decision, reason.trim());
    setReason("");
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <UserCheck className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-display font-semibold">Investigator Approval</h3>
          <StatusPill label={approval || "PENDING"} className="ml-auto" />
        </div>

        <p className="text-[11px] text-muted-foreground mb-3">
          Approval is recorded against your account and is one of the gate&apos;s requirements. It
          cannot substitute for certification, and it cannot be inferred from a confidence score.
        </p>

        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (required to reject, optional to approve)"
          className="h-9 text-sm mb-2"
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={() => decide("approve")} disabled={busy}
            className="bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 border border-emerald-600/40 hover:bg-emerald-600/20">
            {busy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5 mr-1.5" />}
            Approve delivery
          </Button>
          <Button size="sm" variant="outline" onClick={() => decide("reject")} disabled={busy}
            className="border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-500/10">
            Reject
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <UserPlus className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-display font-semibold">Assignment</h3>
        </div>
        <p className="text-[11px] text-muted-foreground mb-2">
          {brief?.assignment?.assigned_at
            ? `Assigned ${formatWhen(brief.assignment.assigned_at)}`
            : "This case is not assigned."}
        </p>
        <div className="flex gap-2">
          <Input
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            placeholder="investigator@firm.example"
            className="h-9 text-sm"
          />
          <Button size="sm" variant="outline" disabled={busy || !assignee.trim()} onClick={() => onAssign(assignee.trim())}>
            Assign
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-display font-semibold">Approval History</h3>
        </div>
        {brief?.approvals?.length ? (
          <ul className="space-y-2">
            {brief.approvals.map((a) => (
              <li key={a.id} className="border-l-2 border-border pl-2.5 py-0.5">
                <div className="flex items-center gap-2">
                  <StatusPill label={a.status} tone={a.status === "granted" ? "good" : a.status === "rejected" ? "bad" : "warn"} />
                  <span className="text-[11px] text-muted-foreground">{a.approved_by || "unrecorded"}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">{formatWhen(a.approved_at || a.created_date)}</span>
                </div>
                {a.reason && <p className="text-[11px] text-foreground/80 mt-0.5">{a.reason}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground italic">No approval has ever been recorded for this case.</p>
        )}
      </div>
    </div>
  );
}

function formatWhen(value) {
  if (!value) return "time not recorded";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}