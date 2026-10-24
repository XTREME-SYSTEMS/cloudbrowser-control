import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, Bot, History } from "lucide-react";
import ServiceBoard from "@/components/workspace/ServiceBoard";
import CommandBar from "@/components/workspace/CommandBar";
import RunningNow from "@/components/workspace/RunningNow";
import ResultPanel from "@/components/workspace/ResultPanel";
import OpsQueue from "@/components/assistant/OpsQueue";

const VERDICT_CLASS = {
  delivered: "border-primary/40 bg-primary/10 text-primary",
  conditional: "border-gold/40 bg-gold/10 text-gold",
  blocked: "border-destructive/40 bg-destructive/10 text-destructive",
  failed: "border-destructive/40 bg-destructive/10 text-destructive",
};

/**
 * ONE OPERABLE SCREEN.
 *
 * Cards by category, the input, what is running now, the last result, the
 * operating queue and the brief — in that order, with nothing to configure.
 * The stages, the hand-offs, the model assignments and the retries stay behind
 * the lines; what surfaces is progress and results.
 */
export default function WorkflowWorkspace() {
  const [catalog, setCatalog] = useState({ services: [], categories: [], uncategorised: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeSlug, setActiveSlug] = useState(null);
  const [sentence, setSentence] = useState("");
  const [activeRun, setActiveRun] = useState(null);
  const [runs, setRuns] = useState([]);
  const [busyStage, setBusyStage] = useState(null);
  const [queueKey, setQueueKey] = useState(0);

  const expectedSlug = useRef(null);
  const activeRunId = useRef(null);

  const loadRuns = useCallback(async () => {
    try {
      const page = await base44.entities.ServiceRun.list("-created_date", 8);
      setRuns(Array.isArray(page) ? page : []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await base44.functions.invoke("getServiceCatalog", {});
        const data = res?.data || res;
        setCatalog({
          services: data?.services || [],
          categories: data?.categories || [],
          uncategorised: data?.uncategorised || [],
        });
      } catch (err) {
        setError(err?.message || "The service catalogue could not be loaded.");
      } finally {
        setLoading(false);
      }
    })();
    loadRuns();
  }, [loadRuns]);

  // Live progress: the runner writes the run record as each stage lands, so the
  // screen advances without pulling or refreshing.
  useEffect(() => {
    const unsubscribe = base44.entities.ServiceRun.subscribe((event) => {
      const record = event?.data;
      if (!record?.id) return;
      if (event.type === "create" && record.service_slug === expectedSlug.current) {
        activeRunId.current = record.id;
        setActiveRun(record);
        return;
      }
      if (event.type === "update") {
        if (record.id === activeRunId.current) setActiveRun(record);
        setRuns((prev) => {
          if (prev.some((r) => r.id === record.id)) {
            return prev.map((r) => (r.id === record.id ? record : r));
          }
          return [record, ...prev].slice(0, 8);
        });
      }
    });
    return unsubscribe;
  }, []);

  const activeService = catalog.services.find((s) => s.slug === activeSlug) || null;
  const runningNow = activeRun && ["running", "assurance", "queued"].includes(activeRun.status);
  const latest = activeRun || runs[0] || null;

  const selectService = (service) => {
    setActiveSlug(service.slug);
    setSentence((prev) => prev.trim() || `Run the ${service.name} service: ${service.tagline}.`);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    }
  };

  const startRun = (payload) => {
    setError(null);
    expectedSlug.current = payload.service_slug;
    activeRunId.current = null;
    setActiveRun({
      id: "pending",
      service_slug: payload.service_slug,
      service_name: activeService?.name || payload.service_slug,
      status: "running",
      current_stage: "Plan",
      stages: [],
      created_date: new Date().toISOString(),
      input_sentence: payload.sentence,
    });

    base44.functions
      .invoke("runServiceWorkflow", payload)
      .then((res) => {
        const data = res?.data || res;
        if (data?.error && !data?.run) setError(data.error);
        if (data?.run) setActiveRun(data.run);
      })
      .catch((err) => setError(err?.response?.data?.error || err?.message || "The run could not be started."))
      .finally(() => {
        loadRuns();
        setQueueKey((k) => k + 1);
      });
  };

  const rerunStage = async (stageKey) => {
    if (!latest?.id || latest.id === "pending") return;
    setBusyStage(stageKey);
    setError(null);
    try {
      const res = await base44.functions.invoke("runServiceWorkflow", {
        run_id: latest.id,
        only_stage: stageKey,
      });
      const data = res?.data || res;
      if (data?.error) throw new Error(data.error);
      if (data?.run) setActiveRun(data.run);
    } catch (err) {
      setError(err?.message || "That stage could not be re-run.");
    } finally {
      setBusyStage(null);
      loadRuns();
    }
  };

  const answerDecision = (answer) => {
    if (!activeService) {
      setError("The service for this run could not be resolved, so the answer cannot be sent.");
      return;
    }
    setActiveRun(null);
    startRun({ service_slug: activeService.slug, sentence, answers: answer });
  };

  return (
    <div className="space-y-5 pb-4">
      <div className="flex flex-wrap items-start gap-3 rounded-xl border border-border bg-card p-5">
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-xl font-bold tracking-wide">Workspace</h1>
          <p className="mt-0.5 max-w-3xl text-xs text-muted-foreground">
            Every service is one card. Press it or type a sentence, and the brief is built, the nine stages run, and the result comes back
            reviewed — QA, guardian and an independent validator on separate model families. Nothing ships without evidence.
          </p>
        </div>
        <Link to="/executive-assistant">
          <Button variant="outline" size="sm">
            <Bot className="h-3 w-3" />
            Executive assistant
          </Button>
        </Link>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Loading the service board…
        </div>
      ) : (
        <ServiceBoard
          services={catalog.services}
          categories={catalog.categories}
          uncategorised={catalog.uncategorised}
          onRun={selectService}
          runningSlug={runningNow ? activeRun?.service_slug : null}
        />
      )}

      {activeRun && (
        <RunningNow run={activeRun} onRerunStage={runningNow ? undefined : rerunStage} busyStage={busyStage} />
      )}

      {latest && !runningNow && (
        <ResultPanel run={latest} onDecision={answerDecision} onRerunStage={rerunStage} busyStage={busyStage} />
      )}

      <OpsQueue refreshKey={queueKey} />

      {runs.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            <h3 className="font-display text-sm font-semibold tracking-wide">Last results</h3>
            <span className="ml-auto text-[11px] text-muted-foreground">
              Blocked and failed runs stay here — a refused run is the system working
            </span>
          </div>
          <div className="space-y-1.5">
            {runs.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  activeRunId.current = r.id;
                  setActiveRun(r);
                }}
                className="flex w-full flex-wrap items-center gap-2 rounded-lg border border-border/50 bg-secondary/25 p-2 text-left hover:border-primary/30"
              >
                <Badge className={VERDICT_CLASS[r.verdict] || VERDICT_CLASS.failed}>{r.verdict || r.status}</Badge>
                <span className="text-[11px] font-medium">{r.service_name}</span>
                <span className="text-[11px] text-muted-foreground">{r.overall_score ?? 0}/100</span>
                {r.block_reason && (
                  <span className="truncate text-[10px] text-muted-foreground">{r.block_reason}</span>
                )}
                <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                  {r.created_date ? new Date(r.created_date).toLocaleString() : ""}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <CommandBar
        service={activeService ? { ...activeService, decision_questions: latest?.service_slug === activeService.slug ? latest.decision_questions || [] : [] } : null}
        sentence={sentence}
        setSentence={setSentence}
        onRun={startRun}
        running={runningNow}
      />
    </div>
  );
}