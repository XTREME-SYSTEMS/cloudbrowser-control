import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import TraceDetail from "@/components/skip-tracing/TraceDetail";
import { traceHeadline, when } from "@/components/skip-tracing/traceDetailParts";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";

/**
 * One skip trace's complete record on its own page, opened from the results
 * list, the history list or the identified-owner rows. TraceDetail renders every
 * field the record carries, so nothing stored is left behind on this page.
 */
export default function SkipTraceDetail() {
  const { id } = useParams();
  const [trace, setTrace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const record = await base44.entities.SkipTrace.get(id);
      setTrace(record || null);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "This trace could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-gold" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Skip trace record
            </span>
          </div>
          <h1 className="mt-1 truncate text-2xl font-display font-bold">
            {loading ? "Loading…" : traceHeadline(trace)}
          </h1>
          {trace && (
            <p className="text-xs text-muted-foreground">
              {when(trace.created_date) || "Start time not recorded"}
              {trace.search_duration_ms ? ` · ${(trace.search_duration_ms / 1000).toFixed(1)}s` : ""}
              {trace.batch_id ? ` · batch ${trace.batch_id}` : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link to="/skip-tracing/results">
            <Button size="sm" variant="outline">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />All results
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

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
          <p className="mt-3 text-xs text-muted-foreground">Loading the full record…</p>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4">
          <p className="text-sm font-display font-semibold text-red-700 dark:text-red-300">
            This trace could not be opened
          </p>
          <p className="mt-1 text-xs text-red-700 dark:text-red-300">{error}</p>
        </div>
      ) : !trace ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-sm font-display font-semibold">Trace not found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            This record no longer exists, or it belongs to another account.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <TraceDetail trace={trace} />
        </div>
      )}
    </div>
  );
}