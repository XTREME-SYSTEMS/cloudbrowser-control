import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Folder, Plus, Trash2, Copy, Check, Eye, EyeOff, Archive, ArchiveRestore, Monitor, Briefcase, DollarSign, TrendingUp } from "lucide-react";

const COLORS = [
  { name: "blue", class: "bg-blue-500" },
  { name: "purple", class: "bg-purple-500" },
  { name: "green", class: "bg-emerald-500" },
  { name: "orange", class: "bg-orange-500" },
  { name: "pink", class: "bg-pink-500" },
  { name: "cyan", class: "bg-cyan-500" },
];

function Stat({ icon: Icon, label, value, to }) {
  const content = (
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium">{value}</span>
    </div>
  );
  return to ? <Link to={to} className="hover:underline">{content}</Link> : content;
}

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [stats, setStats] = useState({});
  const [newProj, setNewProj] = useState({ name: "", description: "", color: "blue" });
  const [createdKey, setCreatedKey] = useState(null);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await base44.entities.Project.list("-created_date", 50);
      setProjects(list);
      setLoadingStats(true);
      // Fetch sessions + jobs in parallel, then compute per-project counts
      const [sessions, jobs, costEntries] = await Promise.all([
        base44.entities.Session.list("-created_date", 200).catch(() => []),
        base44.entities.Job.list("-created_date", 200).catch(() => []),
        base44.entities.CostEntry.list("-created_date", 200).catch(() => []),
      ]);
      const next = {};
      for (const p of list) {
        const projSessions = sessions.filter((s) => s.project_id === p.id);
        const projJobs = jobs.filter((j) => j.project_id === p.id);
        const projCosts = costEntries.filter((c) => c.job_id && projJobs.some((j) => j.id === c.job_id));
        next[p.id] = {
          sessions: projSessions.length,
          activeSessions: projSessions.filter((s) => !["ended", "errored", "timed_out"].includes(s.status)).length,
          jobs: projJobs.length,
          completedJobs: projJobs.filter((j) => j.status === "completed").length,
          failedJobs: projJobs.filter((j) => j.status === "failed").length,
          totalCost: projCosts.reduce((sum, c) => sum + (c.cost || 0), 0),
        };
      }
      setStats(next);
    } catch (e) {
      console.error("Failed to load projects", e);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!newProj.name) return;
    setCreating(true);
    try {
      const res = await base44.functions.invoke("createProject", newProj);
      if (res.data?.api_key?.api_key) {
        setCreatedKey(res.data.api_key.api_key);
        setShowKey(true);
      }
      setNewProj({ name: "", description: "", color: "blue" });
      load();
    } catch (e) { alert(e.response?.data?.error || e.message); }
    finally { setCreating(false); }
  };

  const copyKey = () => { navigator.clipboard.writeText(createdKey); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const remove = async (id) => {
    if (!confirm("Delete this project? Associated sessions and jobs will remain but lose the project link.")) return;
    await base44.entities.Project.delete(id);
    load();
  };

  const toggleArchive = async (p) => {
    await base44.entities.Project.update(p.id, { status: p.status === "active" ? "archived" : "active" });
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold flex items-center gap-2"><Folder className="w-6 h-6" />Projects</h1>
        <p className="text-muted-foreground mt-1">Track every project's sessions, jobs, and costs. Each project gets its own API key for integration.</p>
      </div>

      {createdKey && (
        <Card className="border-amber-300">
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-amber-800">Project API key — copy it now, it won't be shown again!</span>
              <Button size="sm" variant="ghost" onClick={() => setShowKey(!showKey)}>{showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</Button>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-2 rounded bg-amber-50 border font-mono text-xs sm:text-sm break-all">
                {showKey ? createdKey : "cb_live_•••••••••••••••••••••••••••••••••••••••••"}
              </code>
              <Button size="sm" onClick={copyKey} className="shrink-0">{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</Button>
            </div>
            <Button size="sm" variant="outline" onClick={() => setCreatedKey(null)}>Done</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Plus className="w-5 h-5" />New Project</CardTitle>
          <CardDescription>Create a project to group sessions and jobs. An API key is generated automatically.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Project Name</Label><Input value={newProj.name} onChange={(e) => setNewProj({ ...newProj, name: e.target.value })} placeholder="My Scraper, Competitor Monitor..." /></div>
          <div><Label>Description</Label><Textarea value={newProj.description} onChange={(e) => setNewProj({ ...newProj, description: e.target.value })} rows={2} /></div>
          <div>
            <Label>Color</Label>
            <div className="flex gap-2 mt-1">
              {COLORS.map((c) => (
                <button key={c.name} onClick={() => setNewProj({ ...newProj, color: c.name })} className={`w-7 h-7 rounded-full ${c.class} ${newProj.color === c.name ? "ring-2 ring-offset-2 ring-primary" : ""}`} />
              ))}
            </div>
          </div>
          <Button onClick={create} disabled={creating || !newProj.name} size="sm"><Plus className="w-4 h-4 mr-1" />{creating ? "Creating..." : "Create Project & Generate Key"}</Button>
        </CardContent>
      </Card>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground text-sm">No projects yet. Create one above to start tracking.</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((p) => {
            const s = stats[p.id] || {};
            return (
              <Card key={p.id} className={p.status === "archived" ? "opacity-60" : ""}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full bg-${p.color || "blue"}-500`} />
                      <div>
                        <CardTitle className="text-base">{p.name}</CardTitle>
                        {p.status === "archived" && <span className="text-xs text-muted-foreground ml-1">(archived)</span>}
                        {p.description && <CardDescription className="mt-0.5">{p.description}</CardDescription>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => toggleArchive(p)}>
                        {p.status === "active" ? <Archive className="w-4 h-4" /> : <ArchiveRestore className="w-4 h-4" />}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <Stat icon={Monitor} label="Sessions" value={loadingStats ? "…" : (s.sessions || 0)} to="/sessions" />
                    <Stat icon={TrendingUp} label="Active" value={loadingStats ? "…" : (s.activeSessions || 0)} to="/sessions" />
                    <Stat icon={Briefcase} label="Jobs" value={loadingStats ? "…" : (s.jobs || 0)} to="/jobs" />
                    <Stat icon={Check} label="Completed" value={loadingStats ? "…" : (s.completedJobs || 0)} to="/jobs" />
                  </div>
                  {s.failedJobs > 0 && (
                    <div className="flex items-center gap-2 text-xs text-red-500">
                      <Briefcase className="w-4 h-4" /> {s.failedJobs} failed job(s)
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Total cost</span>
                    <span className="text-sm font-medium ml-auto">${(s.totalCost || 0).toFixed(4)}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}