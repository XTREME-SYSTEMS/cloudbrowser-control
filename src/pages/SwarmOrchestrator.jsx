import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Radar, Phone, Mail, MapPin, Users, Search, AlertCircle, CheckCircle2,
  Clock, Database, Loader2, Building, User, Globe, Bot, Cpu, Zap,
  Activity, Layers, ArrowRight, RefreshCw, Home, UserSearch, FileSearch,
} from "lucide-react";

const AGENTS = [
  {
    name: "property_researcher",
    label: "Property Researcher",
    icon: Home,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    desc: "Identifies property owners from county assessor, tax records, deeds, and property appraiser databases.",
    task_type: "property_search",
  },
  {
    name: "people_finder",
    label: "People Finder",
    icon: UserSearch,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
    desc: "Finds phone numbers, emails, and addresses using people search engines, reverse phone, and public directories.",
    task_type: "people_search",
  },
  {
    name: "data_enricher",
    label: "Data Enricher",
    icon: FileSearch,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    desc: "Cross-references social media, relatives, associates, and business records to enrich and verify all findings.",
    task_type: "data_enrichment",
  },
];

const STATUS_CONFIG = {
  pending: { label: "Pending", color: "text-muted-foreground", bg: "bg-muted/20", icon: Clock },
  assigned: { label: "Assigned", color: "text-blue-500", bg: "bg-blue-500/10", icon: Bot },
  running: { label: "Running", color: "text-cyan-500", bg: "bg-cyan-500/10", icon: Loader2, spin: true },
  completed: { label: "Completed", color: "text-emerald-500", bg: "bg-emerald-500/10", icon: CheckCircle2 },
  failed: { label: "Failed", color: "text-red-500", bg: "bg-red-500/10", icon: AlertCircle },
};

export default function SwarmOrchestrator() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assignAgent, setAssignAgent] = useState("property_researcher");
  const [taskInput, setTaskInput] = useState("");
  const [batchTargets, setBatchTargets] = useState("");
  const [batchName, setBatchName] = useState("");
  const [running, setRunning] = useState(false);
  const [batchResult, setBatchResult] = useState(null);
  const [error, setError] = useState(null);
  const [filterAgent, setFilterAgent] = useState("all");

  const loadTasks = useCallback(async () => {
    try {
      const data = await base44.entities.SwarmTask.list("-created_date", 100);
      setTasks(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
    const interval = setInterval(loadTasks, 5000);
    return () => clearInterval(interval);
  }, [loadTasks]);

  const handleAssignTask = async () => {
    if (!taskInput.trim()) return;
    setError(null);
    try {
      const target = JSON.parse(taskInput);
      await base44.entities.SwarmTask.create({
        agent_name: assignAgent,
        task_type: AGENTS.find((a) => a.name === assignAgent)?.task_type || "property_search",
        target_data: target,
        status: "pending",
        priority: "normal",
        assigned_at: new Date().toISOString(),
      });
      setTaskInput("");
      loadTasks();
    } catch (err) {
      setError("Invalid JSON. Enter target data as JSON, e.g. {\"property_address\": \"123 Main St\"}");
    }
  };

  const handleBatchRun = async () => {
    setError(null);
    setBatchResult(null);
    let targets;
    try {
      targets = JSON.parse(batchTargets);
      if (!Array.isArray(targets)) throw new Error("Input must be a JSON array");
    } catch {
      setError("Enter a valid JSON array of targets, e.g. [{\"property_address\":\"123 Main St\"}]");
      return;
    }
    if (targets.length === 0) {
      setError("Add at least one target");
      return;
    }
    setRunning(true);
    try {
      const response = await base44.functions.invoke("runBatchSkipTrace", {
        targets,
        batch_id: batchName || undefined,
      });
      const data = response.data || response;
      if (data.error) {
        setError(data.error);
      } else {
        setBatchResult(data);
      }
      loadTasks();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setRunning(false);
    }
  };

  // Per-agent stats
  const agentStats = AGENTS.map((agent) => {
    const agentTasks = tasks.filter((t) => t.agent_name === agent.name);
    return {
      ...agent,
      total: agentTasks.length,
      pending: agentTasks.filter((t) => t.status === "pending").length,
      running: agentTasks.filter((t) => t.status === "running").length,
      completed: agentTasks.filter((t) => t.status === "completed").length,
      failed: agentTasks.filter((t) => t.status === "failed").length,
      avgConfidence: agentTasks.length > 0
        ? Math.round(agentTasks.reduce((sum, t) => sum + (t.confidence_score || 0), 0) / agentTasks.length)
        : 0,
    };
  });

  const filteredTasks = filterAgent === "all" ? tasks : tasks.filter((t) => t.agent_name === filterAgent);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-heading font-semibold flex items-center gap-2">
          <Bot className="w-6 h-6 text-primary" />
          AGI Swarm Orchestrator
        </h1>
        <p className="text-muted-foreground mt-1 max-w-3xl">
          Manage your autonomous skip tracing agent swarm. Assign tasks to the Property Researcher, People Finder,
          and Data Enricher — they work in sequence to identify owners, find contacts, and enrich data, then report back.
        </p>
      </div>

      {/* Agent Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {agentStats.map((agent) => {
          const Icon = agent.icon;
          return (
            <Card key={agent.name} className={`${agent.border} ${agent.bg}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-10 h-10 rounded-lg ${agent.bg} flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${agent.color}`} />
                    </div>
                    <div>
                      <CardTitle className="text-base">{agent.label}</CardTitle>
                      <p className="text-xs text-muted-foreground">{agent.desc}</p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Pending</p>
                    <p className="text-lg font-bold">{agent.pending}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Running</p>
                    <p className="text-lg font-bold text-cyan-500">{agent.running}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Done</p>
                    <p className="text-lg font-bold text-emerald-500">{agent.completed}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Failed</p>
                    <p className="text-lg font-bold text-red-500">{agent.failed}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-xs text-muted-foreground">Avg Confidence</span>
                  <Badge variant="outline" className={agent.color}>{agent.avgConfidence}%</Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs defaultValue="batch">
        <TabsList>
          <TabsTrigger value="batch"><Layers className="w-4 h-4 mr-1" />Batch Run</TabsTrigger>
          <TabsTrigger value="assign"><Bot className="w-4 h-4 mr-1" />Assign Task</TabsTrigger>
          <TabsTrigger value="tasks"><Activity className="w-4 h-4 mr-1" />Task Reports ({tasks.length})</TabsTrigger>
        </TabsList>

        {/* Batch Run Tab */}
        <TabsContent value="batch" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Batch Enrichment Run</CardTitle>
              <CardDescription>
                Paste a JSON array of targets. Each target runs through all 3 agents in sequence: Property Researcher
                identifies the owner, People Finder locates contacts, Data Enricher cross-references and verifies.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Batch Name (optional)</Label>
                <Input placeholder="e.g. Elm St Delinquent Tax List" value={batchName}
                  onChange={(e) => setBatchName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Targets (JSON array)</Label>
                <Textarea
                  placeholder={'[\n  {"property_address": "123 Elm St, Springfield, IL 62701"},\n  {"property_address": "456 Oak Ave, Chicago, IL 60601", "owner_name": "John Smith"}\n]'}
                  value={batchTargets}
                  onChange={(e) => setBatchTargets(e.target.value)}
                  className="font-mono text-sm min-h-[150px]"
                />
              </div>
              <Button onClick={handleBatchRun} disabled={running || !batchTargets.trim()} className="w-full">
                {running
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Running batch — agents working...</>
                  : <><Zap className="w-4 h-4 mr-2" />Launch Batch Enrichment</>}
              </Button>
              {error && (
                <div className="flex items-start gap-2 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
                  {error.includes("credit") && (
                    <span className="text-muted-foreground">Credits reset 2026-09-12.</span>
                  )}
                </div>
              )}
              {batchResult && (
                <Card className="border-emerald-500/30 bg-emerald-500/5">
                  <CardContent className="pt-4 pb-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-emerald-500">
                      <CheckCircle2 className="w-4 h-4" />Batch complete: {batchResult.batch_id}
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-sm">
                      <div><span className="text-muted-foreground">Total:</span> <span className="font-bold">{batchResult.total}</span></div>
                      <div><span className="text-muted-foreground">Found:</span> <span className="font-bold text-emerald-500">{batchResult.found}</span></div>
                      <div><span className="text-muted-foreground">Partial:</span> <span className="font-bold text-amber-500">{batchResult.partial}</span></div>
                      <div><span className="text-muted-foreground">Failed:</span> <span className="font-bold text-red-500">{batchResult.failed}</span></div>
                    </div>
                    <div className="space-y-1 mt-2">
                      {batchResult.results?.map((r, i) => (
                        <div key={i} className="flex items-center justify-between text-xs p-2 rounded-md bg-muted/30">
                          <span className="truncate">{r.target}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            {r.owner_name && <span className="font-medium">{r.owner_name}</span>}
                            <Badge variant="outline" className={
                              r.status === "found" ? "text-emerald-500" :
                              r.status === "partial" ? "text-amber-500" : "text-red-500"
                            }>{r.status}</Badge>
                            <span className="text-muted-foreground">{r.confidence}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Assign Task Tab */}
        <TabsContent value="assign" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Assign Task to Agent</CardTitle>
              <CardDescription>
                Send a single target to a specific agent. Use this for targeted lookups or to re-run a failed search method.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Assign To</Label>
                <div className="grid grid-cols-3 gap-2">
                  {AGENTS.map((agent) => {
                    const Icon = agent.icon;
                    return (
                      <button
                        key={agent.name}
                        onClick={() => setAssignAgent(agent.name)}
                        className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${
                          assignAgent === agent.name
                            ? `${agent.border} ${agent.bg} ring-2 ring-primary`
                            : "border-border hover:bg-muted/50"
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${assignAgent === agent.name ? agent.color : "text-muted-foreground"}`} />
                        <span className="text-xs font-medium">{agent.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Target Data (JSON)</Label>
                <Textarea
                  placeholder={'{\n  "property_address": "123 Main St, Anytown, ST 12345",\n  "owner_name": "John Smith"\n}'}
                  value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                  className="font-mono text-sm min-h-[120px]"
                />
              </div>
              <Button onClick={handleAssignTask} disabled={!taskInput.trim()} className="w-full">
                <ArrowRight className="w-4 h-4 mr-2" />Assign to {AGENTS.find((a) => a.name === assignAgent)?.label}
              </Button>
              {error && (
                <div className="flex items-start gap-2 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Task Reports Tab */}
        <TabsContent value="tasks" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              <Button size="sm" variant={filterAgent === "all" ? "default" : "outline"} onClick={() => setFilterAgent("all")}>
                All ({tasks.length})
              </Button>
              {AGENTS.map((agent) => (
                <Button key={agent.name} size="sm" variant={filterAgent === agent.name ? "default" : "outline"}
                  onClick={() => setFilterAgent(agent.name)}>
                  {agent.label} ({tasks.filter((t) => t.agent_name === agent.name).length})
                </Button>
              ))}
            </div>
            <Button size="sm" variant="ghost" onClick={loadTasks} disabled={loading}>
              <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />Refresh
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTasks.length === 0 ? (
            <Card>
              <CardContent className="pt-8 pb-8 flex flex-col items-center gap-2 text-center">
                <Bot className="w-10 h-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No tasks yet. Assign a task or run a batch to see agent reports here.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredTasks.map((task) => {
                const agent = AGENTS.find((a) => a.name === task.agent_name);
                const status = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
                const StatusIcon = status.icon;
                const AgentIcon = agent?.icon || Bot;
                return (
                  <Card key={task.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className={`w-9 h-9 rounded-lg ${agent?.bg || "bg-muted/20"} flex items-center justify-center shrink-0`}>
                            <AgentIcon className={`w-4 h-4 ${agent?.color || "text-muted-foreground"}`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{agent?.label || task.agent_name}</span>
                              <Badge variant="outline" className="text-xs">{task.task_type}</Badge>
                              <Badge variant="outline" className={`text-xs ${status.color} ${status.bg}`}>
                                <StatusIcon className={`w-3 h-3 mr-1 ${status.spin ? "animate-spin" : ""}`} />
                                {status.label}
                              </Badge>
                              {task.confidence_score > 0 && (
                                <span className="text-xs text-muted-foreground">{task.confidence_score}% confidence</span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              {task.target_data?.property_address || task.target_data?.owner_name ||
                                task.target_data?.phone || task.target_data?.email || "—"}
                            </p>
                            {task.result_summary && (
                              <p className="text-xs mt-1 text-foreground/80">{task.result_summary}</p>
                            )}
                            {task.error_message && (
                              <p className="text-xs mt-1 text-red-500">{task.error_message}</p>
                            )}
                            {task.batch_id && (
                              <p className="text-xs text-muted-foreground mt-1 font-mono">batch: {task.batch_id}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground text-right shrink-0">
                          {task.completed_at && <p>{new Date(task.completed_at).toLocaleString()}</p>}
                          {task.duration_ms > 0 && <p>{(task.duration_ms / 1000).toFixed(1)}s</p>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}