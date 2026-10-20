import React from "react";
import { Database, Link2, ShieldCheck, ShieldAlert } from "lucide-react";
import StatusPill from "@/components/investigator/StatusPill";

/**
 * The evidence register: what each finding rests on, and whether that source was
 * mechanically re-fetched and matched after it was recorded.
 *
 * Two different questions are kept apart here. "Is this finding re-verified?" is
 * answered by the certification's own verified/unverified finding lists, not by
 * the shape of the row — a row that looks complete is not a row that was checked.
 */
export default function EvidencePanel({ ledger = [], certification }) {
  const verified = new Set(certification?.verified_finding_ids || []);
  const unverified = new Set(certification?.unverified_finding_ids || []);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Records" value={ledger.length} />
        <Stat label="Re-verified" value={verified.size} tone="text-emerald-600 dark:text-emerald-400" />
        <Stat label="Not re-verified" value={unverified.size} tone="text-amber-600 dark:text-amber-400" />
      </div>

      {ledger.length === 0 ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="text-xs text-amber-700 dark:text-amber-300">
            No preserved source evidence is attached to this case. Findings without a preserved
            source cannot be re-verified, so they cannot be certified.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground">
                  <th className="text-left px-3 py-2 font-semibold">Finding</th>
                  <th className="text-left px-3 py-2 font-semibold">Source</th>
                  <th className="text-left px-3 py-2 font-semibold">Retrieved</th>
                  <th className="text-left px-3 py-2 font-semibold">Preserved hash</th>
                  <th className="text-left px-3 py-2 font-semibold">Re-verification</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((e, i) => {
                  const state =
                    e.finding_id && verified.has(e.finding_id)
                      ? { label: "re-verified", tone: "good" }
                      : e.finding_id && unverified.has(e.finding_id)
                        ? { label: "not intact", tone: "bad" }
                        : { label: "not checked", tone: "warn" };
                  return (
                    <tr key={`${e.finding_id}-${i}`} className="border-t border-border">
                      <td className="px-3 py-2 font-mono">{e.finding_id || "--"}</td>
                      <td className="px-3 py-2 max-w-[220px]">
                        {e.source_url ? (
                          <a href={e.source_url} target="_blank" rel="noopener noreferrer"
                            className="text-primary underline-offset-2 hover:underline inline-flex items-center gap-1">
                            <Link2 className="w-3 h-3 shrink-0" />
                            <span className="truncate">{hostOf(e.source_url)}</span>
                          </a>
                        ) : (
                          <span className="text-muted-foreground">no source recorded</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{shortWhen(e.retrieved_at)}</td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">
                        {e.content_hash ? `${e.content_hash.slice(0, 12)}…` : "absent"}
                      </td>
                      <td className="px-3 py-2">
                        <StatusPill label={state.label} tone={state.tone} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-muted/30 p-3 flex items-start gap-2">
        {verified.size > 0 ? (
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        ) : (
          <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        )}
        <p className="text-[11px] text-muted-foreground">
          A preserved hash is what makes re-verification meaningful: the source is fetched again and
          compared against the copy taken at the time, so a page that has since changed is detected
          rather than assumed intact.
        </p>
      </div>
    </div>
  );
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function shortWhen(value) {
  if (!value) return "not recorded";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
}

function Stat({ label, value, tone }) {
  return (
    <div className="rounded-lg border border-border bg-card px-2 py-1.5 text-center">
      <div className={`text-lg font-display font-bold ${tone || ""}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  );
}