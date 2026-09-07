import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  RefreshCw, AlertCircle, CheckCircle2, XCircle, Clock,
  Server, Activity, Zap, RotateCcw, Square, Undo2, Ban,
  Rocket, Settings2, ExternalLink, Cpu, MemoryStick, Loader2, FolderTree
} from "lucide-react";

const STATUS_STYLES = {
  SUCCESS: { color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/30", icon: CheckCircle2, label: "Healthy" },
  FAILED: { color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/30", icon: XCircle, label: "Failed" },
  RUNNING: { color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/30", icon: Loader2, label: "Deploying" },
  QUEUED: { color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/30", icon: Clock, label: "Queued" },
  CANCELED: { color: "text-gray-500", bg: "bg-gray-500/10", border: "border-gray-500/30", icon: Ban, label: "Canceled" },
  NOT_DEPLOYED: { color: "text-gray-400", bg: "bg-gray-400/10", border: "border-gray-400/30", icon: Clock, label: "Not Deployed" },
};

function getStatusStyle(status, deployed) {
  if (!deployed) return STATUS_STYLES.NOT_DEPLOYED;
  return STATUS_STYLES[status] || STATUS_STYLES.NOT_DEPLOYED;
}

function ServiceCard({ service, onAction, acting }) {
  const [showLimits, setShowLimits] = useState(false);
  const [showRoot, setShowRoot] = useState(false);
  const [memGB, setMemGB] = useState(null);
  const [vcpus, setVcpus] = useState(null);
  const [rootDir, setRootDir] = useState("");
  const instance = service.instances[0];

  // Initialize limit values from instance data
  useEffect(() => {
    if (instance?.limits) {
      setMemGB(instance.limits.memoryGB);
      setVcpus(instance.limits.vCPUs);
    }
    setRootDir(instance?.rootDirectory || "");
  }, [instance?.limits, instance?.rootDirectory]);

  if (!instance) return null;

  const status = instance.latestDeployment?.status || (instance.deployed ? "SUCCESS" : "NOT_DEPLOYED");
  const style = getStatusStyle(status, instance.deployed);
  const StatusIcon = style.icon;
  const isActing = acting === service.id;
  const domains = [...instance.customDomains, ...instance.serviceDomains];

  const handleLimitSave = () => {
    onAction("update_limits", service.id, null, { memoryGB: parseFloat(memGB), vCPUs: parseFloat(vcpus) });
    setShowLimits(false);
  };

  const handleRootSave = () => {
    onAction("update_root_directory", service.id, null, { rootDirectory: rootDir });
    setShowRoot(false);
  };

  return (
    <Card className={`border ${style.border} ${style.bg} transition-all`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {service.icon ? (
              <img src={service.icon} alt="" className="w-5 h-5 rounded shrink-0" />
            ) : (
              <Server className={`w-5 h-5 shrink-0 ${style.color}`} />
            )}
            <div className="min-w-0">
              <CardTitle className="text-sm truncate">{service.name}</CardTitle>
              {instance.repo && (
                <p className="text-xs text-muted-foreground truncate">{instance.repo}</p>
              )}
            </div>
          </div>
          <Badge variant="outline" className={`${style.color} ${style.bg} shrink-0`}>
            <StatusIcon className={`w-3 h-3 mr-1 ${status === "RUNNING" ? "animate-spin" : ""}`} />
            {style.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Deployment info */}
        {instance.latestDeployment && (
          <div className="text-xs space-y-1">
            <p className="text-muted-foreground">
              <span className="text-foreground/60">deployed:</span> {new Date(instance.latestDeployment.createdAt).toLocaleString()}
            </p>
          </div>
        )}

        {/* Domains */}
        {domains.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {domains.slice(0, 2).map((d) => (
              <a key={d} href={`https://${d}`} target="_blank" rel="noopener noreferrer"
                className="text-xs text-blue-500 hover:underline flex items-center gap-0.5 truncate max-w-full">
                <ExternalLink className="w-3 h-3 shrink-0" />
                <span className="truncate">{d}</span>
              </a>
            ))}
            {domains.length > 2 && <span className="text-xs text-muted-foreground">+{domains.length - 2} more</span>}
          </div>
        )}

        {/* Resource limits + root directory */}
        <div className="flex items-center gap-3 text-xs flex-wrap">
          {instance.limits && (
            <>
              <span className="flex items-center gap-1 text-muted-foreground">
                <MemoryStick className="w-3 h-3" />
                {instance.limits.memoryGB ? `${instance.limits.memoryGB}GB` : "unlimited"}
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <Cpu className="w-3 h-3" />
                {instance.limits.vCPUs ? `${instance.limits.vCPUs} vCPU` : "unlimited"}
              </span>
            </>
          )}
          <span className="flex items-center gap-1 text-muted-foreground">
            <FolderTree className="w-3 h-3" />
            {instance.rootDirectory || "/"}
          </span>
          {instance.sleeping && <Badge variant="outline" className="text-xs">Sleeping</Badge>}
        </div>

        {/* Limit editor */}
        {showLimits && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-background/50 border">
            <div className="flex flex-col gap-0.5">
              <label className="text-xs text-muted-foreground">RAM (GB)</label>
              <input type="number" step="0.5" min="0" value={memGB ?? ""}
                onChange={(e) => setMemGB(e.target.value ? parseFloat(e.target.value) : null)}
                className="w-16 px-1.5 py-1 text-xs rounded border bg-background" placeholder="∞" />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-xs text-muted-foreground">vCPU</label>
              <input type="number" step="0.5" min="0" value={vcpus ?? ""}
                onChange={(e) => setVcpus(e.target.value ? parseFloat(e.target.value) : null)}
                className="w-16 px-1.5 py-1 text-xs rounded border bg-background" placeholder="∞" />
            </div>
            <Button size="sm" onClick={handleLimitSave} disabled={isActing} className="mt-4 h-7">
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowLimits(false)} className="mt-4 h-7">
              Cancel
            </Button>
          </div>
        )}

        {/* Root directory editor */}
        {showRoot && (
          <div className="flex items-center gap-2 p-2 rounded-md bg-background/50 border">
            <div className="flex flex-col gap-0.5 flex-1">
              <label className="text-xs text-muted-foreground">Root Directory</label>
              <input type="text" value={rootDir}
                onChange={(e) => setRootDir(e.target.value)}
                className="w-full px-1.5 py-1 text-xs rounded border bg-background"
                placeholder="e.g. browser-engine" />
            </div>
            <Button size="sm" onClick={handleRootSave} disabled={isActing} className="mt-4 h-7">
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowRoot(false)} className="mt-4 h-7">
              Cancel
            </Button>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {instance.latestDeployment?.canRedeploy && (
            <Button size="sm" variant="outline" disabled={isActing}
              onClick={() => onAction("redeploy", service.id, null)}
              className="h-7 text-xs">
              {isActing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
              Redeploy
            </Button>
          )}
          {instance.deployed && (
            <Button size="sm" variant="outline" disabled={isActing}
              onClick={() => onAction("deploy_latest", service.id, null)}
              className="h-7 text-xs">
              <Rocket className="w-3 h-3" /> Deploy Latest
            </Button>
          )}
          {instance.latestDeployment?.status === "RUNNING" && (
            <Button size="sm" variant="outline" disabled={isActing}
              onClick={() => onAction("cancel", null, instance.latestDeployment.id)}
              className="h-7 text-xs">
              <Ban className="w-3 h-3" /> Cancel
            </Button>
          )}
          {instance.latestDeployment?.canRollback && (
            <Button size="sm" variant="outline" disabled={isActing}
              onClick={() => onAction("rollback", null, instance.latestDeployment.id)}
              className="h-7 text-xs">
              <Undo2 className="w-3 h-3" /> Rollback
            </Button>
          )}
          {instance.deployed && instance.latestDeployment?.status === "SUCCESS" && (
            <Button size="sm" variant="outline" disabled={isActing}
              onClick={() => onAction("restart", null, instance.latestDeployment.id)}
              className="h-7 text-xs">
              <RefreshCw className="w-3 h-3" /> Restart
            </Button>
          )}
          {instance.deployed && instance.latestDeployment?.status === "SUCCESS" && (
            <Button size="sm" variant="outline" disabled={isActing}
              onClick={() => onAction("stop", null, instance.latestDeployment.id)}
              className="h-7 text-xs">
              <Square className="w-3 h-3" /> Stop
            </Button>
          )}
          {instance.deployed && (
            <Button size="sm" variant="ghost" disabled={isActing}
              onClick={() => setShowLimits(!showLimits)}
              className="h-7 text-xs">
              <Settings2 className="w-3 h-3" /> Limits
            </Button>
          )}
          {instance.deployed && (
            <Button size="sm" variant="ghost" disabled={isActing}
              onClick={() => setShowRoot(!showRoot)}
              className="h-7 text-xs">
              <FolderTree className="w-3 h-3" /> Root
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function RailwayMirror() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [acting, setActing] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const response = await base44.functions.invoke("railwayMirror", {});
      const result = response.data ?? response;
      if (result.ok) {
        setData(result);
        setError(null);
      } else {
        // Don't overwrite existing data on refresh errors — just show a banner
        setError(result.error || "Failed to fetch Railway status");
      }
    } catch (e) {
      // Don't overwrite existing data on refresh errors — just show a banner
      setError(e.message || "Failed to fetch");
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLastRefresh(new Date());
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    if (!autoRefresh) return;
    const interval = setInterval(() => fetchStatus(true), 60000);
    return () => clearInterval(interval);
  }, [fetchStatus, autoRefresh]);

  const handleAction = async (action, serviceId, deploymentId, extra = {}) => {
    const key = serviceId || deploymentId;
    setActing(key);
    try {
      const response = await base44.functions.invoke("railwayAction", {
        action, serviceId, deploymentId, ...extra
      });
      const result = response.data ?? response;
      if (!result.ok) {
        setError(result.error);
      } else {
        // Refresh after a short delay to show the action taking effect
        setTimeout(fetchStatus, 2000);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setActing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading Railway infrastructure...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <AlertCircle className="w-10 h-10 text-red-500" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button onClick={() => { setLoading(true); setError(null); fetchStatus(); }} variant="outline" size="sm">
                <RefreshCw className="w-3 h-3" /> Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const summary = data?.summary || {};
  const services = data?.services || [];
  const failedServices = services.filter(s => s.instances.some(i => i.latestDeployment?.status === "FAILED"));
  const notDeployed = services.filter(s => s.instances.some(i => !i.deployed));

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Server className="w-5 h-5" />
            Railway Mirror
          </h1>
          <p className="text-sm text-muted-foreground">
            {data?.project?.name} — live infrastructure control
          </p>
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
          <Button size="sm" variant="outline" onClick={() => fetchStatus(true)} disabled={refreshing}>
            <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Services</p>
                <p className="text-2xl font-bold">{summary.total_services || 0}</p>
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
                <p className="text-2xl font-bold text-emerald-500">{summary.healthy || 0}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-emerald-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card className={summary.failed > 0 ? "border-red-500/30 bg-red-500/5" : ""}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-red-500">{summary.failed || 0}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card className={summary.not_deployed > 0 ? "border-amber-500/30 bg-amber-500/5" : ""}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Not Deployed</p>
                <p className="text-2xl font-bold text-amber-500">{summary.not_deployed || 0}</p>
              </div>
              <Clock className="w-8 h-8 text-amber-500/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error banner */}
      {error && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="pt-4 pb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-sm text-red-500">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Failed services alert */}
      {failedServices.length > 0 && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <p className="text-sm font-medium text-red-500">
                {failedServices.length} service(s) with failed deployments
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {failedServices.map(s => (
                <Button key={s.id} size="sm" variant="outline"
                  onClick={() => handleAction("redeploy", s.id, null)}
                  disabled={acting === s.id}
                  className="h-7 text-xs border-red-500/30">
                  {acting === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                  Redeploy {s.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Service grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {services.map(service => (
          <ServiceCard
            key={service.id}
            service={service}
            onAction={handleAction}
            acting={acting}
          />
        ))}
      </div>
    </div>
  );
}