import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  Users, Loader2, CheckCircle, AlertCircle, Clock, Mail, Phone, MapPin,
  Crown, UserCheck, UserX, FileText, Gavel, TrendingUp, Shield,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const STATUS_CONFIG = {
  pending: { label: "Pending", color: "secondary", icon: Clock },
  searching: { label: "In Progress", color: "default", icon: Loader2 },
  found: { label: "Heirs Found", color: "default", icon: CheckCircle },
  partial: { label: "Partially Found", color: "secondary", icon: AlertCircle },
  failed: { label: "No Results", color: "destructive", icon: AlertCircle },
};

export default function HeirSearchPortal() {
  const [userEmail, setUserEmail] = useState("");
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedCase, setExpandedCase] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUserEmail(u?.email || "");
      loadCases(u?.email || "");
    }).catch(() => setLoading(false));
  }, []);

  const loadCases = async (email) => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.entities.HeirSearch.filter(
        { client_email: email },
        { sort: "-created_date", limit: 50 }
      );
      setCases(res.items || res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const priorityColor = (p) =>
    p === "primary" ? "default" : p === "secondary" ? "secondary" : "outline";

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-neutral-800 bg-neutral-950 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div>
            <span className="xa-pill-badge">CLIENT PORTAL</span>
            <h1 className="font-heading font-bold text-xl sm:text-2xl text-white mt-1">Heir Search Portal</h1>
          </div>
          <div className="text-right">
            <p className="text-xs text-neutral-500">Signed in as</p>
            <p className="text-sm text-neutral-300 font-medium truncate max-w-[200px]">{userEmail}</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {error && (
          <div className="p-4 rounded-xl border border-red-800 bg-red-950/50 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : cases.length === 0 ? (
          <div className="text-center py-20">
            <Users className="w-12 h-12 mx-auto mb-4 text-neutral-700" />
            <h2 className="text-lg font-semibold text-neutral-400">No Cases Assigned</h2>
            <p className="text-sm text-neutral-600 mt-2 max-w-md mx-auto">
              You don't have any heir search cases assigned to your account yet.
              Once a case is assigned to you, the results will appear here.
            </p>
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <PortalStat icon={FileText} label="Total Cases" value={cases.length} />
              <PortalStat icon={Clock} label="In Progress" value={cases.filter(c => c.status === "searching" || c.status === "pending").length} />
              <PortalStat icon={CheckCircle} label="Completed" value={cases.filter(c => c.status === "found" || c.status === "partial").length} />
              <PortalStat icon={Users} label="Heirs Found" value={cases.reduce((s, c) => s + (c.identified_heirs?.length || 0), 0)} />
            </div>

            {/* Case Cards */}
            {cases.map(c => {
              const sc = STATUS_CONFIG[c.status] || STATUS_CONFIG.pending;
              const isExpanded = expandedCase === c.id;
              const heirs = c.identified_heirs || [];
              const livingHeirs = heirs.filter(h => h.is_living !== false);

              return (
                <div key={c.id} className="xa-card overflow-hidden">
                  {/* Case Header */}
                  <button
                    onClick={() => setExpandedCase(isExpanded ? null : c.id)}
                    className="w-full text-left flex items-center justify-between gap-4 p-5 hover:bg-neutral-800/30 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-heading font-bold text-lg text-white">{c.deceased_name}</h3>
                        <Badge variant={sc.color === "destructive" ? "destructive" : sc.color === "default" ? "default" : "secondary"}>
                          <sc.icon className={`w-3 h-3 mr-1 ${c.status === "searching" ? "animate-spin" : ""}`} />
                          {sc.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-neutral-500 mt-1">
                        {c.case_reference ? `Case: ${c.case_reference}` : "No case reference"}
                        {" · "}Created {c.created_date ? new Date(c.created_date).toLocaleDateString() : "—"}
                        {c.confidence_score > 0 && ` · Confidence: ${c.confidence_score}%`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-2xl font-bold text-primary">{heirs.length}</div>
                      <div className="text-xs text-neutral-500">heirs found</div>
                    </div>
                  </button>

                  {/* Expanded Results */}
                  {isExpanded && (
                    <div className="border-t border-neutral-800 p-5 space-y-5">
                      {c.status === "searching" || c.status === "pending" ? (
                        <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-950/30 border border-blue-900">
                          <Loader2 className="w-5 h-5 animate-spin text-primary" />
                          <div>
                            <p className="text-sm font-medium text-blue-300">Research In Progress</p>
                            <p className="text-xs text-neutral-500">Our team is actively searching for heirs. Check back soon for updates.</p>
                          </div>
                        </div>
                      ) : heirs.length === 0 ? (
                        <div className="text-center py-8 text-neutral-500">
                          <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No heirs were identified in this search.</p>
                        </div>
                      ) : (
                        <>
                          {/* Deceased Confirmation */}
                          {c.deceased_details && Object.keys(c.deceased_details).length > 0 && (
                            <div className="p-4 rounded-lg bg-neutral-900 border border-neutral-800">
                              <h4 className="text-sm font-semibold text-neutral-300 mb-2 flex items-center gap-1">
                                <Shield className="w-4 h-4 text-primary" /> Deceased Confirmation
                              </h4>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                {c.deceased_details.full_name && <div><span className="text-neutral-500">Name:</span> <span className="text-neutral-200">{c.deceased_details.full_name}</span></div>}
                                {c.deceased_details.birth_date && <div><span className="text-neutral-500">Born:</span> <span className="text-neutral-200">{c.deceased_details.birth_date}</span></div>}
                                {c.deceased_details.death_date && <div><span className="text-neutral-500">Died:</span> <span className="text-neutral-200">{c.deceased_details.death_date}</span></div>}
                                {c.deceased_details.last_residence && <div><span className="text-neutral-500">Last Residence:</span> <span className="text-neutral-200">{c.deceased_details.last_residence}</span></div>}
                              </div>
                            </div>
                          )}

                          {/* Probate Info */}
                          {c.probate_info && Object.keys(c.probate_info).length > 0 && (c.probate_info.case_number || c.probate_info.executor_name) && (
                            <div className="p-4 rounded-lg bg-neutral-900 border border-neutral-800">
                              <h4 className="text-sm font-semibold text-neutral-300 mb-2 flex items-center gap-1">
                                <Gavel className="w-4 h-4 text-primary" /> Probate Court
                              </h4>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                {c.probate_info.court_county && <div><span className="text-neutral-500">County:</span> <span className="text-neutral-200">{c.probate_info.court_county}</span></div>}
                                {c.probate_info.case_number && <div><span className="text-neutral-500">Case #:</span> <span className="text-neutral-200">{c.probate_info.case_number}</span></div>}
                                {c.probate_info.executor_name && <div><span className="text-neutral-500">Executor:</span> <span className="text-neutral-200">{c.probate_info.executor_name}</span></div>}
                                {c.probate_info.attorney_name && <div><span className="text-neutral-500">Attorney:</span> <span className="text-neutral-200">{c.probate_info.attorney_name}</span></div>}
                              </div>
                            </div>
                          )}

                          {/* Identified Heirs */}
                          <div>
                            <h4 className="text-sm font-semibold text-neutral-300 mb-3 flex items-center gap-1">
                              <Crown className="w-4 h-4 text-primary" /> Identified Heirs ({heirs.length})
                            </h4>
                            <div className="space-y-3">
                              {[...heirs]
                                .sort((a, b) => (a.relationship_degree || 9) - (b.relationship_degree || 9))
                                .map((heir, i) => (
                                <div key={i} className="p-4 rounded-lg bg-neutral-900 border border-neutral-800">
                                  <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                                    <div className="flex items-center gap-2">
                                      {heir.is_living ? <UserCheck className="w-4 h-4 text-green-500" /> : <UserX className="w-4 h-4 text-red-500" />}
                                      <span className="font-medium text-white">{heir.name}</span>
                                      <Badge variant={priorityColor(heir.inheritance_priority)} className="text-xs">
                                        {heir.relationship}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <div className="w-20 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-gold-gradient rounded-full" style={{ width: `${heir.confidence || 0}%` }} />
                                      </div>
                                      <span className="text-xs text-neutral-500">{heir.confidence || 0}%</span>
                                    </div>
                                  </div>
                                  {!heir.is_living && (
                                    <p className="text-xs text-red-400 mb-2">Likely deceased — descendants may inherit by representation</p>
                                  )}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                    {heir.phone_numbers?.length > 0 && (
                                      <div className="flex items-start gap-1.5">
                                        <Phone className="w-3.5 h-3.5 text-neutral-500 mt-0.5 shrink-0" />
                                        <div className="flex flex-wrap gap-1">
                                          {heir.phone_numbers.map((p, j) => (
                                            <span key={j} className="text-neutral-300">{p.number}</span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {heir.emails?.length > 0 && (
                                      <div className="flex items-start gap-1.5">
                                        <Mail className="w-3.5 h-3.5 text-neutral-500 mt-0.5 shrink-0" />
                                        <div className="flex flex-wrap gap-1">
                                          {heir.emails.map((e, j) => (
                                            <span key={j} className="text-neutral-300">{e.email}</span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {heir.address && (
                                      <div className="flex items-start gap-1.5 sm:col-span-2">
                                        <MapPin className="w-3.5 h-3.5 text-neutral-500 mt-0.5 shrink-0" />
                                        <span className="text-neutral-300">{heir.address}</span>
                                      </div>
                                    )}
                                  </div>
                                  {heir.notes && (
                                    <p className="text-xs text-neutral-500 italic mt-2">{heir.notes}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </main>
    </div>
  );
}

function PortalStat({ icon: Icon, label, value }) {
  return (
    <div className="xa-card p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">{label}</span>
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="text-2xl font-heading font-bold text-white">{value}</div>
    </div>
  );
}