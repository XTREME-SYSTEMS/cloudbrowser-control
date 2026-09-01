import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Globe, Trash2, Pencil, Zap, Star, CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function ProxyCard({ proxy, isDefault, onEdit, onDelete, onTest, onToggleActive, onSetDefault, sessionCount }) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);

  const runTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      const res = await onTest(proxy.id);
      setResult(res.data || res);
    } catch (e) {
      setResult({ ok: false, error: e.response?.data?.error || e.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className={`border rounded-lg p-4 space-y-3 ${proxy.active ? "bg-card" : "bg-muted/30 opacity-60"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{proxy.name}</span>
            {isDefault && <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded flex items-center gap-1"><Star className="w-3 h-3" />Default</span>}
            {proxy.rotation_group && <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{proxy.rotation_group}</span>}
          </div>
          <div className="text-sm text-muted-foreground truncate">{proxy.server} · {proxy.protocol} · {proxy.country || "—"}</div>
        </div>
        <Switch checked={proxy.active} onCheckedChange={() => onToggleActive(proxy)} />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={runTest} disabled={testing}>
          {testing ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Zap className="w-3.5 h-3.5 mr-1" />}
          Test
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onEdit(proxy)}><Pencil className="w-3.5 h-3.5" /></Button>
        <Button size="sm" variant="ghost" onClick={() => onSetDefault(proxy)} disabled={isDefault}><Star className="w-3.5 h-3.5" /></Button>
        <Button size="sm" variant="ghost" onClick={() => onDelete(proxy.id)}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
        {sessionCount > 0 && <span className="text-xs text-muted-foreground ml-auto">{sessionCount} session{sessionCount !== 1 ? "s" : ""}</span>}
      </div>

      {result && (
        <div className={`text-xs p-2 rounded border ${result.ok ? "border-green-200 bg-green-50 dark:bg-green-950/20" : "border-red-200 bg-red-50 dark:bg-red-950/20"}`}>
          <div className="flex items-center gap-1.5">
            {result.ok ? <CheckCircle className="w-3.5 h-3.5 text-green-600" /> : <XCircle className="w-3.5 h-3.5 text-red-600" />}
            {result.ok ? (
              <span>Exit IP: <strong className="font-mono">{result.exit_ip}</strong> · {(result.latency_ms / 1000).toFixed(1)}s</span>
            ) : (
              <span className="text-red-600">{result.error || "Failed"}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}