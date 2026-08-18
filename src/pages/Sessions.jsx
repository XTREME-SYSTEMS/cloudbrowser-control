import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/StatusBadge";
import { Plus, Monitor } from "lucide-react";

export default function Sessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await base44.entities.Session.list("-created_date", 100);
        setSessions(data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
    const unsub = base44.entities.Session.subscribe(() => load());
    return unsub;
  }, []);

  if (loading) return <div className="flex justify-center h-64 items-center"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold">Sessions</h1>
          <p className="text-muted-foreground mt-1">Browser session history and live status</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>All Sessions ({sessions.length})</CardTitle></CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Monitor className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No sessions yet. Sessions are created when you run a job.</p>
              <Link to="/jobs/new" className="inline-block mt-3"><Button><Plus className="w-4 h-4 mr-2" />Create a Job</Button></Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Target URL</th>
                    <th className="pb-2 pr-4">Tags</th>
                    <th className="pb-2 pr-4">Started</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 pr-4"><StatusBadge status={s.status} /></td>
                      <td className="py-3 pr-4 max-w-xs truncate">{s.target_url || s.current_url || "—"}</td>
                      <td className="py-3 pr-4">
                        <div className="flex gap-1 flex-wrap">
                          {(s.tags || []).map((t) => <span key={t} className="px-2 py-0.5 bg-muted rounded text-xs">{t}</span>)}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">{s.started_at ? new Date(s.started_at).toLocaleString() : "—"}</td>
                      <td className="py-3"><Link to={`/sessions/${s.id}`}><Button variant="ghost" size="sm">View</Button></Link></td>
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