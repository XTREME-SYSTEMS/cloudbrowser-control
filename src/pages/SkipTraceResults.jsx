import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { traceHeadline, when } from "@/components/skip-tracing/traceDetailParts";
import {
  Loader2, RefreshCw, ArrowLeft, ChevronRight, Phone, Mail, MapPin, Layers,
} from "lucide-react";

const STATUS_TONE = {
  found: "border-emerald-500/40 text-emerald-600",
  partial: "border-amber-500/40 text-amber-600",
  failed: "border-red-500/40 text-red-600",
  searching: "border-blue-500/40 text-blue-600",
  pending: "border-border text-muted-foreground",
};

/**
 * The sets the dashboard tiles count. "In progress" is searching OR pending,
 * matching how the tile above it is counted, so a tile never promises a number
 * this page cannot show.
 */
const SETS = [
  { id: "all", label: "All traces" },
  { id: "found", label: "Found" },
  { id: "partial", label: "Partial" },
  { id: "failed", label: "Failed" },
  { id: "inprogress", label: "In progress" },
];

function matchesSet(trace, set) {
  if (set === "all") return true;
  if (set === "inprogress") return trace.status === "searching" || trace.status === "pending";
  return trace.status === set;
}

/**
 * Every stored skip trace, whether it is reached from a summary tile or opened
 * directly. This is the results page the dashboard's numbers lead to; each row
 * opens the one trace's complete record.
 */
export default function SkipTraceResults() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = params.get("status") || "all";
  const batch = params.get("batch") || "";

  const [traces, setTraces] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const stored = await base44.entities.SkipTrace.list("-created_date", 100);
      setTraces(stored || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const shown = useMemo(
    () => traces.filter((t) => matchesSet(t, status) && (!batch || (t.batch_id || "single") === batch)),
    [traces, status, batch],
  );

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold">Skip trace results</h1>
          <p className="text-xs text-muted-foreground">
            Every stored trace with all of its recorded findings. {shown.length} of {traces.length} shown.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/skip-tracing">
            <Button size="sm" variant="outline">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />Skip tracing
            </Button>
          </Link>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {SETS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setParam("status", s.id === "all" ? "" : s.id)}
            aria-pressed={status === s.id}
            className={`rounded-lg border px-3 py-1.5 text-[11px] font-display font-semibold transition-all ${
              status === s.id
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
            }`}
          >
            {s.label}
          </button>
        ))}
        {batch && (
          <button
            type="button"
            onClick={() => setParam("batch", "")}
            className="ml-1 inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-[11px] font-display font-semibold text-primary"
          >
            <Layers className="h-3 w-3" />
            batch {batch === "single" ? "individual" : batch}
            <span className="text-primary/70">clear</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
          <p className="mt-3 text-xs text-muted-foreground">Loading every stored trace…</p>
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-sm font-display font-semibold">Nothing in this set</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {traces.length === 0
              ? "No traces have been stored yet."
              : "No stored trace matches this set and batch."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {shown.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => navigate(`/skip-traces/${t.id}`)}
              className="w-full rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-display text-sm font-semibold">{traceHeadline(t)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t.found_owner_name ? `Owner: ${t.found_owner_name}` : "Owner not identified"}
                    {" · "}{when(t.created_date) || "start time not recorded"}
                    {t.search_duration_ms ? ` · ${(t.search_duration_ms / 1000).toFixed(1)}s` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline" className={STATUS_TONE[t.status] || "border-border"}>
                    {(t.status || "unknown").toUpperCase()}
                  </Badge>
                  <span className="text-xs font-medium">{t.confidence_score ?? 0}%</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />{t.found_phone_numbers?.length || 0} phones
                </span>
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />{t.found_emails?.length || 0} emails
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />{t.found_addresses?.length || 0} addresses
                </span>
                {t.batch_id && (
                  <span className="flex items-center gap-1">
                    <Layers className="h-3 w-3" />batch {t.batch_id}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}