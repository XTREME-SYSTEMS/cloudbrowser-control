import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CheckCircle, XCircle, AlertCircle, History } from "lucide-react";

export default function CaptchaHistory() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const items = await base44.entities.CaptchaSolveLog.list("-created_date", 100);
      setLogs(items);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = logs.filter((l) => {
    if (filterType !== "all" && l.captcha_type !== filterType) return false;
    if (filterStatus === "solved" && !l.solved) return false;
    if (filterStatus === "failed" && l.solved) return false;
    return true;
  });

  const stats = {
    total: logs.length,
    solved: logs.filter((l) => l.solved).length,
    byType: ["recaptcha_v2", "hcaptcha", "turnstile", "unknown"].map((t) => ({
      type: t,
      total: logs.filter((l) => l.captcha_type === t).length,
      solved: logs.filter((l) => l.captcha_type === t && l.solved).length,
    })),
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><History className="w-5 h-5" />Solve History & Stats</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats by type */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {stats.byType.map((s) => (
            <div key={s.type} className="p-2 rounded border text-center">
              <p className="text-xs text-muted-foreground capitalize">{s.type.replace("_", " ")}</p>
              <p className="text-lg font-bold">{s.total > 0 ? Math.round((s.solved / s.total) * 100) : 0}%</p>
              <p className="text-xs text-muted-foreground">{s.solved}/{s.total}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Type</Label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="recaptcha_v2">reCAPTCHA v2</SelectItem>
                <SelectItem value="hcaptcha">hCaptcha</SelectItem>
                <SelectItem value="turnstile">Turnstile</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="solved">Solved</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Log table */}
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No solve attempts match these filters.</p>
        ) : (
          <div className="space-y-1.5 max-h-96 overflow-auto">
            {filtered.map((log) => (
              <div key={log.id} className="flex items-center gap-2 text-xs p-2 rounded border">
                {log.solved ? <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0" />
                  : log.detected ? <XCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  : <AlertCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                <span className="font-mono truncate flex-1">{log.url}</span>
                <span className="text-muted-foreground shrink-0 capitalize">{log.captcha_type?.replace("_", " ")}</span>
                <span className="text-muted-foreground shrink-0">{log.provider}</span>
                <span className="text-muted-foreground shrink-0">{(log.duration_ms / 1000).toFixed(1)}s</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}