import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Loader2, Globe, Layers, CheckCircle2, XCircle, AlertCircle,
  Rocket, Shield, Code2, Copy, RefreshCw, Zap,
} from "lucide-react";

const STATUS_CONFIG = {
  acquiring: { label: "Acquiring", color: "text-blue-500", bg: "bg-blue-500/10", icon: Loader2, spin: true },
  compiling: { label: "Compiling", color: "text-purple-500", bg: "bg-purple-500/10", icon: Zap, spin: false },
  validating: { label: "Validating", color: "text-amber-500", bg: "bg-amber-500/10", icon: AlertCircle, spin: false },
  deployed: { label: "Deployed", color: "text-emerald-500", bg: "bg-emerald-500/10", icon: CheckCircle2, spin: false },
  failed: { label: "Failed", color: "text-red-500", bg: "bg-red-500/10", icon: XCircle, spin: false },
  cancelled: { label: "Cancelled", color: "text-gray-500", bg: "bg-gray-500/10", icon: XCircle, spin: false },
};

export default function BatchClone() {
  const [urlsText, setUrlsText] = useState("");
  const [batching, setBatching] = useState(false);
  const [error, setError] = useState(null);
  const [batchResult, setBatchResult] = useState(null);
  const [projects, setProjects] = useState([]);
  const [skipDeploy, setSkipDeploy] = useState(false);

  const parseUrls = () =>
    urlsText.split("\n").map(u => u.trim()).filter(u => u.startsWith("http"));

  const urlCount = parseUrls().length;

  const handleBatch = async () => {
    const urls = parseUrls();
    if (urls.length === 0) return;
    setBatching(true);
    setError(null);
    setBatchResult(null);
    try {
      const response = await base44.functions.invoke("batchClonePipeline", {
        urls,
        skip_deployment: skipDeploy,
      });
      const data = response.data || response;
      if (!data.ok) {
        setError(data.error || "Batch failed");
      } else {
        setBatchResult(data);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBatching(false);
    }
  };

  // Poll for project status updates
  const fetchProjects = useCallback(async () => {
    if (!batchResult?.urls?.length) return;
    try {
      const all = await base44.entities.CloneProject.list("-created_date", 50);
      const matched = all.filter(p => batchResult.urls.includes(p.target_url));
      setProjects(matched);
    } catch {}
  }, [batchResult]);

  useEffect(() => {
    if (!batchResult) return;
    fetchProjects();
    const interval = setInterval(fetchProjects, 4000);
    return () => clearInterval(interval);
  }, [batchResult, fetchProjects]);

  const completed = projects.filter(p => p.status === "deployed" || p.status === "failed").length;
  const inProgress = projects.filter(p => p.status === "acquiring" || p.status === "compiling" || p.status === "validating").length;
  const overallPct = projects.length > 0 ? Math.round((completed / projects.length) * 100) : 0;

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Layers className="w-5 h-5" />
          Batch Clone Runner
        </h1>
        <p className="text-sm text-muted-foreground">
          Drop in a list of URLs and the DEEP pipeline will automatically scrape and resolve gaps for every site at once.
        </p>
      </div>

      {/* URL Input */}
      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
          <div>
            <label className="text-sm font-medium mb-2 block">URLs (one per line, max 25)</label>
            <Textarea
              placeholder={"https://example.com\nhttps://another-site.com\nhttps://third-site.com"}
              value={urlsText}
              onChange={(e) => setUrlsText(e.target.value)}
              rows={8}
              disabled={batching}
              className="font-mono text-sm"
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-muted-foreground">{urlCount} valid URL{urlCount !== 1 ? "s" : ""}</span>
              {urlCount > 25 && <span className="text-xs text-red-500">Maximum 25 URLs per batch</span>}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 items-center">
            <label className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
              <input type="checkbox" checked={skipDeploy} onChange={(e) => setSkipDeploy(e.target.checked)} className="rounded" />
              Skip deployment (gap analysis only)
            </label>
            <div className="flex-1" />
            <Button onClick={handleBatch} disabled={batching || urlCount === 0 || urlCount > 25}>
              {batching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
              {batching ? "Starting batch..." : `Clone ${urlCount} URL${urlCount !== 1 ? "s" : ""}`}
            </Button>
          </div>
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-500">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Batch Progress */}
      {batchResult && (
        <>
          <Card className="border-emerald-500/20 bg-emerald-500/5">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-medium">Batch started — {batchResult.total} pipelines launched</span>
              </div>
              {projects.length > 0 && (
                <>
                  <Progress value={overallPct} className="h-2 mb-2" />
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> {completed} completed</span>
                    <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 text-blue-500" /> {inProgress} in progress</span>
                    <span className="ml-auto">{overallPct}%</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Per-URL Progress */}
          {projects.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold flex items-center gap-1.5">
                  <Globe className="w-4 h-4" /> Pipeline Progress
                </h2>
                <Button size="sm" variant="ghost" onClick={fetchProjects}>
                  <RefreshCw className="w-3 h-3" /> Refresh
                </Button>
              </div>
              <div className="space-y-2">
                {projects.map((p) => {
                  const config = STATUS_CONFIG[p.status] || STATUS_CONFIG.acquiring;
                  const Icon = config.icon;
                  return (
                    <Card key={p.id} className={`${config.bg}`}>
                      <CardContent className="pt-3 pb-3">
                        <div className="flex items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">{p.target_url}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              {p.parity_score > 0 && (
                                <span className="flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  {p.parity_score}% parity
                                </span>
                              )}
                              {p.endpoint_count > 0 && (
                                <span className="flex items-center gap-1">
                                  <Code2 className="w-3 h-3" />
                                  {p.endpoint_count} endpoints
                                </span>
                              )}
                              {p.gap_count > 0 && (
                                <span className="flex items-center gap-1">
                                  <Shield className="w-3 h-3" />
                                  {p.gap_count} gaps
                                </span>
                              )}
                              {p.deployed_url && (
                                <a href={p.deployed_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-emerald-500 hover:underline">
                                  <Rocket className="w-3 h-3" />
                                  <span className="truncate max-w-[200px]">{p.deployed_url}</span>
                                </a>
                              )}
                            </div>
                          </div>
                          <Badge variant="outline" className={`${config.color} shrink-0`}>
                            <Icon className={`w-3 h-3 mr-1 ${config.spin ? "animate-spin" : ""}`} />
                            {config.label}
                          </Badge>
                        </div>
                        {p.error_message && (
                          <p className="text-xs text-red-500 mt-1 pl-1">{p.error_message}</p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* New Batch Button */}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => { setBatchResult(null); setProjects([]); setUrlsText(""); }}>
              <Copy className="w-4 h-4" /> Start New Batch
            </Button>
          </div>
        </>
      )}
    </div>
  );
}