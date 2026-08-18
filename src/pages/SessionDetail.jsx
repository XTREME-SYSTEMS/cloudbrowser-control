import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/StatusBadge";
import { Image } from "@/components/ui/image";
import {
  ArrowLeft, Monitor, Video, Radio, Share2, XCircle, Clock,
  Network, Terminal, AlertTriangle, FileText, Download, Upload,
  Cpu, DollarSign, Shield, Activity, Layers, Globe,
} from "lucide-react";
import LiveView from "@/components/LiveView";

const TABS = [
  { id: "live", label: "Live", icon: Radio },
  { id: "timeline", label: "Timeline", icon: Clock },
  { id: "actions", label: "Actions", icon: Activity },
  { id: "network", label: "Network", icon: Network },
  { id: "console", label: "Console", icon: Terminal },
  { id: "errors", label: "Errors", icon: AlertTriangle },
  { id: "artifacts", label: "Artifacts", icon: FileText },
  { id: "downloads", label: "Downloads", icon: Download },
  { id: "uploads", label: "Uploads", icon: Upload },
  { id: "recording", label: "Recording", icon: Video },
  { id: "tabs", label: "Tabs", icon: Layers },
  { id: "context", label: "Context", icon: Globe },
  { id: "proxy", label: "Proxy", icon: Globe },
  { id: "agent", label: "Agent", icon: Cpu },
  { id: "cost", label: "Cost", icon: DollarSign },
  { id: "metadata", label: "Metadata", icon: FileText },
  { id: "evidence", label: "Evidence", icon: Shield },
];

export default function SessionDetail() {
  const { id } = useParams();
  const [session, setSession] = useState(null);
  const [logs, setLogs] = useState([]);
  const [screenshots, setScreenshots] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("live");

  useEffect(() => {
    const load = async () => {
      try {
        const [s, l, ss, rs] = await Promise.all([
          base44.entities.Session.get(id),
          base44.entities.LogEntry.filter({ session_id: id }, "-timestamp", 500),
          base44.entities.Screenshot.filter({ session_id: id }, "-taken_at", 100),
          base44.entities.Result.filter({ session_id: id }, "-extracted_at", 100),
        ]);
        setSession(s);
        setLogs(l);
        setScreenshots(ss);
        setResults(rs);
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
      const url = `${window.location.origin}/share/${res.data.shareToken}`;
      navigator.clipboard?.writeText(url);
      alert("Share link copied to clipboard!");
    } catch (e) { alert("Failed to share: " + e.message); }
  };

  const handleClose = async () => {
    if (!confirm("Terminate this session? The real browser will be closed. This cannot be undone.")) return;
    try {
      await base44.functions.invoke("engineAction", { action: "close_session", sessionId: session.session_id, sessionEntityId: session.id });
    } catch (e) { alert("Close failed: " + e.message); }
  };

  const errorLogs = logs.filter((l) => l.level === "error");
  const downloadResults = results.filter((r) => r.action_type === "download");
  const uploadResults = logs.filter((l) => l.category === "action" && l.message?.includes("upload"));

  return (
    <div className="space-y-4">
      <Link to="/sessions" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to sessions
      </Link>

      {/* Header with controls */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-heading font-bold">Session Inspector</h1>
            <StatusBadge status={session.status} />
          </div>
          <div className="mt-1 space-y-1">
            <p className="text-sm font-mono text-muted-foreground">CP: {session.id}</p>
            <p className="text-sm font-mono text-muted-foreground">RT: {session.session_id || "— no runtime ID —"}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(session.status === "running" || session.status === "idle") && (
            <>
              <Button variant="outline" size="sm" onClick={handleShare}><Share2 className="w-4 h-4 mr-1" />Share</Button>
              <Button variant="destructive" size="sm" onClick={handleClose}><XCircle className="w-4 h-4 mr-1" />Terminate</Button>
            </>
          )}
        </div>
      </div>

      {/* Metadata grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <InfoCard label="Current URL" value={session.current_url || session.target_url || "—"} />
        <InfoCard label="Title" value={session.current_title || "—"} />
        <InfoCard label="Viewport" value={session.viewport ? `${session.viewport.width}×${session.viewport.height}` : "default"} />
        <InfoCard label="Started" value={session.started_at ? new Date(session.started_at).toLocaleString() : "—"} />
        <InfoCard label="Worker" value={session.metadata?.worker_id || "—"} />
        <InfoCard label="Region" value={session.metadata?.region || "—"} />
      </div>

      {session.error_message && (
        <Card className="p-4 border-red-500/50 bg-red-50/50">
          <p className="text-sm text-red-800"><strong>Error:</strong> {session.error_message}</p>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b overflow-x-auto flex-nowrap">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1 ${
                tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === "live" && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Radio className="w-5 h-5" />Live View</CardTitle></CardHeader>
          <CardContent>
            {["running", "idle"].includes(session.status) && session.session_id ? (
              <LiveView sessionId={session.session_id} />
            ) : (
              <p className="text-center py-8 text-muted-foreground">Session is not active or has no runtime ID</p>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "timeline" && (
        <Card>
          <CardHeader><CardTitle>Timeline ({logs.length} events)</CardTitle></CardHeader>
          <CardContent>
            <LogList logs={logs} />
          </CardContent>
        </Card>
      )}

      {tab === "actions" && (
        <Card>
          <CardHeader><CardTitle>Action Logs ({logs.filter((l) => l.category === "action").length})</CardTitle></CardHeader>
          <CardContent>
            <LogList logs={logs.filter((l) => l.category === "action")} />
          </CardContent>
        </Card>
      )}

      {tab === "network" && (
        <Card>
          <CardHeader><CardTitle>Network Activity</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-2">Network requests captured by the engine during session execution.</p>
            <LogList logs={logs.filter((l) => l.category === "network")} />
          </CardContent>
        </Card>
      )}

      {tab === "console" && (
        <Card>
          <CardHeader><CardTitle>Console Output</CardTitle></CardHeader>
          <CardContent>
            <LogList logs={logs.filter((l) => l.level === "info" && l.category !== "action")} />
          </CardContent>
        </Card>
      )}

      {tab === "errors" && (
        <Card>
          <CardHeader><CardTitle>Errors ({errorLogs.length})</CardTitle></CardHeader>
          <CardContent>
            {errorLogs.length === 0 ? (
              <p className="text-center py-8 text-green-600">No errors recorded</p>
            ) : (
              <LogList logs={errorLogs} />
            )}
          </CardContent>
        </Card>
      )}

      {tab === "artifacts" && (
        <Card>
          <CardHeader><CardTitle>Screenshots & Artifacts ({screenshots.length})</CardTitle></CardHeader>
          <CardContent>
            {screenshots.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground"><Monitor className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>No artifacts captured</p></div>
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

      {tab === "downloads" && (
        <Card>
          <CardHeader><CardTitle>Downloads ({downloadResults.length})</CardTitle></CardHeader>
          <CardContent>
            {downloadResults.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground"><Download className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>No downloads recorded</p></div>
            ) : (
              <div className="space-y-2">
                {downloadResults.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 p-3 border rounded">
                    <Download className="w-5 h-5 text-blue-500" />
                    <div>
                      <p className="font-medium text-sm">{r.data?.filename || "download"}</p>
                      <p className="text-xs text-muted-foreground">{r.data?.size ? `${Math.round(r.data.size / 1024)} KB` : "—"} · {new Date(r.extracted_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "uploads" && (
        <Card>
          <CardHeader><CardTitle>Uploads ({uploadResults.length})</CardTitle></CardHeader>
          <CardContent>
            {uploadResults.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground"><Upload className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>No uploads recorded</p></div>
            ) : (
              <LogList logs={uploadResults} />
            )}
          </CardContent>
        </Card>
      )}

      {tab === "recording" && (
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

      {tab === "tabs" && (
        <Card>
          <CardHeader><CardTitle>Tab Management</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Multi-tab state tracking. Active tab and tab count shown below.</p>
            <div className="mt-3 p-3 rounded bg-muted/30">
              <p className="text-sm">Tabs: {session.tabs?.length || 0}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "context" && (
        <Card>
          <CardHeader><CardTitle>Context & State</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <InfoRow label="Profile ID" value={session.profile_id || "—"} />
              <InfoRow label="Resume Token" value={session.resume_token ? "✓ Set" : "—"} />
              <InfoRow label="Share Token" value={session.share_token ? "✓ Set" : "—"} />
              <InfoRow label="User Data Dir" value={session.metadata?.user_data_dir || "—"} />
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "proxy" && (
        <Card>
          <CardHeader><CardTitle>Proxy Configuration</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <InfoRow label="Proxy ID" value={session.proxy_id || "None"} />
              <InfoRow label="Headers" value={session.headers ? `${Object.keys(session.headers).length} custom` : "None"} />
              <InfoRow label="Blocked Resources" value={session.blocked_resources?.length ? session.blocked_resources.join(", ") : "None"} />
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "agent" && (
        <Card>
          <CardHeader><CardTitle>Agent Activity</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">AI agent decisions and step-by-step execution will appear here when agent runs are active.</p>
          </CardContent>
        </Card>
      )}

      {tab === "cost" && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><DollarSign className="w-5 h-5" />Cost Breakdown</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <InfoRow label="Session Duration" value={session.started_at ? `${Math.round((Date.now() - new Date(session.started_at).getTime()) / 1000)}s` : "—"} />
              <InfoRow label="Video Recording" value={session.record_video ? "Enabled" : "Disabled"} />
              <InfoRow label="CDP Debugging" value={session.enable_cdp ? "Enabled" : "Disabled"} />
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "metadata" && (
        <Card>
          <CardHeader><CardTitle>Session Metadata</CardTitle></CardHeader>
          <CardContent>
            <pre className="text-xs font-mono bg-muted/30 p-4 rounded overflow-x-auto">
              {JSON.stringify(session.metadata || {}, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {tab === "evidence" && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5" />Evidence & Audit Trail</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <InfoRow label="Control-Plane ID" value={session.id} />
              <InfoRow label="Runtime ID" value={session.session_id || "—"} />
              <InfoRow label="Worker ID" value={session.metadata?.worker_id || "—"} />
              <InfoRow label="Engine Version" value={session.metadata?.engine_version || "—"} />
              <InfoRow label="Created" value={session.started_at ? new Date(session.started_at).toISOString() : "—"} />
              <InfoRow label="Ended" value={session.ended_at ? new Date(session.ended_at).toISOString() : "—"} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InfoCard({ label, value }) {
  return (
    <Card className="p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm mt-1 truncate">{value}</p>
    </Card>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between p-2 rounded bg-muted/30">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-xs">{value}</span>
    </div>
  );
}

function LogList({ logs }) {
  if (!logs.length) return <p className="text-center py-8 text-muted-foreground">No entries</p>;
  return (
    <div className="space-y-1 max-h-96 overflow-y-auto font-mono text-xs">
      {logs.map((log) => (
        <div key={log.id} className={`p-2 rounded ${log.level === "error" ? "bg-red-50 text-red-800" : "bg-muted/50"}`}>
          <span className="text-muted-foreground">{log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : "—"}</span>{" "}
          <span className={`font-semibold ${log.level === "error" ? "text-red-600" : ""}`}>[{log.level}]</span>{" "}
          {log.message}
        </div>
      ))}
    </div>
  );
}