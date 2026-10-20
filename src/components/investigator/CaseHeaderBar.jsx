import React from "react";
import { Fingerprint, MapPin, CalendarDays } from "lucide-react";
import StatusPill from "@/components/investigator/StatusPill";

/** Identity and status at a glance, with the gate's own labels rather than a summary of them. */
export default function CaseHeaderBar({ caseRecord, verification }) {
  if (!caseRecord) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-display font-bold truncate">{caseRecord.deceased_name}</h2>
            <StatusPill
              label={caseRecord.status || "unknown"}
              tone={caseRecord.status === "found" ? "good" : caseRecord.status === "failed" ? "bad" : "warn"}
            />
            {caseRecord.deceased_confirmed !== true && (
              <span className="text-[10px] text-amber-600 dark:text-amber-400">identity not confirmed</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-[11px] text-muted-foreground">
            <span className="font-mono">{caseRecord.case_reference || "no case reference"}</span>
            {caseRecord.death_location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {caseRecord.death_location}
              </span>
            )}
            {caseRecord.deceased_dod && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="w-3 h-3" /> d. {caseRecord.deceased_dod}
              </span>
            )}
            {caseRecord.deceased_ssn && (
              <span className="inline-flex items-center gap-1">
                <Fingerprint className="w-3 h-3" /> SSN {caseRecord.deceased_ssn}
              </span>
            )}
          </div>
        </div>

        {verification && (
          <div className="flex flex-wrap gap-1.5">
            <StatusPill label={verification.certification_status} />
            <StatusPill label={verification.evidence_status} />
            <StatusPill label={verification.investigator_approval} />
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground mt-3">
        The confidence figure this case reports about its own work is not shown here as a status.
        Certification comes from the gate, and an uncertified case may not present itself as verified.
      </p>
    </div>
  );
}