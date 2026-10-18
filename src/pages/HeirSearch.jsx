import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Users, Search, AlertCircle, Database, Loader2, FileText, MapPin, Mail,
  UserX, ChevronDown, ChevronRight, ExternalLink, X, SlidersHorizontal,
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
        ...form,
        deep_search: true,
        extreme_deep: true,
        spreadsheet_url: spreadsheetUrl || undefined,
      });
      const data = response.data || response;
      if (data.error) {
        setError(data.error);
      } else {
        setResult(data);
        loadHistory();
      }
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
        heir_search_id: result.id,
        section: sectionKey,
      });
      const data = response.data || response;
      if (data.ok && data.data) {
        setResult({ ...result, [sectionKey]: data.data });
      }
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
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-heading font-semibold flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Heir Search
          </h1>
          <p className="text-muted-foreground mt-1 max-w-3xl">
            Search for a deceased person by name to identify and locate their heirs.
            Every result is clickable — click any name or address to run a deep search on it.
          </p>
        </div>
        <div className="flex gap-2">
          <a href="/heir-search-dashboard">
            <Button variant="outline">
              <Database className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
          </a>
          {trackingSheetUrl && (
            <a href={trackingSheetUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline">
                <ExternalLink className="w-4 h-4 mr-2" />
                Tracking Sheet
              </Button>
            </a>
          )}
        </div>
      </div>

      <Tabs defaultValue="search">
        <TabsList>
          <TabsTrigger value="search"><Search className="w-4 h-4 mr-1" />New Search</TabsTrigger>
          <TabsTrigger value="history"><Database className="w-4 h-4 mr-1" />Cases ({history.length})</TabsTrigger>
        </TabsList>

        {/* Search Tab */}
        <TabsContent value="search" className="space-y-4">
          {/* Google-like Search Bar */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="w-full max-w-2xl">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      autoFocus
                      placeholder="Search for a deceased person by name..."
                      value={form.deceased_name}
                      onChange={e => setForm({ ...form, deceased_name: e.target.value })}
                      onKeyDown={e => { if (e.key === "Enter") handleSearch(); }}
                      className="pl-12 h-14 text-base rounded-full"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button onClick={handleSearch} disabled={searching} size="lg" className="rounded-full px-8">
                    {searching
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Searching all sources...</>
                      : <><Search className="w-4 h-4 mr-2" />Extreme Deep Search</>}
                  </Button>
                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="rounded-full"
                  >
                    <SlidersHorizontal className="w-4 h-4 mr-2" />
                    Advanced
                    {showAdvanced ? <ChevronDown className="w-4 h-4 ml-1" /> : <ChevronRight className="w-4 h-4 ml-1" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground text-center max-w-md">
                  Always runs extreme deep search across all 30+ source categories.
                  Click any name or address in results to search deeper.
                </p>
              </div>

              {showAdvanced && (
                <div className="mt-4 pt-4 border-t space-y-4">
                  <TemplateSelector
                    currentSettings={{ deep_search: true, extreme_deep: true, spreadsheet_url: spreadsheetUrl }}
                    onApplyTemplate={(t) => {
                      if (t.spreadsheet_url !== undefined) setSpreadsheetUrl(t.spreadsheet_url);
                      if (t.death_location !== undefined) setForm(f => ({ ...f, death_location: t.death_location }));
                      if (t.case_reference !== undefined) setForm(f => ({ ...f, case_reference: t.case_reference }));
                    }}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Date of Birth (if known)</Label>
                      <Input type="date" value={form.deceased_dob}
                        onChange={e => setForm({ ...form, deceased_dob: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Date of Death (if known)</Label>
                      <Input type="date" value={form.deceased_dod}
                        onChange={e => setForm({ ...form, deceased_dod: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label><MapPin className="w-4 h-4 inline mr-1" />Last Known Address</Label>
                      <Input placeholder="123 Main St, Springfield, IL 62701" value={form.deceased_last_address}
                        onChange={e => setForm({ ...form, deceased_last_address: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Death Location (city/county/state)</Label>
                      <Input placeholder="Sangamon County, IL" value={form.death_location}
                        onChange={e => setForm({ ...form, death_location: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>SSN (last 4 digits, if known)</Label>
                      <Input placeholder="1234" maxLength={4} value={form.deceased_ssn}
                        onChange={e => setForm({ ...form, deceased_ssn: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label><FileText className="w-4 h-4 inline mr-1" />Case / Account Reference</Label>
                      <Input placeholder="ACT-2026-001" value={form.case_reference}
                        onChange={e => setForm({ ...form, case_reference: e.target.value })} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label><Mail className="w-4 h-4 inline mr-1" />Client Email (assign to client portal)</Label>
                      <Input type="email" placeholder="client@example.com — leave blank to keep internal" value={form.client_email}
                        onChange={e => setForm({ ...form, client_email: e.target.value })} />
                    </div>
                  </div>

                  <div className="space-y-2 p-3 rounded-lg border bg-primary/5">
                    <Label className="flex items-center gap-1 font-medium">
                      <Database className="w-4 h-4 text-primary" />
                      Google Sheet — Auto-Export Heirs
                    </Label>
                    <Input
                      placeholder="Paste your Google Sheets URL (https://docs.google.com/spreadsheets/d/...)"
                      value={spreadsheetUrl}
                      onChange={e => setSpreadsheetUrl(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      When heirs are found, each one is appended as a row to the "Heirs" tab. Leave blank to skip.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {error && (
            <Card className="border-destructive">
              <CardContent className="pt-6 flex items-start gap-3 text-destructive">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Search Error</p>
                  <p className="text-sm">{error}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {result && (
            <HeirSearchResults
              result={result}
              setResult={setResult}
              deepSearch={true}
              searchingSection={searchingSection}
              onDeleteSection={handleDeleteSection}
              onDeepSearchSection={handleDeepSearchSection}
            />
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Heir Search Cases</CardTitle>
              <CardDescription>All heir search operations — click to view full results, click ✕ to delete failed cases</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted" /></div>
              ) : history.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No heir searches yet. Run your first search above.</p>
              ) : (
                <div className="space-y-2">
                  {history.map((hs) => (
                    <div key={hs.id} className="flex items-center justify-between p-3 rounded-md border hover:bg-muted/50 cursor-pointer"
                      onClick={() => { setResult(hs); }}>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{hs.deceased_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {hs.deceased_dod || "DOD unknown"}
                          {" — "}{hs.identified_heirs?.length || 0} heirs
                          {hs.case_reference ? ` — ${hs.case_reference}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <Badge variant={hs.status === "found" ? "default" : hs.status === "partial" ? "secondary" : "outline"}>
                          {hs.status}
                        </Badge>
                        <span className="text-sm font-medium">{hs.confidence_score}%</span>
                        <button
                          onClick={(e) => handleDeleteCase(hs.id, e)}
                          disabled={deletingId === hs.id}
                          title="Delete this case"
                          className="flex items-center justify-center w-7 h-7 rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive/60 transition-all disabled:opacity-40"
                        >
                          {deletingId === hs.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}