import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert, Ban } from "lucide-react";

/**
 * The case's own provenance, shown above its findings: the authority the
 * research was conducted under, the independent certification verdict, and every
 * source that was unavailable. All three are stored on the case, but they were
 * only ever surfaced inside the investigator workspace, so a case page showed
 * findings without the record that qualifies them.
 */
export default function CaseRecordSummary({ record }) {
  if (!record) return null;
  const auth = record.authorization;
  const cert = record.certification;
  const blocked = record.blocked_sources;
  if (!auth && !cert && !blocked) return null;

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      {auth && (
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5" />
            Authority recorded
          </p>
          <p className="mt-1.5 text-sm font-medium text-[#0a1f3c]">
            {auth.permissible_purpose || "No permissible purpose recorded"}
          </p>
          {auth.legal_matter && <p className="text-xs text-slate-500">{auth.legal_matter}</p>}
          <p className="mt-1 text-[11px] text-slate-400">
            {auth.asserted_by_email || "operator not recorded"}
            {auth.asserted_at ? ` · ${new Date(auth.asserted_at).toLocaleDateString()}` : ""}
          </p>
        </div>
      )}

      {cert && (
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {cert.certified ? (
              <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
            )}
            Independent certification
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge
              className={
                cert.certified
                  ? "border border-green-200 bg-green-100 text-green-700"
                  : "border border-amber-200 bg-amber-100 text-amber-700"
              }
            >
              {cert.certified ? "CERTIFIED" : "NOT CERTIFIED"}
            </Badge>
            {typeof cert.overall_score === "number" && (
              <span className="text-xs text-slate-500">{cert.overall_score}% overall</span>
            )}
            {typeof cert.model_separation_ok === "boolean" && (
              <span className="text-xs text-slate-500">
                {cert.model_separation_ok ? "models independent" : "model separation not met"}
              </span>
            )}
          </div>
          {cert.failed_rules?.length > 0 && (
            <p className="mt-1.5 text-[11px] text-amber-700">
              Refused on {cert.failed_rules.join(", ")}
            </p>
          )}
          {cert.reasons?.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {cert.reasons.slice(0, 3).map((r, i) => (
                <li key={i} className="text-[11px] text-slate-500">· {r}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {blocked && (
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            <Ban className="h-3.5 w-3.5 text-slate-400" />
            Sources unavailable
          </p>
          <p className="mt-1.5 text-sm font-medium text-[#0a1f3c]">
            {blocked.blocked?.length || 0} blocked · {blocked.available?.length || 0} available
          </p>
          {blocked.summary && <p className="text-xs text-slate-500">{blocked.summary}</p>}
          {blocked.blocked?.slice(0, 3).map((b, i) => (
            <p key={i} className="mt-1 text-[11px] text-slate-500">
              · {b?.name || b?.source || "unnamed source"}
              {b?.missing ? ` (${b.missing})` : ""}
            </p>
          ))}
          {blocked.disclosure && (
            <p className="mt-1.5 text-[11px] text-slate-400">{blocked.disclosure}</p>
          )}
        </div>
      )}
    </div>
  );
}