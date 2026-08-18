import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Webhook } from "lucide-react";

const EVENTS = ["job.completed", "job.failed", "session.created", "session.ended", "schedule.triggered"];

export default function WebhooksManager() {
  const [webhooks, setWebhooks] = useState([]);
  const [newWebhook, setNewWebhook] = useState({ name: "", url: "", events: [] });

  const load = async () => { try { setWebhooks(await base44.entities.Webhook.list("-created_date", 50)); } catch (e) {} };
  useEffect(() => { load(); }, []);

  const toggleEvent = (ev) => {
    const events = newWebhook.events.includes(ev) ? newWebhook.events.filter((e) => e !== ev) : [...newWebhook.events, ev];
    setNewWebhook({ ...newWebhook, events });
  };

  const add = async () => {
    if (!newWebhook.name || !newWebhook.url) return;
    try { await base44.entities.Webhook.create(newWebhook); setNewWebhook({ name: "", url: "", events: [] }); load(); } catch (e) { alert(e.message); }
  };

  const remove = async (id) => { await base44.entities.Webhook.delete(id); load(); };

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Webhook className="w-5 h-5" />Webhooks</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={newWebhook.name} onChange={(e) => setNewWebhook({ ...newWebhook, name: e.target.value })} /></div>
          <div><Label>URL</Label><Input value={newWebhook.url} onChange={(e) => setNewWebhook({ ...newWebhook, url: e.target.value })} placeholder="https://..." /></div>
          <div><Label>Events</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {EVENTS.map((ev) => (
                <button key={ev} onClick={() => toggleEvent(ev)} className={`px-2 py-1 rounded text-xs ${newWebhook.events.includes(ev) ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{ev}</button>
              ))}
            </div>
          </div>
          <Button onClick={add} size="sm"><Plus className="w-4 h-4 mr-1" />Add Webhook</Button>
        </div>
        {webhooks.length > 0 && (
          <div className="space-y-2">
            {webhooks.map((w) => (
              <div key={w.id} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <span className="font-medium">{w.name}</span> <span className="text-sm text-muted-foreground">{w.url}</span>
                  <div className="flex gap-1 mt-1">{(w.events || []).map((e) => <span key={e} className="px-1.5 py-0.5 bg-muted rounded text-xs">{e}</span>)}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => remove(w.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}