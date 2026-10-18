import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText, Download, Loader2, Search, Shield, Database,
  CheckCircle, AlertCircle, ArrowRight, Sparkles, Users, Target, TrendingUp, Zap,
} from "lucide-react";
import { downloadStrategicReportPDF } from "@/lib/strategicReportPDF";

const TARGET_SUBJECTS = [
  { name: "Paul C. Lingard", address: "19681 Summerlin Rd # 41, Fort Myers, FL 33908" },
  { name: "Donald Roy Yandell", address: "4511 Rusk Ave, Dallas, TX 75204" },
  { name: "Lucile C Wright", address: "6 Pueblo Dr, Pensacola, FL 32507" },
];

export default function StrategicReport() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tracing, setTracing] = useState(false);
  const [error, setError] = useState(null);
  const [reportReady, setReportReady] = useState(false);

  useEffect(() => { loadTraces(); }, []);

  const loadTraces = async () => {
    setLoading(true);
    try {
      const results = [];
      for (const target of TARGET_SUBJECTS) {
        const res = await base44.entities.SkipTrace.filter(
          { target_owner_name: target.name },
          { sort: "-created_date", limit: 1 }
        );
        const items = res.items || res;
        if (items[0]) {
          const t = items[0];
          results.push({
            id: t.id,
            target: t.target_owner_name,
            address: t.target_property_address,
            status: t.status,
            confidence: t.confidence_score,
            phones: (t.found_phone_numbers || []).map(p => p.display || p.number),
            emails: (t.found_emails || []).map(e => e.email || e),
            addresses: (t.found_addresses || []).map(a => a.address),
            social: (t.found_social_profiles || []).map(s => `${s.platform}: ${s.url || s.username || ""}`),
            relatives: t.found_relatives || [],
            sources_count: (t.sources_checked || []).length,
            methods_count: (t.methods_used || []).length,
            duration: t.search_duration_ms,
            exec_summary: t.search_results?.executive_summary,
            full_report: t.search_results?.full_report,
            enrichment: t.search_results?.enrichment,
          });
        }
      }
      setSubjects(results);
      if (results.length === TARGET_SUBJECTS.length) setReportReady(true);
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  const runAllTraces = async () => {
    setTracing(true);
    setError(null);
    try {
      for (const target of TARGET_SUBJECTS) {
        await base44.functions.invoke("runMaxSkipTrace", {
          owner_name: target.name,
          property_address: target.address,
          deep_search: true,
        });
      }
      await loadTraces();
    } catch (err) {
      setError(err.message);
    } finally { setTracing(false); }
  };

  const handleDownload = () => {
    downloadStrategicReportPDF({ subjects, playbook: true });
  };

  return (
    <div className="bg-[#05070a] text-white rounded-2xl -m-4 md:-m-8 p-4 md:p-8 min-h-[calc(100vh-2rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 border-b border-[#00a8ff]/20 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full border-2 border-[#00a8ff] flex items-center justify-center bg-[#05070a]">
            <span className="text-2xl font-bold text-[#c8d2de]">S</span>
          </div>
          <div>
            <h1 className="text-xl font-bold">
              <span className="text-white">STRATEGIC MINDS</span>
              <span className="text-[#00f2ff]"> AI</span>
            </h1>
            <p className="text-[10px] text-[#788291] tracking-[0.2em] uppercase">Intelligence in Motion</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={runAllTraces} disabled={tracing}
            className="bg-[#00a8ff]/10 text-[#00a8ff] border border-[#00a8ff]/40 hover:bg-[#00a8ff]/20">
            {tracing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Tracing...</> : <><Search className="w-4 h-4 mr-2" />Run Deep Traces</>}
          </Button>
          <Button onClick={handleDownload} disabled={!reportReady || loading}
            className="bg-[#00a8ff] text-white border-0 hover:bg-[#0090e0]">
            <Download className="w-4 h-4 mr-2" />Download PDF Report
          </Button>
        </div>
      </div>

      {/* Title */}
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold mb-2">
          <span className="text-white">Forensic Skip Trace </span>
          <span className="text-[#00f2ff]">Report</span>
        </h2>
        <p className="text-sm text-[#788291] max-w-2xl mx-auto">
          Professional investigative document compiled from 241+ public-record sources across 30+ data categories.
          All findings are cross-verified, confidence-scored, and presented to legal-grade standards.
        </p>
      </div>

      {/* Status */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#00a8ff]" />
          <span className="ml-3 text-[#788291]">Loading trace data...</span>
        </div>
      )}

      {error && (
        <div className="max-w-2xl mx-auto p-4 rounded-xl border border-red-500/30 bg-red-500/10 flex items-start gap-3 text-red-400 mb-6">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div><p className="font-medium text-sm">Error</p><p className="text-xs">{error}</p></div>
        </div>
      )}

      {/* Subject Cards */}
      {!loading && subjects.length > 0 && (
        <div className="space-y-4 max-w-4xl mx-auto mb-10">
          {subjects.map((s, i) => (
            <div key={s.id} className="rounded-xl border border-[#00a8ff]/20 bg-[#0c1016] p-5 hover:border-[#00a8ff]/40 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[#00a8ff] text-xs font-bold">SUBJECT {i + 1}</span>
                    <Badge className={
                      s.status === "found" ? "bg-green-500/10 text-green-400 border border-green-500/30" :
                      s.status === "partial" ? "bg-amber-500/10 text-amber-400 border border-amber-500/30" :
                      "bg-red-500/10 text-red-400 border border-red-500/30"
                    }>{s.status}</Badge>
                  </div>
                  <h3 className="text-lg font-bold text-white">{s.target}</h3>
                  <p className="text-xs text-[#788291]">{s.address}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-[#00f2ff]">{s.confidence}%</div>
                  <p className="text-[10px] text-[#788291] uppercase tracking-wider">Confidence</p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3 mt-4">
                <Stat icon={FileText} label="Phones" value={s.phones?.length || 0} />
                <Stat icon={FileText} label="Emails" value={s.emails?.length || 0} />
                <Stat icon={FileText} label="Addresses" value={s.addresses?.length || 0} />
                <Stat icon={Database} label="Sources" value={s.sources_count || 0} />
              </div>
              {s.exec_summary && (
                <p className="text-xs text-[#a0aab8] mt-3 line-clamp-2">{s.exec_summary.substring(0, 200)}...</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pillars */}
      {!loading && (
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          {[
            { icon: TrendingUp, title: "Higher Visibility", desc: "30+ source categories queried per subject" },
            { icon: Users, title: "More Qualified Traffic", desc: "Cross-verified contact data with confidence scoring" },
            { icon: Target, title: "Stronger Brand Authority", desc: "Evidence chains and data quality assessments" },
            { icon: Zap, title: "Real Business Growth", desc: "Actionable intelligence for legal administration" },
          ].map((p, i) => (
            <div key={i} className="rounded-xl border border-[#00a8ff]/15 bg-[#0c1016] p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full border border-[#00a8ff]/40 flex items-center justify-center shrink-0">
                <p.icon className="w-5 h-5 text-[#00a8ff]" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">{p.title}</h4>
                <p className="text-xs text-[#788291]">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CTA */}
      {!loading && reportReady && (
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-8 py-3 rounded-full border border-[#00a8ff]/40 bg-[#00a8ff]/5">
            <Sparkles className="w-4 h-4 text-[#00a8ff]" />
            <span className="text-sm font-bold text-white">BUILD SMARTER. GROW FASTER.</span>
            <ArrowRight className="w-4 h-4 text-[#00a8ff]" />
          </div>
          <p className="text-xs text-[#788291] mt-3">
            Click "Download PDF Report" to generate the full branded investigative document.
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-[#05070a] px-3 py-2">
      <Icon className="w-3.5 h-3.5 text-[#00a8ff] shrink-0" />
      <div>
        <div className="text-sm font-bold text-white">{value}</div>
        <div className="text-[9px] text-[#788291] uppercase tracking-wider">{label}</div>
      </div>
    </div>
  );
}