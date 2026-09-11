import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Radar, Phone, Mail, MapPin, Users, Search, AlertCircle, CheckCircle, Clock, Database, Loader2, Building, User, Globe, LayoutDashboard } from "lucide-react";
import SkipTracingDashboard from "@/components/skip-tracing/SkipTracingDashboard";

export default function SkipTracing() {
  const [form, setForm] = useState({ property_address: "", owner_name: "", phone: "", email: "", company: "" });
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => { loadHistory(); }, []);

  const loadHistory = async () => {
    try {
      const traces = await base44.entities.SkipTrace.list("-created_date", 50);
      setHistory(traces);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSearch = async () => {
    if (!form.property_address && !form.owner_name && !form.phone && !form.email) {
      setError("Enter at least one search field to begin tracing");
      return;
    }
    setSearching(true);
    setError(null);
    setResult(null);
    try {
      const response = await base44.functions.invoke("runSkipTrace", form);
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

  const statusColor = (status) =>
    status === "found" ? "text-green-500" : status === "partial" ? "text-yellow-500" : "text-red-500";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-heading font-semibold flex items-center gap-2">
          <Radar className="w-6 h-6 text-primary" />
          Skip Tracing
        </h1>
        <p className="text-muted-foreground mt-1 max-w-3xl">
          Identify property owners and find their contact info using every available source — property records,
          people search, reverse phone, social media, email directories, relatives, and business records. The
          engine runs 7 search methods in sequence, cross-references results, and confidence-scores every finding.
        </p>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard"><LayoutDashboard className="w-4 h-4 mr-1" />Dashboard</TabsTrigger>
          <TabsTrigger value="search"><Search className="w-4 h-4 mr-1" />Search</TabsTrigger>
          <TabsTrigger value="history"><Database className="w-4 h-4 mr-1" />History ({history.length})</TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard">
          <SkipTracingDashboard traces={history} loading={loadingHistory} onRefresh={loadHistory} />
        </TabsContent>

        {/* Search Tab */}
        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Start a New Trace</CardTitle>
              <CardDescription>
                Enter any information you have. The system will identify the owner and exhaust every source to
                locate their contact info.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label><MapPin className="w-4 h-4 inline mr-1" />Property Address</Label>
                  <Input placeholder="123 Main St, Anytown, ST 12345" value={form.property_address}
                    onChange={e => setForm({ ...form, property_address: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label><User className="w-4 h-4 inline mr-1" />Owner Name (if known)</Label>
                  <Input placeholder="John Smith" value={form.owner_name}
                    onChange={e => setForm({ ...form, owner_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label><Phone className="w-4 h-4 inline mr-1" />Phone (if known)</Label>
                  <Input placeholder="555-123-4567" value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label><Mail className="w-4 h-4 inline mr-1" />Email (if known)</Label>
                  <Input placeholder="john@example.com" value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label><Building className="w-4 h-4 inline mr-1" />Company (if known)</Label>
                  <Input placeholder="ABC Construction LLC" value={form.company}
                    onChange={e => setForm({ ...form, company: e.target.value })} />
                </div>
              </div>
              <Button onClick={handleSearch} disabled={searching} className="w-full">
                {searching
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Searching all sources — 7 methods in progress...</>
                  : <><Radar className="w-4 h-4 mr-2" />Run Full Skip Trace</>}
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
                  {error.includes("credit") && (
                    <p className="text-sm mt-2 text-muted-foreground">
                      Integration credits reset on 2026-09-12. Upgrade your plan for immediate access.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {result && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {result.status === "found" ? <CheckCircle className="w-5 h-5 text-green-500" />
                       : result.status === "partial" ? <AlertCircle className="w-5 h-5 text-yellow-500" />
                       : <AlertCircle className="w-5 h-5 text-red-500" />}
                      Trace Results
                    </CardTitle>
                    <CardDescription>
                      {result.found_owner_name ? `Owner: ${result.found_owner_name}` : "Owner not identified"}
                      {" — "}Confidence: {result.confidence_score}%
                    </CardDescription>
                  </div>
                  <Badge variant={result.status === "found" ? "default" : "secondary"}>
                    {result.status.toUpperCase()}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Phone Numbers */}
                {result.phone_numbers?.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-2 flex items-center gap-2"><Phone className="w-4 h-4" />Phone Numbers ({result.phone_numbers.length})</h3>
                    <div className="space-y-2">
                      {result.phone_numbers.map((p, i) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                          <div className="flex items-center gap-2">
                            <span className="font-mono">{p.number}</span>
                            {p.type && <Badge variant="outline">{p.type}</Badge>}
                            {p.source && <span className="text-xs text-muted-foreground">via {p.source}</span>}
                          </div>
                          <ConfidenceBar score={p.confidence || 0} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Emails */}
                {result.emails?.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-2 flex items-center gap-2"><Mail className="w-4 h-4" />Email Addresses ({result.emails.length})</h3>
                    <div className="space-y-2">
                      {result.emails.map((e, i) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                          <div className="flex items-center gap-2">
                            <span className="font-mono">{e.email}</span>
                            {e.verified && <Badge variant="outline" className="text-green-600 border-green-600">Verified</Badge>}
                            {e.source && <span className="text-xs text-muted-foreground">via {e.source}</span>}
                          </div>
                          <ConfidenceBar score={e.confidence || 0} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Addresses */}
                {result.addresses?.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-2 flex items-center gap-2"><MapPin className="w-4 h-4" />Addresses ({result.addresses.length})</h3>
                    <div className="space-y-2">
                      {result.addresses.map((a, i) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                          <div className="flex items-center gap-2">
                            <span>{a.address}</span>
                            {a.type && <Badge variant="outline">{a.type}</Badge>}
                          </div>
                          <ConfidenceBar score={a.confidence || 0} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Social Profiles */}
                {result.social_profiles?.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-2 flex items-center gap-2"><Globe className="w-4 h-4" />Social Profiles ({result.social_profiles.length})</h3>
                    <div className="flex flex-wrap gap-2">
                      {result.social_profiles.map((s, i) => (
                        <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 p-2 rounded-md bg-muted/50 hover:bg-muted">
                          <Badge variant="outline">{s.platform}</Badge>
                          {s.bio && <span className="text-xs text-muted-foreground max-w-40 truncate">{s.bio}</span>}
                          <span className="text-xs text-muted-foreground">{s.confidence}%</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Relatives */}
                {result.relatives?.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-2 flex items-center gap-2"><Users className="w-4 h-4" />Relatives & Associates ({result.relatives.length})</h3>
                    <div className="flex flex-wrap gap-2">
                      {result.relatives.map((r, i) => (
                        <Badge key={i} variant="secondary">
                          {r.name}{r.relationship ? ` (${r.relationship})` : ""}
                          {r.phone && ` — ${r.phone}`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Meta */}
                <div className="flex flex-wrap gap-4 pt-4 border-t text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><Database className="w-4 h-4" />{result.sources?.length || 0} sources checked</span>
                  <span className="flex items-center gap-1"><Search className="w-4 h-4" />{result.methods?.length || 0} methods used</span>
                  <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{(result.duration_ms / 1000).toFixed(1)}s</span>
                </div>

                {/* Sources breakdown */}
                {result.sources?.length > 0 && (
                  <div className="pt-2">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Sources exhausted:</p>
                    <div className="flex flex-wrap gap-1">
                      {result.sources.map((s, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Trace History</CardTitle>
              <CardDescription>Recent skip trace operations — click to view full results</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted" /></div>
              ) : history.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No traces yet. Run your first skip trace in the Search tab.</p>
              ) : (
                <div className="space-y-2">
                  {history.map((trace) => (
                    <div key={trace.id} className="flex items-center justify-between p-3 rounded-md border hover:bg-muted/50 cursor-pointer"
                      onClick={() => { setResult(trace); }}>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">
                          {trace.target_property_address || trace.target_owner_name || trace.target_phone || trace.target_email || "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {trace.found_owner_name ? `Found: ${trace.found_owner_name}` : "Owner not found"}
                          {" — "}{trace.found_phone_numbers?.length || 0} phones
                          {" — "}{trace.found_emails?.length || 0} emails
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <Badge variant={trace.status === "found" ? "default" : trace.status === "partial" ? "secondary" : "outline"}>
                          {trace.status}
                        </Badge>
                        <span className={`text-sm font-medium ${statusColor(trace.status)}`}>{trace.confidence_score}%</span>
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