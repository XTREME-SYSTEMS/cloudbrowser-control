import { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import OperationsBar from "@/components/system-health/OperationsBar";
import HealthVerdict from "@/components/system-health/HealthVerdict";
import RemediationPlan from "@/components/system-health/RemediationPlan";
import HealingPanel from "@/components/system-health/HealingPanel";
import ArchiveLedger from "@/components/system-health/ArchiveLedger";
import OpsDeepLinks from "@/components/system-health/OpsDeepLinks";

const ARCHIVE_SCOPE = [
  "Service results older than 30 days",
  "QA and test results older than 30 days",
  "Heal-action history older than 30 days",
  "Healing flags already resolved",
];

const OUTCOMES = {
  qa: (r) => `QA measured ${r.overall_score}/100 — ${r.system_status}. ${r.prioritized_action_plan?.length ?? 0} ranked issue(s).`,
  heal: (r) => r.message || "Self-heal cycle finished.",
  infra: (r) =>
    r.enabled === false
      ? "Infrastructure auto-heal is switched off, so nothing was changed."
      : `Infrastructure heal finished — ${r.summary?.healed ?? 0} healed, ${r.summary?.failed ?? 0} failed.`,
  archive: (r) => r.message || "Archive finished.",
};

/**
 * ONE OPERATIONS CONSOLE.
 *
 * Heal, QA, test and archive were all built and then left unrouted, so none of
 * them could be reached or pressed. This screen is the single place that drives
 * them: four real actions, the score they produce, the ranked list of what to
 * fix, the flags healing refused to close on its own, and the archive ledger
 * that proves nothing was thrown away to get a clean start.
 */
export default function SystemHealth() {
  const [state, setState] = useState({ flags: [], archive: [], healLog: [], lastQA: null, tests: null });
  const [qa, setQa] = useState(null);
  const [heal, setHeal] = useState(null);
  const [archiveResult, setArchiveResult] = useState(null);
  const [busy, setBusy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastOutcome, setLastOutcome] = useState(null);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const load = useCallback(async () => {
    try {
      const [flags, archive, healLog, storedQA, passed, failed] = await Promise.all([
        base44.entities.HealingFlag.filter({ status: { $nin: ["resolved"] } }, "-flagged_at", 25),
        base44.entities.SystemArchive.list("-archived_at", 40),
        base44.entities.AutoHealLog.list("-healed_at", 20),
        base44.entities.TestResult.filter({ suite: "system_qa" }, "-created_date", 1),
        base44.entities.TestResult.count({ status: "pass" }),
        base44.entities.TestResult.count({ status: "fail" }),
      ]);
      setState({
        flags: flags || [],
        archive: archive || [],
        healLog: healLog || [],
        lastQA: (storedQA || [])[0] || null,
        tests: { passed: passed || 0, failed: failed || 0 },
      });
    } catch (err) {
      setError(err?.message || "The system state could not be read.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const call = async (name, payload = {}) => {
    const res = await base44.functions.invoke(name, payload);
    const data = res?.data ?? res;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const runAction = async (key) => {
    if (key === "archive" && !confirmArchive) {
      setConfirmArchive(true);
      return;
    }
    setBusy(key);
    setError(null);
    setLastOutcome(null);
    try {
      if (key === "qa") {
        const report = await call("runSystemQA");
        setQa(report);
        setLastOutcome({ key, text: OUTCOMES.qa(report) });
      } else if (key === "heal") {
        const cycle = await call("runSelfHealingLoop");
        setHeal(cycle);
        setLastOutcome({ key, text: OUTCOMES.heal(cycle) });
      } else if (key === "infra") {
        const report = await call("railwayAutoHeal");
        setLastOutcome({ key, text: OUTCOMES.infra(report) });
      } else if (key === "archive") {
        const report = await call("archiveResults", { preset: "results", older_than_days: 30 });
        setArchiveResult(report);
        setConfirmArchive(false);
        setLastOutcome({ key, text: OUTCOMES.archive(report) });
      }
      await load();
    } catch (err) {
      setError(err?.message || "That action could not be completed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4 pb-4">
      <div className="flex flex-wrap items-start gap-3 rounded-xl border border-border bg-card p-5">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl font-bold tracking-wide">System Health</h1>
          <p className="mt-0.5 max-w-3xl text-xs text-muted-foreground">
            Measure the system, heal what can be healed, see exactly what could not be, and start a clean cycle without
            losing the results you are retiring.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading || Boolean(busy)}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Refresh
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      <OperationsBar busy={busy} onRun={runAction} />

      {confirmArchive && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
          <h3 className="font-display text-sm font-semibold tracking-wide">Confirm the clean start</h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Each record below is copied into the archive ledger in full, and only then cleared from the live system. If a
            record cannot be archived it is deliberately left in place rather than deleted. Open problems are never
            archived.
          </p>
          <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
            {ARCHIVE_SCOPE.map((line) => (
              <li key={line}>· {line}</li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => runAction("archive")} disabled={Boolean(busy)}>
              {busy === "archive" ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Preserve and start fresh
            </Button>
            <Button size="sm" variant="outline" onClick={() => setConfirmArchive(false)} disabled={Boolean(busy)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {lastOutcome && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
          <span className="font-display font-semibold tracking-wide">
            {lastOutcome.key === "qa"
              ? "QA validation"
              : lastOutcome.key === "heal"
                ? "Self-heal cycle"
                : lastOutcome.key === "infra"
                  ? "Infrastructure heal"
                  : "Archive"}
          </span>
          <span className="ml-2 text-muted-foreground">{lastOutcome.text}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Reading the system state…
        </div>
      ) : (
        <>
          <HealthVerdict qa={qa} lastQA={state.lastQA} tests={state.tests} />
          <RemediationPlan plan={qa?.prioritized_action_plan} />
          <HealingPanel flags={state.flags} cycle={heal} healLog={state.healLog} />
          <ArchiveLedger archive={state.archive} result={archiveResult} />
          <OpsDeepLinks />
        </>
      )}
    </div>
  );
}