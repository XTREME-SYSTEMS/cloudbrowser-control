import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react";

const TEST_URLS = [
  { label: "reCAPTCHA v2 (2captcha demo)", value: "https://2captcha.com/demo/recaptcha-v2" },
  { label: "hCaptcha demo", value: "https://accounts.hcaptcha.com/demo" },
  { label: "Cloudflare Turnstile", value: "https://demo.turnstile.workers.dev" },
];

export default function CaptchaTestRunner({ onTested }) {
  const [url, setUrl] = useState(TEST_URLS[0].value);
  const [provider, setProvider] = useState("self");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);

  const runTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke("testCaptchaSolver", { provider, url });
      setResult(res.data || res);
      onTested?.();
    } catch (e) {
      setResult({ error: e.response?.data?.error || e.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Play className="w-5 h-5" />Live Test Runner</CardTitle>
        <CardDescription>Run a real captcha solve against a test page</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Test Page</Label>
            <Select value={url} onValueChange={setUrl}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TEST_URLS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Provider</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="self">Self-hosted</SelectItem>
                <SelectItem value="2captcha">2Captcha</SelectItem>
                <SelectItem value="anticaptcha">Anti-Captcha</SelectItem>
                <SelectItem value="capmonster">CapMonster</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label className="text-xs">Custom URL (optional)</Label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/page-with-captcha" />
        </div>
        <Button onClick={runTest} disabled={testing}>
          {testing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Play className="w-4 h-4 mr-1" />}
          {testing ? "Solving…" : "Run Solve Test"}
        </Button>

        {result && (
          <div className={`p-4 rounded-lg border ${result.error ? "border-red-200 bg-red-50 dark:bg-red-950/20" : result.captcha?.solved ? "border-green-200 bg-green-50 dark:bg-green-950/20" : "border-amber-200 bg-amber-50 dark:bg-amber-950/20"}`}>
            <div className="flex items-start gap-2">
              {result.error ? <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                : result.captcha?.solved ? <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                : <XCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />}
              <div className="text-sm space-y-1.5 flex-1 min-w-0">
                {result.error ? (
                  <span className="text-red-700">{result.error}</span>
                ) : (
                  <>
                    <div className="font-medium">{result.captcha?.detected ? "Captcha detected" : "No captcha detected"} → {result.captcha?.solved ? "✅ Solved" : "❌ Failed"}</div>
                    {result.captcha?.type && <div className="text-muted-foreground">Type: <span className="font-mono">{result.captcha.type}</span></div>}
                    {result.captcha?.token && <div className="text-muted-foreground text-xs break-all">Token: <span className="font-mono">{result.captcha.token.slice(0, 60)}…</span></div>}
                    {result.captcha?.error && <div className="text-red-600 text-xs">{result.captcha.error}</div>}
                    <div className="text-muted-foreground text-xs">Duration: {(result.duration_ms / 1000).toFixed(1)}s · Engine: {result.engine_version || "—"}</div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}