import React from "react";
import { History, UserPlus, Gavel, FileText } from "lucide-react";

/**
 * The case history and its audit receipts, newest first.
 *
 * A record that only kept its refusals could not answer who authorised a
 * delivery, so grants are receipts too and are shown beside the rest.
 */
const KIND_META = {
  investigator_assignment: { icon: UserPlus, label: "Assignment" },
  investigator_decision: { icon: Gavel, label: "Decision" },
  heir_search_report_approval: { icon: Gavel, label: "Approval" },
};

export default function CaseHistoryPanel({ audit = [] }) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <History className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-display font-semibold">Case History &amp; Audit Receipts</h3>
          <span className="ml-auto text-[11px] text-muted-foreground">{audit.length} entr{audit.length === 1 ? "y" : "ies"}</span>
        </div>

        {audit.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Nothing has been recorded against this case yet.</p>
        ) : (
          <ol className="space-y-2.5">
            {audit.map((e) => {
              const meta = KIND_META[e.kind] || { icon: FileText, label: e.action || "entry" };
              const Icon = meta.icon;
              return (
                <li key={e.id} className="flex gap-2.5">
                  <div className="w-6 h-6 rounded-full border border-border bg-muted/50 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-[10px] font-display font-bold uppercase tracking-widest text-muted-foreground">
                        {meta.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground ml-auto">{shortWhen(e.timestamp)}</span>
                    </div>
                    <p className="text-xs text-foreground/90 break-words">{e.description || "No description recorded"}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {e.user_email || "actor not recorded"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        The history is append-only: it is written by the server when a decision is recorded, not by
        the screen that requested it.
      </p>
    </div>
  );
}

function shortWhen(value) {
  if (!value) return "time not recorded";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}