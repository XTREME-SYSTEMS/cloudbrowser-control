import React, { useState } from "react";
import { Network, AlertTriangle, UserRound, Info } from "lucide-react";
import StatusPill from "@/components/investigator/StatusPill";

/**
 * The relationship graph as a reviewer reads it.
 *
 * Every branch states its own basis. A claim with no recorded evidence says so,
 * because the alternative — a tree that draws a line between two names without
 * saying what supports it — is the single most misleading artifact this pipeline
 * could produce.
 */
export default function FamilyTreePanel({ kinship }) {
  const [openId, setOpenId] = useState(null);

  if (!kinship) {
    return <Empty text="No relationship data is available for this case." />;
  }

  const relationships = kinship.relationships || [];
  const counts = kinship.counts;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Network className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-display font-semibold">Relationship Graph</h3>
          {counts && (
            <span className="ml-auto text-[11px] text-muted-foreground">
              {counts.established} supported · {counts.unresolved} unresolved · {counts.rejected} refused
            </span>
          )}
        </div>

        {kinship.no_recorded_basis && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              No relationship in this case rests on an establishing record. These are research leads
              pending primary documentation, not established next of kin.
            </p>
          </div>
        )}

        {relationships.length === 0 ? (
          <Empty text="No relationship claims are recorded for this case, so nothing is established and nothing is rejected." />
        ) : (
          <ul className="space-y-1.5">
            {relationships.map((r, i) => {
              const key = `${r.relative_name}-${i}`;
              const open = openId === key;
              return (
                <li key={key} className="rounded-lg border border-border">
                  <button
                    onClick={() => setOpenId(open ? null : key)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/50 rounded-lg"
                  >
                    <UserRound className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate">{r.relative_name}</span>
                    <span className="text-[11px] text-muted-foreground capitalize">{r.relation.replace(/_/g, " ")}</span>
                    {r.historical && <span className="text-[10px] text-muted-foreground">(former)</span>}
                    <StatusPill label={r.status} tone={claimTone(r.status)} className="ml-auto" />
                  </button>
                  {open && (
                    <div className="border-t border-border px-3 py-2.5 space-y-1.5">
                      <Row label="Basis recorded">
                        {r.evidence_classes.length > 0
                          ? r.evidence_classes.map((c) => c.replace(/_/g, " ")).join(", ")
                          : "none recorded"}
                      </Row>
                      {r.reasons?.length > 0 && (
                        <Row label="Engine reasoning">{r.reasons.join("; ")}</Row>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-border bg-muted/30 p-3">
        <div className="flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">{kinship.disclosure}</p>
        </div>
      </div>
    </div>
  );
}

function claimTone(status) {
  if (status === "established") return "good";
  if (status === "rejected") return "bad";
  return "warn";
}

function Row({ label, children }) {
  return (
    <p className="text-[11px] text-muted-foreground">
      <span className="font-semibold text-foreground">{label}:</span> {children}
    </p>
  );
}

function Empty({ text }) {
  return <p className="text-xs text-muted-foreground italic py-3">{text}</p>;
}