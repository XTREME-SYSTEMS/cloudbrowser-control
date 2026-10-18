import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Search, AlertCircle, Database, Loader2, FileText, MapPin, Mail,
  ChevronDown, ChevronRight, ExternalLink, X, SlidersHorizontal, History,
} from "lucide-react";
import TemplateSelector from "@/components/heir-search/TemplateSelector";
import HeirSearchResults from "@/components/heir-search/HeirSearchResults";

export default function HeirSearch() {
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({
    deceased_name: "",
    deceased_dob: "",
    deceased_dod: "",
    deceased_last_address: "",
    deceased_ssn: "",
    death_location: "",
    case_reference: "",
    client_email: "",
  });
  const [spreadsheetUrl, setSpreadsheetUrl] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [trackingSheetUrl, setTrackingSheetUrl] = useState("");
  const [searchingSection, setSearchingSection] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [showAllCases, setShowAllCases] = useState(false);

  useEffect(() => { loadHistory(); loadTrackingSheet(); }, []);

  useEffect(() => {
    const caseId = searchParams.get("case");
    if (!caseId) return;
    (async () => {
      try {
        const hs = await base44.entities.HeirSearch.get(caseId);
        if (hs) setResult(hs);
      } catch (err) {
        console.error("Failed to load case:", err);
      }
    })();
  }, [searchParams]);

  const loadTrackingSheet = async () => {
    try {
      const res = await base44.functions.invoke("getHeirTrackingSheetUrl", {});
      const data = res.data || res;
      if (data.url) setTrackingSheetUrl(data.url);
    } catch (err) {
      console.error(err);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await base44.entities.HeirSearch.filter({}, { sort: "-created_date", limit: 50 });
      setHistory(res.items || res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSearch = async () => {
    if (!form.deceased_name) {
      setError("Enter a name to begin searching");
      return;
    }
    setSearching(true);
    setError(null);
    setResult(null);
    try {
      const response = await base44.functions.invoke("runHeirSearch", {
        ...form, deep_search: true, extreme_deep: true,
        spreadsheet_url: spreadsheetUrl || undefined,
      });
      const data = response.data || response;
      if (data.error) setError(data.error);
      else { setResult(data); loadHistory(); }
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setSearching(false);
    }
  };

  const handleDeleteSection = async (sectionKey) => {
    if (!result?.id) return;
    try {
      await base44.entities.HeirSearch.update(result.id, { [sectionKey]: null });
      setResult({ ...result, [sectionKey]: null });
    } catch (e) {
      console.error("Delete section failed:", e);
    }
  };

  const handleDeepSearchSection = async (sectionKey) => {
    if (!result?.id) return;
    setSearchingSection(sectionKey);
    try {
      const response = await base44.functions.invoke("deepSearchSection", {
        heir_search_id: result.id, section: sectionKey,
      });
      const data = response.data || response;
      if (data.ok && data.data) setResult({ ...result, [sectionKey]: data.data });
    } catch (e) {
      console.error("Deep search section failed:", e);
    } finally {
      setSearchingSection(null);
    }
  };

  const handleDeleteCase = async (id, e) => {
    e.stopPropagation();
    setDeletingId(id);
    try {
      await base44.entities.HeirSearch.delete(id);
      setHistory(history.filter(h => h.id !== id));
      if (result?.id === id) setResult(null);
    } catch (err) {
      console.error("Delete case failed:", err);
    } finally {
      setDeletingId(null);
    }
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
          <p className="text-sm text-slate-500 mt-0.5">Search for a deceased person to find and locate their heirs</p>
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
            <a href="/heir-search-dashboard">
              <Database className="w-3.5 h-3.5 mr-1.5" />Dashboard
            </a>
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="max-w-2xl mx-auto py-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            autoFocus
            placeholder="Search for a deceased person by name..."
            value={form.deceased_name}
            onChange={e => setForm({ ...form, deceased_name: e.target.value })}
            onKeyDown={e => { if (e.key === "Enter") handleSearch(); }}
            className="pl-12 h-12 text-base rounded-full border-slate-300 bg-white shadow-sm focus:border-[#0a1f3c] focus:ring-2 focus:ring-[#c9a961]/20"
          />
        </div>
        <div className="flex items-center justify-center gap-3 mt-4">
          <Button onClick={handleSearch} disabled={searching}
            className="rounded-full px-6 bg-[#0a1f3c] hover:bg-[#1a3a5c] text-white border-0">
            {searching
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Searching...</>
              : <><Search className="w-4 h-4 mr-2" />Search</>}
          </Button>
          <Button variant="ghost" onClick={() => setShowAdvanced(!showAdvanced)}
            className="rounded-full text-slate-600 hover:bg-slate-100">
            <SlidersHorizontal className="w-4 h-4 mr-1.5" />
            Advanced
            {showAdvanced ? <ChevronDown className="w-3.5 h-3.5 ml-1" /> : <ChevronRight className="w-3.5 h-3.5 ml-1" />}
          </Button>
        </div>
        <p className="text-xs text-slate-400 text-center mt-3">
          Runs an extreme deep search across 30+ source categories. Click any name or address in results to search deeper.
        </p>

        {showAdvanced && (
          <div className="mt-6 p-5 rounded-xl border border-slate-200 bg-slate-50 space-y-4">
            <TemplateSelector
              currentSettings={{ deep_search: true, extreme_deep: true, spreadsheet_url: spreadsheetUrl }}
              onApplyTemplate={(t) => {
                if (t.spreadsheet_url !== undefined) setSpreadsheetUrl(t.spreadsheet_url);
                if (t.death_location !== undefined) setForm(f => ({ ...f, death_location: t.death_location }));
                if (t.case_reference !== undefined) setForm(f => ({ ...f, case_reference: t.case_reference }));
              }}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-slate-700 text-xs">Date of Birth</Label>
                <Input type="date" value={form.deceased_dob} onChange={e => setForm({ ...form, deceased_dob: e.target.value })}
                  className="bg-white border-slate-300" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-700 text-xs">Date of Death</Label>
                <Input type="date" value={form.deceased_dod} onChange={e => setForm({ ...form, deceased_dod: e.target.value })}
                  className="bg-white border-slate-300" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-700 text-xs"><MapPin className="w-3 h-3 inline mr-1" />Last Known Address</Label>
                <Input placeholder="123 Main St, Springfield, IL" value={form.deceased_last_address}
                  onChange={e => setForm({ ...form, deceased_last_address: e.target.value })} className="bg-white border-slate-300" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-700 text-xs">Death Location</Label>
                <Input placeholder="Sangamon County, IL" value={form.death_location}
                  onChange={e => setForm({ ...form, death_location: e.target.value })} className="bg-white border-slate-300" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-700 text-xs">SSN (last 4)</Label>
                <Input placeholder="1234" maxLength={4} value={form.deceased_ssn}
                  onChange={e => setForm({ ...form, deceased_ssn: e.target.value })} className="bg-white border-slate-300" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-700 text-xs"><FileText className="w-3 h-3 inline mr-1" />Case Reference</Label>
                <Input placeholder="ACT-2026-001" value={form.case_reference}
                  onChange={e => setForm({ ...form, case_reference: e.target.value })} className="bg-white border-slate-300" />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-slate-700 text-xs"><Mail className="w-3 h-3 inline mr-1" />Client Email</Label>
                <Input type="email" placeholder="client@example.com" value={form.client_email}
                  onChange={e => setForm({ ...form, client_email: e.target.value })} className="bg-white border-slate-300" />
              </div>
            </div>
            <div className="space-y-1.5 p-3 rounded-lg border border-slate-200 bg-white">
              <Label className="flex items-center gap-1 text-slate-700 text-xs font-medium">
                <Database className="w-3.5 h-3.5 text-[#0a1f3c]" />Google Sheet — Auto-Export
              </Label>
              <Input placeholder="Paste Google Sheets URL" value={spreadsheetUrl}
                onChange={e => setSpreadsheetUrl(e.target.value)} className="bg-white border-slate-300" />
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="max-w-2xl mx-auto p-4 rounded-xl border border-red-200 bg-red-50 flex items-start gap-3 text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-sm">Search Error</p>
            <p className="text-xs">{error}</p>
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="mt-6">
          <HeirSearchResults
            result={result}
            setResult={setResult}
            deepSearch={true}
            searchingSection={searchingSection}
            onDeleteSection={handleDeleteSection}
            onDeepSearchSection={handleDeepSearchSection}
          />
        </div>
      )}

      {/* Recent Cases — only when no result */}
      {!result && !searching && (
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
                <div key={hs.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => { setResult(hs); }}>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-slate-900 truncate">{hs.deceased_name}</p>
                    <p className="text-xs text-slate-400">
                      {hs.deceased_dod || "DOD unknown"} — {hs.identified_heirs?.length || 0} heirs
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <Badge className={hs.status === "found" ? "bg-green-100 text-green-700 border border-green-200" : "bg-slate-100 text-slate-600 border border-slate-200"}>
                      {hs.status}
                    </Badge>
                    <span className="text-xs font-medium text-slate-600">{hs.confidence_score}%</span>
                    <button onClick={(e) => handleDeleteCase(hs.id, e)} disabled={deletingId === hs.id}
                      title="Delete"
                      className="flex items-center justify-center w-6 h-6 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
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
              <button onClick={() => setShowAllCases(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-2">
              {history.map((hs) => (
                <div key={hs.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
                  onClick={() => { setResult(hs); setShowAllCases(false); }}>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-slate-900 truncate">{hs.deceased_name}</p>
                    <p className="text-xs text-slate-400">
                      {hs.deceased_dod || "DOD unknown"} — {hs.identified_heirs?.length || 0} heirs
                      {hs.case_reference ? ` — ${hs.case_reference}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <Badge className={hs.status === "found" ? "bg-green-100 text-green-700 border border-green-200" : "bg-slate-100 text-slate-600 border border-slate-200"}>
                      {hs.status}
                    </Badge>
                    <span className="text-xs font-medium text-slate-600">{hs.confidence_score}%</span>
                    <button onClick={(e) => handleDeleteCase(hs.id, e)} disabled={deletingId === hs.id}
                      className="flex items-center justify-center w-6 h-6 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50">
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