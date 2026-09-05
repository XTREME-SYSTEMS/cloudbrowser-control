import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Eye, Brain, DollarSign, Sparkles, RefreshCw, Play, Loader2, TrendingUp,
  Target, Lightbulb, Crown, AlertTriangle, CheckCircle2, ArrowRight,
  Search, Database, Zap, Activity, BookOpen,
} from 'lucide-react';

const ARTIFACT_TYPE_ICONS = {
  insight: Lightbulb,
  strategy: Target,
  playbook: BookOpen,
  keyword_cluster: Search,
  trend_signal: TrendingUp,
  money_trail: DollarSign,
  elite_motive: Crown,
  competitive_gap: AlertTriangle,
  capability_gap: Zap,
  actionable_recommendation: ArrowRight,
  system_learning: Brain,
};

const STATUS_COLORS = {
  pending: 'bg-muted text-muted-foreground',
  scraping: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  scraped: 'bg-green-500/15 text-green-600 dark:text-green-400',
  ingested: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
  failed: 'bg-red-500/15 text-red-600 dark:text-red-400',
  stale: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400',
};

export default function VisionCortexIntelligence() {
  const [seeds, setSeeds] = useState([]);
  const [artifacts, setArtifacts] = useState([]);
  const [reflections, setReflections] = useState([]);
  const [moneyTrails, setMoneyTrails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [seedRes, artRes, reflRes, moneyRes] = await Promise.all([
        base44.entities.IntelligenceSeed.list('-created_date', 50).catch(() => []),
        base44.entities.IntelligenceArtifact.list('-created_date', 50).catch(() => []),
        base44.entities.VisionCortexReflection.list('-created_date', 30).catch(() => []),
        base44.entities.MoneyTrail.list('-created_date', 30).catch(() => []),
      ]);
      setSeeds(seedRes || []);
      setArtifacts(artRes || []);
      setReflections(reflRes || []);
      setMoneyTrails(moneyRes || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const runAction = async (action, payload = {}) => {
    setActionLoading(action);
    try {
      const res = await base44.functions.invoke(action, payload);
      setLastResult({ action, data: res.data, timestamp: new Date().toISOString() });
      await loadData();
    } catch (e) {
      setLastResult({ action, error: e.message, timestamp: new Date().toISOString() });
    }
    setActionLoading(null);
  };

  const runFullCycle = async () => {
    setActionLoading('full_cycle');
    try {
      // 1. Seed intelligence sources
      await base44.functions.invoke('seedIntelligenceSources', {});
      setLastResult({ action: 'seed', message: 'Seeds created. Ingesting...' });

      // 2. Ingest intelligence
      await base44.functions.invoke('ingestIntelligence', { limit: 30 });
      setLastResult({ action: 'ingest', message: 'Intelligence ingested. Following money...' });

      // 3. Follow the money
      await base44.functions.invoke('followTheMoney', {});
      setLastResult({ action: 'money', message: 'Money tracked. Reflecting...' });

      // 4. Self-reflect
      await base44.functions.invoke('visionCortexSelfReflect', { cycle: Date.now() });
      setLastResult({ action: 'reflect', message: 'Full intelligence cycle complete.' });

      await loadData();
    } catch (e) {
      setLastResult({ action: 'full_cycle', error: e.message });
    }
    setActionLoading(null);
  };

  // Stats
  const seedStats = {
    total: seeds.length,
    pending: seeds.filter(s => s.status === 'pending').length,
    ingested: seeds.filter(s => s.status === 'ingested').length,
  };
  const artifactStats = {
    total: artifacts.length,
    highImpact: artifacts.filter(a => (a.impact_score || 0) >= 80).length,
    avgConfidence: artifacts.length > 0 ? Math.round(artifacts.reduce((s, a) => s + (a.confidence_score || 0), 0) / artifacts.length) : 0,
  };
  const reflectionStats = {
    total: reflections.length,
    eliteInvestigations: reflections.filter(r => r.reflection_type === 'elite_investigation').length,
    moneyTracking: reflections.filter(r => r.reflection_type === 'money_tracking').length,
    avgConfidence: reflections.length > 0 ? Math.round(reflections.reduce((s, r) => s + (r.confidence || 0), 0) / reflections.length) : 0,
  };
  const moneyStats = {
    total: moneyTrails.length,
    totalAmount: moneyTrails.reduce((s, m) => s + (m.amount_usd || 0), 0),
    topCategory: (() => {
      const cats = {};
      moneyTrails.forEach(m => { cats[m.category] = (cats[m.category] || 0) + 1; });
      return Object.entries(cats).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
    })(),
  };

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
              <Eye className="w-6 h-6 text-green-500" />
              Vision Cortex Intelligence
            </h1>
            <p className="text-sm text-muted-foreground">
              Autonomous intelligence system for browser automation & data acquisition — seed, ingest, reflect, follow the money
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={loadData} disabled={actionLoading !== null}>
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh
            </Button>
            <Button size="sm" onClick={runFullCycle} disabled={actionLoading !== null}>
              {actionLoading === 'full_cycle' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Run Full Intelligence Cycle
            </Button>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Button variant="outline" onClick={() => runAction('seedIntelligenceSources', {})} disabled={actionLoading !== null}>
          {actionLoading === 'seedIntelligenceSources' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
          Seed Sources
        </Button>
        <Button variant="outline" onClick={() => runAction('ingestIntelligence', { limit: 30 })} disabled={actionLoading !== null}>
          {actionLoading === 'ingestIntelligence' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Brain className="w-4 h-4 mr-2" />}
          Ingest Intelligence
        </Button>
        <Button variant="outline" onClick={() => runAction('followTheMoney', {})} disabled={actionLoading !== null}>
          {actionLoading === 'followTheMoney' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <DollarSign className="w-4 h-4 mr-2" />}
          Follow the Money
        </Button>
        <Button variant="outline" onClick={() => runAction('visionCortexSelfReflect', {})} disabled={actionLoading !== null}>
          {actionLoading === 'visionCortexSelfReflect' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
          Self-Reflect
        </Button>
      </div>

      {/* Last Result */}
      {lastResult && (
        <Card className={lastResult.error ? 'border-red-500/30' : 'border-green-500/30'}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              {lastResult.error ? (
                <AlertTriangle className="w-4 h-4 text-red-500" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              )}
              <span className="text-sm font-medium">
                {lastResult.action}: {lastResult.error || lastResult.message || 'Complete'}
              </span>
              {lastResult.data && (
                <Badge variant="outline" className="text-xs ml-auto">
                  {JSON.stringify(lastResult.data).substring(0, 100)}...
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Search className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Intelligence Seeds</span>
            </div>
            <div className="text-2xl font-bold">{seedStats.total}</div>
            <div className="text-xs text-muted-foreground">{seedStats.pending} pending · {seedStats.ingested} ingested</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Brain className="w-4 h-4 text-purple-500" />
              <span className="text-xs text-muted-foreground">Artifacts</span>
            </div>
            <div className="text-2xl font-bold">{artifactStats.total}</div>
            <div className="text-xs text-muted-foreground">{artifactStats.highImpact} high-impact · {artifactStats.avgConfidence} avg confidence</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Eye className="w-4 h-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Reflections</span>
            </div>
            <div className="text-2xl font-bold">{reflectionStats.total}</div>
            <div className="text-xs text-muted-foreground">{reflectionStats.eliteInvestigations} elite · {reflectionStats.moneyTracking} money · {reflectionStats.avgConfidence} avg conf</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-orange-500" />
              <span className="text-xs text-muted-foreground">Money Trails</span>
            </div>
            <div className="text-2xl font-bold">{moneyStats.total}</div>
            <div className="text-xs text-muted-foreground">${(moneyStats.totalAmount / 1000).toFixed(1)}B tracked · top: {moneyStats.topCategory}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full">
          <TabsTrigger value="overview" className="text-xs md:text-sm"><Activity className="w-4 h-4 mr-1 md:mr-2" />Overview</TabsTrigger>
          <TabsTrigger value="seeds" className="text-xs md:text-sm"><Search className="w-4 h-4 mr-1 md:mr-2" />Seeds</TabsTrigger>
          <TabsTrigger value="artifacts" className="text-xs md:text-sm"><Brain className="w-4 h-4 mr-1 md:mr-2" />Artifacts</TabsTrigger>
          <TabsTrigger value="reflections" className="text-xs md:text-sm"><Eye className="w-4 h-4 mr-1 md:mr-2" />Reflections</TabsTrigger>
          <TabsTrigger value="money" className="text-xs md:text-sm"><DollarSign className="w-4 h-4 mr-1 md:mr-2" />Money</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2"><Crown className="w-4 h-4 text-yellow-500" /> Elite Motive Investigation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Vision Cortex's investigation into why elites are driving hard for data and data centers.
                </p>
                {reflections.filter(r => r.reflection_type === 'elite_investigation').slice(0, 3).map((r, i) => (
                  <div key={i} className="border rounded p-2 mb-2">
                    <div className="text-sm font-medium">{r.title}</div>
                    <p className="text-xs text-muted-foreground mt-1">{r.elite_motive_analysis || r.insight}</p>
                  </div>
                ))}
                {reflections.filter(r => r.reflection_type === 'elite_investigation').length === 0 && (
                  <p className="text-xs text-muted-foreground">No elite investigations yet. Run self-reflection to begin.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2"><DollarSign className="w-4 h-4 text-orange-500" /> Money Flow Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Following the money in AI, data, and data center investments.
                </p>
                {moneyTrails.slice(0, 3).map((m, i) => (
                  <div key={i} className="border rounded p-2 mb-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{m.entity_name}</span>
                      <Badge variant="outline" className="text-xs">{m.amount_display}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{m.description}</p>
                    {m.elite_motive && <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">Motive: {m.elite_motive}</p>}
                  </div>
                ))}
                {moneyTrails.length === 0 && (
                  <p className="text-xs text-muted-foreground">No money trails yet. Run "Follow the Money" to begin.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2"><Lightbulb className="w-4 h-4 text-yellow-500" /> Top High-Impact Artifacts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {artifacts.filter(a => (a.impact_score || 0) >= 70).slice(0, 5).map((a, i) => {
                  const Icon = ARTIFACT_TYPE_ICONS[a.artifact_type] || Brain;
                  return (
                    <div key={i} className="flex items-start gap-3 p-2 border rounded">
                      <Icon className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{a.title}</span>
                          <Badge variant="outline" className="text-xs">{a.artifact_type}</Badge>
                          <Badge variant="outline" className="text-xs text-orange-600">Impact: {a.impact_score}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{a.content}</p>
                      </div>
                    </div>
                  );
                })}
                {artifacts.length === 0 && (
                  <p className="text-xs text-muted-foreground">No artifacts yet. Run "Seed Sources" then "Ingest Intelligence" to begin.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Seeds */}
        <TabsContent value="seeds" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Intelligence Seeds ({seeds.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {seeds.map((s, i) => (
                  <div key={i} className="flex items-start gap-3 p-2 border rounded">
                    <Badge className={STATUS_COLORS[s.status] + ' text-xs shrink-0 border-0'}>{s.status}</Badge>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{s.title}</span>
                        {s.rank && <Badge variant="outline" className="text-xs">#{s.rank}</Badge>}
                        <Badge variant="outline" className="text-xs">{s.intelligence_category}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{s.description}</p>
                      {s.vision_cortex_analysis && (
                        <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">{s.vision_cortex_analysis}</p>
                      )}
                    </div>
                  </div>
                ))}
                {seeds.length === 0 && <p className="text-xs text-muted-foreground">No seeds yet. Click "Seed Sources" to discover intelligence.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Artifacts */}
        <TabsContent value="artifacts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Intelligence Artifacts ({artifacts.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {artifacts.map((a, i) => {
                  const Icon = ARTIFACT_TYPE_ICONS[a.artifact_type] || Brain;
                  return (
                    <div key={i} className="flex items-start gap-3 p-3 border rounded">
                      <Icon className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{a.title}</span>
                          <Badge variant="outline" className="text-xs">{a.artifact_type}</Badge>
                          <Badge variant="outline" className="text-xs text-green-600">Conf: {a.confidence_score}</Badge>
                          <Badge variant="outline" className="text-xs text-orange-600">Impact: {a.impact_score}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{a.content}</p>
                        {a.actionable_steps && a.actionable_steps.length > 0 && (
                          <div className="mt-2">
                            <span className="text-xs font-medium">Actionable Steps:</span>
                            <ul className="mt-1 space-y-0.5">
                              {a.actionable_steps.map((step, idx) => (
                                <li key={idx} className="text-xs flex items-start gap-1">
                                  <span className="text-primary">{idx + 1}.</span>
                                  <span>{step}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {artifacts.length === 0 && <p className="text-xs text-muted-foreground">No artifacts yet. Run "Ingest Intelligence" after seeding.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reflections */}
        <TabsContent value="reflections" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Vision Cortex Reflections ({reflections.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {reflections.map((r, i) => (
                  <div key={i} className="border rounded p-3">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <Badge variant="outline" className="text-xs">{r.reflection_type}</Badge>
                      <span className="text-sm font-medium">{r.title}</span>
                      <Badge variant="outline" className="text-xs ml-auto">Conf: {r.confidence}</Badge>
                    </div>
                    <div className="space-y-1">
                      {r.observation && <p className="text-xs"><span className="font-medium text-muted-foreground">Observation:</span> {r.observation}</p>}
                      {r.insight && <p className="text-xs"><span className="font-medium text-purple-600 dark:text-purple-400">Insight:</span> {r.insight}</p>}
                      {r.learning && <p className="text-xs"><span className="font-medium text-green-600 dark:text-green-400">Learning:</span> {r.learning}</p>}
                      {r.elite_motive_analysis && <p className="text-xs"><span className="font-medium text-yellow-600 dark:text-yellow-400">Elite Motive:</span> {r.elite_motive_analysis}</p>}
                      {r.money_trail_insight && <p className="text-xs"><span className="font-medium text-orange-600 dark:text-orange-400">Money Insight:</span> {r.money_trail_insight}</p>}
                      {r.action_taken && <p className="text-xs"><span className="font-medium text-blue-600 dark:text-blue-400">Action:</span> {r.action_taken}</p>}
                    </div>
                  </div>
                ))}
                {reflections.length === 0 && <p className="text-xs text-muted-foreground">No reflections yet. Run "Self-Reflect" to begin.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Money */}
        <TabsContent value="money" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-orange-500" /> Money Trails ({moneyTrails.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {moneyTrails.map((m, i) => (
                  <div key={i} className="border rounded p-3">
                    <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{m.entity_name}</span>
                        <Badge variant="outline" className="text-xs">{m.entity_type}</Badge>
                      </div>
                      <Badge variant="outline" className="text-xs text-orange-600">{m.amount_display}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{m.description}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">{m.category}</Badge>
                      <Badge variant="outline" className="text-xs">{m.flow_type}</Badge>
                      <Badge variant="outline" className="text-xs">{m.direction}</Badge>
                      {m.significance && <Badge variant="outline" className="text-xs">Sig: {m.significance}/10</Badge>}
                    </div>
                    {m.elite_motive && (
                      <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                        <span className="font-medium">Elite Motive:</span> {m.elite_motive}
                      </p>
                    )}
                    {m.vision_cortex_interpretation && (
                      <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                        <span className="font-medium">Vision Cortex:</span> {m.vision_cortex_interpretation}
                      </p>
                    )}
                  </div>
                ))}
                {moneyTrails.length === 0 && <p className="text-xs text-muted-foreground">No money trails yet. Run "Follow the Money" to begin tracking.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}