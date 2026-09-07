import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw, Activity, Server, Clock, AlertTriangle, CheckCircle2, XCircle, Zap } from "lucide-react";
import EngineWorkerCard from "@/components/engine-monitor/EngineWorkerCard";
import PerformanceHeatmap from "@/components/engine-monitor/PerformanceHeatmap";

const HOURS_24_MS = 24 * 60 * 60 * 1000;

export default function EngineMonitor() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [error, setError] = useState(null);

  const fetchLogs = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      // Fetch recent health logs (sorted desc, up to 500 to cover 24h)
      const recent = await base44.entities.EngineHealthLog.list("-checked_at", 500);
      const now = Date.now();
      const within24h = (recent || []).filter((l) => l.checked_at && new Date(l.checked_at).getTime() > now - HOURS_24_MS);
      setLogs(within24h);
      setError(null);
    } catch (e) {
      setError(e.message || "Failed to load engine health data");
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLastRefresh(new Date());
    }
  }, []);

  useEffect(() => {
    fetchLogs();
    if (!autoRefresh) return;
    const interval = setInterval(() => fetchLogs(true), 30000);
    return () => clearInterval(interval);
  }, [fetchLogs, autoRefresh]);

  // Derive latest state per engine
  const latestPerEngine = React.useMemo(() => {
    const map = new Map();
    for (const log of logs) {
      const key = log.engine_label || log.engine_url || "unknown";
      if (!map.has(key) || new Date(log.checked_at) > new Date(map.get(key).checked_at)) {
        map.set(key, log);
      }
    }
    return [...map.values()];
  }, [logs]);

  const summary = React.useMemo(() => {
    const total = latestPerEngine.length;
    const healthy = latestPerEngine.filter((e) => e.status === "healthy").length;
    const degraded = latestPerEngine.filter((e) => e.status === "degraded").length;
    const unhealthy = latestPerEngine.filter((e) => e.status === "unhealthy" || e.status === "unreachable").length;
    const avgMs = latestPerEngine.length > 0
      ? Math.round(latestPerEngine.reduce((s, e) => s + (e.response_time_ms || 0), 0) / latestPerEngine.length)
      : 0;
    const totalSessions = latestPerEngine.reduce((s, e) => s + (e.active_sessions || 0), 0);
    const maxSessions = latestPerEngine.reduce((s, e) => s + (e.max_sessions || 0), 0);
    return { total, healthy, degraded, unhealthy, avgMs, totalSessions, maxSessions };
  }, [latestPerEngine]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading engine monitor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Server className="w-5 h-5" /> Engine Monitor
          </h1>
          <p className="text-sm text-muted-foreground">Live browser worker status & 24h performance heatmap</p>
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <Button
            size="sm"
            variant={autoRefresh ? "default" : "outline"}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Activity className="w-3 h-3" />
            {autoRefresh ? "Auto 30s" : "Paused"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => fetchLogs(true)} disabled={refreshing}>
            <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="pt-4 pb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-sm text-red-500">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Engines</p>
                <p className="text-2xl font-bold">{summary.total}</p>
              </div>
              <Server className="w-8 h-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/30">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Healthy</p>
                <p className="text-2xl font-bold text-emerald-500">{summary.healthy}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-emerald-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card className={summary.degraded > 0 ? "border-amber-500/30 bg-amber-500/5" : ""}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Degraded</p>
                <p className="text-2xl font-bold text-amber-500">{summary.degraded}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-amber-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card className={summary.unhealthy > 0 ? "border-red-500/30 bg-red-500/5" : ""}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Failing</p>
                <p className="text-2xl font-bold text-red-500">{summary.unhealthy}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Avg Response</p>
                <p className="text-2xl font-bold">{summary.avgMs}<span className="text-sm font-normal text-muted-foreground">ms</span></p>
              </div>
              <Clock className="w-8 h-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 24h Heatmap */}
      <PerformanceHeatmap logs={logs} />

      {/* Live worker status */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4" />
          <h2 className="text-sm font-semibold">Live Worker Status</h2>
          {summary.maxSessions > 0 && (
            <span className="text-xs text-muted-foreground">
              · {summary.totalSessions}/{summary.maxSessions} sessions active
            </span>
          )}
        </div>
        {latestPerEngine.length === 0 ? (
          <Card>
            <CardContent className="pt-6 pb-6 text-center text-sm text-muted-foreground">
              No engine workers found. Run an engine health check to populate live status.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {latestPerEngine
              .sort((a, b) => {
                const order = { unhealthy: 0, unreachable: 1, degraded: 2, healthy: 3 };
                return (order[a.status] ?? 4) - (order[b.status] ?? 4);
              })
              .map((engine) => (
                <EngineWorkerCard key={engine.id} engine={engine} isLatest />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}