import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Play, RefreshCw, AlertCircle, CheckCircle, XCircle, Clock, Mail, Zap } from "lucide-react";

const STATUS_STYLES = {
  completed: { icon: CheckCircle, color: "text-green-600", badge: "default" },
  failed: { icon: XCircle, color: "text-red-600", badge: "destructive" },
  dead_lettered: { icon: AlertCircle, color: "text-red-700", badge: "destructive" },
  awaiting_approval: { icon: Mail, color: "text-yellow-600", badge: "secondary" },
  pending: { icon: Clock, color: "text-muted-foreground", badge: "secondary" },
  ingesting: { icon: Activity, color: "text-blue-600", badge: "secondary" },
  validating: { icon: Activity, color: "text-blue-600", badge: "secondary" },
  scoring: { icon: Activity, color: "text-blue-600", badge: "secondary" },
  acting: { icon: Zap, color: "text-purple-600", badge: "secondary" },
  observing: { icon: Activity, color: "text-blue-600", badge: "secondary" },
  receipt: { icon: CheckCircle, color: "text-green-600", badge: "default" },
  retry: { icon: RefreshCw, color: "text-orange-600", badge: "secondary" },
};

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.pending;
  const Icon = style.icon;
  return (
    <Badge variant={style.badge} className="flex items-center gap-1 w-fit">
      <Icon className="w-3 h-3" />
      {status}
    </Badge>
  );
}

function SpecCard({ spec, onRun }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Badge variant="outline">{spec.workflow_id}</Badge>
              {spec.name}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{spec.objective}</p>
          </div>
          <Badge variant={spec.status === 'active' ? 'default' : 'secondary'}>{spec.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div><span className="text-muted-foreground">Trigger:</span> {spec.trigger || 'manual'}</div>
          <div><span className="text-muted-foreground">Latency:</span> {spec.expected_latency || 'N/A'}</div>
          <div><span className="text-muted-foreground">Cost:</span> {spec.expected_cost || 'N/A'}</div>
          <div><span className="text-muted-foreground">Retries:</span> {spec.max_retries || 3}</div>
        </div>
        {spec.steps && (
          <div className="text-xs">
            <span className="text-muted-foreground">Pipeline:</span>
            <div className="mt-1 font-mono text-[11px] bg-muted p-2 rounded">{spec.steps}</div>
          </div>
        )}
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1 text-green-600"><CheckCircle className="w-3 h-3" /> {spec.success_count || 0}</span>
          <span className="flex items-center gap-1 text-red-600"><XCircle className="w-3 h-3" /> {spec.failure_count || 0}</span>
          <span className="text-muted-foreground">Total: {spec.run_count || 0}</span>
        </div>
        <Button size="sm" onClick={() => onRun(spec)} className="w-full">
          <Play className="w-3 h-3 mr-1" /> Run Now
        </Button>
      </CardContent>
    </Card>
  );
}

function RunCard({ run }) {
  return (
    <Card>
      <CardContent className="pt-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusBadge status={run.status} />
            <span className="text-xs font-mono text-muted-foreground">{run.run_id}</span>
          </div>
          <span className="text-xs text-muted-foreground">{run.workflow_id}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div><span className="text-muted-foreground">Step:</span> {run.current_step}</div>
          <div><span className="text-muted-foreground">Score:</span> {run.score || 0}</div>
          <div><span className="text-muted-foreground">Retries:</span> {run.retry_count || 0}/{run.max_retries || 3}</div>
          <div><span className="text-muted-foreground">Duration:</span> {run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : '—'}</div>
        </div>
        {run.error_message && (
          <div className="flex items-start gap-2 text-xs text-red-600">
            <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" /> {run.error_message}
          </div>
        )}
        {run.receipt_id && (
          <div className="text-xs text-muted-foreground font-mono">Receipt: {run.receipt_id}</div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AutonomousWorkflows() {
  const [specs, setSpecs] = useState([]);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(null);
  const [error, setError] = useState(null);
  const [inputText, setInputText] = useState('{\n  "event_id": "test_001",\n  "project_id": "demo",\n  "query": "test event"\n}');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [specList, runList] = await Promise.all([
        base44.entities.AutonomousWorkflow.list('-updated_date', 50),
        base44.entities.AutonomousWorkflowRun.list('-created_date', 30),
      ]);
      setSpecs(specList);
      setRuns(runList);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRun = async (spec) => {
    setRunning(spec.workflow_id);
    setError(null);
    try {
      let inputData = {};
      try { inputData = JSON.parse(inputText); } catch { inputData = { event_id: `manual_${Date.now()}`, project_id: 'demo' }; }
      await base44.functions.invoke('runAutonomousWorkflow', { workflow_id: spec.workflow_id, input_data: inputData });
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    }
    setRunning(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <Activity className="w-6 h-6 text-primary" />
          Autonomous Workflows
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Durable state-machine workflows: ingest → validate → score → act/draft → observe → receipt. With checkpointing, idempotency, bounded retry, and dead-letter recovery.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-md">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <label className="text-sm font-medium">Input Event (JSON)</label>
          <Textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="mt-2 font-mono text-xs"
            rows={5}
          />
          <p className="text-xs text-muted-foreground mt-2">This input is passed to every workflow you run below.</p>
        </CardContent>
      </Card>

      <Tabs defaultValue="specs">
        <TabsList>
          <TabsTrigger value="specs">Workflow Specs ({specs.length})</TabsTrigger>
          <TabsTrigger value="runs">Recent Runs ({runs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="specs" className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
          ) : specs.length === 0 ? (
            <Card><CardContent className="pt-6 text-center text-muted-foreground py-12">No workflow specs yet. Seed specs from the Autonomous Workflows package.</CardContent></Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {specs.map((s) => (
                <SpecCard key={s.id} spec={s} onRun={handleRun} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="runs" className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
          ) : runs.length === 0 ? (
            <Card><CardContent className="pt-6 text-center text-muted-foreground py-12">No runs yet. Execute a workflow spec above.</CardContent></Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {runs.map((r) => <RunCard key={r.id} run={r} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}