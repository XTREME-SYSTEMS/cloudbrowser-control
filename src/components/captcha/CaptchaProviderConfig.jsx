import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Shield, Save, Loader2 } from "lucide-react";

const PROVIDERS = [
  { value: "none", label: "None — Disabled" },
  { value: "self", label: "Self-hosted (Free, no API key)" },
  { value: "2captcha", label: "2Captcha (External API)" },
  { value: "anticaptcha", label: "Anti-Captcha (External API)" },
  { value: "capmonster", label: "CapMonster (External API)" },
];

export default function CaptchaProviderConfig() {
  const [settings, setSettings] = useState(null);
  const [provider, setProvider] = useState("none");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.SystemSettings.list("-created_date", 1)
      .then((rows) => {
        const s = rows[0] || null;
        setSettings(s);
        setProvider(s?.captcha_provider || "none");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      if (settings?.id) {
        await base44.entities.SystemSettings.update(settings.id, { captcha_provider: provider });
      } else {
        const s = await base44.entities.SystemSettings.create({ captcha_provider: provider });
        setSettings(s);
      }
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Shield className="w-5 h-5" />Solver Provider</CardTitle>
        <CardDescription>Choose how captchas are solved across all jobs</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            <div>
              <Label>Active Provider</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {provider !== "none" && provider !== "self" && (
              <p className="text-xs text-muted-foreground bg-muted/40 p-2 rounded">
                External providers use the <code className="bg-muted px-1 rounded">CAPTCHA_SOLVER_API_KEY</code> secret. Set it in Settings → Secrets.
              </p>
            )}
            {provider === "self" && (
              <p className="text-xs text-muted-foreground bg-green-50 dark:bg-green-950/20 p-2 rounded">
                Self-hosted solver runs in the browser engine — no API key needed. Handles reCAPTCHA v2, hCaptcha, and Turnstile.
              </p>
            )}
            <Button onClick={save} disabled={saving || provider === (settings?.captcha_provider || "none")}>
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              Save Provider
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}