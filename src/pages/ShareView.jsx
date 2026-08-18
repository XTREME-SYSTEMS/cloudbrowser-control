import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, RefreshCw, ExternalLink, Globe } from "lucide-react";

export default function ShareView() {
  const { token } = useParams();
  const [session, setSession] = useState(null);
  const [screenshots, setScreenshots] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const sessions = await base44.entities.Session.filter({ share_token: token });
      if (sessions[0]) {
        setSession(sessions[0]);
        const [shots, lg] = await Promise.all([
          base44.entities.Screenshot.filter({ session_id: sessions[0].id }),
          base44.entities.LogEntry.filter({ session_id: sessions[0].id }),
        ]);
        setScreenshots(shots);
        setLogs(lg);
      }
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); /* poll every 2s for live updates */ const interval = setInterval(load, 2000); return () => clearInterval(interval); }, [token]);

  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div></div>;
  if (!session) return <div className="flex items-center justify-center py-20"><p className="text-muted-foreground">Session not found or share link expired.</p></div>;

  const latestShot = screenshots[0];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            <h1 className="text-xl font-bold">Shared Session View</h1>
            <span className={`px-2 py-0.5 rounded text-xs ${session.status === "running" ? "bg-green-500" : "bg-slate-600"}`}>{session.status}</span>
          </div>
          <Button size="sm" variant="ghost" onClick={refresh} className="text-slate-300"><RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />Refresh</Button>
        </div>

        {session.current_url && (
          <div className="flex items-center gap-2 text-sm text-slate-400"><Globe className="w-4 h-4" /><span className="truncate">{session.current_url}</span></div>
        )}

        {/* Live screenshot */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-6">
            {latestShot ? (
              <img src={latestShot.file_url} alt="Live view" className="w-full rounded-md" />
            ) : (
              <div className="flex items-center justify-center h-64 text-slate-500"><p>Waiting for screenshots...</p></div>
            )}
          </CardContent>
        </Card>

        {/* Logs */}
        {logs.length > 0 && (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="pt-6">
              <h3 className="text-sm font-medium mb-2 text-slate-300">Activity Log</h3>
              <div className="space-y-1 max-h-48 overflow-y-auto font-mono text-xs">
                {logs.slice(-20).reverse().map((log) => (
                  <div key={log.id} className={`text-${log.level === "error" ? "red" : log.level === "warn" ? "yellow" : "slate"}-400`}>
                    [{new Date(log.timestamp).toLocaleTimeString()}] {log.message}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}