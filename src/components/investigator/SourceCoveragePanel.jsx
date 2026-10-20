import React from "react";
import { Database, Ban, Scale, FileCheck2 } from "lucide-react";

/**
 * What was searched, under whose authority, and what was not searched at all.
 *
 * A blocked source is listed as loudly as a searched one. A gap in coverage that
 * the reader cannot see reads as coverage, which is the failure mode this panel
 * exists to prevent.
 */
export default function SourceCoveragePanel({ coverage }) {
  if (!coverage) return null;

  const blocked = coverage.blocked_sources?.blocked || [];

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <Scale className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-display font-semibold">Search Authority</h3>
        </div>
        <Row label="Permissible purpose" value={prettify(coverage.permissible_purpose)} />
        <Row label="Legal matter" value={coverage.legal_matter} />
        <Row label="Asserted by" value={coverage.asserted_by_email} />
        <Row label="Asserted at" value={coverage.asserted_at} />
        <Row
          label="Regulated data"
          value={coverage.data_categories?.length ? coverage.data_categories.join(", ") : "none declared"}
        />
        <p className="text-[11px] text-muted-foreground mt-2">
          Authority is recorded at intake, before any source is contacted. It is read here, never
          reconstructed afterwards.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <Database className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-display font-semibold">
            Sources queried ({coverage.sources_checked?.length || 0})
          </h3>
        </div>
        {coverage.sources_checked?.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {coverage.sources_checked.map((s, i) => (
              <li key={i} className="text-[11px] rounded-md border border-border bg-muted/40 px-2 py-0.5">{s}</li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground italic">No sources are recorded as queried.</p>
        )}

        <div className="flex items-center gap-2 mt-4 mb-2">
          <FileCheck2 className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-display font-semibold">
            Methods executed ({coverage.methods_used?.length || 0})
          </h3>
        </div>
        {coverage.methods_used?.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {coverage.methods_used.map((m, i) => (
              <li key={i} className="text-[11px] rounded-md border border-border bg-muted/40 px-2 py-0.5">{m}</li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground italic">No methods are recorded as executed.</p>
        )}
      </div>

      <div className={`rounded-xl border p-4 ${blocked.length ? "border-amber-500/40 bg-amber-500/10" : "border-border bg-card"}`}>
        <div className="flex items-center gap-2 mb-2">
          <Ban className={`w-4 h-4 ${blocked.length ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`} />
          <h3 className="text-sm font-display font-semibold">Blocked sources ({blocked.length})</h3>
        </div>
        {blocked.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            {coverage.blocked_sources?.summary || "No source was withheld for want of credentials."}
          </p>
        ) : (
          <>
            <ul className="space-y-1">
              {blocked.map((b, i) => (
                <li key={i} className="text-xs text-amber-800 dark:text-amber-200">
                  {String(b.source || b.name || "Unnamed source")}
                  {b.credential_missing || b.credential
                    ? ` — missing credential: ${b.credential_missing || b.credential}`
                    : ""}
                </li>
              ))}
            </ul>
            {coverage.blocked_sources?.disclosure && (
              <p className="text-[11px] text-amber-800/90 dark:text-amber-200/90 mt-2">
                {coverage.blocked_sources.disclosure}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <p className="text-[11px] flex gap-2 py-0.5">
      <span className="font-semibold text-foreground w-40 shrink-0">{label}</span>
      <span className="text-muted-foreground break-all">{value || "not recorded"}</span>
    </p>
  );
}

function prettify(value) {
  if (!value) return null;
  return String(value).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}