import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Cpu, Save, Eye, EyeOff, Loader2, CheckCircle, XCircle } from "lucide-react";

export default function EngineConnectionManager() {
  const [engineUrl, setEngineUrl] = useState("");
  const [engineKey, setEngineKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const urlRows = await base44.entities.Setting.filter({ setting_key: "engine.url" });
      const keyRows = await base44.entities.Setting.filter({ setting_key: "engine.api_key" });
      if (urlRows[0]?.effective_value) setEngineUrl(urlRows[0].effective_value);
      if (keyRows[0]?.effective_value) setEngineKey(keyRows[0].effective_value);
    } catch (e) {}
  };

  const handleSave = async () => {
    if (!engineUrl || !engineKey) return;
    setSaving(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke("updateEngineConfig", {
        engine_url: engineUrl,
        engine_api_key: engineKey,
      });
      setResult(res.data);
    } catch (e) {
      setResult({ ok: false, error: e.response?.data?.error || e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Cpu className="w-5 h-5" />Engine Connection</CardTitle>
        <CardDescription>
          Enter the engine URL and API key to override the platform secrets. Values are tested against the engine before saving.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="engine-url">Engine URL</Label>
          <Input
            id="engine-url"
            placeholder="https://your-engine.up.railway.app"
            value={engineUrl}
            onChange={(e) => setEngineUrl(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="engine-key">Engine API Key</Label>
          <div className="flex gap-2">
            <Input
              id="engine-key"
              type={showKey ? "text" : "password"}
              placeholder="Enter engine API key"
              value={engineKey}
              onChange={(e) => setEngineKey(e.target.value)}
            />
            <Button type="button" variant="outline" size="icon" onClick={() => setShowKey(!showKey)}>
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving || !engineUrl || !engineKey}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Test &amp; Save
        </Button>
        {result && (
          <div
            className={`flex items-start gap-2 p-3 rounded text-sm ${
              result.ok
                ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
            }`}
          >
            {result.ok ? <CheckCircle className="w-5 h-5 mt-0.5 shrink-0" /> : <XCircle className="w-5 h-5 mt-0.5 shrink-0" />}
            <div>
              {result.ok ? (
                <span>
                  Connected — {result.health?.active_sessions ?? 0} active sessions, uptime{" "}
                  {Math.round(result.health?.uptime ?? 0)}s
                </span>
              ) : (
                <span>{result.error}</span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}