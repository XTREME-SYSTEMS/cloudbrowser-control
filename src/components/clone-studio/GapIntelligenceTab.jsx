import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Brain, Shield, Database, Server, Zap, Globe, Loader2,
  CheckCircle2, XCircle, AlertCircle, Sparkles, Search,
  FileCode, Layers, RefreshCw, ChevronDown, ChevronRight,
} from "lucide-react";

const GAP_TYPE_CONFIG = {
  database: { label: "Database", icon: Database, color: "text-blue-500", bg: "bg-blue-500/10" },
  oauth: { label: "OAuth", icon: Shield, color: "text-purple-500", bg: "bg-purple-500/10" },
  server_logic: { label: "Server Logic", icon: Server, color: "text-amber-500", bg: "bg-amber-500/10" },
  websocket: { label: "WebSocket", icon: Zap, color: "text-cyan-500", bg: "bg-cyan-500/10" },
  firewall: { label: "Firewall", icon: Shield, color: "text-red-500", bg: "bg-red-500/10" },
  payment: { label: "Payment", icon: Globe, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  search: { label: "Search", icon: Search, color: "text-indigo-500", bg: "bg-indigo-500/10" },
  realtime: { label: "Realtime", icon: Zap, color: "text-orange-500", bg: "bg-orange-500/10" },
  unknown: { label: "Unknown", icon: AlertCircle, color: "text-gray-500", bg: "bg-gray-500/10" },
};

const STRATEGY_CONFIG = {
  seed_data: { label: "Seed Data", icon: Database, desc: "Scraped site's own public content to seed mock database" },
  scrape_similar: { label: "Scrape Similar", icon: Search, desc: "Found similar sites and inferred their API schemas" },
  template: { label: "Template", icon: FileCode, desc: "Matched against route template catalog" },
  infer_llm: { label: "LLM Inference", icon: Brain, desc: "LLM-generated mock handler (last resort)" },
};

export default function GapIntelligenceTab({ project, gaps, onRefresh }) {
  const [classifying, setClassifying] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [expandedGap, setExpandedGap] = useState(null);
  const [resolutions, setResolutions] = useState([]);
  const [result, setResult] = useState(null);

  // Load resolutions for this project
  useEffect(() => {
    if (!project?.id) return;
    (async () => {
      try {
        const res = await base44.entities.GapResolution.filter({ clone_project_id: project.id });
        setResolutions(res);
      } catch {}
    })();
  }, [project?.id, gaps]);

  const handleClassify = async () => {
    setClassifying(true);
    setResult(null);
    try {
      const response = await base44.functions.invoke("classifyGapsDefinitively", {
        clone_project_id: project.id,
      });
      setResult(response.data || response);
      onRefresh();
    } catch (e) {
      setResult({ error: e.message });
    } finally {
      setClassifying(false);
    }
  };

  const handleResolveAll = async () => {
    setResolving(true);
    setResult(null);
    try {
      const response = await base44.functions.invoke("resolveAllGaps", {
        clone_project_id: project.id,
        batch_limit: 5,
      });
      setResult(response.data || response);
      onRefresh();
    } catch (e) {
      setResult({ error: e.message });
    } finally {
      setResolving(false);
    }
  };

  const handleSeedDatabase = async () => {
    setSeeding(true);
    setResult(null);
    try {
      const response = await base44.functions.invoke("seedGapDatabase", {
        clone_project_id: project.id,
      });
      setResult(response.data || response);
      onRefresh();
    } catch (e) {
      setResult({ error: e.message });
    } finally {
      setSeeding(false);
    }
  };

  const handleScrapeSimilar = async (gapType) => {
    setScraping(true);
    setResult(null);
    try {
      const response = await base44.functions.invoke("scrapeSimilarSystems", {
        clone_project_id: project.id,
        gap_type: gapType,
      });
      setResult(response.data || response);
      onRefresh();
    } catch (e) {
      setResult({ error: e.message });
    } finally {
      setScraping(false);
    }
  };

  // Calculate stats
  const totalGaps = gaps.length;
  const resolvedGaps = gaps.filter((g) => g.status === "resolved").length;
  const definitiveGaps = gaps.filter((g) => g.definitive).length;
  const gapTypeCounts = gaps.reduce((acc, g) => {
    acc[g.gap_type] = (acc[g.gap_type] || 0) + 1;
    return acc;
  }, {});

  const resolutionMap = new Map(resolutions.map((r) => [r.clone_gap_id, r]));

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-gold-gradient flex items-center justify-center shrink-0">
              <Brain className="w-5 h-5 text-black" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold">Gap Intelligence Engine</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Definitively classifies unclonable backend areas using HTTP evidence, then resolves each gap
                with data seeding, similar-system scraping, template matching, or LLM inference.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 mt-3">
            <Button size="sm" onClick={handleClassify} disabled={classifying || resolving}>
              {classifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              Classify Gaps
            </Button>
            <Button size="sm" onClick={handleResolveAll} disabled={classifying || resolving || totalGaps === 0}>
              {resolving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Resolve All Gaps
            </Button>
            <Button size="sm" variant="outline" onClick={handleSeedDatabase} disabled={seeding}>
              {seeding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
              Seed Database
            </Button>
          </div>

          {/* Result */}
          {result && (
            <div className={`mt-3 p-2 rounded-md text-xs ${result.error ? "bg-red-500/10 text-red-500" : "bg-emerald-500/10 text-emerald-500"}`}>
              {result.error ? (
                <span className="flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> {result.error}</span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {result.status === "complete"
                    ? `Complete — ${result.resolved}/${result.total_gaps} resolved`
                    : result.total_gaps != null
                    ? `Classified ${result.total_gaps} gaps (${result.definitive_gaps} definitive) — industry: ${result.industry_detected}`
                    : "Operation complete"}
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-3 pb-3">
            <p className="text-xs text-muted-foreground">Total Gaps</p>
            <p className="text-2xl font-bold mt-0.5">{totalGaps}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <p className="text-xs text-muted-foreground">Definitive</p>
            <p className="text-2xl font-bold mt-0.5 text-blue-500">{definitiveGaps}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <p className="text-xs text-muted-foreground">Resolved</p>
            <p className="text-2xl font-bold mt-0.5 text-emerald-500">{resolvedGaps}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <p className="text-xs text-muted-foreground">Industry</p>
            <p className="text-sm font-bold mt-0.5 capitalize">{gaps[0]?.industry_detected || "generic"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Resolution Progress */}
      {totalGaps > 0 && (
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Resolution Progress</span>
              <span className="text-xs font-bold">{resolvedGaps}/{totalGaps}</span>
            </div>
            <Progress value={(resolvedGaps / totalGaps) * 100} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Gap Type Distribution */}
      {Object.keys(gapTypeCounts).length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Gap Type Distribution</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(gapTypeCounts).map(([type, count]) => {
              const config = GAP_TYPE_CONFIG[type] || GAP_TYPE_CONFIG.unknown;
              const Icon = config.icon;
              return (
                <Badge key={type} variant="outline" className={`${config.color} ${config.bg}`}>
                  <Icon className="w-3 h-3 mr-1" />
                  {config.label}: {count}
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      {/* Gap List */}
      <div>
        <p className="text-sm font-medium mb-2 flex items-center gap-1.5">
          <Layers className="w-4 h-4" /> Unclonable Gaps ({gaps.length})
        </p>
        {gaps.length === 0 ? (
          <Card>
            <CardContent className="pt-6 pb-6 flex flex-col items-center gap-2 text-center">
              <Brain className="w-8 h-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                No gaps classified yet. Run "Classify Gaps" to definitively identify unclonable backend areas.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {gaps.map((gap) => {
              const config = GAP_TYPE_CONFIG[gap.gap_type] || GAP_TYPE_CONFIG.unknown;
              const Icon = config.icon;
              const resolution = resolutionMap.get(gap.id);
              const isExpanded = expandedGap === gap.id;
              const stratConfig = gap.resolution_strategy ? STRATEGY_CONFIG[gap.resolution_strategy] : null;

              return (
                <Card key={gap.id} className="overflow-hidden">
                  <CardContent className="pt-3 pb-3">
                    {/* Gap Header */}
                    <div
                      className="flex items-center gap-2 cursor-pointer"
                      onClick={() => setExpandedGap(isExpanded ? null : gap.id)}
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                      <div className={`w-7 h-7 rounded-md ${config.bg} flex items-center justify-center shrink-0`}>
                        <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-xs shrink-0 ${config.color}`}>
                            {config.label}
                          </Badge>
                          {gap.definitive && (
                            <Badge variant="outline" className="text-xs shrink-0 text-blue-500 border-blue-500/30">
                              Definitive
                            </Badge>
                          )}
                          <span className="font-mono text-xs truncate">
                            {gap.inferred_method} {gap.inferred_endpoint}
                          </span>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-xs shrink-0 ${
                          gap.status === "resolved" ? "text-emerald-500" :
                          gap.status === "unresolved" ? "text-red-500" :
                          gap.status === "classifying" ? "text-blue-500" :
                          "text-amber-500"
                        }`}
                      >
                        {gap.status}
                      </Badge>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="mt-3 space-y-3 border-t pt-3">
                        {/* Classification Evidence */}
                        {gap.classification_evidence?.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                              <Search className="w-3 h-3" /> Classification Evidence
                            </p>
                            <div className="space-y-0.5">
                              {gap.classification_evidence.map((ev, i) => (
                                <div key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                                  <span className="text-blue-500 mt-0.5">•</span>
                                  <span>{ev}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Resolution Strategy */}
                        {stratConfig && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                              <Sparkles className="w-3 h-3" /> Resolution: {stratConfig.label}
                            </p>
                            <p className="text-xs text-muted-foreground">{stratConfig.desc}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-muted-foreground">Confidence:</span>
                              <Progress value={gap.confidence_score || 0} className="h-1.5 w-24" />
                              <span className="text-xs font-bold">{gap.confidence_score || 0}%</span>
                            </div>
                          </div>
                        )}

                        {/* Seed Data */}
                        {gap.seed_data && Object.keys(gap.seed_data).length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                              <Database className="w-3 h-3" /> Seed Data ({Object.keys(gap.seed_data).length} collections)
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(gap.seed_data).map(([name, records]) => (
                                <Badge key={name} variant="outline" className="text-xs">
                                  {name}: {records.length} records
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Similar Systems */}
                        {gap.similar_systems_found?.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                              <Globe className="w-3 h-3" /> Similar Systems Found ({gap.similar_systems_found.length})
                            </p>
                            <div className="space-y-1">
                              {gap.similar_systems_found.slice(0, 3).map((s, i) => (
                                <div key={i} className="text-xs flex items-center gap-2">
                                  <span className="font-mono truncate">{s.url}</span>
                                  <Badge variant="outline" className="text-xs shrink-0">
                                    {Math.round((s.relevance || 0) * 100)}%
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Template Matched */}
                        {gap.template_matched && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                              <FileCode className="w-3 h-3" /> Template Matched
                            </p>
                            <p className="text-xs font-mono">{gap.template_matched}</p>
                          </div>
                        )}

                        {/* Generated Code */}
                        {gap.generated_code && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                              <FileCode className="w-3 h-3" /> Generated Mock Code
                            </p>
                            <pre className="text-xs font-mono p-2 rounded-md bg-muted/20 border overflow-x-auto max-h-48 overflow-y-auto">
                              {gap.generated_code.substring(0, 2000)}
                            </pre>
                          </div>
                        )}

                        {/* Resolution Summary */}
                        {resolution?.resolution_summary && (
                          <div className="text-xs text-emerald-500 flex items-start gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span>{resolution.resolution_summary}</span>
                          </div>
                        )}

                        {/* Scrape Similar Button */}
                        {gap.gap_type !== "database" && gap.gap_type !== "oauth" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7"
                            onClick={() => handleScrapeSimilar(gap.gap_type)}
                            disabled={scraping}
                          >
                            {scraping ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                            Find Similar Systems
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}