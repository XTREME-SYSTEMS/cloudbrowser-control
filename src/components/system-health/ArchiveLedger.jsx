import { Archive, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * The archive ledger, newest batch first. Each batch states what it retired and
 * why, so "start fresh" is a recorded event rather than a silent wipe.
 */
export default function ArchiveLedger({ archive, result }) {
  const batches = [];
  for (const record of archive || []) {
    const key = record.batch_id || "ungrouped";
    let batch = batches.find((b) => b.key === key);
    if (!batch) {
      batch = { key, count: 0, at: record.archived_at, reason: record.reason, who: record.archived_by_email, groups: {} };
      batches.push(batch);
    }
    batch.count += 1;
    const label = record.entity_label || record.entity || "records";
    batch.groups[label] = (batch.groups[label] || 0) + 1;
  }

  const total = (archive || []).length;
  const truncated = (archive || []).filter((r) => r.payload_truncated).length;

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Archive className="h-4 w-4 text-primary" />
        <h2 className="font-display text-sm font-semibold tracking-wide">Archive ledger</h2>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {total} archived record(s) in the most recent batches
          {truncated > 0 ? ` · ${truncated} too large to keep whole` : ""}
        </span>
      </div>

      {result && (
        <div
          className={`mt-3 rounded-lg border p-2.5 text-[11px] ${
            result.failed > 0 ? "border-amber-500/40 bg-amber-500/5" : "border-emerald-500/40 bg-emerald-500/5"
          }`}
        >
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <div>
              <div className="font-medium">{result.message}</div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
                <span>batch {result.batch_id}</span>
                <span>kept everything newer than {result.older_than_days} days</span>
                {result.dry_run ? <span>dry run — nothing was changed</span> : null}
              </div>
              {(result.targets || []).filter((t) => t.matched > 0 || t.error).length > 0 && (
                <div className="mt-1 space-y-0.5 text-muted-foreground">
                  {(result.targets || [])
                    .filter((t) => t.matched > 0 || t.error)
                    .map((t) => (
                      <div key={t.entity}>
                        {t.label}: {t.archived} preserved, {t.deleted} cleared from the live system
                        {t.failed > 0 ? `, ${t.failed} left in place` : ""}
                        {t.more_waiting ? " — more than 500 matched, run again for the rest" : ""}
                        {t.error ? ` — ${t.error}` : ""}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {batches.length === 0 ? (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Nothing has been archived yet. Everything the system has produced is still live. Archiving preserves each
          record here in full before it is cleared, so an old result can still be read back afterwards.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {batches.slice(0, 6).map((batch) => (
            <li key={batch.key} className="rounded-lg border border-border/60 bg-secondary/20 p-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-border bg-secondary text-muted-foreground">{batch.count} record(s)</Badge>
                <span className="text-[11px] font-medium">{batch.key}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {batch.at ? new Date(batch.at).toLocaleString() : ""}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {Object.entries(batch.groups)
                  .map(([label, n]) => `${n} ${label.toLowerCase()}`)
                  .join(" · ")}
              </div>
              {batch.reason && <div className="mt-0.5 text-[10px] text-muted-foreground">{batch.reason}</div>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}