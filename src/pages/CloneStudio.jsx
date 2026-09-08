import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Copy, Loader2, Search, Globe, CheckCircle2, XCircle, Clock,
  Server, Code2, Eye, Zap, ExternalLink, RefreshCw, AlertCircle,
  FileSearch, Layers, Rocket, Cpu, Database, Shield, GitBranch, Brain,
} from "lucide-react";
import GapIntelligenceTab from "@/components/clone-studio/GapIntelligenceTab";

const STATUS_CONFIG = {
  acquiring: { label: "Acquiring", color: "text-blue-500", bg: "bg-blue-500/10", icon: Loader2, spin: true },
  compiling: { label: "Compiling", color: "text-purple-500", bg: "bg-purple-500/10", icon: Cpu, spin: false },
  validating: { label: "Validating", color: "text-amber-500", bg: "bg-amber-500/10", icon: Eye, spin: false },
  deploying: { label: "Deploying", color: "text-cyan-500", bg: "bg-cyan-500/10", icon: Rocket, spin: true },
  deployed: { label: "Deployed", color: "text-emerald-500", bg: "bg-emerald-500/10", icon: CheckCircle2, spin: false },
  failed: { label: "Failed", color: "text-red-500", bg: "bg-red-500/10", icon: XCircle, spin: false },
  cancelled: { label: "Cancelled", color: "text-gray-500", bg: "bg-gray-500/10", icon: Clock, spin: false },
};

const PHASES = [
  { key: "acquisition", label: "Acquisition", icon: Globe, desc: "Capture DOM, HAR, screenshots" },
  { key: "compilation", label: "Compilation", icon: Cpu, desc: "Map endpoints, infer backend" },
  { key: "validation", label: "Validation", icon: Eye, desc: "100% parity gate" },
  { key: "egress", label: "Egress", icon: Rocket, desc: "Deploy to GitHub + Vercel" },
];

function PhaseProgress({ currentPhase, status }) {
  const currentIdx = PHASES.findIndex((p) => p.key === currentPhase);
  const isFailed = status === "failed";
  const isDeployed = status === "deployed";

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      {PHASES.map((phase, idx) => {
        const isDone = isDeployed || (idx < currentIdx && !isFailed);
        const isCurrent = idx === currentIdx && !isFailed && !isDeployed;
        const Icon = phase.icon;
        return (
          <div key={phase.key} className="flex items-center flex-1">
            <div className={`flex flex-col items-center gap-1 ${isDone ? "text-emerald-500" : isCurrent ? "text-blue-500" : isFailed && idx === currentIdx ? "text-red-500" : "text-muted-foreground/40"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${isDone ? "border-emerald-500/30 bg-emerald-500/10" : isCurrent ? "border-blue-500/30 bg-blue-500/10" : "border-muted-foreground/20"}`}>
                {isDone ? <CheckCircle2 className="w-4 h-4" /> : isCurrent ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
              </div>
              <span className="text-[10px] font-medium hidden sm:block">{phase.label}</span>
            </div>
            {idx < PHASES.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 rounded ${isDone ? "bg-emerald-500/30" : "bg-muted-foreground/20"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function CloneDetail({ project, onClose, onRefresh }) {
  const [assets, setAssets] = useState([]);
  const [gaps, setGaps] = useState([]);
  const [validations, setValidations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (!project?.id) return;
    (async () => {
      setLoading(true);
      try {
        const [a, g, v] = await Promise.all([
          base44.entities.CloneAsset.filter({ clone_project_id: project.id }),
          base44.entities.CloneGap.filter({ clone_project_id: project.id }),
          base44.entities.CloneValidationResult.filter({ clone_project_id: project.id }),
        ]);
        setAssets(a);
        setGaps(g);
        setValidations(v);
      } catch {}
      setLoading(false);
    })();
  }, [project?.id]);

  const statusConfig = STATUS_CONFIG[project?.status] || STATUS_CONFIG.acquiring;
  const desktopScreenshot = assets.find((a) => a.asset_type === "screenshot" && a.viewport === "desktop");
  const mobileScreenshot = assets.find((a) => a.asset_type === "screenshot" && a.viewport === "mobile");
  const mockBackend = assets.find((a) => a.asset_type === "mock_backend");

  const tabs = [
    { key: "overview", label: "Overview", icon: Layers },
    { key: "screenshots", label: "Screenshots", icon: Eye },
    { key: "endpoints", label: "Endpoints & Gaps", icon: Code2 },
    { key: "intelligence", label: "Gap Intelligence", icon: Brain },
    { key: "code", label: "Mock Backend", icon: FileSearch },
    { key: "validation", label: "Validation", icon: CheckCircle2 },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-background rounded-xl border shadow-2xl max-w-5xl w-full my-8" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-background rounded-t-xl z-10">
          <div className="flex items-center gap-2 min-w-0">
            <Globe className="w-5 h-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <h2 className="text-base font-bold truncate">{project?.target_name || project?.target_url}</h2>
              <a href={project?.target_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline truncate block">
                {project?.target_url}
              </a>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className={`${statusConfig.color} ${statusConfig.bg}`}>
              <statusConfig.icon className={`w-3 h-3 mr-1 ${statusConfig.spin ? "animate-spin" : ""}`} />
              {statusConfig.label}
            </Badge>
            <Button size="sm" variant="ghost" onClick={onClose}>✕</Button>
          </div>
        </div>

        {/* Phase Progress */}
        <div className="p-4 border-b">
          <PhaseProgress currentPhase={project?.phase} status={project?.status} />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3 border-b">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === tab.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* OVERVIEW */}
              {activeTab === "overview" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card>
                      <CardContent className="pt-4 pb-4">
                        <p className="text-xs text-muted-foreground">Stack Type</p>
                        <p className="text-sm font-bold mt-1">{project?.stack_type || "Unknown"}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 pb-4">
                        <p className="text-xs text-muted-foreground">Endpoints</p>
                        <p className="text-2xl font-bold mt-1">{project?.endpoint_count || 0}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 pb-4">
                        <p className="text-xs text-muted-foreground">Gaps</p>
                        <p className="text-2xl font-bold mt-1">{project?.gap_count || 0}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 pb-4">
                        <p className="text-xs text-muted-foreground">Assets</p>
                        <p className="text-2xl font-bold mt-1">{project?.asset_count || 0}</p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Card className="border-emerald-500/20">
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Parity Score</span>
                          <span className="text-lg font-bold text-emerald-500">{project?.parity_score || 0}%</span>
                        </div>
                        <Progress value={project?.parity_score || 0} className="h-2" />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Visual</span>
                          <span className="text-lg font-bold">{project?.visual_score || 0}%</span>
                        </div>
                        <Progress value={project?.visual_score || 0} className="h-2" />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Functional</span>
                          <span className="text-lg font-bold">{project?.functional_score || 0}%</span>
                        </div>
                        <Progress value={project?.functional_score || 0} className="h-2" />
                      </CardContent>
                    </Card>
                  </div>

                  {project?.inference_iterations > 0 && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      Self-heal iterations: {project.inference_iterations} / {project.max_iterations}
                    </div>
                  )}

                  {project?.deployed_url && (
                    <Card className="border-emerald-500/30 bg-emerald-500/5">
                      <CardContent className="pt-4 pb-4 flex items-center gap-3">
                        <Rocket className="w-5 h-5 text-emerald-500" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">Deployed Clone</p>
                          <a href={project.deployed_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                            {project.deployed_url} <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {project?.github_repo_url && (
                    <Card>
                      <CardContent className="pt-4 pb-4 flex items-center gap-3">
                        <GitBranch className="w-5 h-5 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">GitHub Repository</p>
                          <a href={project.github_repo_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                            {project.github_repo_url} <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {project?.error_message && (
                    <Card className="border-red-500/30 bg-red-500/5">
                      <CardContent className="pt-4 pb-4 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                        <p className="text-sm text-red-500">{project.error_message}</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* SCREENSHOTS */}
              {activeTab === "screenshots" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium mb-2 flex items-center gap-1.5"><Server className="w-4 h-4" /> Desktop (1920×1080)</p>
                      {desktopScreenshot ? (
                        <img src={desktopScreenshot.file_url} alt="Desktop" className="w-full rounded-lg border" />
                      ) : (
                        <div className="aspect-video rounded-lg border bg-muted/20 flex items-center justify-center text-muted-foreground text-sm">
                          No desktop screenshot
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-2 flex items-center gap-1.5"><Server className="w-4 h-4" /> Mobile (390×844)</p>
                      {mobileScreenshot ? (
                        <img src={mobileScreenshot.file_url} alt="Mobile" className="w-full max-w-[200px] rounded-lg border mx-auto" />
                      ) : (
                        <div className="aspect-[9/16] max-w-[200px] rounded-lg border bg-muted/20 flex items-center justify-center text-muted-foreground text-sm mx-auto">
                          No mobile screenshot
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ENDPOINTS & GAPS */}
              {activeTab === "endpoints" && (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-2 flex items-center gap-1.5"><Code2 className="w-4 h-4" /> Captured Assets</p>
                    <div className="space-y-1">
                      {assets.map((a) => (
                        <div key={a.id} className="flex items-center gap-2 p-2 rounded-md border text-xs">
                          <Badge variant="outline" className="text-xs shrink-0">{a.asset_type}</Badge>
                          <span className="text-muted-foreground truncate">{a.viewport !== "none" ? a.viewport : ""}</span>
                          <Badge variant="outline" className={`text-xs ml-auto ${a.status === "captured" ? "text-emerald-500" : a.status === "inferred" ? "text-amber-500" : "text-red-500"}`}>
                            {a.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2 flex items-center gap-1.5"><Shield className="w-4 h-4" /> Unclonable Gaps ({gaps.length})</p>
                    <div className="space-y-1">
                      {gaps.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">No gaps identified</p>
                      ) : gaps.map((g) => (
                        <div key={g.id} className="p-2 rounded-md border text-xs space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs shrink-0">{g.gap_type}</Badge>
                            <span className="font-mono truncate">{g.inferred_method} {g.inferred_endpoint}</span>
                            <Badge variant="outline" className={`text-xs ml-auto ${g.status === "inferred" || g.status === "resolved" ? "text-emerald-500" : "text-amber-500"}`}>
                              {g.status}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground">{g.description}</p>
                          {g.template_matched && (
                            <p className="text-muted-foreground">Template: <span className="font-mono">{g.template_matched}</span></p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* GAP INTELLIGENCE */}
              {activeTab === "intelligence" && (
                <GapIntelligenceTab
                  project={project}
                  gaps={gaps}
                  onRefresh={() => {
                    (async () => {
                      try {
                        const [a, g, v] = await Promise.all([
                          base44.entities.CloneAsset.filter({ clone_project_id: project.id }),
                          base44.entities.CloneGap.filter({ clone_project_id: project.id }),
                          base44.entities.CloneValidationResult.filter({ clone_project_id: project.id }),
                        ]);
                        setAssets(a);
                        setGaps(g);
                        setValidations(v);
                      } catch {}
                    })();
                  }}
                />
              )}

              {/* MOCK BACKEND CODE */}
              {activeTab === "code" && (
                <div className="space-y-2">
                  {mockBackend ? (
                    <>
                      <div className="flex items-center gap-2">
                        <FileSearch className="w-4 h-4 text-muted-foreground" />
                        <p className="text-sm font-medium">Generated Mock Backend (server.js)</p>
                        <Button size="sm" variant="ghost" className="ml-auto h-7 text-xs" onClick={() => window.open(mockBackend.file_url, "_blank")}>
                          <ExternalLink className="w-3 h-3" /> Open
                        </Button>
                      </div>
                      <iframe src={mockBackend.file_url} className="w-full h-[400px] rounded-lg border bg-muted/10 font-mono text-xs" title="Mock backend code" />
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4">No mock backend generated yet</p>
                  )}
                </div>
              )}

              {/* VALIDATION */}
              {activeTab === "validation" && (
                <div className="space-y-2">
                  {validations.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">No validation results yet</p>
                  ) : validations.map((v, i) => (
                    <div key={i} className="p-3 rounded-md border space-y-1">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs">{v.validation_category}</Badge>
                        <span className={`text-sm font-bold ${v.score >= 100 ? "text-emerald-500" : v.score >= 50 ? "text-amber-500" : "text-red-500"}`}>
                          {v.score}/{v.max_score}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{v.details}</p>
                      {v.failed_nodes?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {v.failed_nodes.map((n, j) => (
                            <Badge key={j} variant="outline" className="text-xs text-red-500">{n}</Badge>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">Iteration {v.iteration} — {v.validated_at ? new Date(v.validated_at).toLocaleString() : ""}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CloneStudio() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cloning, setCloning] = useState(false);
  const [url, setUrl] = useState("");
  const [selectedProject, setSelectedProject] = useState(null);
  const [error, setError] = useState(null);
  const [cloneResult, setCloneResult] = useState(null);
  const [skipDeploy, setSkipDeploy] = useState(false);

  const fetchProjects = useCallback(async () => {
    try {
      const data = await base44.entities.CloneProject.list("-created_date", 20);
      setProjects(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
    const interval = setInterval(fetchProjects, 5000);
    return () => clearInterval(interval);
  }, [fetchProjects]);

  const handleClone = async () => {
    if (!url.trim()) return;
    setCloning(true);
    setError(null);
    setCloneResult(null);
    try {
      const response = await base44.functions.invoke("runDeepClonePipeline", {
        target_url: url.trim(),
        skip_deployment: skipDeploy,
      });
      const result = response.data || response;
      setCloneResult(result);
      if (!result.ok) {
        setError(result.error || "Clone failed");
      }
      await fetchProjects();
    } catch (e) {
      setError(e.message);
    } finally {
      setCloning(false);
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Copy className="w-5 h-5" />
          DEEP Clone Studio
        </h1>
        <p className="text-sm text-muted-foreground">
          Deterministic web application cloning — 4-phase pipeline: Acquisition → Compilation → Validation → Egress
        </p>
      </div>

      {/* Clone Input */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 flex items-center gap-2">
              <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
              <Input
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !cloning && handleClone()}
                disabled={cloning}
                className="flex-1"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap px-2">
              <input type="checkbox" checked={skipDeploy} onChange={(e) => setSkipDeploy(e.target.checked)} className="rounded" />
              Skip deploy
            </label>
            <Button onClick={handleClone} disabled={cloning || !url.trim()}>
              {cloning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
              {cloning ? "Cloning..." : "Clone URL"}
            </Button>
          </div>
          {error && (
            <div className="flex items-center gap-2 mt-2 text-sm text-red-500">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
          {cloneResult?.ok && (
            <div className="mt-2 p-3 rounded-md border bg-emerald-500/5 border-emerald-500/20 space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-500">
                <CheckCircle2 className="w-4 h-4" />
                Clone pipeline complete
              </div>
              {cloneResult.deployed_url && (
                <a href={cloneResult.deployed_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                  <Rocket className="w-3 h-3" /> {cloneResult.deployed_url} <ExternalLink className="w-3 h-3" />
                </a>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mt-2">
                <div><span className="text-muted-foreground">Parity:</span> <span className="font-bold text-emerald-500">{cloneResult.pipeline?.phase3_validation?.parity_score}%</span></div>
                <div><span className="text-muted-foreground">Endpoints:</span> <span className="font-bold">{cloneResult.pipeline?.phase2a_audit?.endpoints}</span></div>
                <div><span className="text-muted-foreground">Gaps:</span> <span className="font-bold">{cloneResult.pipeline?.phase2a_audit?.gaps}</span></div>
                <div><span className="text-muted-foreground">Stack:</span> <span className="font-bold">{cloneResult.pipeline?.phase2b_synthesis?.stack_type}</span></div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Clone Projects List */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <Layers className="w-4 h-4" /> Clone Projects
          </h2>
          <Button size="sm" variant="ghost" onClick={fetchProjects} disabled={loading}>
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : projects.length === 0 ? (
          <Card>
            <CardContent className="pt-8 pb-8 flex flex-col items-center gap-2 text-center">
              <Copy className="w-10 h-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No clone projects yet. Enter a URL above to start cloning.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {projects.map((p) => {
              const config = STATUS_CONFIG[p.status] || STATUS_CONFIG.acquiring;
              const Icon = config.icon;
              return (
                <Card
                  key={p.id}
                  className={`border cursor-pointer hover:shadow-md transition-all ${config.bg}`}
                  onClick={() => setSelectedProject(p)}
                >
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold truncate">{p.target_name || p.target_url}</p>
                        <p className="text-xs text-muted-foreground truncate">{p.target_url}</p>
                      </div>
                      <Badge variant="outline" className={`${config.color} shrink-0`}>
                        <Icon className={`w-3 h-3 mr-1 ${config.spin ? "animate-spin" : ""}`} />
                        {config.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {p.parity_score > 0 && (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          {p.parity_score}%
                        </span>
                      )}
                      {p.endpoint_count > 0 && (
                        <span className="flex items-center gap-1">
                          <Code2 className="w-3 h-3" />
                          {p.endpoint_count}
                        </span>
                      )}
                      {p.gap_count > 0 && (
                        <span className="flex items-center gap-1">
                          <Shield className="w-3 h-3" />
                          {p.gap_count}
                        </span>
                      )}
                      {p.stack_type && p.stack_type !== "UnknownREST" && (
                        <span className="flex items-center gap-1">
                          <Database className="w-3 h-3" />
                          {p.stack_type}
                        </span>
                      )}
                    </div>
                    {p.deployed_url && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-emerald-500">
                        <Rocket className="w-3 h-3" />
                        <span className="truncate">{p.deployed_url}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedProject && (
        <CloneDetail
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onRefresh={fetchProjects}
        />
      )}
    </div>
  );
}