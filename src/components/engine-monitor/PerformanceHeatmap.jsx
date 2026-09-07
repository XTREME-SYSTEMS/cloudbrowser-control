import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Grid3x3 } from "lucide-react";

/**
 * 24-hour performance heatmap.
 * Rows = engines, Columns = hours (last 24), Cell color = health status + response time intensity.
 */
export default function PerformanceHeatmap({ logs }) {
  const { engines, hours, matrix, stats } = useMemo(() => {
    const now = new Date();
    const hourBuckets = [];
    for (let i = 23; i >= 0; i--) {
      const d = new Date(now);
      d.setMinutes(0, 0, 0);
      d.setHours(d.getHours() - i);
      hourBuckets.push(d);
    }

    // Group logs by engine label
    const engineSet = new Map();
    for (const log of logs) {
      const label = log.engine_label || log.engine_url || "unknown";
      if (!engineSet.has(label)) engineSet.set(label, []);
      engineSet.get(label).push(log);
    }
    const engines = [...engineSet.keys()].sort();

    // Build matrix: matrix[engineIndex][hourIndex] = { status, avgMs, count, failures }
    const matrix = engines.map((engineLabel) => {
      const engineLogs = engineSet.get(engineLabel);
      return hourBuckets.map((hourStart) => {
        const hourEnd = new Date(hourStart.getTime() + 3600000);
        const inHour = engineLogs.filter((l) => {
          const t = new Date(l.checked_at);
          return t >= hourStart && t < hourEnd;
        });
        if (inHour.length === 0) return { status: "no_data", avgMs: 0, count: 0, failures: 0 };
        const failures = inHour.filter((l) => l.status === "unhealthy" || l.status === "unreachable").length;
        const avgMs = inHour.reduce((s, l) => s + (l.response_time_ms || 0), 0) / inHour.length;
        const failureRate = failures / inHour.length;
        let status = "healthy";
        if (failureRate > 0.5) status = "unhealthy";
        else if (failureRate > 0.2 || avgMs > 2000) status = "degraded";
        return { status, avgMs: Math.round(avgMs), count: inHour.length, failures, failureRate };
      });
    });

    // Overall stats
    let totalChecks = 0, totalFailures = 0, totalMs = 0, msCount = 0;
    for (const row of matrix) {
      for (const cell of row) {
        totalChecks += cell.count;
        totalFailures += cell.failures;
        if (cell.avgMs > 0) { totalMs += cell.avgMs; msCount++; }
      }
    }
    const stats = {
      totalChecks,
      totalFailures,
      failureRate: totalChecks > 0 ? (totalFailures / totalChecks) * 100 : 0,
      avgResponseMs: msCount > 0 ? Math.round(totalMs / msCount) : 0,
    };

    const hours = hourBuckets;
    return { engines, hours, matrix, stats };
  }, [logs]);

  const getCellColor = (cell) => {
    if (cell.status === "no_data") return "bg-muted/30";
    if (cell.status === "unhealthy") return "bg-red-500/80";
    if (cell.status === "degraded") return "bg-amber-500/70";
    // healthy — intensity by response time
    if (cell.avgMs > 1500) return "bg-emerald-500/40";
    if (cell.avgMs > 800) return "bg-emerald-500/60";
    return "bg-emerald-500/90";
  };

  const getCellTitle = (cell, engineLabel, hour) => {
    if (cell.status === "no_data") return `${engineLabel} · ${hour}:00 — no data`;
    return `${engineLabel} · ${hour}:00\n${cell.count} checks · ${cell.failures} failures (${(cell.failureRate * 100).toFixed(0)}%)\navg ${cell.avgMs}ms`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Grid3x3 className="w-4 h-4" /> 24h Performance Heatmap
            </CardTitle>
            <CardDescription className="text-xs">
              {stats.totalChecks} checks · {stats.totalFailures} failures ({stats.failureRate.toFixed(1)}%) · avg {stats.avgResponseMs}ms
            </CardDescription>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500/90" /> Fast</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500/70" /> Degraded</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500/80" /> Failing</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-muted/30" /> No data</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {engines.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No engine health data in the last 24 hours. Run an engine health check to populate the heatmap.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              {/* Hour labels */}
              <div className="flex gap-0.5 mb-1 pl-28">
                {hours.map((h, i) => (
                  <div key={i} className="flex-1 text-center text-[10px] text-muted-foreground font-mono">
                    {h.getHours()}
                  </div>
                ))}
              </div>
              {/* Engine rows */}
              {engines.map((engineLabel, eIdx) => (
                <div key={engineLabel} className="flex items-center gap-0.5 mb-0.5">
                  <div className="w-28 shrink-0 text-xs text-muted-foreground truncate pr-2 text-right" title={engineLabel}>
                    {engineLabel}
                  </div>
                  {hours.map((_, hIdx) => {
                    const cell = matrix[eIdx][hIdx];
                    return (
                      <div
                        key={hIdx}
                        className={`flex-1 h-6 rounded-sm ${getCellColor(cell)} hover:ring-2 hover:ring-primary/50 transition-all cursor-pointer`}
                        title={getCellTitle(cell, engineLabel, hours[hIdx].getHours())}
                      />
                    );
                  })}
                </div>
              ))}
              {/* Time axis */}
              <div className="flex justify-between pl-28 mt-2 text-[10px] text-muted-foreground/60">
                <span>{hours[0].toLocaleString([], { weekday: "short", hour: "numeric" })}</span>
                <span>Now</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}