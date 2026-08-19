import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Database, Save, Trash2 } from "lucide-react";

export default function StorageRetentionManager() {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(/** @type {any} */ ({}));
  const [saving, setSaving] = useState(false);
  const [purging, setPurging] = useState(false);

  const load = async () => {
    try {
      const list = await base44.entities.SystemSettings.list("-created_date", 1);
      if (list[0]) { setSettings(list[0]); setForm(list[0]); }
      else setForm({
        screenshot_retention_days: 30, log_retention_days: 14, video_retention_days: 7,
        auto_delete_expired: true,
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

  const purgeNow = async () => {
    if (!confirm("Delete ALL screenshots, logs, and videos now? This frees storage immediately and cannot be undone.")) return;
    setPurging(true);
    try {
      const [ss, logs] = await Promise.all([
        base44.entities.Screenshot.list("-created_date", 10000),
        base44.entities.LogEntry.list("-created_date", 10000),
      ]);
      let deleted = 0;
      // Delete screenshots
      for (const s of ss) { await base44.entities.Screenshot.delete(s.id).catch(() => {}); deleted++; }
      // Delete logs
      for (const l of logs) { await base44.entities.LogEntry.delete(l.id).catch(() => {}); deleted++; }
      // Delete videos (stored as video_url on sessions)
      const sessions = await base44.entities.Session.filter({ record_video: true });
      for (const s of sessions) {
        if (s.video_url) await base44.entities.Session.update(s.id, { video_url: null }).catch(() => {});
      }
      alert(`Purged ${deleted} screenshots and logs, cleared ${sessions.length} video references.`);
    } catch (e) { alert(e.message); }
    finally { setPurging(false); }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Database className="w-5 h-5" />Storage & Retention</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><Label>Screenshot Retention (days)</Label><Input type="number" value={form.screenshot_retention_days || 30} onChange={(e) => setForm({ ...form, screenshot_retention_days: +e.target.value })} /></div>
          <div><Label>Log Retention (days)</Label><Input type="number" value={form.log_retention_days || 14} onChange={(e) => setForm({ ...form, log_retention_days: +e.target.value })} /></div>
          <div><Label>Video Retention (days)</Label><Input type="number" value={form.video_retention_days || 7} onChange={(e) => setForm({ ...form, video_retention_days: +e.target.value })} /></div>
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
          <div><p className="text-sm font-medium">Auto-Delete Expired</p><p className="text-xs text-muted-foreground">Automatically delete old screenshots, logs, and videos</p></div>
          <Switch checked={form.auto_delete_expired ?? true} onCheckedChange={(v) => setForm({ ...form, auto_delete_expired: v })} />
        </div>

        <div className="flex gap-2 pt-2 border-t">
          <Button onClick={save} disabled={saving} size="sm"><Save className="w-4 h-4 mr-1" />{saving ? "Saving..." : "Save Retention"}</Button>
          <Button onClick={purgeNow} disabled={purging} size="sm" variant="outline"><Trash2 className="w-4 h-4 mr-1" />{purging ? "Purging..." : "Purge All Now"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}