import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/StatusBadge";
import { Image } from "@/components/ui/image";
import { ArrowLeft, Monitor, Video, Radio, Share2 } from "lucide-react";
import LiveView from "@/components/LiveView";

export default function SessionDetail() {
  const { id } = useParams();
  const [session, setSession] = useState(null);
  const [logs, setLogs] = useState([]);
  const [screenshots, setScreenshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("logs");

  useEffect(() => {
    const load = async () => {
      try {
        const [s, l, ss] = await Promise.all([
          base44.entities.Session.get(id),
          base44.entities.LogEntry.filter({ session_id: id }, "-timestamp", 200),
          base44.entities.Screenshot.filter({ session_id: id }, "-taken_at", 50),
        ]);
        setSession(s);
        setLogs(l);
        setScreenshots(ss);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
    const unsub = base44.entities.Session.subscribe(() => load());
    return unsub;
  }, [id]);

  if (loading) return <div className="flex justify-center h-64 items-center"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;
  if (!session) return <div className="text-center py-12 text-muted-foreground">Session not found. <Link to="/sessions" className="underline">Back to sessions</Link></div>;

  const handleShare = async () => {
    try {
      const res = await base44.functions.invoke("engineAction", { action: "share_session", sessionId: session.session_id, sessionEntityId: session.id });
      const url = `${window.location.origin}/sessions/${session.id}?share=${res.data.shareToken}`;
      navigator.clipboard?.writeText(url);
      alert("Share link copied to clipboard!");
    } catch (e) { alert("Failed to share: " + e.message); }
  };

  return (
    <div className="space-y-6">
      <Link to="/sessions" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to sessions
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-heading font-bold">Session</h1>
            <StatusBadge status={session.status} />
          </div>
          <p className="text-muted-foreground mt-1 font-mono text-sm">{session.session_id || session.id}</p>
        </div>
        <div className="flex gap-2">
          {(session.status === "running" || session.status === "idle") && (
            <Button variant="outline" onClick={handleShare}><Share2 className="w-4 h-4 mr-2" />Share</Button>
          )}
          {(session.status === "running" || session.status === "idle") && (
            <Button
              variant="destructive"
              onClick={async () => {
                await base44.functions.invoke("engineAction", {
                  action: "close_session",
                  sessionId: session.session_id,
                  sessionEntityId: session.id,
                });
              }}
            >
              Close Session
            </Button>
          )}
        </div>
      </div>

      {/* Session info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Current URL</p><p className="text-sm mt-1 truncate">{session.current_url || session.target_url || "—"}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Title</p><p className="text-sm mt-1 truncate">{session.current_title || "—"}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Viewport</p><p className="text-sm mt-1">{session.viewport ? `${session.viewport.width}×${session.viewport.height}` : "default"}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Started</p><p className="text-sm mt-1">{session.started_at ? new Date(session.started_at).toLocaleString() : "—"}</p></Card>
        {session.cdp_url && <Card className="p-4"><p className="text-xs text-muted-foreground">CDP Endpoint</p><p className="text-sm mt-1 font-mono truncate">{session.cdp_url}</p></Card>}
        {session.record_video && <Card className="p-4"><p className="text-xs text-muted-foreground">Video</p><p className="text-sm mt-1">Recording enabled</p></Card>}
      </div>

      {session.error_message && (
        <Card className="p-4 border-red-500/50 bg-red-50/50">
          <p className="text-sm text-red-800"><strong>Error:</strong> {session.error_message}</p>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {["logs", "screenshots", "video", "live"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "logs" && (
        <Card>
          <CardHeader><CardTitle>Action Logs ({logs.length})</CardTitle></CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No logs recorded</p>
            ) : (
              <div className="space-y-1 max-h-96 overflow-y-auto font-mono text-xs">
                {logs.map((log) => (
                  <div key={log.id} className={`p-2 rounded ${log.level === "error" ? "bg-red-50 text-red-800" : "bg-muted/50"}`}>
                    <span className="text-muted-foreground">{new Date(log.timestamp).toLocaleTimeString()}</span>{" "}
                    <span className={`font-semibold ${log.level === "error" ? "text-red-600" : ""}`}>[{log.level}]</span>{" "}
                    {log.message}
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
            {screenshots.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground"><Monitor className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>No screenshots captured</p></div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {screenshots.map((ss) => (
                  <div key={ss.id} className="space-y-1">
                    <Image src={ss.file_url} className="rounded-lg border aspect-video" fittingType="fit" />
                    <p className="text-xs text-muted-foreground">{ss.caption || new Date(ss.taken_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "video" && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Video className="w-5 h-5" />Session Recording</CardTitle></CardHeader>
          <CardContent>
            {session.video_url ? (
              <video src={session.video_url} controls className="w-full rounded-lg" />
            ) : (
              <p className="text-center py-8 text-muted-foreground">No video recorded for this session</p>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "live" && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Radio className="w-5 h-5" />Live View</CardTitle></CardHeader>
          <CardContent>
            {["running", "idle"].includes(session.status) ? (
              <LiveView sessionId={session.session_id} />
            ) : (
              <p className="text-center py-8 text-muted-foreground">Session is not active</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}