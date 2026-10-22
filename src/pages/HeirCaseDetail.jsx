import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import HeirSearchResults from "@/components/heir-search/HeirSearchResults";
import CaseRecordSummary from "@/components/heir-search/CaseRecordSummary";
import { downloadHeirPDF } from "@/lib/heirPDF";
import { ArrowLeft, FileText, Loader2, RefreshCw } from "lucide-react";

const STATUS_CLASS = {
  found: "border border-green-200 bg-green-100 text-green-700",
  partial: "border border-amber-200 bg-amber-100 text-amber-700",
  failed: "border border-red-200 bg-red-100 text-red-700",
};

/**
 * One heir case's complete results on its own page. Every case row, tile and
 * heir action leads here, and HeirSearchResults renders all of the run's
 * sections, so a reopened case shows everything a fresh run showed.
 */
export default function HeirCaseDetail() {
  const { id } = useParams();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const stored = await base44.entities.HeirSearch.get(id);
      setRecord(stored || null);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "This case could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // A stored case names its run totals differently from a fresh run's response,
  // so the results view is handed the same shape either way. Without this a
  // reopened case reads "undefined living heirs" and counts zero sources.
  const result = useMemo(() => {
    if (!record) return null;
    const heirs = record.identified_heirs || [];
    return {
      ...record,
      living_heir_count:
        record.living_heir_count ?? heirs.filter((h) => h.is_living !== false).length,
      sources: record.sources ?? record.sources_checked ?? [],
      methods: record.methods ?? record.methods_used ?? [],
      duration_ms: record.duration_ms ?? record.search_duration_ms ?? 0,
    };
  }, [record]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-gold" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Heir search case
            </span>
          </div>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-display font-bold">
            <span className="truncate">{loading ? "Loading…" : record?.deceased_name || "Case not found"}</span>
            {record?.status && (
              <Badge className={STATUS_CLASS[record.status] || "border border-border bg-muted text-muted-foreground"}>
                {record.status.toUpperCase()}
              </Badge>
            )}
          </h1>
          {record && (
            <p className="text-xs text-muted-foreground">
              {record.case_reference || "no case reference"}
              {record.death_location ? ` · ${record.death_location}` : ""}
              {record.deceased_dod ? ` · died ${record.deceased_dod}` : ""}
              {" · "}{record.identified_heirs?.length || 0} heirs
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link to="/heir-search-dashboard">
            <Button size="sm" variant="outline">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />All cases
            </Button>
          </Link>
          {result && (
            <Button size="sm" variant="outline" onClick={() => downloadHeirPDF(result)}>
              <FileText className="mr-1.5 h-3.5 w-3.5" />PDF
            </Button>
          )}
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
          <p className="mt-3 text-xs text-muted-foreground">Loading every result for this case…</p>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4">
          <p className="text-sm font-display font-semibold text-red-700 dark:text-red-300">
            This case could not be opened
          </p>
          <p className="mt-1 text-xs text-red-700 dark:text-red-300">{error}</p>
        </div>
      ) : !record ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-sm font-display font-semibold">Case not found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            This case no longer exists, or it belongs to another account.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <CaseRecordSummary record={result} />
          <HeirSearchResults
            result={result}
            setResult={setRecord}
            deepSearch={true}
            heirSearchId={id}
          />
        </div>
      )}
    </div>
  );
}