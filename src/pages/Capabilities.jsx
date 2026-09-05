import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CheckCircle2, XCircle, AlertCircle, Shield, ShieldCheck, Trophy, RefreshCw,
  ChevronDown, ChevronRight, ArrowRightLeft, Eye, Sparkles, AlertTriangle,
  Cloud, Zap, Target, ListChecks, BookOpen, Brain, Rocket, Play, Loader2,
  TrendingUp, TrendingDown, Lightbulb, Crown,
} from 'lucide-react';
import {
  CURRENT_CAPABILITIES, XTREMEAI_CAPABILITIES, FAULTLINE_CAPABILITIES,
  VISIONCORTEX_CAPABILITIES, ALL_POSSIBLE_CAPABILITIES, GAP_ANALYSIS,
  VISION_CORTEX_STRATEGIES, VISION_CORTEX_PLAYBOOK, ALL_CAPABILITIES,
  SYSTEM_SOURCES, SCORE_DIMENSIONS,
} from '@/components/capabilities/comprehensiveCapabilitiesData';

const STATUS_COLORS = {
  implemented: 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30',
  partial: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30',
  gap: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
};

const SCORE_COLORS = (score) => {
  if (score >= 90) return 'text-green-600 dark:text-green-400';
  if (score >= 70) return 'text-yellow-600 dark:text-yellow-400';
  if (score >= 50) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
};

const SEVERITY_COLORS = {
  critical: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
  high: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30',
  low: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
};

const SOURCE_ICONS = {
  cloud_browser: Cloud,
  xtremeaibuilder: Sparkles,
  faultline: AlertTriangle,
  visioncortex: Eye,
};

export default function Capabilities() {
  const [scoreData, setScoreData] = useState(null);
  const [matrixData, setMatrixData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedCategories, setExpandedCategories] = useState(new Set());
  const [showGapsOnly, setShowGapsOnly] = useState(false);
  const [sourceFilter, setSourceFilter] = useState('all');

  const loadData = async () => {
    setLoading(true);
    try {
      const [matrixRes] = await Promise.all([
        base44.functions.invoke('getCapabilityMatrix', {}).catch(() => null),
      ]);
      if (matrixRes?.data) setMatrixData(matrixRes.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const runScore = async () => {
    setScoring(true);
    try {
      const res = await base44.functions.invoke('runComprehensiveScore', { run_tests: true });
      setScoreData(res.data);
    } catch (e) { console.error(e); }
    setScoring(false);
  };

  useEffect(() => { loadData(); }, []);

  const toggleCategory = (key) => {
    const next = new Set(expandedCategories);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedCategories(next);
  };

  // Group capabilities by category
  const groupedCaps = useMemo(() => {
    const filter = sourceFilter === 'all' ? ALL_CAPABILITIES : ALL_CAPABILITIES.filter(c => c.source === sourceFilter);
    const groups = {};
    for (const cap of filter) {
      if (!groups[cap.category]) groups[cap.category] = [];
      groups[cap.category].push(cap);
    }
    return groups;
  }, [sourceFilter]);

  // Stats
  const stats = useMemo(() => {
    const implemented = ALL_CAPABILITIES.filter(c => c.status === 'implemented').length;
    const partial = ALL_CAPABILITIES.filter(c => c.status === 'partial').length;
    const gaps = ALL_CAPABILITIES.filter(c => c.status === 'gap').length;
    const avgScore = Math.round(ALL_CAPABILITIES.filter(c => c.score > 0).reduce((s, c) => s + c.score, 0) / ALL_CAPABILITIES.filter(c => c.score > 0).length);
    return { total: ALL_CAPABILITIES.length, implemented, partial, gaps, avgScore };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              Comprehensive Capabilities
            </h1>
            <p className="text-sm text-muted-foreground">
              All system capabilities, imported tools, gaps, and scoring — from Cloud Browser + Xtreme AI Builder + Fault-Line 3 + Vision Cortex
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadData}>
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh
            </Button>
            <Button size="sm" onClick={runScore} disabled={scoring}>
              {scoring ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              {scoring ? 'Scoring...' : 'Run Score Test'}
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Total Capabilities</span>
            </div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Implemented</span>
            </div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.implemented}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-4 h-4 text-yellow-500" />
              <span className="text-xs text-muted-foreground">Partial</span>
            </div>
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.partial}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="w-4 h-4 text-red-500" />
              <span className="text-xs text-muted-foreground">Gaps</span>
            </div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.gaps}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Target className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Avg Score</span>
            </div>
            <div className={`text-2xl font-bold ${SCORE_COLORS(stats.avgScore)}`}>{stats.avgScore}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-orange-500" />
              <span className="text-xs text-muted-foreground">Score Test</span>
            </div>
            <div className={`text-2xl font-bold ${scoreData ? SCORE_COLORS(scoreData.overall_score) : 'text-muted-foreground'}`}>
              {scoreData ? scoreData.overall_score : '—'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Score Test Results */}
      {scoreData && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="w-4 h-4" /> Comprehensive Score Test Results
              <Badge className={SCORE_COLORS(scoreData.overall_score) + ' border-0 ml-auto'}>
                {scoreData.overall_score}/100
              </Badge>
              <Badge variant="outline" className={
                scoreData.launch_readiness === 'launch_ready' ? 'border-green-500/30 text-green-600' :
                scoreData.launch_readiness === 'near_ready' ? 'border-yellow-500/30 text-yellow-600' :
                'border-red-500/30 text-red-600'
              }>
                {scoreData.launch_readiness.replace('_', ' ')}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Dimension Scores */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {scoreData.dimensions.map((d) => (
                <div key={d.key} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{d.label}</span>
                    <Badge className={SCORE_COLORS(d.score) + ' border-0'}>{d.score}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={d.score} className="h-1.5 flex-1" />
                    <span className="text-xs text-muted-foreground">{d.weight}%</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {d.capabilities_tested} tested · {d.gaps.length} gaps · weighted: {d.weighted_score}
                  </div>
                </div>
              ))}
            </div>

            {/* Critical Failures */}
            {scoreData.critical_failures?.length > 0 && (
              <div className="border border-red-500/30 rounded-lg p-3 bg-red-500/5">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-semibold text-red-600">Critical Failures (score capped)</span>
                </div>
                {scoreData.critical_failures.map((cf, i) => (
                  <div key={i} className="text-sm text-red-600 dark:text-red-400">
                    {cf.dimension}: {cf.score}/100
                  </div>
                ))}
              </div>
            )}

            {/* Perfection Report */}
            {scoreData.perfection_report && (
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-semibold">AI Perfection Report</span>
                </div>
                <p className="text-sm text-muted-foreground">{scoreData.perfection_report.overall_assessment}</p>
                {scoreData.perfection_report.top_3_priorities?.length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Top 3 Priorities:</span>
                    <ul className="mt-1 space-y-1">
                      {scoreData.perfection_report.top_3_priorities.map((p, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <span className="text-primary font-bold">{i + 1}.</span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Perfection Path:</span>
                  <p className="text-sm mt-1">{scoreData.perfection_report.perfection_path}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Benchmark Comparison:</span>
                  <p className="text-sm mt-1">{scoreData.perfection_report.benchmark_comparison}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full">
          <TabsTrigger value="overview" className="text-xs md:text-sm"><ListChecks className="w-4 h-4 mr-1 md:mr-2" />All Capabilities</TabsTrigger>
          <TabsTrigger value="current" className="text-xs md:text-sm"><Cloud className="w-4 h-4 mr-1 md:mr-2" />Current System</TabsTrigger>
          <TabsTrigger value="imported" className="text-xs md:text-sm"><Sparkles className="w-4 h-4 mr-1 md:mr-2" />Imported Tools</TabsTrigger>
          <TabsTrigger value="gaps" className="text-xs md:text-sm"><ArrowRightLeft className="w-4 h-4 mr-1 md:mr-2" />Gaps</TabsTrigger>
          <TabsTrigger value="vision" className="text-xs md:text-sm"><Eye className="w-4 h-4 mr-1 md:mr-2" />Vision Cortex</TabsTrigger>
        </TabsList>

        {/* All Capabilities Tab */}
        <TabsContent value="overview" className="space-y-4">
          {/* Source Filter */}
          <div className="flex flex-wrap gap-2">
            <Button variant={sourceFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setSourceFilter('all')}>All Sources</Button>
            {SYSTEM_SOURCES.map(s => (
              <Button key={s.id} variant={sourceFilter === s.id ? 'default' : 'outline'} size="sm" onClick={() => setSourceFilter(s.id)}>
                {s.name}
              </Button>
            ))}
            <Button variant={showGapsOnly ? 'default' : 'outline'} size="sm" onClick={() => setShowGapsOnly(!showGapsOnly)}>
              {showGapsOnly ? 'Show All' : 'Gaps Only'}
            </Button>
          </div>

          {/* Capability Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 sticky top-0">
                      <th className="text-left p-2 font-semibold min-w-[200px]">Capability</th>
                      <th className="text-left p-2 font-semibold min-w-[250px] hidden md:table-cell">Description</th>
                      <th className="text-center p-2 font-semibold w-20">Status</th>
                      <th className="text-center p-2 font-semibold w-16 hidden md:table-cell">Source</th>
                      <th className="text-center p-2 font-semibold w-16">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(groupedCaps).map(([category, caps]) => {
                      const visibleCaps = showGapsOnly ? caps.filter(c => c.status !== 'implemented') : caps;
                      if (visibleCaps.length === 0) return null;
                      const isExpanded = expandedCategories.has(category) || showGapsOnly;
                      const catAvg = caps.length > 0 ? Math.round(caps.reduce((s, c) => s + (c.score || 0), 0) / caps.length) : 0;
                      return (
                        <React.Fragment key={category}>
                          <tr
                            className="border-b bg-slate-50 dark:bg-slate-900/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900"
                            onClick={() => toggleCategory(category)}
                          >
                            <td colSpan={5} className="p-2 font-semibold">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                  {category}
                                </div>
                                <Badge className={SCORE_COLORS(catAvg) + ' border-0'}>Avg: {catAvg} · {caps.length} caps</Badge>
                              </div>
                            </td>
                          </tr>
                          {isExpanded && visibleCaps.map((cap, capIdx) => {
                            const SourceIcon = SOURCE_ICONS[cap.source] || Cloud;
                            return (
                              <tr key={`${category}-${capIdx}`} className="border-b hover:bg-muted/30">
                                <td className="p-2 font-medium align-top">{cap.name}</td>
                                <td className="p-2 text-muted-foreground align-top text-xs hidden md:table-cell">{cap.description}</td>
                                <td className="p-2 text-center align-top">
                                  <Badge variant="outline" className={STATUS_COLORS[cap.status] + ' text-xs'}>
                                    {cap.status}
                                  </Badge>
                                </td>
                                <td className="p-2 text-center align-top hidden md:table-cell">
                                  <SourceIcon className="w-4 h-4 mx-auto text-muted-foreground" />
                                </td>
                                <td className={`p-2 text-center align-top font-bold ${SCORE_COLORS(cap.score || 0)}`}>
                                  {cap.score || 0}
                                </td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Current System Tab */}
        <TabsContent value="current" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Cloud className="w-4 h-4 text-blue-500" /> Current System Capabilities
                <Badge className="ml-auto">{CURRENT_CAPABILITIES.length} capabilities</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {CURRENT_CAPABILITIES.map((cap, i) => (
                  <div key={i} className="flex items-start gap-3 p-2 border rounded-md">
                    <Badge variant="outline" className={STATUS_COLORS[cap.status] + ' text-xs shrink-0'}>
                      {cap.status}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{cap.name}</span>
                        <span className={`text-sm font-bold ${SCORE_COLORS(cap.score)}`}>{cap.score}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{cap.description}</p>
                      <Badge variant="outline" className="text-xs mt-1">{cap.category}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Imported Tools Tab */}
        <TabsContent value="imported" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Xtreme AI Builder */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" /> Xtreme AI Builder
                  <Badge className="ml-auto">{XTREMEAI_CAPABILITIES.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {XTREMEAI_CAPABILITIES.map((cap, i) => (
                    <div key={i} className="flex items-start gap-2 p-1.5 border rounded text-xs">
                      <Badge variant="outline" className={STATUS_COLORS[cap.status] + ' text-xs shrink-0'}>
                        {cap.category}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{cap.name}</span>
                        <p className="text-muted-foreground mt-0.5">{cap.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Fault-Line 3 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-500" /> Fault-Line 3
                  <Badge className="ml-auto">{FAULTLINE_CAPABILITIES.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {FAULTLINE_CAPABILITIES.map((cap, i) => (
                    <div key={i} className="flex items-start gap-2 p-1.5 border rounded text-xs">
                      <Badge variant="outline" className={STATUS_COLORS[cap.status] + ' text-xs shrink-0'}>
                        {cap.category}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{cap.name}</span>
                        <p className="text-muted-foreground mt-0.5">{cap.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Vision Cortex */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Eye className="w-4 h-4 text-green-500" /> Vision Cortex
                  <Badge className="ml-auto">{VISIONCORTEX_CAPABILITIES.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {VISIONCORTEX_CAPABILITIES.map((cap, i) => (
                    <div key={i} className="flex items-start gap-2 p-1.5 border rounded text-xs">
                      <Badge variant="outline" className={STATUS_COLORS[cap.status] + ' text-xs shrink-0'}>
                        {cap.category}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{cap.name}</span>
                        <p className="text-muted-foreground mt-0.5">{cap.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* All Possible Capabilities */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Rocket className="w-4 h-4 text-blue-500" /> All Possible Capabilities for a Browser Automation System
                <Badge className="ml-auto">{ALL_POSSIBLE_CAPABILITIES.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {ALL_POSSIBLE_CAPABILITIES.map((cap, i) => (
                  <div key={i} className="flex items-start gap-3 p-2 border rounded-md">
                    <Badge variant="outline" className={STATUS_COLORS[cap.status] + ' text-xs shrink-0'}>
                      {cap.status}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{cap.name}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{cap.description}</p>
                      <Badge variant="outline" className="text-xs mt-1">{cap.category}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Gaps Tab */}
        <TabsContent value="gaps" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4" /> Gap Analysis — {GAP_ANALYSIS.length} gaps identified
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {GAP_ANALYSIS.map((g, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 border rounded-md">
                    <Badge variant="outline" className={SEVERITY_COLORS[g.severity] + ' text-xs shrink-0'}>
                      {g.severity}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{g.gap}</span>
                        <Badge variant="outline" className="text-xs">{g.category}</Badge>
                        {g.closable && <Badge variant="outline" className="text-xs text-green-600 border-green-500/30">Closable</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{g.recommendation}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-xs text-muted-foreground">Source:</span>
                        <Badge variant="outline" className="text-xs">{g.source}</Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vision Cortex Tab */}
        <TabsContent value="vision" className="space-y-4">
          {/* Strategies */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-green-500" /> Vision Cortex Strategic Enhancements
                <Badge className="ml-auto">{VISION_CORTEX_STRATEGIES.length} strategies</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {VISION_CORTEX_STRATEGIES.map((s, i) => (
                  <div key={i} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Crown className="w-4 h-4 text-yellow-500" />
                      <span className="text-sm font-semibold">{s.name}</span>
                      <Badge variant="outline" className={
                        s.priority === 'critical' ? 'text-red-600 border-red-500/30 text-xs ml-auto' :
                        s.priority === 'high' ? 'text-orange-600 border-orange-500/30 text-xs ml-auto' :
                        'text-yellow-600 border-yellow-500/30 text-xs ml-auto'
                      }>
                        {s.priority}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{s.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Skill Playbook */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-500" /> Skill Playbook
                <Badge className="ml-auto">{VISION_CORTEX_PLAYBOOK.length} playbooks</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {VISION_CORTEX_PLAYBOOK.map((p, i) => (
                  <div key={i} className="border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-4 h-4 text-orange-500" />
                      <span className="text-sm font-semibold">{p.skill}</span>
                      <Badge variant="outline" className="text-xs ml-auto">{p.source}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{p.playbook}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Scoring Dimensions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="w-4 h-4 text-purple-500" /> Scoring Dimensions
                <Badge className="ml-auto">{SCORE_DIMENSIONS.length} dimensions</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {SCORE_DIMENSIONS.map((d, i) => (
                  <div key={i} className="border rounded-lg p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{d.label}</span>
                      <Badge variant="outline" className="text-xs">{d.weight}%</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{d.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}