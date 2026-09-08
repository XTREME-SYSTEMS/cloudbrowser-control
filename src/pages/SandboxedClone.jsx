import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  Loader2, Globe, Rocket, CheckCircle2, XCircle, AlertCircle,
  RefreshCw, Target, Zap, Eye, Server, Repeat, Box, Ghost, Radio, Cloud,
} from "lucide-react";

export default function SandboxedClone() {
  const [url, setUrl] = useState("");
  const [maxIterations, setMaxIterations] = useState(10);
  const [shadowMode, setShadowMode] = useState(false);
  const [shadowInterval, setShadowInterval] = useState(60);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);
  const [sandbox, setSandbox] = useState(null);
  const [project, setProject] = useState(null);
  const [validations, setValidations] = useState([]);
  const [provisioning, setProvisioning] = useState(false);
  const [provisionResult, setProvisionResult] = useState(null);
  const [provisionError, setProvisionError] = useState(null);

  const handleStart = async () => {
    if (!url.trim()) return;
    setStarting(true);
    setError(null);
    setSandbox(null);
    setProject(null);
    setValidations([]);
    try {
      const response = await base44.functions.invoke("runSandboxedRecursiveClone", {
        target_url: url.trim(),
        max_iterations: maxIterations,
        shadow_mode: shadowMode,
        shadow_interval: shadowInterval,
      });
      const data = response.data || response;
      if (!data.ok) {
        setError(data.error || "Failed to start");
      } else {
        setSandbox(data);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setStarting(false);
    }
  };

  // Poll for progress
  const pollProgress = useCallback(async () => {
    if (!sandbox?.sandbox_id) return;
    try {
      const [sb, proj, vals] = await Promise.all([
        base44.entities.Sandbox.get(sandbox.sandbox_id),
        sandbox.project_id ? base44.entities.CloneProject.get(sandbox.project_id) : Promise.resolve(null),
        sandbox.project_id ? base44.entities.CloneValidationResult.filter({ clone_project_id: sandbox.project_id }) : Promise.resolve([]),
      ]);
      setSandbox({ ...sandbox, ...sb, deployed_url: sb.engine_url || sandbox.deployed_url });
      setProject(proj);
      setValidations(vals);
    } catch {}
  }, [sandbox?.sandbox_id, sandbox?.project_id]);

  useEffect(() => {
    if (!sandbox?.sandbox_id) return;
    pollProgress();
    const interval = setInterval(pollProgress, 4000);
    return () => clearInterval(interval);
  }, [sandbox?.sandbox_id, sandbox?.project_id]);

  const isRunning = sandbox && project && (project.status === "validating" || project.status === "compiling" || project.status === "acquiring");
  const isShadowing = sandbox?.status === "shadowing";
  const isDone = sandbox && project && (project.status === "deployed" || project.status === "failed") && !isShadowing;
  const parityScore = project?.parity_score || 0;
  const visualScore = project?.visual_score || 0;
  const functionalScore = project?.functional_score || 0;
  const currentIteration = project?.inference_iterations || 0;
  const shadowSyncCount = sandbox?.shadow_sync_count || 0;
  const shadowLastSync = sandbox?.shadow_last_sync_at;
  const logs = sandbox?.provisioning_logs || "";

  // Group validations by iteration
  const iterationsMap = {};
  for (const v of validations) {
    const iter = v.iteration || 1;
    if (!iterationsMap[iter]) iterationsMap[iter] = [];
    iterationsMap[iter].push(v);
  }
  const handleProvision = async () => {
    if (!sandbox?.project_id) return;
    setProvisioning(true);
    setProvisionError(null);
    setProvisionResult(null);
    try {
      const response = await base44.functions.invoke("provisionCloneDeployment", {
        clone_project_id: sandbox.project_id,
      });
      const data = response.data || response;
      if (!data.ok) {
        setProvisionError(data.error || "Provisioning failed");
      } else {
        setProvisionResult(data);
        if (data.deployed_url) {
          setSandbox((s) => ({ ...s, deployed_url: data.deployed_url }));
        }
      }
    } catch (e) {
      setProvisionError(e.message);
    } finally {
      setProvisioning(false);
    }
  };

  const iterationKeys = Object.keys(iterationsMap).sort((a, b) => Number(a) - Number(b));

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Box className="w-5 h-5" />
          Sandboxed Recursive Clone
        </h1>
        <p className="text-sm text-muted-foreground">
          Deploy a clone into an isolated sandbox and recursively iterate until it hits 100% parity.
        </p>
      </div>

      {/* Input */}
      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 flex items-center gap-2">
              <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
              <Input
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !starting && handleStart()}
                disabled={starting}
                className="flex-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground whitespace-nowrap">Max iterations:</label>
              <Input
                type="number"
                min={1}
                max={20}
                value={maxIterations}
                onChange={(e) => setMaxIterations(Number(e.target.value))}
                disabled={starting}
                className="w-20"
              />
            </div>
            <Button onClick={handleStart} disabled={starting || !url.trim()}>
              {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : shadowMode ? <Ghost className="w-4 h-4" /> : <Rocket className="w-4 h-4" />}
              {starting ? "Starting..." : shadowMode ? "Launch Shadow Clone" : "Launch Sandbox Clone"}
            </Button>
          </div>
          {/* Shadow Mode Toggle */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 rounded-lg border border-border/50 bg-muted/20">
            <div className="flex items-center gap-2">
              <Ghost className={`w-4 h-4 ${shadowMode ? "text-violet-500" : "text-muted-foreground"}`} />
              <div>
                <span className="text-sm font-medium">Shadow Mode</span>
                <p className="text-xs text-muted-foreground">Continuously monitor the original site and auto-re-sync the clone when changes are detected.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 sm:ml-auto">
              {shadowMode && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground whitespace-nowrap">Check every:</label>
                  <select
                    value={shadowInterval}
                    onChange={(e) => setShadowInterval(Number(e.target.value))}
                    disabled={starting}
                    className="text-xs rounded-md border border-input bg-transparent px-2 py-1"
                  >
                    <option value={30}>30s</option>
                    <option value={60}>1 min</option>
                    <option value={300}>5 min</option>
                    <option value={600}>10 min</option>
                  </select>
                </div>
              )}
              <Switch checked={shadowMode} onCheckedChange={setShadowMode} disabled={starting} />
            </div>
          </div>
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-500">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Progress */}
      {sandbox && project && (
        <>
          {/* Status Bar */}
          <Card className={isShadowing ? "border-violet-500/30 bg-violet-500/5" : isDone && parityScore >= 100 ? "border-emerald-500/30 bg-emerald-500/5" : ""}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3 mb-3">
                {isRunning && <Loader2 className="w-5 h-5 animate-spin text-blue-500" />}
                {isShadowing && <Radio className="w-5 h-5 text-violet-500 animate-pulse" />}
                {isDone && parityScore >= 100 && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                {isDone && parityScore < 100 && <AlertCircle className="w-5 h-5 text-amber-500" />}
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {isShadowing
                      ? `Shadow mode active — monitoring for changes (${shadowSyncCount} syncs)`
                      : isRunning
                        ? `Iterating — iteration ${currentIteration} of ${maxIterations}`
                        : isDone && parityScore >= 100
                          ? "100% parity achieved!"
                          : `Complete — ${parityScore}% parity`}
                  </p>
                  <p className="text-xs text-muted-foreground">{sandbox.name}</p>
                </div>
                {(isRunning || isShadowing) && (
                  <Button size="sm" variant="ghost" onClick={pollProgress}>
                    <RefreshCw className="w-3 h-3" /> Refresh
                  </Button>
                )}
              </div>
              <Progress value={parityScore} className="h-3" />
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-muted-foreground">Parity Score</span>
                <span className={`text-sm font-bold ${parityScore >= 100 ? "text-emerald-500" : parityScore >= 50 ? "text-amber-500" : "text-red-500"}`}>
                  {parityScore}%
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Score Breakdown */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Visual</span>
                </div>
                <p className="text-xl font-bold">{visualScore}%</p>
                <Progress value={visualScore} className="h-1.5 mt-1" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Functional</span>
                </div>
                <p className="text-xl font-bold">{functionalScore}%</p>
                <Progress value={functionalScore} className="h-1.5 mt-1" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Repeat className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Iterations</span>
                </div>
                <p className="text-xl font-bold">{currentIteration}/{maxIterations}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Gaps</span>
                </div>
                <p className="text-xl font-bold">{project.gap_count || 0}</p>
              </CardContent>
            </Card>
          </div>

          {/* Vercel Provisioning */}
          <Card className="border-blue-500/20">
            <CardContent className="pt-4 pb-4 space-y-3">
              <div className="flex items-center gap-3">
                <Cloud className="w-5 h-5 text-blue-500 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Provision on Vercel</p>
                  <p className="text-xs text-muted-foreground">
                    Push the clone to a GitHub repo, create a Vercel project, and deploy to production.
                  </p>
                </div>
              </div>
              {provisionError && (
                <div className="flex items-start gap-2 text-xs text-red-500 bg-red-500/5 rounded-md p-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span className="break-words">{provisionError}</span>
                </div>
              )}
              {provisionResult && (
                <div className="space-y-2 rounded-md bg-emerald-500/5 border border-emerald-500/20 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-emerald-600">
                    <CheckCircle2 className="w-4 h-4" /> Deployed to Vercel
                  </div>
                  {provisionResult.deployed_url && (
                    <a href={provisionResult.deployed_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline block truncate">
                      {provisionResult.deployed_url}
                    </a>
                  )}
                  {provisionResult.github?.repo_url && (
                    <a href={provisionResult.github.repo_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline block truncate">
                      GitHub: {provisionResult.github.repo_url}
                    </a>
                  )}
                </div>
              )}
              <Button
                onClick={handleProvision}
                disabled={provisioning || !sandbox.project_id || isRunning}
                className="w-full"
              >
                {provisioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
                {provisioning ? "Provisioning..." : "Provision on Vercel"}
              </Button>
            </CardContent>
          </Card>

          {/* Deployed URL */}
          {sandbox.deployed_url && (
            <Card className="border-emerald-500/20">
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <Rocket className="w-5 h-5 text-emerald-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Sandbox URL</p>
                  <a href={sandbox.deployed_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline truncate block">
                    {sandbox.deployed_url}
                  </a>
                </div>
                <Badge variant="outline" className={isRunning ? "text-blue-500" : "text-emerald-500"}>
                  {isRunning ? "Iterating" : "Live"}
                </Badge>
              </CardContent>
            </Card>
          )}

          {/* Shadow Mode Status */}
          {isShadowing && (
            <Card className="border-violet-500/20 bg-violet-500/5">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3 mb-3">
                  <Ghost className="w-5 h-5 text-violet-500 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Shadow Mode Active</p>
                    <p className="text-xs text-muted-foreground">
                      Monitoring <span className="font-mono">{sandbox.shadow_target_url}</span> every {sandbox.shadow_monitoring_interval || 60}s
                    </p>
                  </div>
                  <Badge variant="outline" className="text-violet-500">
                    <Radio className="w-3 h-3 mr-1" /> Live
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-background/50 p-2">
                    <p className="text-xs text-muted-foreground">Syncs performed</p>
                    <p className="text-lg font-bold text-violet-500">{shadowSyncCount}</p>
                  </div>
                  <div className="rounded-lg bg-background/50 p-2">
                    <p className="text-xs text-muted-foreground">Last sync</p>
                    <p className="text-sm font-medium">
                      {shadowLastSync ? new Date(shadowLastSync).toLocaleTimeString() : "Awaiting first change"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Iteration History */}
          {iterationKeys.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Repeat className="w-4 h-4" />
                  Iteration History
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {iterationKeys.map((iterKey) => {
                    const iterVals = iterationsMap[iterKey];
                    const visual = iterVals.find((v) => v.validation_category === "visual_dom");
                    const functional = iterVals.find((v) => v.validation_category === "endpoint_interactive");
                    return (
                      <div key={iterKey} className="rounded-lg border p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">Iteration {iterKey}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {iterVals[0]?.validated_at ? new Date(iterVals[0].validated_at).toLocaleTimeString() : ""}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {visual && (
                            <div>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Eye className="w-3 h-3" /> Visual: {visual.score}/100
                              </span>
                              {visual.failed_nodes?.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {visual.failed_nodes.slice(0, 3).map((n, i) => (
                                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-500">{n}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          {functional && (
                            <div>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Zap className="w-3 h-3" /> Functional: {functional.score}/100
                              </span>
                              <p className="text-xs text-muted-foreground mt-0.5">{functional.details}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sandbox Logs */}
          {logs && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Server className="w-4 h-4" />
                  Sandbox Logs
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <pre className="text-xs font-mono whitespace-pre-wrap bg-muted/20 rounded-md p-3 max-h-48 overflow-y-auto">
                  {logs}
                </pre>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Initial started state (before first poll) */}
      {sandbox && !project && (
        <Card>
          <CardContent className="pt-8 pb-8 flex flex-col items-center gap-3 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-sm text-muted-foreground">{sandbox.message}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}