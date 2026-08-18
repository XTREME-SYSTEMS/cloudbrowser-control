import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/StatusBadge";
import { Plus, Play, Briefcase } from "lucide-react";

export default function Jobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await base44.entities.Job.list("-created_date", 100);
        setJobs(data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
    const unsub = base44.entities.Job.subscribe(() => load());
    return unsub;
  }, []);

  const runJob = async (jobId) => {
    setRunning(jobId);
    try {
      await base44.functions.invoke("runJob", { jobId });
    } catch (e) {
      alert("Failed to run job: " + e.response?.data?.error || e.message);
    } finally {
      setRunning(null);
    }
  };

  if (loading) return <div className="flex justify-center h-64 items-center"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold">Jobs</h1>
          <p className="text-muted-foreground mt-1">Automation jobs — define steps and run them</p>
        </div>
        <Link to="/jobs/new"><Button><Plus className="w-4 h-4 mr-2" />New Job</Button></Link>
      </div>

      <Card>
        <CardHeader><CardTitle>All Jobs ({jobs.length})</CardTitle></CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No jobs yet.</p>
              <Link to="/jobs/new" className="inline-block mt-3"><Button><Plus className="w-4 h-4 mr-2" />Create a Job</Button></Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Name</th>
                    <th className="pb-2 pr-4">Start URL</th>
                    <th className="pb-2 pr-4">Steps</th>
                    <th className="pb-2 pr-4">Created</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 pr-4"><StatusBadge status={job.status} /></td>
                      <td className="py-3 pr-4 font-medium">{job.name}</td>
                      <td className="py-3 pr-4 max-w-xs truncate">{job.start_url || "—"}</td>
                      <td className="py-3 pr-4">{job.steps_count || 0}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{new Date(job.created_date).toLocaleDateString()}</td>
                      <td className="py-3 flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => runJob(job.id)} disabled={running === job.id || job.status === "running"}>
                          {running === job.id ? <div className="w-3 h-3 border-2 border-muted border-t-primary rounded-full animate-spin" /> : <Play className="w-3 h-3" />}
                        </Button>
                        <Link to={`/jobs/${job.id}`}><Button variant="ghost" size="sm">View</Button></Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}