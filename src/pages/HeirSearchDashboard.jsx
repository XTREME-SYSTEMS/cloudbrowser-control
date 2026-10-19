import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Users, Search, Loader2, CheckCircle, AlertCircle, Clock, FileText, Mail, ExternalLink, Filter, Phone, MapPin, UserCheck, Target,
} from "lucide-react";
import { downloadHeirPDF } from "@/lib/heirPDF";
import BrandIngestion from "@/components/brand/BrandIngestion";
import VisualValidationPanel from "@/components/brand/VisualValidationPanel";
import BulkImport from "@/components/heir-search/BulkImport";

const STATUS_CONFIG = {
  pending: { label: "Pending", color: "secondary", icon: Clock },
  searching: { label: "Searching", color: "default", icon: Loader2 },
  found: { label: "Found", color: "default", icon: CheckCircle },
  partial: { label: "Partial", color: "secondary", icon: AlertCircle },
  failed: { label: "Failed", color: "destructive", icon: AlertCircle },
};

export default function HeirSearchDashboard() {
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [trackingSheetUrl, setTrackingSheetUrl] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.entities.HeirSearch.filter({}, { sort: "-created_date", limit: 100 });
      setCases(Array.isArray(res) ? res : res.items || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    base44.functions.invoke("getHeirTrackingSheetUrl", {}).then(res => {
      const data = res.data || res;
      if (data.url) setTrackingSheetUrl(data.url);
    }).catch(() => {});
  }, [load]);

  const filtered = cases.filter(c => {
    const matchesSearch = !searchTerm ||
      c.deceased_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.case_reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.client_email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: cases.length,
    searching: cases.filter(c => c.status === "searching" || c.status === "pending").length,
    found: cases.filter(c => c.status === "found").length,
    partial: cases.filter(c => c.status === "partial").length,
    failed: cases.filter(c => c.status === "failed").length,
    totalHeirs: cases.reduce((sum, c) => sum + (c.identified_heirs?.length || 0), 0),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#c9a961]" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c9a961]">Case Management</span>
          </div>
          <h1 className="font-serif text-2xl font-bold text-[#0a1f3c] flex items-center gap-2">
            <Users className="w-6 h-6 text-[#0a1f3c]" />
            Heir Search Dashboard
          </h1>
          <p className="text-muted-foreground mt-1 max-w-3xl">
            Overview of all active and completed heir search cases, research status, and discovered potential heirs.
          </p>
        </div>
        <div className="flex gap-2">
          {trackingSheetUrl && (
            <a href={trackingSheetUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline">
                <ExternalLink className="w-4 h-4 mr-2" />
                Tracking Sheet
              </Button>
            </a>
          )}
          <Button onClick={() => navigate("/heir-search")}>
            <Search className="w-4 h-4 mr-2" />
            New Search
          </Button>
        </div>
      </div>

      {/* Bulk Import — paste, normalize, and input into the system */}
      <BulkImport onDone={load} />

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={FileText} label="Total Cases" value={stats.total} color="text-primary" />
        <StatCard icon={Clock} label="Active" value={stats.searching} color="text-[#c9a961]" />
        <StatCard icon={CheckCircle} label="Found" value={stats.found} color="text-green-500" />
        <StatCard icon={AlertCircle} label="Partial" value={stats.partial} color="text-yellow-500" />
        <StatCard icon={AlertCircle} label="Failed" value={stats.failed} color="text-red-500" />
        <StatCard icon={Users} label="Total Heirs" value={stats.totalHeirs} color="text-[#0a1f3c]" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, case ref, or client email..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-md border border-border bg-background text-sm"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="searching">Searching</option>
          <option value="found">Found</option>
          <option value="partial">Partial</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Cases Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Filter className="w-4 h-4" />All Cases</CardTitle>
          <CardDescription>{filtered.length} case{filtered.length !== 1 ? "s" : ""} shown</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No cases found. Run a new heir search to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Case Ref</th>
                    <th className="pb-2 pr-4 font-medium">Deceased Name</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 pr-4 font-medium text-center">Heirs Found</th>
                    <th className="pb-2 pr-4 font-medium">Confidence</th>
                    <th className="pb-2 pr-4 font-medium">Client</th>
                    <th className="pb-2 pr-4 font-medium">Created</th>
                    <th className="pb-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => {
                    const sc = STATUS_CONFIG[c.status] || STATUS_CONFIG.pending;
                    const livingHeirs = (c.identified_heirs || []).filter(h => h.is_living !== false).length;
                    return (
                      <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="py-3 pr-4 font-mono text-xs">{c.case_reference || "—"}</td>
                        <td className="py-3 pr-4">
                          <button
                            onClick={() => navigate(`/heir-search?case=${c.id}`)}
                            className="font-medium text-left hover:text-primary transition-colors"
                          >
                            {c.deceased_name}
                          </button>
                        </td>
                        <td className="py-3 pr-4">
                          <Badge variant={sc.color === "destructive" ? "destructive" : sc.color === "default" ? "default" : "secondary"}>
                            <sc.icon className={`w-3 h-3 mr-1 ${c.status === "searching" ? "animate-spin" : ""}`} />
                            {sc.label}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 text-center">
                          <span className="font-semibold text-primary">{c.identified_heirs?.length || 0}</span>
                          <span className="text-muted-foreground text-xs"> ({livingHeirs} living)</span>
                        </td>
                        <td className="py-3 pr-4">
                          {c.confidence_score > 0 ? (
                            <div className="flex items-center gap-2">
              <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-gold-gradient rounded-full" style={{ width: `${c.confidence_score}%` }} />
              </div>
                              <span className="text-xs text-muted-foreground">{c.confidence_score}%</span>
                            </div>
                          ) : "—"}
                        </td>
                        <td className="py-3 pr-4 text-xs text-muted-foreground">
                          {c.client_email ? (
                            <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{c.client_email}</span>
                          ) : <span className="text-muted-foreground/50">Unassigned</span>}
                        </td>
                        <td className="py-3 pr-4 text-xs text-muted-foreground">
                          {c.created_date ? new Date(c.created_date).toLocaleDateString() : "—"}
                        </td>
                        <td className="py-3">
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => navigate(`/heir-search?case=${c.id}`)}>
                              View
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => downloadHeirPDF(c)}>
                              PDF
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* People Being Searched — identified heirs across all cases */}
      <PeopleBeingSearched cases={cases} onTrace={navigate} />

      {/* Visual Validation & Brand Ingestion */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BrandIngestion />
        <VisualValidationPanel />
      </div>
    </div>
  );
}

function PeopleBeingSearched({ cases, onTrace }) {
  const [expandedCase, setExpandedCase] = useState(null);

  const allHeirs = cases
    .filter(c => c.identified_heirs && c.identified_heirs.length > 0)
    .flatMap(c => c.identified_heirs.map((h, i) => ({
      ...h,
      caseId: c.id,
      caseRef: c.case_reference || "—",
      deceasedName: c.deceased_name,
      heirIndex: i,
    })));

  const livingHeirs = allHeirs.filter(h => h.is_living !== false);
  const contactableHeirs = livingHeirs.filter(h =>
    (h.phone_numbers && h.phone_numbers.length > 0) ||
    (h.emails && h.emails.length > 0) ||
    h.address
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-primary" />
          People Being Searched
        </CardTitle>
        <CardDescription>
          {livingHeirs.length} living heirs identified across {cases.filter(c => c.identified_heirs?.length).length} cases
          {contactableHeirs.length > 0 && ` — ${contactableHeirs.length} with contact info`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {allHeirs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No heirs identified yet. Run a search to discover potential heirs.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto xa-scroll">
            {cases.filter(c => c.identified_heirs && c.identified_heirs.length > 0).map(c => {
              const isExpanded = expandedCase === c.id;
              const heirs = c.identified_heirs || [];
              const livingCount = heirs.filter(h => h.is_living !== false).length;
              return (
                <div key={c.id} className="rounded-lg border border-white/5 overflow-hidden">
                  <button
                    onClick={() => setExpandedCase(isExpanded ? null : c.id)}
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Users className="w-4 h-4 text-primary/70 shrink-0" />
                      <span className="font-medium text-sm truncate">{c.deceased_name}</span>
                      <Badge variant="outline" className="text-xs shrink-0">{heirs.length} heirs</Badge>
                      <span className="text-xs text-muted-foreground shrink-0">({livingCount} living)</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">{c.case_reference || ""}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); onTrace(`/heir-search?case=${c.id}`); }}
                        className="text-xs text-primary hover:underline"
                      >
                        Open
                      </button>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-white/5 divide-y divide-white/5">
                      {heirs.map((h, i) => {
                        const hasContact = (h.phone_numbers?.length > 0) || (h.emails?.length > 0) || h.address;
                        return (
                          <div key={i} className="px-3 py-2.5 flex items-start gap-3 hover:bg-muted/20 transition-colors">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-primary/10 border border-primary/20">
                              {h.is_living !== false ? <UserCheck className="w-3.5 h-3.5 text-green-500" /> : <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">{h.name}</span>
                                <Badge variant="outline" className="text-xs">{h.relationship}</Badge>
                                {h.inheritance_priority && (
                                  <Badge variant={h.inheritance_priority === "primary" ? "default" : "secondary"} className="text-xs">
                                    {h.inheritance_priority}
                                  </Badge>
                                )}
                                {h.confidence > 0 && (
                                  <span className="text-xs text-muted-foreground">{h.confidence}%</span>
                                )}
                              </div>
                              {hasContact ? (
                                <div className="mt-1 space-y-0.5">
                                  {h.phone_numbers?.length > 0 && (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Phone className="w-3 h-3" />
                                      {h.phone_numbers.map(p => p.number || p).join(", ")}
                                    </p>
                                  )}
                                  {h.emails?.length > 0 && (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Mail className="w-3 h-3" />
                                      {h.emails.map(e => e.email || e).join(", ")}
                                    </p>
                                  )}
                                  {h.address && (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                      <MapPin className="w-3 h-3" />
                                      {h.address}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground italic mt-0.5">No contact info — open case to trace</p>
                              )}
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); onTrace(`/heir-search?case=${c.id}`); }}
                              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/60 transition-all shrink-0"
                            >
                              <Target className="w-3 h-3" />
                              Trace
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
        <div className="text-2xl font-heading font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}