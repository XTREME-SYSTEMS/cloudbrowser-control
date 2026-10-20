import React, { useState, useEffect, useCallback } from "react";
import { Loader2, AlertTriangle, RefreshCw, Inbox, Lock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import CaseQueue from "@/components/investigator/CaseQueue";
import CaseHeaderBar from "@/components/investigator/CaseHeaderBar";
import FamilyTreePanel from "@/components/investigator/FamilyTreePanel";
import RelationshipReviewPanel from "@/components/investigator/RelationshipReviewPanel";
import EvidencePanel from "@/components/investigator/EvidencePanel";
import SourceCoveragePanel from "@/components/investigator/SourceCoveragePanel";
import CertificationGatePanel from "@/components/investigator/CertificationGatePanel";
import ApprovalPanel from "@/components/investigator/ApprovalPanel";
import ResearchGapsPanel from "@/components/investigator/ResearchGapsPanel";
import CaseHistoryPanel from "@/components/investigator/CaseHistoryPanel";
import ReportControlsPanel from "@/components/investigator/ReportControlsPanel";

/**
 * INVESTIGATOR COMMAND CENTER
 * ==========================================================================
 * The review surface for a case, and the place the pipeline's claims are
 * checked rather than accepted.
 *
 * Two things it does not do, both deliberately:
 *
 *   • It computes no status of its own. Every certification, evidence and
 *     approval label is resolved server-side by the same gate that governs the
 *     spreadsheet exports and the report delivery, so a case cannot look
 *     finished here and refused everywhere else.
 *
 *   • It renders gaps instead of hiding them. Unresolved relationships, blocked
 *     sources, competing evidence and failed rules are the substance of a review,
 *     not an exception to it.
 */
const TABS = [
  { id: "overview", label: "Overview" },
  { id: "relationships", label: "Family Tree" },
  { id: "identity", label: "Identity Review" },
  { id: "evidence", label: "Evidence" },
  { id: "sources", label: "Source Coverage" },
  { id: "certification", label: "QA & Certification" },
  { id: "approvals", label: "Approvals" },
  { id: "gaps", label: "Research Gaps" },
  { id: "history", label: "History" },
  { id: "reports", label: "Reports" },
];

export default function InvestigatorCommandCenter() {
  const [queue, setQueue] = useState([]);
  const [counts, setCounts] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [brief, setBrief] = useState(null);
  const [queueLoading, setQueueLoading] = useState(true);
  const [briefLoading, setBriefLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("overview");

  const message = (err) =>
    err?.response?.data?.error || err?.message || "The request could not be completed.";

  const loadQueue = useCallback(async (term) => {
    setQueueLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("getInvestigatorCaseBrief", { limit: 25, search: term });
      const data = res.data || res;
      if (data?.error) throw new Error(data.error);
      setQueue(data?.queue?.cases || []);
      setCounts(data?.queue?.counts || null);
    } catch (err) {
      setQueue([]);
      setCounts(null);
      setError(message(err));
    } finally {
      setQueueLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQueue("");
  }, [loadQueue]);

  const openCase = async (id) => {
    setSelectedId(id);
    setBriefLoading(true);
    setError(null);
    setBrief(null);
    try {
      const res = await base44.functions.invoke("getInvestigatorCaseBrief", { heir_search_id: id });
      const data = res.data || res;
      if (data?.error) throw new Error(data.error);
      setBrief(data?.brief || null);
      setTab("overview");
    } catch (err) {
      setError(message(err));
    } finally {
      setBriefLoading(false);
    }
  };

  const record = async (payload) => {
    setBusy(true);
    setError(null);
    try {
      await base44.functions.invoke("recordInvestigatorDecision", payload);
      if (brief?.case?.id) await openCase(brief.case.id);
      await loadQueue(search);
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };

  const onSearch = (term) => {
    setSearch(term);
    loadQueue(term);
  };

  const refresh = async () => {
    await loadQueue(search);
    if (selectedId) await openCase(selectedId);
  };

  const forbidden = /admin role/i.test(error || "");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold">Investigator Command Center</h1>
          <p className="text-xs text-muted-foreground">
            Case review, evidence status, certification and approval in one place.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={refresh} disabled={queueLoading || briefLoading}>
          {queueLoading || briefLoading ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          )}
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 flex items-start gap-2">
          {forbidden ? (
            <Lock className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          )}
          <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="rounded-xl border border-border bg-card p-3">
          <CaseQueue
            cases={queue}
            counts={counts}
            search={search}
            loading={queueLoading}
            selectedId={selectedId}
            onSelect={openCase}
            onSearch={onSearch}
          />
        </div>

        <div className="min-w-0">
          {!selectedId && (
            <div className="rounded-xl border border-border bg-card p-10 text-center">
              <Inbox className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-display font-semibold">Select a case to review</p>
              <p className="text-xs text-muted-foreground mt-1">
                Its relationships, evidence, certification and approval history open here.
              </p>
            </div>
          )}

          {selectedId && briefLoading && (
            <div className="rounded-xl border border-border bg-card p-10 text-center">
              <Loader2 className="w-6 h-6 mx-auto animate-spin text-primary" />
              <p className="text-xs text-muted-foreground mt-3">Assembling the case brief…</p>
            </div>
          )}

          {selectedId && !briefLoading && brief && (
            <div className="space-y-4">
              <CaseHeaderBar caseRecord={brief.case} verification={brief.verification} />

              <div className="flex gap-1.5 overflow-x-auto xa-scroll pb-1">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`shrink-0 rounded-lg border px-3 py-1.5 text-[11px] font-display font-semibold transition-all ${
                      tab === t.id
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                    }`}
                  >
                    {t.label}
                    {t.id === "gaps" && brief.gaps?.length > 0 && (
                      <span className="ml-1.5 rounded-full bg-amber-500/20 px-1.5 text-[10px] text-amber-700 dark:text-amber-300">
                        {brief.gaps.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {tab === "overview" && <OverviewPanel brief={brief} />}
              {tab === "relationships" && <FamilyTreePanel kinship={brief.kinship} />}
              {tab === "identity" && <RelationshipReviewPanel kinship={brief.kinship} />}
              {tab === "evidence" && (
                <EvidencePanel ledger={brief.evidence_ledger} certification={brief.certification} />
              )}
              {tab === "sources" && <SourceCoveragePanel coverage={brief.source_coverage} />}
              {tab === "certification" && (
                <CertificationGatePanel
                  verification={brief.verification}
                  certification={brief.certification}
                  lineage={brief.lineage}
                  gaps={brief.gaps}
                />
              )}
              {tab === "approvals" && (
                <ApprovalPanel
                  brief={brief}
                  busy={busy}
                  onDecision={(decision, reason) =>
                    record({ heir_search_id: brief.case.id, decision, reason })
                  }
                  onAssign={(assigned_to_email) =>
                    record({ heir_search_id: brief.case.id, decision: "assign", assigned_to_email })
                  }
                />
              )}
              {tab === "gaps" && <ResearchGapsPanel gaps={brief.gaps} />}
              {tab === "history" && <CaseHistoryPanel audit={brief.audit} />}
              {tab === "reports" && <ReportControlsPanel brief={brief} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** The case at a glance: what the graph supports, what it does not, and what is outstanding. */
function OverviewPanel({ brief }) {
  const kin = brief.kinship?.counts;
  const stats = [
    { label: "People in graph", value: kin?.persons ?? "--" },
    { label: "Claims supported", value: kin?.established ?? "--", tone: "text-emerald-600 dark:text-emerald-400" },
    { label: "Claims unresolved", value: kin?.unresolved ?? "--", tone: "text-amber-600 dark:text-amber-400" },
    { label: "Conflicts awaiting review", value: kin?.conflicts ?? "--", tone: "text-amber-600 dark:text-amber-400" },
    { label: "Evidence records", value: brief.evidence_ledger?.length ?? 0 },
    { label: "Open gaps", value: brief.gaps?.length ?? 0, tone: "text-amber-600 dark:text-amber-400" },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card px-3 py-2.5">
            <div className={`text-xl font-display font-bold ${s.tone || ""}`}>{s.value}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-display font-semibold mb-2">What this case establishes</h3>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {brief.kinship?.disclosure || "No relationship graph has been built for this case."}
        </p>
      </div>

      {brief.gaps?.length > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <h3 className="text-sm font-display font-semibold text-amber-700 dark:text-amber-300 mb-2">
            Outstanding before this case can be delivered
          </h3>
          <ul className="space-y-1">
            {brief.gaps.slice(0, 4).map((g, i) => (
              <li key={`${g.code}-${i}`} className="text-[11px] text-amber-800 dark:text-amber-200">
                · {g.message}
              </li>
            ))}
          </ul>
          {brief.gaps.length > 4 && (
            <p className="text-[11px] text-amber-800/80 dark:text-amber-200/80 mt-1">
              {brief.gaps.length - 4} further gap(s) in the Research Gaps tab.
            </p>
          )}
        </div>
      )}
    </div>
  );
}