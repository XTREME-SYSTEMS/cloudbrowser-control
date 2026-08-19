import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Monitor, Save } from "lucide-react";

const BLOCKABLE = ["image", "font", "media", "stylesheet"];

export default function SessionDefaultsManager() {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(/** @type {any} */ ({}));
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const list = await base44.entities.SystemSettings.list("-created_date", 1);
      if (list[0]) {
        setSettings(list[0]);
        setForm(list[0]);
      } else {
        setForm({
          default_viewport_width: 1920, default_viewport_height: 1080,
          default_user_agent: "", default_locale: "en-US", default_timezone: "America/New_York",
          default_timeout_ms: 30000, default_blocked_resources: [], default_headers: {},
        });
      }
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

  const toggleBlocked = (r) => {
    const blocked = form.default_blocked_resources || [];
    setForm({ ...form, default_blocked_resources: blocked.includes(r) ? blocked.filter((b) => b !== r) : [...blocked, r] });
  };

  const setHeaders = (text) => {
    try { setForm({ ...form, default_headers: JSON.parse(text) }); }
    catch { /* invalid JSON, keep old */ }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Monitor className="w-5 h-5" />Session Defaults</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Default settings applied to every new browser session unless overridden per job.</p>

        <div className="grid grid-cols-2 gap-3">
          <div><Label>Viewport Width</Label><Input type="number" value={form.default_viewport_width || 1920} onChange={(e) => setForm({ ...form, default_viewport_width: +e.target.value })} /></div>
          <div><Label>Viewport Height</Label><Input type="number" value={form.default_viewport_height || 1080} onChange={(e) => setForm({ ...form, default_viewport_height: +e.target.value })} /></div>
        </div>
        <div><Label>User Agent (blank = default Chrome)</Label><Input value={form.default_user_agent || ""} onChange={(e) => setForm({ ...form, default_user_agent: e.target.value })} placeholder="Mozilla/5.0..." /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Locale</Label><Input value={form.default_locale || "en-US"} onChange={(e) => setForm({ ...form, default_locale: e.target.value })} /></div>
          <div><Label>Timezone</Label><Input value={form.default_timezone || "America/New_York"} onChange={(e) => setForm({ ...form, default_timezone: e.target.value })} /></div>
        </div>
        <div><Label>Default Timeout (ms)</Label><Input type="number" value={form.default_timeout_ms || 30000} onChange={(e) => setForm({ ...form, default_timeout_ms: +e.target.value })} /></div>

        <div>
          <Label>Block Resources by Default</Label>
          <p className="text-xs text-muted-foreground mb-2">Blocking these speeds up page loads and saves bandwidth.</p>
          <div className="flex flex-wrap gap-2">
            {BLOCKABLE.map((r) => (
              <button key={r} onClick={() => toggleBlocked(r)} className={`px-3 py-1 rounded text-xs ${(form.default_blocked_resources || []).includes(r) ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{r}</button>
            ))}
          </div>
        </div>

        <div>
          <Label>Default Headers (JSON)</Label>
          <Textarea rows={3} defaultValue={JSON.stringify(form.default_headers || {}, null, 2)} onBlur={(e) => setHeaders(e.target.value)} className="font-mono text-xs" placeholder='{"Accept-Language": "en-US"}' />
        </div>

        <Button onClick={save} disabled={saving} size="sm"><Save className="w-4 h-4 mr-1" />{saving ? "Saving..." : "Save Defaults"}</Button>
      </CardContent>
    </Card>
  );
}