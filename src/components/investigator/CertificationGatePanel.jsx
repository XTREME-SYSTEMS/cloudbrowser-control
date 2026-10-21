import React from "react";
import { ShieldCheck, ShieldAlert, GitCompareArrows, Fingerprint } from "lucide-react";
import StatusPill from "@/components/investigator/StatusPill";

/**
 * The certification verdict, stated in the terms the gate decided it in.
 *
 * The three labels are the gate's own output, not this screen's opinion, and the
 * fingerprints are printed side by side because "the case changed after it was
 * reviewed" is only arguable when both values are visible.
 */
export default function CertificationGatePanel({ verification, certification, lineage, gaps = [] }) {
  if (!verification) return null;

  // The explanations arrive with the brief so the rule text lives in one place.
  const gateGaps = (gaps || []).filter((g) => g.area === "gate");

  const qa = certification?.qa_score;
  const validator = certification?.validator_score;
  const models = [
    { label: "Search path", value: certification?.search_model },
    { label: "QA", value: certification?.qa_model },
    { label: "Validator", value: certification?.validator_model },
  ];

  const fingerprintMoved =
    Boolean(lineage?.case_fingerprint) &&
    Boolean(lineage?.certification_fingerprint) &&
    lineage.case_fingerprint !== lineage.certification_fingerprint;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          {verification.exportable_as_certified ? (
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          )}
          <h3 className="text-sm font-display font-semibold">Delivery Gate</h3>
          <span className="ml-auto text-[10px] text-muted-foreground font-mono">{verification.gate_version}</span>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          <StatusPill label={verification.certification_status} />
          <StatusPill label={verification.evidence_status} />
          <StatusPill label={verification.investigator_approval} />
          <StatusPill
            label={verification.exportable_as_certified ? "Certified delivery permitted" : "Certified delivery refused"}
            tone={verification.exportable_as_certified ? "good" : "bad"}
          />
        </div>

        {verification.failed_rules?.length > 0 ? (
          <ul className="space-y-1">
            {(gateGaps.length > 0
              ? gateGaps
              : verification.failed_rules.map((rule) => ({ code: rule, message: "" }))
            ).map((gap) => (
              <li key={gap.code} className="text-xs text-foreground/90 border-l-2 border-red-500/40 pl-2.5 py-0.5">
                <span className="font-mono text-[10px] text-muted-foreground mr-1.5">{gap.code}</span>
                {gap.message || "Refused by this rule."}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-emerald-600 dark:text-emerald-400">
            Every deterministic rule passed. Delivery still requires the approval below.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Fingerprint className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-display font-semibold">Independence &amp; Review</h3>
          <StatusPill
            className="ml-auto"
            label={certification?.model_separation_ok ? "models distinct" : "independence unproven"}
            tone={certification?.model_separation_ok ? "good" : "bad"}
          />
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          {models.map((m) => (
            <div key={m.label} className="rounded-lg border border-border bg-muted/40 px-2.5 py-2">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{m.label}</div>
              <div className="text-[11px] font-mono truncate">{m.value || "not recorded"}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <Score label="QA score" value={qa} />
          <Score label="Validator score" value={validator} />
        </div>

        <p className="text-[11px] text-muted-foreground">
          Different models are not, by themselves, independent validation. Certification additionally
          requires mechanical re-verification of each finding against its preserved source, and a
          named investigator&apos;s approval.
        </p>

        {certification?.reasons?.length > 0 && (
          <ul className="mt-2 space-y-1">
            {certification.reasons.map((r, i) => (
              <li key={i} className="text-[11px] text-muted-foreground">· {r}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <GitCompareArrows className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-display font-semibold">Case Lineage</h3>
        </div>
        <Row label="Reviewed fingerprint" value={lineage?.certification_fingerprint} mono />
        <Row label="Current fingerprint" value={lineage?.case_fingerprint} mono />
        <Row label="Certification stamp" value={lineage?.certification_stamp} mono />
        <Row label="Certified at" value={lineage?.certified_at} />
        {fingerprintMoved && (
          <p className="text-[11px] text-red-600 dark:text-red-400 mt-2">
            The case changed after review. The certificate describes a version of this case that no
            longer exists and cannot authorise delivery.
          </p>
        )}
      </div>
    </div>
  );
}

function Score({ label, value }) {
  const num = typeof value === "number" ? value : null;
  const tone =
    num === null ? "text-muted-foreground" : num >= 85 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400";
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-2.5 py-2 text-center">
      <div className={`text-lg font-display font-bold ${tone}`}>{num === null ? "--" : Math.round(num)}</div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  );
}

function Row({ label, value, mono = false }) {
  return (
    <p className="text-[11px] text-muted-foreground flex gap-2 py-0.5">
      <span className="font-semibold text-foreground w-36 shrink-0">{label}</span>
      <span className={mono ? "font-mono break-all" : "break-all"}>{value || "not recorded"}</span>
    </p>
  );
}