import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Loader2, Globe, Brain, Shield, Zap, CheckCircle2, XCircle, AlertCircle,
  Database, Lock, Server, Wifi, ShieldAlert, CreditCard, Search, Radio,
  Sparkles, ArrowRight, RefreshCw, Target,
} from "lucide-react";

const GAP_TYPE_ICONS = {
  database: Database,
  oauth: Lock,
  server_logic: Server,
  websocket: Wifi,
  firewall: ShieldAlert,
  payment: CreditCard,
  search: Search,
  realtime: Radio,
  unknown: AlertCircle,
};

const AUTONOMY_CONFIG = {
  fully_autonomous: { label: "Fully Autonomous", color: "text-emerald-500", bg: "bg-emerald-500/10", icon: CheckCircle2 },
  semi_autonomous: { label: "Semi-Autonomous", color: "text-blue-500", bg: "bg-blue-500/10", icon: Zap },
  inference_engine: { label: "Inference Engine", color: "text-amber-500", bg: "bg-amber-500/10", icon: Brain },
  unresolved: { label: "Unresolved", color: "text-red-500", bg: "bg-red-500/10", icon: XCircle },
};

const STRATEGY_LABELS = {
  template: "Template Match",
  seed_data: "Data Seeding",
  scrape_similar: "Similar System Scrape",
  infer_llm: "LLM Inference",
};

export default function GapPlayground() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const handleRun = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await base44.functions.invoke("runGapPlayground", { target_url: url.trim() });
      const data = response.data || response;
      if (!data.ok) {
        setError(data.error || "Analysis failed");
      } else {
        setResult(data);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleProceed = async () => {
    if (!result?.project_id) return;
    setLoading(true);
    try {
      const response = await base44.functions.invoke("runDeepClonePipeline", {
        target_url: result.target_url,
        skip_deployment: false,
      });
      const data = response.data || response;
      if (data.ok) {
        window.location.href = "/clone-studio";
      } else {
        setError(data.error || "Full clone failed");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Target className="w-5 h-5" />
          Gap Intelligence Playground
        </h1>
        <p className="text-sm text-muted-foreground">
          Test the gap intelligence engine against a single URL — classify and resolve all unclonable areas before committing to a full clone.
        </p>
      </div>

      {/* Input */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 flex items-center gap-2">
              <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
              <Input
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !loading && handleRun()}
                disabled={loading}
                className="flex-1"
              />
            </div>
            <Button onClick={handleRun} disabled={loading || !url.trim()}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
              {loading ? "Analyzing..." : "Run Gap Analysis"}
            </Button>
          </div>
          {error && (
            <div className="flex items-center gap-2 mt-2 text-sm text-red-500">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
          {loading && !result && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Capturing site, classifying gaps, and resolving with multi-strategy engine...
              </div>
              <Progress value={66} className="h-1.5" />
              <p className="text-xs text-muted-foreground">This runs Phase 1 (Acquisition) + Phase 2 (Gap Intelligence) without deploying.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">Total Gaps</p>
                <p className="text-2xl font-bold mt-1">{result.summary.total_gaps}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">Endpoints</p>
                <p className="text-2xl font-bold mt-1">{result.summary.endpoints_discovered}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">Avg Confidence</p>
                <p className="text-2xl font-bold mt-1">{result.summary.avg_confidence}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground">Stack Type</p>
                <p className="text-sm font-bold mt-1">{result.summary.stack_type}</p>
              </CardContent>
            </Card>
          </div>

          {/* Autonomy Breakdown */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Autonomy Breakdown
              </CardTitle>
              <CardDescription className="text-xs">Which parts are fully autonomous vs. which rely on the inference engine</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(AUTONOMY_CONFIG).map(([key, config]) => {
                  const count = result.summary.by_autonomy[key] || 0;
                  const pct = result.summary.total_gaps > 0 ? Math.round((count / result.summary.total_gaps) * 100) : 0;
                  const Icon = config.icon;
                  return (
                    <div key={key} className={`rounded-lg border p-3 ${config.bg}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className={`w-4 h-4 ${config.color}`} />
                        <span className="text-xs font-medium">{config.label}</span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className={`text-2xl font-bold ${config.color}`}>{count}</span>
                        <span className="text-xs text-muted-foreground">({pct}%)</span>
                      </div>
                      <Progress value={pct} className="h-1.5 mt-2" />
                    </div>
                  );
                })}
              </div>
              {result.recommendation && (
                <div className="mt-3 flex items-start gap-2 p-3 rounded-md bg-muted/30 border text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 text-blue-500 mt-0.5" />
                  <span>{result.recommendation}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Gap Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Identified Gaps ({result.gaps.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {result.gaps.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No gaps identified — this site may be fully clonable with standard templates.</p>
              ) : (
                <div className="space-y-2">
                  {result.gaps.map((gap) => {
                    const GapIcon = GAP_TYPE_ICONS[gap.gap_type] || AlertCircle;
                    const autoConfig = AUTONOMY_CONFIG[gap.autonomy_level] || AUTONOMY_CONFIG.unresolved;
                    return (
                      <div key={gap.id} className="rounded-lg border p-3 space-y-2">
                        <div className="flex items-start gap-2">
                          <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${autoConfig.bg}`}>
                            <GapIcon className={`w-4 h-4 ${autoConfig.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-xs">{gap.gap_type}</Badge>
                              {gap.inferred_method && (
                                <span className="font-mono text-xs text-muted-foreground">{gap.inferred_method} {gap.inferred_endpoint}</span>
                              )}
                              {gap.definitive && (
                                <Badge variant="outline" className="text-xs text-emerald-500">
                                  <CheckCircle2 className="w-3 h-3 mr-1" /> Definitive
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{gap.description}</p>
                          </div>
                          <Badge variant="outline" className={`text-xs shrink-0 ${autoConfig.color} ${autoConfig.bg}`}>
                            {autoConfig.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs pl-10">
                          {gap.resolution_strategy && (
                            <span className="flex items-center gap-1">
                              <Zap className="w-3 h-3" />
                              {STRATEGY_LABELS[gap.resolution_strategy] || gap.resolution_strategy}
                            </span>
                          )}
                          {gap.template_matched && (
                            <span className="font-mono text-muted-foreground">template: {gap.template_matched}</span>
                          )}
                          <span className="flex items-center gap-1 ml-auto">
                            <Target className="w-3 h-3" />
                            {gap.confidence_score}% confidence
                          </span>
                        </div>
                        {gap.classification_evidence?.length > 0 && (
                          <div className="pl-10 flex flex-wrap gap-1">
                            {gap.classification_evidence.slice(0, 3).map((ev, i) => (
                              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground font-mono">{ev}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Proceed Button */}
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => { setResult(null); setUrl(""); }}>
              <RefreshCw className="w-4 h-4" /> Test Another URL
            </Button>
            <Button onClick={handleProceed} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              Proceed to Full Clone
            </Button>
          </div>
        </>
      )}
    </div>
  );
}