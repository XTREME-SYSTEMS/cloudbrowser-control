import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import OnboardingQuestionnaire from "@/components/intelligence/OnboardingQuestionnaire";
import ThinkingScreenSaver from "@/components/intelligence/ThinkingScreenSaver";
import {
  Sparkles, Search, Download, Layers, Users, Swords, UserSearch,
  GitBranch, Palette, Megaphone, Rocket, Cloud, CheckCircle2,
  Loader2, ChevronRight, Brain, TrendingUp, AlertCircle,
} from "lucide-react";

const STEPS = [
  { num: 1, name: "ENVISION", icon: Sparkles, desc: "Define industry, market, goals" },
  { num: 2, name: "DISCOVER", icon: Search, desc: "National demand map, domain scan, keywords" },
  { num: 3, name: "INGEST", icon: Download, desc: "Economic, debt, social, psychology intel" },
  { num: 4, name: "NORMALIZE", icon: Layers, desc: "Organize, enrich, cross-reference data" },
  { num: 5, name: "BUYERS", icon: Users, desc: "Who pays, why, how much" },
  { num: 6, name: "COMPETITORS", icon: Swords, desc: "Reverse engineer, Level 5 clone" },
  { num: 7, name: "SKIP TRACE", icon: UserSearch, desc: "Decision maker contacts, deep trace" },
  { num: 8, name: "SIMULATE", icon: GitBranch, desc: "Hundreds of strategy scenarios" },
  { num: 9, name: "BRAND", icon: Palette, desc: "10 brand options, mockups, slogans" },
  { num: 10, name: "STRATEGY", icon: Megaphone, desc: "Pitches, scripts, rebuttals, templates" },
  { num: 11, name: "DEPLOY", icon: Rocket, desc: "Builders docs, architectural plans" },
  { num: 12, name: "SYNC", icon: Cloud, desc: "Google Drive, Gmail, Calendar, Sheets" },
];

export default function IntelligenceCommandCenter() {
  const [pipeline, setPipeline] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [thinking, setThinking] = useState(false);
  const [thinkingLabel, setThinkingLabel] = useState("");
  const [stepResults, setStepResults] = useState({});
  const [history, setHistory] = useState([]);

  useEffect(() => { loadHistory(); }, []);

  const loadHistory = async () => {
    try {
      const res = await base44.entities.IntelligencePipeline.filter({}, { sort: "-created_date", limit: 10 });
      setHistory(res.items || res);
    } catch (e) { console.error(e); }
  };

  const handleOnboardingComplete = async (data) => {
    setThinking(true);
    setThinkingLabel("Initializing Pipeline");
    try {
      const rec = await base44.entities.IntelligencePipeline.create({
        ...data,
        status: "running",
        current_step: 1,
        total_steps: 12,
        step_results: {},
      });
      setPipeline(rec);
      setStepResults({ 1: { status: "complete", data } });
      setCurrentStep(1);
      loadHistory();
    } catch (e) {
      console.error(e);
    } finally {
      setThinking(false);
    }
  };

  const runStep = useCallback(async (stepNum) => {
    if (!pipeline) return;
    setThinking(true);
    setThinkingLabel(`Step ${stepNum}: ${STEPS[stepNum - 1].name}`);
    setStepResults(prev => ({ ...prev, [stepNum]: { status: "running" } }));
    try {
      let result;
      const ctx = { industry: pipeline.industry, target_market: pipeline.target_market, goals: pipeline.goals, geo_focus: pipeline.geo_focus, pipeline_id: pipeline.id };

      switch (stepNum) {
        case 2: {
          const demandRes = await base44.functions.invoke("runNationalDemandMap", { pipeline_id: pipeline.id });
          result = demandRes.data || demandRes;
          break;
        }
        case 3: {
          const res = await base44.functions.invoke("runSocialMediaScan", { industry: pipeline.industry, target_market: pipeline.target_market, pipeline_id: pipeline.id });
          result = res.data || res;
          break;
        }
        case 5: {
          const res = await base44.functions.invoke("architectProductIdea", { industry: pipeline.industry, target_market: pipeline.target_market });
          result = res.data || res;
          break;
        }
        case 6: {
          const res = await base44.functions.invoke("scrapeSimilarSystems", { query: pipeline.industry, target_market: pipeline.target_market });
          result = res.data || res;
          break;
        }
        case 7: {
          const res = await base44.functions.invoke("runBatchSkipTrace", { industry: pipeline.industry, target_market: pipeline.target_market });
          result = res.data || res;
          break;
        }
        case 8: {
          const res = await base44.functions.invoke("runStrategySimulation", { industry: pipeline.industry, goals: pipeline.goals, target_market: pipeline.target_market, budget_range: pipeline.budget_range, pipeline_id: pipeline.id });
          result = res.data || res;
          break;
        }
        case 9: {
          const res = await base44.functions.invoke("runBrandGenerator", { industry: pipeline.industry, target_market: pipeline.target_market, pipeline_id: pipeline.id });
          result = res.data || res;
          break;
        }
        case 10: {
          const res = await base44.functions.invoke("runSalesAssetGenerator", { industry: pipeline.industry, target_market: pipeline.target_market, pipeline_id: pipeline.id });
          result = res.data || res;
          break;
        }
        case 11: {
          const res = await base44.functions.invoke("runBuildersDocCompiler", { pipeline_id: pipeline.id });
          result = res.data || res;
          break;
        }
        case 12: {
          const res = await base44.functions.invoke("runGoogleIntelSync", { pipeline_id: pipeline.id });
          result = res.data || res;
          break;
        }
        default:
          result = { message: "Step completed" };
      }

      setStepResults(prev => ({ ...prev, [stepNum]: { status: "complete", data: result } }));
      setCurrentStep(stepNum);
      await base44.entities.IntelligencePipeline.update(pipeline.id, { current_step: stepNum });
      loadHistory();
    } catch (e) {
      setStepResults(prev => ({ ...prev, [stepNum]: { status: "error", error: e.response?.data?.error || e.message } }));
    } finally {
      setThinking(false);
    }
  }, [pipeline]);

  return (
    <div className="space-y-4 pb-12">
      <ThinkingScreenSaver active={thinking} label={thinkingLabel} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-heading font-semibold flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" /> Intelligence Command Center
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Data intelligence firm — envision, discover, ingest, dominate</p>
        </div>
        {pipeline && (
          <Badge variant="outline" className="text-xs">
            <TrendingUp className="w-3 h-3 mr-1" /> {pipeline.industry}
          </Badge>
        )}
      </div>

      {/* Horizontal Timeline */}
      <div className="overflow-x-auto xa-scroll pb-2">
        <div className="flex items-center gap-1 min-w-max">
          {STEPS.map((step, i) => {
            const stepStatus = stepResults[step.num]?.status;
            const isActive = currentStep === step.num;
            return (
              <div key={step.num} className="flex items-center">
                <button
                  onClick={() => stepResults[step.num] && setCurrentStep(step.num)}
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg border transition-all min-w-[90px] ${
                    isActive ? "bg-primary/15 border-primary" :
                    stepStatus === "complete" ? "bg-green-500/10 border-green-500/30" :
                    stepStatus === "running" ? "bg-yellow-500/10 border-yellow-500/30" :
                    stepStatus === "error" ? "bg-red-500/10 border-red-500/30" :
                    "bg-muted/20 border-border"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-heading font-bold ${stepStatus === "complete" ? "text-green-500" : isActive ? "text-primary" : "text-muted-foreground"}`}>
                      {step.num}
                    </span>
                    {stepStatus === "complete" ? <CheckCircle2 className="w-3 h-3 text-green-500" /> :
                     stepStatus === "running" ? <Loader2 className="w-3 h-3 text-yellow-500 animate-spin" /> :
                     stepStatus === "error" ? <AlertCircle className="w-3 h-3 text-red-500" /> :
                     <step.icon className="w-3.5 h-3.5 text-muted-foreground" />}
                  </div>
                  <span className={`text-[10px] font-display font-semibold tracking-wide ${isActive ? "text-primary" : "text-muted-foreground"}`}>{step.name}</span>
                </button>
                {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground/40 shrink-0" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content — flows top to bottom, compounds */}
      <div className="space-y-4">
        {/* Step 1: Onboarding */}
        {!pipeline ? (
          <OnboardingQuestionnaire onComplete={handleOnboardingComplete} />
        ) : (
          <StepResultCard step={STEPS[0]} result={stepResults[1]} />
        )}

        {/* Steps 2-12 — only show if previous step is complete */}
        {pipeline && STEPS.slice(1).map((step) => {
          const prevComplete = stepResults[step.num - 1]?.status === "complete";
          if (!prevComplete) return null;
          return (
            <StepResultCard key={step.num} step={step} result={stepResults[step.num]} onRun={() => runStep(step.num)} />
          );
        })}
      </div>

      {/* History */}
      {history.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Pipeline History</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {history.map(h => (
              <div key={h.id} className="flex items-center justify-between text-xs p-2 rounded-md border hover:bg-muted/30 cursor-pointer" onClick={() => { setPipeline(h); setCurrentStep(h.current_step || 0); }}>
                <span className="font-medium">{h.industry}</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Step {h.current_step || 0}/12</span>
                  <Badge variant="outline" className="text-[10px]">{h.status}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StepResultCard({ step, result, onRun }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <Card className={result?.status === "complete" ? "border-green-500/20" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${
              result?.status === "complete" ? "bg-green-500/10 border-green-500/30" :
              result?.status === "running" ? "bg-yellow-500/10 border-yellow-500/30" :
              result?.status === "error" ? "bg-red-500/10 border-red-500/30" :
              "bg-muted/30 border-border"
            }`}>
              {result?.status === "complete" ? <CheckCircle2 className="w-4 h-4 text-green-500" /> :
               result?.status === "running" ? <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" /> :
               result?.status === "error" ? <AlertCircle className="w-4 h-4 text-red-500" /> :
               <step.icon className="w-4 h-4 text-muted-foreground" />}
            </div>
            <div>
              <CardTitle className="text-sm flex items-center gap-1.5">
                <span className="text-primary font-heading">{step.num}.</span> {step.name}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{step.desc}</p>
            </div>
          </div>
          {onRun && result?.status !== "running" && (
            <Button size="sm" variant="outline" onClick={onRun}>
              {result?.status === "complete" ? "Re-run" : "Run"} <step.icon className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          )}
        </div>
      </CardHeader>
      {result && (
        <CardContent>
          {result.status === "error" ? (
            <p className="text-sm text-destructive">{result.error}</p>
          ) : result.status === "complete" ? (
            <div className="space-y-2">
              <button onClick={() => setExpanded(!expanded)} className="text-xs text-primary hover:underline">
                {expanded ? "Hide" : "Show"} results
              </button>
              {expanded && (
                <pre className="p-3 rounded-lg border bg-muted/20 text-xs overflow-auto max-h-80 xa-scroll">
                  <code>{formatResult(result.data)}</code>
                </pre>
              )}
            </div>
          ) : result.status === "running" ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Processing...
            </p>
          ) : null}
        </CardContent>
      )}
    </Card>
  );
}

function formatResult(data) {
  if (!data) return "No data";
  if (typeof data === "string") return data;
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}