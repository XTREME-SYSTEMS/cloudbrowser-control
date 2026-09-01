import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, XCircle, AlertCircle, Shield, ShieldCheck, Beaker, Trophy, RefreshCw, ChevronDown, ChevronRight, ArrowRightLeft } from 'lucide-react';

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

export default function Capabilities() {
  const [matrix, setMatrix] = useState(null);
  const [validation, setValidation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState(new Set());
  const [showGapsOnly, setShowGapsOnly] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [matrixRes, valRes] = await Promise.all([
        base44.functions.invoke('getCapabilityMatrix', {}),
        base44.functions.invoke('runFullValidation', {}).catch(() => null),
      ]);
      setMatrix(matrixRes.data);
      if (valRes) setValidation(valRes.data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const toggleCategory = (idx) => {
    const next = new Set(expandedCategories);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setExpandedCategories(next);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (!matrix) {
    return <div className="p-8 text-center text-muted-foreground">Failed to load capability matrix.</div>;
  }

  const { summary, categories, gaps, benchmark } = matrix;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold">Capability Matrix</h1>
            <p className="text-sm text-muted-foreground">
              Benchmark: <span className="font-semibold">{benchmark}</span>
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Avg Score</span>
            </div>
            <div className={`text-2xl font-bold ${SCORE_COLORS(summary.averageScore)}`}>{summary.averageScore}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Implemented</span>
            </div>
            <div className="text-2xl font-bold">{summary.implemented}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-4 h-4 text-yellow-500" />
              <span className="text-xs text-muted-foreground">Partial</span>
            </div>
            <div className="text-2xl font-bold">{summary.partial}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="w-4 h-4 text-red-500" />
              <span className="text-xs text-muted-foreground">Gaps</span>
            </div>
            <div className="text-2xl font-bold">{summary.gaps}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Hardened</span>
            </div>
            <div className="text-2xl font-bold">{summary.hardened}/{summary.totalCapabilities}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Beaker className="w-4 h-4 text-purple-500" />
              <span className="text-xs text-muted-foreground">Validated</span>
            </div>
            <div className="text-2xl font-bold">{summary.validated}/{summary.totalCapabilities}</div>
          </CardContent>
        </Card>
      </div>

      {/* Validation Suite Scores */}
      {validation && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Beaker className="w-4 h-4" /> Validation Suite Results
              <Badge className={SCORE_COLORS(validation.combinedScore) + ' border-0'}>
                {validation.combinedScore}/100
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {validation.suites.map((s) => (
                <div key={s.name} className="border rounded-lg p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{s.label}</span>
                    <Badge className={SCORE_COLORS(s.score) + ' border-0'}>{s.score}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {s.testsPassed}/{s.testsTotal} tests passed
                  </div>
                  <Progress value={s.score} className="h-1.5" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gap List */}
      {gaps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4" /> Gap Analysis — {gaps.length} gaps to benchmark parity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {gaps.map((g, i) => (
                <div key={i} className="flex items-start gap-3 p-2 border rounded-md">
                  <Badge variant="outline" className={STATUS_COLORS[g.status] + ' text-xs shrink-0'}>
                    {g.status}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{g.capability}</span>
                      <span className="text-xs text-muted-foreground">{g.category}</span>
                      {g.closable && <Badge variant="outline" className="text-xs">Closable</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{g.gap}</p>
                  </div>
                  <span className={`text-sm font-bold shrink-0 ${SCORE_COLORS(g.currentScore)}`}>{g.currentScore}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Capability Table — Google Sheets Style */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Capability Comparison Table</CardTitle>
            <Button
              variant={showGapsOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowGapsOnly(!showGapsOnly)}
            >
              {showGapsOnly ? 'Show All' : 'Show Gaps Only'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 sticky top-0">
                  <th className="text-left p-2 font-semibold min-w-[200px]">Capability</th>
                  <th className="text-left p-2 font-semibold min-w-[200px]">Benchmark (Bright Data + Browserbase)</th>
                  <th className="text-left p-2 font-semibold min-w-[200px]">Cloud Browser</th>
                  <th className="text-center p-2 font-semibold w-20">Status</th>
                  <th className="text-center p-2 font-semibold w-16">Hardened</th>
                  <th className="text-center p-2 font-semibold w-16">Validated</th>
                  <th className="text-left p-2 font-semibold min-w-[150px]">Test</th>
                  <th className="text-center p-2 font-semibold w-16">Score</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat, catIdx) => {
                  const visibleCaps = showGapsOnly ? cat.capabilities.filter(c => c.status !== 'implemented') : cat.capabilities;
                  if (visibleCaps.length === 0) return null;
                  const isExpanded = expandedCategories.has(catIdx) || showGapsOnly;
                  const catAvg = Math.round(cat.capabilities.reduce((s, c) => s + c.score, 0) / cat.capabilities.length);
                  return (
                    <React.Fragment key={catIdx}>
                      <tr
                        className="border-b bg-slate-50 dark:bg-slate-900/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900"
                        onClick={() => toggleCategory(catIdx)}
                      >
                        <td colSpan={6} className="p-2 font-semibold">
                          <div className="flex items-center gap-2">
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            {cat.category}
                          </div>
                        </td>
                        <td colSpan={2} className="p-2 text-right">
                          <Badge className={SCORE_COLORS(catAvg) + ' border-0'}>Avg: {catAvg}</Badge>
                        </td>
                      </tr>
                      {isExpanded && visibleCaps.map((cap, capIdx) => (
                        <tr key={`${catIdx}-${capIdx}`} className="border-b hover:bg-muted/30">
                          <td className="p-2 font-medium align-top">{cap.name}</td>
                          <td className="p-2 text-muted-foreground align-top text-xs">{cap.benchmark}</td>
                          <td className="p-2 align-top text-xs">{cap.cloudBrowser}</td>
                          <td className="p-2 text-center align-top">
                            <Badge variant="outline" className={STATUS_COLORS[cap.status] + ' text-xs'}>
                              {cap.status}
                            </Badge>
                          </td>
                          <td className="p-2 text-center align-top">
                            {cap.hardened ? (
                              <ShieldCheck className="w-4 h-4 text-green-500 mx-auto" />
                            ) : (
                              <Shield className="w-4 h-4 text-muted-foreground mx-auto opacity-30" />
                            )}
                          </td>
                          <td className="p-2 text-center align-top">
                            {cap.validated ? (
                              <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                            ) : (
                              <XCircle className="w-4 h-4 text-muted-foreground mx-auto opacity-30" />
                            )}
                          </td>
                          <td className="p-2 align-top text-xs text-muted-foreground">{cap.test}</td>
                          <td className={`p-2 text-center align-top font-bold ${SCORE_COLORS(cap.score)}`}>
                            {cap.score}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}