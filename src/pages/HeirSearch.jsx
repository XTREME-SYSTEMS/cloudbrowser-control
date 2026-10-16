import { useState, useEffect } from "react";
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
  Users, Phone, Mail, MapPin, Search, AlertCircle, CheckCircle, Clock,
  Database, Loader2, FileText, GitBranch, Gavel, UserX, UserCheck, Crown,
  Dna, Globe2, Landmark, Newspaper, ChevronDown, ChevronRight,
} from "lucide-react";

export default function HeirSearch() {
  const [form, setForm] = useState({
    deceased_name: "",
    deceased_dob: "",
    deceased_dod: "",
    deceased_last_address: "",
    deceased_ssn: "",
    death_location: "",
    case_reference: "",
  });
  const [deepSearch, setDeepSearch] = useState(true);
  const [showSources, setShowSources] = useState(false);
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => { loadHistory(); }, []);

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
      const response = await base44.functions.invoke("runHeirSearch", { ...form, deep_search: deepSearch });
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

  const ConfidenceBar = ({ score }) => (
    <div className="flex items-center gap-2 w-32">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-gold-gradient rounded-full" style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-medium text-muted-foreground w-8 text-right">{score}%</span>
    </div>
  );

  const priorityColor = (p) =>
    p === "primary" ? "text-blue-600" : p === "secondary" ? "text-purple-600" : "text-gray-500";

  return (
    <div className="space-y-6">
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
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div>
                  <Label className="cursor-pointer font-medium">Deep Search Mode</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Exhausts all 12 source categories ({HEIR_SEARCH_CATALOG.reduce((n, c) => n + c.sources.length, 0)}+ data sources) —
                    DNA databases, historical records, vital records, international, government registries, and more.
                  </p>
                </div>
                <Switch checked={deepSearch} onCheckedChange={setDeepSearch} />
              </div>

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
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Searching {deepSearch ? "all 12 source categories" : "core sources"}...</>
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
            <div className="space-y-4">
              {/* Summary */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {result.status === "found" ? <CheckCircle className="w-5 h-5 text-green-500" />
                         : result.status === "partial" ? <AlertCircle className="w-5 h-5 text-yellow-500" />
                         : <AlertCircle className="w-5 h-5 text-red-500" />}
                        Heir Search Results
                      </CardTitle>
                      <CardDescription>
                        {result.deceased_confirmed ? "Deceased identity confirmed" : "Deceased identity unconfirmed"}
                        {" — "}{result.living_heir_count} living heirs found — Confidence: {result.confidence_score}%
                      </CardDescription>
                    </div>
                    <Badge variant={result.status === "found" ? "default" : "secondary"}>
                      {result.status.toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>
              </Card>

              {/* Deceased Details */}
              {result.deceased_details && Object.keys(result.deceased_details).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base"><UserX className="w-4 h-4" />Deceased Person Confirmation</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div><span className="text-muted-foreground">Full Name:</span> {result.deceased_details.full_name || "—"}</div>
                      <div><span className="text-muted-foreground">Born:</span> {result.deceased_details.birth_date || "—"}</div>
                      <div><span className="text-muted-foreground">Died:</span> {result.deceased_details.death_date || "—"}</div>
                      <div><span className="text-muted-foreground">Last Residence:</span> {result.deceased_details.last_residence || "—"}</div>
                      <div><span className="text-muted-foreground">Funeral Home:</span> {result.deceased_details.funeral_home || "—"}</div>
                      <div><span className="text-muted-foreground">SSN Issued:</span> {result.deceased_details.ssn_state_issued || "—"}</div>
                    </div>
                    {result.deceased_details.obituary_text && (
                      <div className="mt-3 p-3 rounded-md bg-muted/50">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Obituary Excerpt:</p>
                        <p className="text-sm">{result.deceased_details.obituary_text.substring(0, 500)}...</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Family Tree */}
              {result.family_tree && Object.keys(result.family_tree).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base"><GitBranch className="w-4 h-4" />Family Tree</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {result.family_tree.spouse && (
                        <div className="p-2 rounded-md bg-muted/50">
                          <p className="text-xs font-medium text-muted-foreground">Spouse</p>
                          <p className="text-sm">{result.family_tree.spouse}</p>
                        </div>
                      )}
                      {result.family_tree.ex_spouses?.length > 0 && (
                        <div className="p-2 rounded-md bg-muted/50">
                          <p className="text-xs font-medium text-muted-foreground">Ex-Spouse(s)</p>
                          <p className="text-sm">{result.family_tree.ex_spouses.join(", ")}</p>
                        </div>
                      )}
                      {result.family_tree.children?.length > 0 && (
                        <div className="p-2 rounded-md bg-muted/50">
                          <p className="text-xs font-medium text-muted-foreground">Children</p>
                          <p className="text-sm">{result.family_tree.children.join(", ")}</p>
                        </div>
                      )}
                      {result.family_tree.parents?.length > 0 && (
                        <div className="p-2 rounded-md bg-muted/50">
                          <p className="text-xs font-medium text-muted-foreground">Parents</p>
                          <p className="text-sm">{result.family_tree.parents.join(", ")}</p>
                        </div>
                      )}
                      {result.family_tree.siblings?.length > 0 && (
                        <div className="p-2 rounded-md bg-muted/50">
                          <p className="text-xs font-medium text-muted-foreground">Siblings</p>
                          <p className="text-sm">{result.family_tree.siblings.join(", ")}</p>
                        </div>
                      )}
                      {result.family_tree.grandchildren?.length > 0 && (
                        <div className="p-2 rounded-md bg-muted/50">
                          <p className="text-xs font-medium text-muted-foreground">Grandchildren</p>
                          <p className="text-sm">{result.family_tree.grandchildren.join(", ")}</p>
                        </div>
                      )}
                      {result.family_tree.nieces_nephews?.length > 0 && (
                        <div className="p-2 rounded-md bg-muted/50">
                          <p className="text-xs font-medium text-muted-foreground">Nieces & Nephews</p>
                          <p className="text-sm">{result.family_tree.nieces_nephews.join(", ")}</p>
                        </div>
                      )}
                      {result.family_tree.cousins?.length > 0 && (
                        <div className="p-2 rounded-md bg-muted/50">
                          <p className="text-xs font-medium text-muted-foreground">Cousins</p>
                          <p className="text-sm">{result.family_tree.cousins.join(", ")}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Probate Info */}
              {result.probate_info && Object.keys(result.probate_info).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base"><Gavel className="w-4 h-4" />Probate Court Records</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div><span className="text-muted-foreground">Court County:</span> {result.probate_info.court_county || "—"}</div>
                      <div><span className="text-muted-foreground">Case Number:</span> {result.probate_info.case_number || "Not found"}</div>
                      <div><span className="text-muted-foreground">Executor:</span> {result.probate_info.executor_name || "—"}</div>
                      <div><span className="text-muted-foreground">Attorney:</span> {result.probate_info.attorney_name || "—"}</div>
                      <div><span className="text-muted-foreground">Filing Date:</span> {result.probate_info.filing_date || "—"}</div>
                      <div><span className="text-muted-foreground">Estate Value:</span> {result.probate_info.estate_value || "—"}</div>
                      <div><span className="text-muted-foreground">Will Found:</span> {result.probate_info.will_found ? "Yes" : "No / Unknown"}</div>
                    </div>
                    {result.probate_info.will_details && (
                      <div className="mt-2 p-2 rounded-md bg-muted/50">
                        <p className="text-xs">{result.probate_info.will_details}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Deep Search: Historical Records */}
              {result.historical && Object.keys(result.historical).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base"><Newspaper className="w-4 h-4" />Historical Records</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {result.historical.census_household_members?.length > 0 && (
                      <div><span className="text-muted-foreground">Census Household:</span> {result.historical.census_household_members.map(m => `${m.name} (${m.relationship}, ${m.year})`).join(", ")}</div>
                    )}
                    {result.historical.draft_cards?.length > 0 && (
                      <div><span className="text-muted-foreground">Draft Cards:</span> {result.historical.draft_cards.map(d => `${d.name} — Next of kin: ${d.next_of_kin}`).join("; ")}</div>
                    )}
                    {result.historical.immigration_records?.length > 0 && (
                      <div><span className="text-muted-foreground">Immigration:</span> {result.historical.immigration_records.map(i => `${i.name} arrived ${i.arrival_date} at ${i.port}`).join("; ")}</div>
                    )}
                    {result.historical.additional_relatives_found?.length > 0 && (
                      <div><span className="text-muted-foreground">Additional Relatives:</span> {result.historical.additional_relatives_found.map(r => `${r.name} (${r.relationship})`).join(", ")}</div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Deep Search: Vital Records */}
              {result.vital && Object.keys(result.vital).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base"><FileText className="w-4 h-4" />Vital Records</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {result.vital.birth_record?.parents && (
                      <div><span className="text-muted-foreground">Birth — Parents:</span> {result.vital.birth_record.parents.join(", ")} {result.vital.birth_record.mothers_maiden_name ? `(mother's maiden: ${result.vital.birth_record.mothers_maiden_name})` : ""}</div>
                    )}
                    {result.vital.marriage_records?.length > 0 && (
                      <div><span className="text-muted-foreground">Marriages:</span> {result.vital.marriage_records.map(m => `${m.spouse} (${m.date})`).join("; ")}</div>
                    )}
                    {result.vital.divorce_records?.length > 0 && (
                      <div><span className="text-muted-foreground">Divorces:</span> {result.vital.divorce_records.map(d => `${d.ex_spouse} (${d.date})`).join("; ")}</div>
                    )}
                    {result.vital.additional_relatives?.length > 0 && (
                      <div><span className="text-muted-foreground">Additional from Vital:</span> {result.vital.additional_relatives.join(", ")}</div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Deep Search: DNA / Genetic Genealogy */}
              {result.dna && Object.keys(result.dna).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base"><Dna className="w-4 h-4" />DNA / Genetic Genealogy</CardTitle>
                    <CardDescription>For identifying unknown or missing heirs through genetic matches</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div><span className="text-muted-foreground">Unknown Heirs Likely:</span> {result.dna.unknown_heirs_likely ? "Yes" : "No"}</div>
                    {result.dna.dna_matches_found?.length > 0 && (
                      <div><span className="text-muted-foreground">DNA Matches:</span> {result.dna.dna_matches_found.map(m => `${m.match_name} (${m.relationship_estimate}, ${m.shared_cm}cM)`).join(", ")}</div>
                    )}
                    {result.dna.recommended_dna_strategy && (
                      <div className="p-2 rounded-md bg-muted/50"><span className="text-xs font-medium">Strategy:</span> <span className="text-xs">{result.dna.recommended_dna_strategy}</span></div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Deep Search: Property & Financial */}
              {result.property_financial && Object.keys(result.property_financial).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base"><Landmark className="w-4 h-4" />Property & Financial</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {result.property_financial.properties_owned?.length > 0 && (
                      <div><span className="text-muted-foreground">Properties:</span> {result.property_financial.properties_owned.map(p => `${p.address} (${p.value})`).join("; ")}</div>
                    )}
                    {result.property_financial.business_ownership?.length > 0 && (
                      <div><span className="text-muted-foreground">Businesses:</span> {result.property_financial.business_ownership.map(b => `${b.business_name} (${b.role})`).join("; ")}</div>
                    )}
                    {result.property_financial.estimated_estate_value && (
                      <div><span className="text-muted-foreground">Est. Estate Value:</span> {result.property_financial.estimated_estate_value}</div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Deep Search: International */}
              {result.international && Object.keys(result.international).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base"><Globe2 className="w-4 h-4" />International Records</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {result.international.international_heirs_found?.length > 0 && (
                      <div><span className="text-muted-foreground">International Heirs:</span> {result.international.international_heirs_found.map(h => `${h.name} (${h.relationship}, ${h.country})`).join(", ")}</div>
                    )}
                    {result.international.emigration_records?.length > 0 && (
                      <div><span className="text-muted-foreground">Emigration:</span> {result.international.emigration_records.join(", ")}</div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Identified Heirs */}
              {result.identified_heirs?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base"><Crown className="w-4 h-4" />Identified Heirs ({result.identified_heirs.length})</CardTitle>
                    <CardDescription>Each heir traced for contact information — sorted by inheritance priority</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[...result.identified_heirs]
                      .sort((a, b) => a.relationship_degree - b.relationship_degree)
                      .map((heir, i) => (
                      <div key={i} className="p-3 rounded-lg border space-y-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            {heir.is_living ? <UserCheck className="w-4 h-4 text-green-500" /> : <UserX className="w-4 h-4 text-red-500" />}
                            <span className="font-medium">{heir.name}</span>
                            <Badge variant="outline" className={priorityColor(heir.inheritance_priority)}>
                              {heir.relationship}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {heir.inheritance_priority} heir
                            </Badge>
                          </div>
                          <ConfidenceBar score={heir.confidence || 0} />
                        </div>
                        {!heir.is_living && (
                          <p className="text-xs text-red-500">Likely deceased — descendants may inherit by representation</p>
                        )}
                        {heir.phone_numbers?.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {heir.phone_numbers.map((p, j) => (
                              <Badge key={j} variant="outline" className="text-xs">
                                <Phone className="w-3 h-3 mr-1" />{p.number}
                                <span className="text-muted-foreground ml-1">({p.confidence}%)</span>
                              </Badge>
                            ))}
                          </div>
                        )}
                        {heir.emails?.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {heir.emails.map((e, j) => (
                              <Badge key={j} variant="outline" className="text-xs">
                                <Mail className="w-3 h-3 mr-1" />{e.email}
                                <span className="text-muted-foreground ml-1">({e.confidence}%)</span>
                              </Badge>
                            ))}
                          </div>
                        )}
                        {heir.address && (
                          <p className="text-xs text-muted-foreground"><MapPin className="w-3 h-3 inline mr-1" />{heir.address}</p>
                        )}
                        {heir.notes && (
                          <p className="text-xs text-muted-foreground italic">{heir.notes}</p>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Meta */}
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Database className="w-4 h-4" />{result.sources?.length || 0} sources</span>
                <span className="flex items-center gap-1"><Search className="w-4 h-4" />{result.methods?.length || 0} methods</span>
                <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{(result.duration_ms / 1000).toFixed(1)}s</span>
              </div>
            </div>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Heir Search Cases</CardTitle>
              <CardDescription>All heir search operations — click to view full results</CardDescription>
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