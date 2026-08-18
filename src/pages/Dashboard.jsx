import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import { Activity, CheckCircle, AlertCircle, Cpu, Plus } from "lucide-react";

export default function Dashboard() {
  const [stats, setStats] = useState({ sessions: 0, activeSessions: 0, jobs: 0, completedJobs: 0, failedJobs: 0, queuedJobs: 0 });
  const [recentJobs, setRecentJobs] = useState([]);
  const [engineHealth, setEngineHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [sessions, jobs] = await Promise.all([
          base44.entities.Session.list("-created_date", 200),
          base44.entities.Job.list("-created_date", 50),
        ]);
        setStats({
          sessions: sessions.length,
          activeSessions: sessions.filter((s) => ["running", "idle"].includes(s.status)).length,
          jobs: jobs.length,
          completedJobs: jobs.filter((j) => j.status === "completed").length,
          failedJobs: jobs.filter((j) => j.status === "failed").length,
          queuedJobs: jobs.filter((j) => j.status === "queued").length,
        });
        setRecentJobs(jobs.slice(0, 8));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();

    // Engine health
    base44.functions.invoke("engineHealth", {}).then((res) => setEngineHealth(res.data)).catch(() => {});

    // Real-time session updates
    const unsub = base44.entities.Session.subscribe(() => load());
    return unsub;
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;
  }

  const successRate = stats.jobs > 0 ? Math.round((stats.completedJobs / stats.jobs) * 100) : 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Browser automation control center</p>
        </div>
        <Link to="/jobs/new">
          <Button><Plus className="w-4 h-4 mr-2" />New Job</Button>
        </Link>
      </div>

      {/* Engine health banner */}
      <Card className={`p-4 ${engineHealth?.ok ? "border-green-500/50 bg-green-50/50" : "border-orange-500/50 bg-orange-50/50"}`}>
        <div className="flex items-center gap-3">
          <Cpu className={`w-5 h-5 ${engineHealth?.ok ? "text-green-600" : "text-orange-600"}`} />
          <div className="flex-1">
            <p className="font-medium">
              {engineHealth?.ok ? "Engine connected" : engineHealth?.configured === false ? "Engine not configured" : "Engine unreachable"}
            </p>
            <p className="text-sm text-muted-foreground">
              {engineHealth?.ok
                ? `${engineHealth.active_sessions} active sessions · uptime ${Math.round(engineHealth.uptime)}s`
                : engineHealth?.configured === false
                ? "Set BROWSER_ENGINE_URL and BROWSER_ENGINE_API_KEY in Settings → Secrets"
                : engineHealth?.error || "Check your engine deployment"}
            </p>
          </div>
          <Link to="/settings"><Button variant="outline" size="sm">Configure</Button></Link>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Sessions" value={stats.activeSessions} icon={Activity} accent="text-blue-500" />
        <StatCard label="Total Jobs" value={stats.jobs} icon={CheckCircle} accent="text-purple-500" />
        <StatCard label="Success Rate" value={`${successRate}%`} icon={CheckCircle} accent="text-green-500" />
        <StatCard label="Failed Jobs" value={stats.failedJobs} icon={AlertCircle} accent="text-red-500" />
      </div>

      {/* Recent jobs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          {recentJobs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No jobs yet. <Link to="/jobs/new" className="text-primary underline">Create your first job</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recentJobs.map((job) => (
                <Link key={job.id} to={`/jobs/${job.id}`} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors">
                  <div className="flex items-center gap-3">
                    <StatusBadge status={job.status} />
                    <span className="font-medium">{job.name}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{job.start_url?.slice(0, 50)}</span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}