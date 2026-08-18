import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/StatusBadge";
import { Image } from "@/components/ui/image";
import { ArrowLeft, Play, Download } from "lucide-react";

export default function JobDetail() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [steps, setSteps] = useState([]);
  const [results, setResults] = useState([]);
  const [screenshots, setScreenshots] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState("results");

  useEffect(() => {
    const load = async () => {
      try {
        const [j, s, r, ss, l] = await Promise.all([
          base44.entities.Job.get(id),
          base44.entities.Step.filter({ job_id: id }, "order", 100),
          base44.entities.Result.filter({ job_id: id }, "-extracted_at", 200),
          base44.entities.Screenshot.filter({ job_id: id }, "-taken_at", 50),
          base44.entities.LogEntry.filter({ job_id: id }, "-timestamp", 200),
        ]);
        setJob(j); setSteps(s); setResults(r); setScreenshots(ss); setLogs(l);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
    const unsub = base44.entities.Job.subscribe(() => load());
    return unsub;
  }, [id]);

  const run = async () => {
    setRunning(true);
    try { await base44.functions.invoke("runJob", { jobId: id }); } catch (e) { alert(e.response?.data?.error || e.message); }
    finally { setRunning(false); }
  };

  if (loading) return <div className="flex justify-center h-64 items-center"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;
  if (!job) return <div className="text-center py-12 text-muted-foreground">Job not found. <Link to="/jobs" className="underline">Back</Link></div>;

  return (
    <div className="space-y-6">
      <Link to="/jobs" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to jobs
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-heading font-bold">{job.name}</h1>
            <StatusBadge status={job.status} />
          </div>
          <p className="text-muted-foreground mt-1 text-sm">{job.start_url}</p>
        </div>
        <Button onClick={run} disabled={running || job.status === "running"}>
          {running ? <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
          {running ? "Running..." : "Run Job"}
        </Button>
      </div>

      {job.error_message && (
        <Card className="p-4 border-red-500/50 bg-red-50/50">
          <p className="text-sm text-red-800"><strong>Error:</strong> {job.error_message}</p>
        </Card>
      )}

      {/* Steps */}
      <Card>
        <CardHeader><CardTitle>Steps ({steps.length})</CardTitle></CardHeader>
        <CardContent>
          {steps.length === 0 ? <p className="text-muted-foreground text-sm">No steps defined</p> : (
            <div className="space-y-2">
              {steps.map((s, i) => (
                <div key={s.id} className="flex items-center gap-3 p-2 rounded bg-muted/30">
                  <span className="text-xs text-muted-foreground font-mono w-6">{i + 1}</span>
                  <span className="font-mono text-sm font-medium">{s.action_type}</span>
                  {s.selector && <span className="text-sm text-muted-foreground truncate">{s.selector}</span>}
                  {s.value && <span className="text-sm text-muted-foreground truncate">→ {s.value}</span>}
                  {s.name && <span className="text-xs text-muted-foreground ml-auto">{s.name}</span>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {["results", "screenshots", "logs"].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium capitalize border-b-2 ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "results" && (
        <Card>
          <CardHeader><CardTitle>Results ({results.length})</CardTitle></CardHeader>
          <CardContent>
            {results.length === 0 ? <p className="text-center py-8 text-muted-foreground">No results yet</p> : (
              <div className="space-y-3">
                {results.map((r) => (
                  <div key={r.id} className="border rounded p-3 bg-muted/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono bg-primary text-primary-foreground px-2 py-0.5 rounded">{r.data_type}</span>
                      <span className="text-xs text-muted-foreground">{r.extracted_at ? new Date(r.extracted_at).toLocaleString() : ""}</span>
                    </div>
                    <pre className="text-xs font-mono overflow-x-auto max-h-48 overflow-y-auto">{JSON.stringify(r.data, null, 2)}</pre>
                    {r.data?.file_url && (
                      <a href={r.data.file_url} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="outline" className="mt-2"><Download className="w-3 h-3 mr-1" />Download</Button>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "screenshots" && (
        <Card>
          <CardHeader><CardTitle>Screenshots ({screenshots.length})</CardTitle></CardHeader>
          <CardContent>
            {screenshots.length === 0 ? <p className="text-center py-8 text-muted-foreground">No screenshots</p> : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {screenshots.map((ss) => (
                  <div key={ss.id}>
                    <Image src={ss.file_url} className="rounded-lg border aspect-video" fittingType="fit" />
                    <p className="text-xs text-muted-foreground mt-1">{ss.caption || new Date(ss.taken_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "logs" && (
        <Card>
          <CardHeader><CardTitle>Logs ({logs.length})</CardTitle></CardHeader>
          <CardContent>
            {logs.length === 0 ? <p className="text-center py-8 text-muted-foreground">No logs</p> : (
              <div className="space-y-1 max-h-96 overflow-y-auto font-mono text-xs">
                {logs.map((log) => (
                  <div key={log.id} className={`p-2 rounded ${log.level === "error" ? "bg-red-50 text-red-800" : "bg-muted/50"}`}>
                    <span className="text-muted-foreground">{log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ""}</span>{" "}
                    <span className="font-semibold">[{log.level}]</span> {log.message}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}