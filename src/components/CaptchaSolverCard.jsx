import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Play, CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react";

export default function CaptchaSolverCard() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const load = useCallback(async () => {
    try {
      const items = await base44.entities.CaptchaSolveLog.list("-created_date", 10).catch(() => []);
      setLogs(items);
      if (items.length > 0 && !lastResult) setLastResult(items[0]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [lastResult]);

  useEffect(() => { load(); }, [load]);

  const runTest = async () => {
    setTesting(true);
    try {
      const res = await base44.functions.invoke("testCaptchaSolver", { provider: "self" });
      const data = res.data || res;
      setLastResult(data);
      load();
    } catch (e) {
      setLastResult({ error: e.response?.data?.error || e.message });
    } finally {
      setTesting(false);
    }
  };

  const successRate = logs.length > 0
    ? Math.round((logs.filter((l) => l.solved).length / logs.length) * 100)
    : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="w-5 h-5" /> CAPTCHA Solver
            </CardTitle>
            <CardDescription>Self-hosted solver — no external API key needed</CardDescription>
          </div>
          <Button size="sm" onClick={runTest} disabled={testing}>
            {testing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Play className="w-4 h-4 mr-1" />}
            {testing ? "Testing…" : "Run Test"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status row */}
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${lastResult?.engine_status === "healthy" ? "bg-green-500" : "bg-muted-foreground"}`} />
            Engine {lastResult?.engine_version || "—"}
          </span>
          {successRate !== null && (
            <span className="text-muted-foreground">
              Success rate: <strong className={successRate >= 50 ? "text-green-600" : "text-amber-600"}>{successRate}%</strong> ({logs.filter((l) => l.solved).length}/{logs.length})
            </span>
          )}
        </div>

        {/* Last result */}
        {lastResult && (
          <div className={`p-3 rounded-md border ${lastResult.error ? "border-red-200 bg-red-50" : lastResult.captcha?.solved ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
            <div className="flex items-start gap-2">
              {lastResult.error ? (
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
              ) : lastResult.captcha?.solved ? (
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              )}
              <div className="text-sm space-y-1">
                {lastResult.error ? (
                  <span className="text-red-700">{lastResult.error}</span>
                ) : (
                  <>
                    <div className="font-medium">
                      {lastResult.captcha?.detected ? "Detected" : "Not detected"} → {lastResult.captcha?.solved ? "Solved" : "Failed"}
                    </div>
                    {lastResult.captcha?.type && <div className="text-muted-foreground">Type: {lastResult.captcha.type}</div>}
                    {lastResult.captcha?.error && <div className="text-red-600 text-xs">{lastResult.captcha.error}</div>}
                    {lastResult.duration_ms && <div className="text-muted-foreground text-xs">{(lastResult.duration_ms / 1000).toFixed(1)}s</div>}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Recent logs */}
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No solve attempts yet — run a test above.</p>
        ) : (
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recent attempts</div>
            {logs.map((log) => (
              <div key={log.id} className="flex items-center gap-2 text-xs p-2 rounded border">
                {log.solved ? (
                  <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0" />
                ) : log.detected ? (
                  <XCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                )}
                <span className="font-mono truncate flex-1">{log.url}</span>
                <span className="text-muted-foreground shrink-0">{log.captcha_type}</span>
                <span className="text-muted-foreground shrink-0">{(log.duration_ms / 1000).toFixed(1)}s</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}