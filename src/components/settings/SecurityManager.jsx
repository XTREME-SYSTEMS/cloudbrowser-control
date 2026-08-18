import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Shield, Save, Plus, Trash2, Lock } from "lucide-react";

const CAPTCHA_PROVIDERS = [
  { value: "none", label: "None" },
  { value: "2captcha", label: "2Captcha" },
  { value: "anticaptcha", label: "Anti-Captcha" },
  { value: "capmonster", label: "CapMonster" },
];

export default function SecurityManager() {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({});
  const [newIp, setNewIp] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const list = await base44.entities.SystemSettings.list("-created_date", 1);
      if (list[0]) { setSettings(list[0]); setForm(list[0]); }
      else setForm({ captcha_provider: "none", captcha_api_key: "", ip_allowlist: [], enforce_https: false });
    } catch (e) {}
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      if (settings?.id) await base44.entities.SystemSettings.update(settings.id, form);
      else { const c = await base44.entities.SystemSettings.create(form); setSettings(c); }
    } catch (e) { alert(e.response?.data?.error || e.message); }
    finally { setSaving(false); }
  };

  const addIp = () => {
    if (!newIp) return;
    setForm({ ...form, ip_allowlist: [...(form.ip_allowlist || []), newIp] });
    setNewIp("");
  };
  const removeIp = (ip) => setForm({ ...form, ip_allowlist: (form.ip_allowlist || []).filter((i) => i !== ip) });

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5" />Security & CAPTCHA</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {/* IP Allowlist */}
        <div>
          <Label className="flex items-center gap-1"><Lock className="w-3.5 h-3.5" />IP Allowlist</Label>
          <p className="text-xs text-muted-foreground mb-2">Only these IPs can access the API. Leave empty to allow all.</p>
          <div className="flex gap-2">
            <Input value={newIp} onChange={(e) => setNewIp(e.target.value)} placeholder="e.g. 192.168.1.1 or 10.0.0.0/24" onKeyDown={(e) => e.key === "Enter" && addIp()} />
            <Button size="sm" onClick={addIp}><Plus className="w-4 h-4" /></Button>
          </div>
          {(form.ip_allowlist || []).length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {(form.ip_allowlist || []).map((ip) => (
                <span key={ip} className="flex items-center gap-1 px-2 py-1 rounded bg-muted text-xs font-mono">
                  {ip}
                  <button onClick={() => removeIp(ip)}><Trash2 className="w-3 h-3 text-red-500" /></button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* HTTPS enforcement */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
          <div><p className="text-sm font-medium">Enforce HTTPS</p><p className="text-xs text-muted-foreground">Block navigation to non-HTTPS URLs</p></div>
          <Switch checked={form.enforce_https || false} onCheckedChange={(v) => setForm({ ...form, enforce_https: v })} />
        </div>

        {/* CAPTCHA */}
        <div className="space-y-3 pt-2 border-t">
          <p className="text-sm font-medium">CAPTCHA Solver</p>
          <div>
            <Label>Provider</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {CAPTCHA_PROVIDERS.map((p) => (
                <button key={p.value} onClick={() => setForm({ ...form, captcha_provider: p.value })} className={`px-3 py-1 rounded text-xs ${form.captcha_provider === p.value ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{p.label}</button>
              ))}
            </div>
          </div>
          {form.captcha_provider !== "none" && (
            <div><Label>CAPTCHA API Key</Label><Input type="password" value={form.captcha_api_key || ""} onChange={(e) => setForm({ ...form, captcha_api_key: e.target.value })} placeholder="Enter provider API key" /></div>
          )}
        </div>

        <Button onClick={save} disabled={saving} size="sm"><Save className="w-4 h-4 mr-1" />{saving ? "Saving..." : "Save Security"}</Button>
      </CardContent>
    </Card>
  );
}