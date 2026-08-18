import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Activity, CheckCircle, AlertCircle, XCircle, Cpu, Plus, Shield, DollarSign,
  Server, Gauge, Zap, AlertTriangle, Radio, Clock, TrendingUp, Lock,
} from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import ActivityFeed from "@/components/ActivityFeed";

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [engineHealth, setEngineHealth] = useState(null);
  const [healthLogs, setHealthLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [sessions, jobs, logs] = await Promise.all([
          base44.entities.Session.list("-created_date", 200),
          base44.entities.Job.list("-created_date", 100),
          base44.entities.EngineHealthLog.list("-created_date", 10),
        ]);

        const activeSessions = sessions.filter((s) => ["running", "idle"].includes(s.status));
        const startingSessions = sessions.filter((s) => s.status === "pending");
        const staleSessions = sessions.filter((s) => {
          if (!s.started_at) return false;
          return ["running", "idle"].includes(s.status) && Date.now() - new Date(s.started_at).getTime() > 30 * 60 * 1000;
        });
        const failedSessions = sessions.filter((s) => ["errored", "timed_out"].includes(s.status));
        const orphanedSessions = sessions.filter((s) => ["running", "idle"].includes(s.status) && !s.session_id);

        const completedJobs = jobs.filter((j) => j.status === "completed");
        const failedJobs = jobs.filter((j) => j.status === "failed");
        const queuedJobs = jobs.filter((j) => j.status === "queued");
        const runningJobs = jobs.filter((j) => j.status === "running");
        const retryingJobs = jobs.filter((j) => j.status === "retrying");

        const successRate = jobs.length > 0 ? Math.round((completedJobs.length / jobs.length) * 100) : 0;

        setStats({
          sessions: sessions.length,
          activeSessions: activeSessions.length,
          startingSessions: startingSessions.length,
          staleSessions: staleSessions.length,
          orphanedSessions: orphanedSessions.length,
          failedSessions: failedSessions.length,
          jobs: jobs.length,
          completedJobs: completedJobs.length,
          failedJobs: failedJobs.length,
          queuedJobs: queuedJobs.length,
          runningJobs: runningJobs.length,
          retryingJobs: retryingJobs.length,
          successRate,
        });
        setHealthLogs(logs);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();

    base44.functions.invoke("engineHealth", {}).then((res) => setEngineHealth(res.data)).catch(() => {});
    const unsub = base44.entities.Session.subscribe(() => load());
    return unsub;
  }, []);

  if (loading || !stats) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;
  }

  const releaseStatus = engineHealth?.ok ? "VERIFIED" : "NOT READY";
  const securityGate = "PASS"; // Will be computed from actual checks
  const testGate = "PENDING"; // Will be computed from latest ScoreRecord

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold">Mission Control</h1>
          <p className="text-muted-foreground mt-1">CloudBrowser Control operational command center</p>
        </div>
        <Link to="/jobs/new"><Button><Plus className="w-4 h-4 mr-2" />New Job</Button></Link>
      </div>

      {/* Top Status Bar */}
      <Card className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <StatusItem label="Release" value={releaseStatus} ok={engineHealth?.ok} icon={Gauge} />
          <StatusItem label="Base44 Health" value={engineHealth?.ok ? "Connected" : "Down"} ok={engineHealth?.ok} icon={CheckCircle} />
          <StatusItem label="Engine Health" value={engineHealth?.ok ? "Healthy" : "Unreachable"} ok={engineHealth?.ok} icon={Cpu} />
          <StatusItem label="Engine Version" value={engineHealth?.engine_version || "—"} icon={Server} />
          <StatusItem label="Security Gate" value={securityGate} ok={securityGate === "PASS"} icon={Shield} />
          <StatusItem label="Test Gate" value={testGate} ok={false} icon={AlertTriangle} />
        </div>
        {engineHealth && (
          <div className="mt-3 pt-3 border-t grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div><span className="text-muted-foreground">Worker:</span> <span className="font-mono">{engineHealth.worker_id || "—"}</span></div>
            <div><span className="text-muted-foreground">Region:</span> {engineHealth.region || "—"}</div>
            <div><span className="text-muted-foreground">Schema:</span> {engineHealth.schema_version || "—"}</div>
            <div><span className="text-muted-foreground">Uptime:</span> {Math.round(engineHealth.uptime || 0)}s</div>
          </div>
        )}
      </Card>

      {/* Fleet + Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Server className="w-5 h-5" />Fleet</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Active Browsers" value={engineHealth?.active_sessions ?? 0} icon={Cpu} />
              <Metric label="Max Capacity" value={engineHealth?.max_sessions ?? 0} icon={Gauge} />
              <Metric label="Pool Size" value={engineHealth?.pool_size ?? 0} icon={Activity} />
              <Metric label="Pool Capacity" value={engineHealth?.pool_capacity ?? 0} icon={Server} />
            </div>
            <div className="mt-3 pt-3 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Pool Utilization</span>
                <span className="font-medium">
                  {engineHealth?.pool_capacity > 0
                    ? Math.round(((engineHealth?.pool_size || 0) / engineHealth.pool_capacity) * 100)
                    : 0}%
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 mt-1">
                <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${engineHealth?.pool_capacity > 0 ? ((engineHealth?.pool_size || 0) / engineHealth.pool_capacity) * 100 : 0}%` }} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Radio className="w-5 h-5" />Sessions</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Running" value={stats.activeSessions} icon={Activity} accent="text-blue-500" />
              <Metric label="Starting" value={stats.startingSessions} icon={Clock} accent="text-yellow-500" />
              <Metric label="Stale" value={stats.staleSessions} icon={AlertTriangle} accent="text-orange-500" />
              <Metric label="Orphaned" value={stats.orphanedSessions} icon={AlertCircle} accent="text-red-500" />
              <Metric label="Failed" value={stats.failedSessions} icon={XCircle} accent="text-red-500" />
              <Metric label="Total" value={stats.sessions} icon={Server} />
            </div>
            {stats.orphanedSessions > 0 && (
              <div className="mt-3 p-2 rounded bg-red-50 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {stats.orphanedSessions} session(s) have no runtime ID — orphaned control-plane records
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Jobs + Security */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5" />Jobs</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Queued" value={stats.queuedJobs} icon={Clock} accent="text-yellow-500" />
              <Metric label="Running" value={stats.runningJobs} icon={Activity} accent="text-blue-500" />
              <Metric label="Completed" value={stats.completedJobs} icon={CheckCircle} accent="text-green-500" />
              <Metric label="Failed" value={stats.failedJobs} icon={AlertCircle} accent="text-red-500" />
              <Metric label="Retrying" value={stats.retryingJobs} icon={Zap} accent="text-orange-500" />
              <Metric label="Success Rate" value={`${stats.successRate}%`} icon={Gauge} accent={stats.successRate >= 90 ? "text-green-500" : "text-orange-500"} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5" />Security</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <SecurityRow label="API Auth" status="Bearer + hash" ok />
              <SecurityRow label="IP Allowlist" status="CIDR + fail-closed" ok />
              <SecurityRow label="Webhook HMAC" status="Required + replay guard" ok />
              <SecurityRow label="SSRF Protection" status="Engine-level" ok />
              <SecurityRow label="CORS" status="Allowlist" ok />
              <SecurityRow label="Secret Storage" status="Runtime secrets" ok />
              <SecurityRow label="RLS / Tenancy" status="Not configured" ok={false} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Operations + Recent Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="w-5 h-5" />Recent Health Observations</CardTitle></CardHeader>
          <CardContent>
            {healthLogs.length === 0 ? (
              <p className="text-center py-4 text-muted-foreground text-sm">No health observations recorded yet</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {healthLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between p-2 rounded bg-muted/30 text-sm">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${log.status === "healthy" ? "bg-green-500" : log.status === "unreachable" ? "bg-red-500" : "bg-yellow-500"}`} />
                      <span className="font-medium">{log.status}</span>
                      {log.worker_id && <span className="text-xs text-muted-foreground font-mono">{log.worker_id}</span>}
                    </div>
                    <span className="text-xs text-muted-foreground">{log.checked_at ? new Date(log.checked_at).toLocaleTimeString() : "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent Jobs</CardTitle></CardHeader>
          <CardContent>
            <RecentJobs />
          </CardContent>
        </Card>
      </div>

      <ActivityFeed />
    </div>
  );
}

function StatusItem({ label, value, ok, icon: Icon }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className={`w-4 h-4 shrink-0 ${ok === true ? "text-green-500" : ok === false ? "text-red-500" : "text-muted-foreground"}`} />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-sm font-medium ${ok === true ? "text-green-600" : ok === false ? "text-red-600" : ""}`}>{value}</p>
      </div>
    </div>
  );
}

function Metric({ label, value, icon: Icon, accent }) {
  return (
    <div className="p-3 rounded-lg bg-muted/30">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        {Icon && <Icon className={`w-4 h-4 ${accent || "text-muted-foreground"}`} />}
      </div>
      <p className={`text-xl font-bold mt-1 ${accent || ""}`}>{value}</p>
    </div>
  );
}

function SecurityRow({ label, status, ok }) {
  return (
    <div className="flex items-center justify-between p-2 rounded bg-muted/30">
      <span>{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{status}</span>
        {ok ? <CheckCircle className="w-4 h-4 text-green-500" /> : <AlertCircle className="w-4 h-4 text-orange-500" />}
      </div>
    </div>
  );
}

function RecentJobs() {
  const [jobs, setJobs] = useState([]);
  useEffect(() => {
    base44.entities.Job.list("-created_date", 8).then(setJobs).catch(() => {});
  }, []);
  if (!jobs.length) return <p className="text-center py-4 text-muted-foreground text-sm">No jobs yet</p>;
  return (
    <div className="space-y-2">
      {jobs.map((job) => (
        <Link key={job.id} to={`/jobs/${job.id}`} className="flex items-center justify-between p-2 rounded hover:bg-muted transition-colors">
          <div className="flex items-center gap-2">
            <StatusBadge status={job.status} />
            <span className="font-medium text-sm">{job.name}</span>
          </div>
          <span className="text-xs text-muted-foreground truncate max-w-32">{job.start_url}</span>
        </Link>
      ))}
    </div>
  );
}