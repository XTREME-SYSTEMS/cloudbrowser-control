import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search, AlertCircle, Database, Loader2, ExternalLink, X, History,
  Radar, CheckCircle, Sparkles,
} from "lucide-react";
import HeirSearchResults from "@/components/heir-search/HeirSearchResults";

/**
 * Simplified Heir Search — one smart input, everything else runs in the background.
 * Type a name OR paste case text (obituary, court filing, notes). The system:
 *  1. Organizes pasted text with AI (if detected)
 *  2. Runs an ultra-deep search across 30+ source categories
 *  3. Auto skip-traces every heir, family member, and associate
 *  4. Shows all findings — every name/address is clickable to search deeper
 */
export default function HeirSearch() {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [trackingSheetUrl, setTrackingSheetUrl] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [showAllCases, setShowAllCases] = useState(false);
  const [traceSummary, setTraceSummary] = useState(null);

  const isBusy = stage !== "";

  useEffect(() => { loadHistory(); loadTrackingSheet(); }, []);

  useEffect(() => {
    const caseId = searchParams.get("case");
    if (!caseId) return;
    (async () => {
      try {
        const hs = await base44.entities.HeirSearch.get(caseId);
        if (hs) setResult(hs);
      } catch (err) { console.error(err); }
    })();
  }, [searchParams]);

  const loadTrackingSheet = async () => {
    try {
      const res = await base44.functions.invoke("getHeirTrackingSheetUrl", {});
      const data = res.data || res;
      if (data.url) setTrackingSheetUrl(data.url);
    } catch (err) { console.error(err); }
  };

  const loadHistory = async () => {
    try {
      const res = await base44.entities.HeirSearch.filter({}, { sort: "-created_date", limit: 50 });
      setHistory(res.items || res);
    } catch (err) { console.error(err); }
    finally { setLoadingHistory(false); }
  };

  const isCaseText = (text) => text.includes("\n") || text.length > 80;

  const handleSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setError(null);
    setResult(null);
    setTraceSummary(null);

    let form = { deceased_name: trimmed };

    try {
      // Stage 1: If pasted case text, organize it with AI first
      if (isCaseText(trimmed)) {
        setStage("organizing");
        const parseRes = await base44.functions.invoke("parseCaseText", { text: trimmed });
        const parsed = (parseRes.data || parseRes).parsed || {};
        form = {
          deceased_name: parsed.deceased_name || trimmed,
          deceased_dob: parsed.deceased_dob || "",
          deceased_dod: parsed.deceased_dod || "",
          deceased_last_address: parsed.deceased_last_address || "",
          death_location: parsed.death_location || "",
          deceased_ssn: parsed.deceased_ssn || "",
          case_reference: parsed.case_reference || "",
          client_email: parsed.client_email || "",
        };
      }

      // Stage 2: Ultra-deep heir search
      setStage("searching");
      const response = await base44.functions.invoke("runHeirSearch", {
        ...form, deep_search: true, extreme_deep: true,
        spreadsheet_url: trackingSheetUrl || undefined,
      });
      const data = response.data || response;
      if (data.error) { setError(data.error); return; }
      setResult(data);
      loadHistory();

      // Stage 3: Auto-trace every heir + everyone they know (background)
      if (data.id) {
        setStage("tracing");
        try {
          const traceRes = await base44.functions.invoke("autoTraceHeirs", {
            heir_search_id: data.id,
            spreadsheet_url: trackingSheetUrl || undefined,
          });
          const td = traceRes.data || traceRes;
          if (td.ok) {
            setTraceSummary(td);
            const updated = await base44.entities.HeirSearch.get(data.id);
            if (updated) setResult(updated);
          }
        } catch (e) { console.error("Auto-trace failed:", e); }
      }
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setStage("");
    }
  };

  const handleDeleteCase = async (id, e) => {
    e.stopPropagation();
    setDeletingId(id);
    try {
      await base44.entities.HeirSearch.delete(id);
      setHistory(history.filter(h => h.id !== id));
      if (result?.id === id) setResult(null);
    } catch (err) { console.error(err); }
    finally { setDeletingId(null); }
  };

  const stageLabel = {
    organizing: "Organizing case text with AI...",
    searching: "Running ultra-deep search across 30+ sources...",
    tracing: "Skip-tracing heirs & everyone they know...",
  };

  return (
    <div className="bg-white text-slate-900 rounded-2xl shadow-sm border border-slate-200 -m-4 md:-m-8 p-4 md:p-8 min-h-[calc(100vh-2rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#c9a961]" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c9a961]">Forensic Genealogy</span>
          </div>
          <h1 className="font-serif text-2xl font-bold text-[#0a1f3c]">Heir Search</h1>
          <p className="text-sm text-slate-500 mt-0.5">Type a name or paste any case text — everything runs automatically</p>
        </div>
        <div className="flex items-center gap-2">
          {trackingSheetUrl && (
            <Button variant="outline" size="sm" asChild className="bg-white border-slate-300 text-slate-700 hover:bg-slate-50">
              <a href={trackingSheetUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />Sheet
              </a>
            </Button>
          )}
          <Button variant="outline" size="sm" asChild className="bg-white border-slate-300 text-slate-700 hover:bg-slate-50">
            <a href="/heir-search-dashboard"><Database className="w-3.5 h-3.5 mr-1.5" />Dashboard</a>
          </Button>
        </div>
      </div>

      {/* Smart Search */}
      <div className="max-w-2xl mx-auto">
        <div className="relative">
          <Search className="absolute left-4 top-5 w-5 h-5 text-slate-400 pointer-events-none" />
          <textarea
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSearch(); } }}
            placeholder="Type a name (e.g. John Smith) or paste any case text — obituary, court filing, attorney email, notes..."
            rows={2}
            className="w-full pl-12 pr-4 py-4 text-base rounded-2xl border border-slate-300 bg-white shadow-sm focus:border-[#0a1f3c] focus:ring-2 focus:ring-[#c9a961]/20 resize-none placeholder:text-slate-400"
          />
        </div>
        <div className="flex items-center justify-center mt-4">
          <Button onClick={handleSearch} disabled={isBusy || !query.trim()}
            className="rounded-full px-8 h-11 bg-[#0a1f3c] hover:bg-[#1a3a5c] text-white border-0 text-base">
            {isBusy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Searching...</> : <><Sparkles className="w-4 h-4 mr-2" />Ultra Deep Search</>}
          </Button>
        </div>
        <p className="text-xs text-slate-400 text-center mt-3">
          Runs an extreme deep search across 30+ source categories, then auto-traces every heir and associate. Click any name or address in results to search deeper.
        </p>
      </div>

      {/* Progress */}
      {isBusy && (
        <div className="max-w-2xl mx-auto mt-4 p-4 rounded-xl border border-[#c9a961]/30 bg-[#c9a961]/5 flex items-center gap-3">
          <Radar className="w-5 h-5 text-[#c9a961] animate-pulse shrink-0" />
          <p className="font-medium text-sm text-[#0a1f3c]">{stageLabel[stage]}</p>
          <Loader2 className="w-4 h-4 animate-spin text-[#c9a961] ml-auto shrink-0" />
        </div>
      )}

      {error && (
        <div className="max-w-2xl mx-auto mt-4 p-4 rounded-xl border border-red-200 bg-red-50 flex items-start gap-3 text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div><p className="font-medium text-sm">Search Error</p><p className="text-xs">{error}</p></div>
        </div>
      )}

      {traceSummary && !isBusy && (
        <div className="max-w-2xl mx-auto mt-4 p-3 rounded-xl border border-green-200 bg-green-50 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
          <p className="text-xs text-green-700">
            Auto-trace complete — traced {traceSummary.traced} heirs/family + {traceSummary.associates_traced} associates. {traceSummary.total_heirs} people with contact info now.
          </p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="mt-6">
          <HeirSearchResults result={result} setResult={setResult} deepSearch={true} />
        </div>
      )}

      {/* Recent Cases */}
      {!result && !isBusy && (
        <div className="max-w-2xl mx-auto mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
              <History className="w-4 h-4 text-slate-400" />Recent Cases
            </h2>
            {history.length > 5 && (
              <button onClick={() => setShowAllCases(true)} className="text-xs text-[#0a1f3c] hover:underline font-medium">View all ({history.length})</button>
            )}
          </div>
          {loadingHistory ? (
            <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
          ) : history.length === 0 ? (
            <p className="text-center py-6 text-sm text-slate-400">No searches yet — enter a name above to begin.</p>
          ) : (
            <div className="space-y-2">
              {history.slice(0, 5).map((hs) => (
                <div key={hs.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => { setResult(hs); }}>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-slate-900 truncate">{hs.deceased_name}</p>
                    <p className="text-xs text-slate-400">{hs.deceased_dod || "DOD unknown"} — {hs.identified_heirs?.length || 0} heirs</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <Badge className={hs.status === "found" ? "bg-green-100 text-green-700 border border-green-200" : "bg-slate-100 text-slate-600 border border-slate-200"}>{hs.status}</Badge>
                    <span className="text-xs font-medium text-slate-600">{hs.confidence_score}%</span>
                    <button onClick={(e) => handleDeleteCase(hs.id, e)} disabled={deletingId === hs.id} title="Delete" className="flex items-center justify-center w-6 h-6 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                      {deletingId === hs.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* All Cases Modal */}
      {showAllCases && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setShowAllCases(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-200 sticky top-0 bg-white">
              <h2 className="text-base font-semibold text-slate-900">All Cases ({history.length})</h2>
              <button onClick={() => setShowAllCases(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-2">
              {history.map((hs) => (
                <div key={hs.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer" onClick={() => { setResult(hs); setShowAllCases(false); }}>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-slate-900 truncate">{hs.deceased_name}</p>
                    <p className="text-xs text-slate-400">{hs.deceased_dod || "DOD unknown"} — {hs.identified_heirs?.length || 0} heirs{hs.case_reference ? ` — ${hs.case_reference}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <Badge className={hs.status === "found" ? "bg-green-100 text-green-700 border border-green-200" : "bg-slate-100 text-slate-600 border border-slate-200"}>{hs.status}</Badge>
                    <span className="text-xs font-medium text-slate-600">{hs.confidence_score}%</span>
                    <button onClick={(e) => handleDeleteCase(hs.id, e)} disabled={deletingId === hs.id} className="flex items-center justify-center w-6 h-6 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50">
                      {deletingId === hs.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}