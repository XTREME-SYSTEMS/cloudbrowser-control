import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, Activity, Clock, AlertTriangle, CheckCircle2, XCircle, Server, MapPin, Zap } from "lucide-react";

const STATUS_CONFIG = {
  healthy: { color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/30", icon: CheckCircle2, label: "Healthy" },
  degraded: { color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/30", icon: AlertTriangle, label: "Degraded" },
  unhealthy: { color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/30", icon: XCircle, label: "Unhealthy" },
  unreachable: { color: "text-gray-500", bg: "bg-gray-500/10", border: "border-gray-500/30", icon: XCircle, label: "Unreachable" },
};

export default function EngineWorkerCard({ engine, isLatest }) {
  const config = STATUS_CONFIG[engine.status] || STATUS_CONFIG.unreachable;
  const StatusIcon = config.icon;
  const poolPct = engine.pool_capacity > 0 ? Math.min(100, (engine.pool_size / engine.pool_capacity) * 100) : 0;
  const sessionPct = engine.max_sessions > 0 ? Math.min(100, (engine.active_sessions / engine.max_sessions) * 100) : 0;

  return (
    <Card className={`${config.border} ${config.bg} transition-all`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Server className={`w-4 h-4 shrink-0 ${config.color}`} />
            <div className="min-w-0">
              <CardTitle className="text-sm truncate">{engine.engine_label || engine.engine_url || "Unknown Engine"}</CardTitle>
              {engine.region && (
                <p className="text-xs text-muted-foreground flex items-center gap-0.5">
                  <MapPin className="w-3 h-3" /> {engine.region}
                </p>
              )}
            </div>
          </div>
          <Badge variant="outline" className={`${config.color} ${config.bg} shrink-0`}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {config.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5 pt-2">
        {/* Response time */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" /> Response
          </span>
          <span className={`font-mono font-medium ${engine.response_time_ms > 2000 ? "text-red-500" : engine.response_time_ms > 1000 ? "text-amber-500" : "text-emerald-500"}`}>
            {engine.response_time_ms != null ? `${engine.response_time_ms}ms` : "—"}
          </span>
        </div>

        {/* Sessions */}
        {engine.max_sessions > 0 && (
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground flex items-center gap-1">
                <Activity className="w-3 h-3" /> Sessions
              </span>
              <span className="font-mono">{engine.active_sessions}/{engine.max_sessions}</span>
            </div>
            <Progress value={sessionPct} className="h-1.5" />
          </div>
        )}

        {/* Pool */}
        {engine.pool_capacity > 0 && (
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground flex items-center gap-1">
                <Zap className="w-3 h-3" /> Pool
              </span>
              <span className="font-mono">{engine.pool_size}/{engine.pool_capacity}</span>
            </div>
            <Progress value={poolPct} className="h-1.5" />
          </div>
        )}

        {/* Error message */}
        {engine.error_message && (
          <p className="text-xs text-red-500 truncate" title={engine.error_message}>
            {engine.error_message}
          </p>
        )}

        {/* Last checked */}
        {isLatest && engine.checked_at && (
          <p className="text-xs text-muted-foreground/60">
            {new Date(engine.checked_at).toLocaleTimeString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}