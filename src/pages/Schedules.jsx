import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Calendar, Play } from "lucide-react";

export default function Schedules() {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", cron_expression: "0 9 * * *", interval_seconds: 0, job_template: { name: "", start_url: "", steps: [] } });

  useEffect(() => {
    const load = async () => {
      try { setSchedules(await base44.entities.Schedule.list("-created_date", 100)); }
      catch (e) { console.error(e); } finally { setLoading(false); }
    };
    load();
  }, []);

  const toggle = async (schedule) => {
    await base44.entities.Schedule.update(schedule.id, { enabled: !schedule.enabled });
    setSchedules(schedules.map((s) => s.id === schedule.id ? { ...s, enabled: !s.enabled } : s));
  };

  const remove = async (id) => {
    if (!confirm("Delete this schedule?")) return;
    await base44.entities.Schedule.delete(id);
    setSchedules(schedules.filter((s) => s.id !== id));
  };

  const create = async () => {
    if (!form.name || !form.job_template.start_url) { alert("Name and start URL required"); return; }
    try {
      const created = await base44.entities.Schedule.create({
        ...form,
        enabled: true,
        run_count: 0,
      });
      setSchedules([created, ...schedules]);
      setShowForm(false);
      setForm({ name: "", cron_expression: "0 9 * * *", interval_seconds: 0, job_template: { name: "", start_url: "", steps: [] } });
    } catch (e) { alert(e.response?.data?.error || e.message); }
  };

  const runNow = async (schedule) => {
    try { await base44.functions.invoke("runScheduledJob", { scheduleId: schedule.id }); }
    catch (e) { alert(e.response?.data?.error || e.message); }
  };

  if (loading) return <div className="flex justify-center h-64 items-center"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold">Schedules</h1>
          <p className="text-muted-foreground mt-1">Recurring job execution via cron or interval</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}><Plus className="w-4 h-4 mr-2" />{showForm ? "Cancel" : "New Schedule"}</Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle>New Schedule</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Schedule Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Daily price check" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cron Expression (UTC)</Label>
                <Input value={form.cron_expression} onChange={(e) => setForm({ ...form, cron_expression: e.target.value })} placeholder="0 9 * * *" />
              </div>
              <div>
                <Label>Interval (seconds, 0 = use cron)</Label>
                <Input type="number" value={form.interval_seconds} onChange={(e) => setForm({ ...form, interval_seconds: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div>
              <Label>Job Name</Label>
              <Input value={form.job_template.name} onChange={(e) => setForm({ ...form, job_template: { ...form.job_template, name: e.target.value } })} />
            </div>
            <div>
              <Label>Start URL</Label>
              <Input value={form.job_template.start_url} onChange={(e) => setForm({ ...form, job_template: { ...form.job_template, start_url: e.target.value } })} placeholder="https://example.com" />
            </div>
            <div>
              <Label>Steps (JSON array)</Label>
              <Textarea
                className="font-mono text-xs" rows={6}
                value={JSON.stringify(form.job_template.steps, null, 2)}
                onChange={(e) => {
                  try { setForm({ ...form, job_template: { ...form.job_template, steps: JSON.parse(e.target.value) } }); } catch {}
                }}
                placeholder='[{"action_type":"screenshot","options":{"fullPage":true}}]'
              />
            </div>
            <Button onClick={create}>Create Schedule</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>All Schedules ({schedules.length})</CardTitle></CardHeader>
        <CardContent>
          {schedules.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No schedules yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {schedules.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <Switch checked={s.enabled} onCheckedChange={() => toggle(s)} />
                    <div>
                      <p className="font-medium">{s.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {s.cron_expression ? `Cron: ${s.cron_expression}` : `Every ${s.interval_seconds}s`} · {s.run_count || 0} runs
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => runNow(s)}><Play className="w-3 h-3 mr-1" />Run Now</Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(s.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}