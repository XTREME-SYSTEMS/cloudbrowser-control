import React from "react";
import { ShieldCheck, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The approvals the guardian refused to decide alone. Each one carries the exact
 * command it would run, so approving is an informed act rather than a blank yes.
 */
export default function GuardianQueue({ pending = [], onDecide, busy }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <h2 className="font-display text-sm font-semibold tracking-wide">Waiting on your approval</h2>
        <span className="ml-auto text-[11px] text-muted-foreground">{pending.length}</span>
      </div>

      {pending.length === 0 ? (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Nothing is waiting. Repairs the guardian can make safely have already been made and verified.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {pending.map((approval) => (
            <div key={approval.id} className="rounded-lg border border-border/60 bg-secondary/20 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-medium">{approval.label}</span>
                <span className="xa-pill-badge">{approval.target}</span>
                <span className="text-[10px] text-muted-foreground">{approval.action}</span>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{approval.reason}</p>
              {approval.command ? (
                <pre className="xa-scroll mt-2 max-h-24 overflow-auto rounded-md border border-border/60 bg-muted/40 p-2 text-[10px] leading-snug">
                  {approval.command}
                </pre>
              ) : null}
              <div className="mt-2 flex gap-2">
                <Button size="sm" disabled={Boolean(busy)} onClick={() => onDecide(approval, true)}>
                  <Check className="h-3.5 w-3.5" /> Approve and run
                </Button>
                <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => onDecide(approval, false)}>
                  <X className="h-3.5 w-3.5" /> Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}