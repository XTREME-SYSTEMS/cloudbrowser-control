import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { HEIR_SEARCH_CATALOG } from "@/lib/searchSourceCatalog";
import {
  Users, Search, AlertCircle, Database, Loader2, FileText, MapPin, Mail,
  UserX, Zap, ChevronDown, ChevronRight, ExternalLink, X,
} from "lucide-react";
import TemplateSelector from "@/components/heir-search/TemplateSelector";
import HeirSearchResults from "@/components/heir-search/HeirSearchResults";
import { downloadHeirPDF } from "@/lib/heirPDF";

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
  const [deepSearch, setDeepSearch] = useState(true);
  const [extremeDeep, setExtremeDeep] = useState(false);
  const [showSources, setShowSources] = useState(false);
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
      setError("Enter the deceased person's name to begin");
      return;
    }
    setSearching(true);
    setError(null);
    setResult(null);
    try {
      const response = await base44.functions.invoke("runHeirSearch", { ...form, deep_search: deepSearch, extreme_deep: extremeDeep, spreadsheet_url: spreadsheetUrl || undefined });
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
            Identify and locate heirs of a deceased person. The engine confirms the death via SSDI and obituaries,
            builds the family tree from genealogy databases, searches probate court records, identifies all potential
            heirs by inheritance priority, and skip traces each living heir for contact information.
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
                Open Tracking Sheet
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
          <Card>
            <CardHeader>
              <CardTitle>Deceased Person Information</CardTitle>
              <CardDescription>
                Enter the deceased person's details. At minimum a name is required — the more you provide, the
                more accurate the heir identification will be.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <TemplateSelector
                currentSettings={{ deep_search: deepSearch, extreme_deep: extremeDeep, spreadsheet_url: spreadsheetUrl }}
                onApplyTemplate={(t) => {
                  if (t.deep_search !== undefined) setDeepSearch(t.deep_search);
                  if (t.extreme_deep !== undefined) setExtremeDeep(t.extreme_deep);
                  if (t.spreadsheet_url !== undefined) setSpreadsheetUrl(t.spreadsheet_url);
                  if (t.death_location !== undefined) setForm(f => ({ ...f, death_location: t.death_location }));
                  if (t.case_reference !== undefined) setForm(f => ({ ...f, case_reference: t.case_reference }));
                }}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label><UserX className="w-4 h-4 inline mr-1" />Deceased Person's Full Name *</Label>
                  <Input placeholder="John Michael Smith" value={form.deceased_name}
                    onChange={e => setForm({ ...form, deceased_name: e.target.value })} />
                </div>
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
                  <p className="text-xs text-muted-foreground">Assign this case to a client so they can view results from the Heir Search Portal.</p>
                </div>
              </div>

              {/* Google Sheets Auto-Export */}
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
                  When heirs are found, each one is automatically appended as a new row to the "Heirs" tab
                  with name, relationship, phones, emails, address, and confidence. Leave blank to skip export.
                </p>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div>
                  <Label className="cursor-pointer font-medium">Deep Search Mode</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Exhausts all {HEIR_SEARCH_CATALOG.length} source categories ({HEIR_SEARCH_CATALOG.reduce((n, c) => n + c.sources.length, 0)}+ data sources) —
                    DNA databases, historical records, vital records, international, government registries, unclaimed property,
                    cemetery/coroner, immigration, patents/WHOIS, international genealogy, missing persons, professional associations,
                    and breach verification.
                  </p>
                </div>
                <Switch checked={deepSearch} onCheckedChange={setDeepSearch} />
              </div>

              {deepSearch && (
                <div className="flex items-center justify-between p-3 rounded-lg border bg-primary/5">
                  <div>
                    <Label className="cursor-pointer font-medium flex items-center gap-1">
                      <Zap className="w-4 h-4 text-primary" />
                      Extreme Deep Mode
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Adds 10 more categories: UCC/SEC litigation, FEC/lobbyist records, username correlation,
                      domain/web archive history, SMTP/phone verification, crypto assets, deed chain-of-title,
                      regulatory permits, social graph, and business network analysis.
                    </p>
                  </div>
                  <Switch checked={extremeDeep} onCheckedChange={setExtremeDeep} />
                </div>
              )}

              <button
                onClick={() => setShowSources(!showSources)}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {showSources ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                View all {HEIR_SEARCH_CATALOG.length} source categories
              </button>

              {showSources && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3 rounded-lg border bg-muted/20">
                  {HEIR_SEARCH_CATALOG.map(cat => (
                    <div key={cat.id} className="p-2 rounded-md border bg-background">
                      <p className="text-xs font-semibold flex items-center gap-1">
                        <Database className="w-3 h-3 text-primary" />
                        {cat.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{cat.description}</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-1">{cat.sources.length} sources</p>
                    </div>
                  ))}
                </div>
              )}

              <Button onClick={handleSearch} disabled={searching} className="w-full">
                {searching
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Searching {deepSearch ? `all ${HEIR_SEARCH_CATALOG.length} source categories` : "core sources"}...</>
                  : <><Users className="w-4 h-4 mr-2" />Run {deepSearch ? "Deep" : "Standard"} Heir Search</>}
              </Button>
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
              deepSearch={deepSearch}
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
                <p className="text-center py-8 text-muted-foreground">No heir searches yet. Run your first search in the New Search tab.</p>
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