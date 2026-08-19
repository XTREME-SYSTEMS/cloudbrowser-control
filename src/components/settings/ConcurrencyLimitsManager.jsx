import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Gauge, Save, Video, Bug } from "lucide-react";

export default function ConcurrencyLimitsManager() {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(/** @type {any} */ ({}));
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const list = await base44.entities.SystemSettings.list("-created_date", 1);
      if (list[0]) { setSettings(list[0]); setForm(list[0]); }
      else setForm({
        max_concurrent_sessions: 10, rate_limit_per_minute: 60,
        pool_size: 3, pool_warm_count: 2, max_steps_per_job: 100, max_job_duration_min: 30,
        enable_recording_by_default: false, enable_cdp_by_default: false,
      });
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

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Gauge className="w-5 h-5" />Concurrency & Limits</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Max Concurrent Sessions</Label><Input type="number" value={form.max_concurrent_sessions || 10} onChange={(e) => setForm({ ...form, max_concurrent_sessions: +e.target.value })} /></div>
          <div><Label>Rate Limit (req/min)</Label><Input type="number" value={form.rate_limit_per_minute || 60} onChange={(e) => setForm({ ...form, rate_limit_per_minute: +e.target.value })} /></div>
          <div><Label>Pool Size</Label><Input type="number" value={form.pool_size || 3} onChange={(e) => setForm({ ...form, pool_size: +e.target.value })} /></div>
          <div><Label>Pool Warm Count</Label><Input type="number" value={form.pool_warm_count || 2} onChange={(e) => setForm({ ...form, pool_warm_count: +e.target.value })} /></div>
          <div><Label>Max Steps per Job</Label><Input type="number" value={form.max_steps_per_job || 100} onChange={(e) => setForm({ ...form, max_steps_per_job: +e.target.value })} /></div>
          <div><Label>Max Job Duration (min)</Label><Input type="number" value={form.max_job_duration_min || 30} onChange={(e) => setForm({ ...form, max_job_duration_min: +e.target.value })} /></div>
        </div>

        <div className="space-y-3 pt-2 border-t">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
            <div className="flex items-center gap-2"><Video className="w-4 h-4" /><div><p className="text-sm font-medium">Recording by Default</p><p className="text-xs text-muted-foreground">Record video of all sessions automatically</p></div></div>
            <Switch checked={form.enable_recording_by_default || false} onCheckedChange={(v) => setForm({ ...form, enable_recording_by_default: v })} />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
            <div className="flex items-center gap-2"><Bug className="w-4 h-4" /><div><p className="text-sm font-medium">CDP Debugging by Default</p><p className="text-xs text-muted-foreground">Expose Chrome DevTools Protocol for all sessions</p></div></div>
            <Switch checked={form.enable_cdp_by_default || false} onCheckedChange={(v) => setForm({ ...form, enable_cdp_by_default: v })} />
          </div>
        </div>

        <Button onClick={save} disabled={saving} size="sm"><Save className="w-4 h-4 mr-1" />{saving ? "Saving..." : "Save Limits"}</Button>
      </CardContent>
    </Card>
  );
}