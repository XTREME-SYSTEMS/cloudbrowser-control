import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Activity, Monitor, Briefcase, ScrollText } from "lucide-react";

export default function ActivityFeed() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [sessions, jobs, logs] = await Promise.all([
          base44.entities.Session.list("-created_date", 5),
          base44.entities.Job.list("-created_date", 5),
          base44.entities.LogEntry.list("-created_date", 10),
        ]);
        const allEvents = [
          ...sessions.map((s) => ({ id: s.id, type: "session", title: `Session ${s.status}`, subtitle: s.target_url || s.current_url || "—", time: s.created_date, icon: Monitor })),
          ...jobs.map((j) => ({ id: j.id, type: "job", title: `Job "${j.name}" ${j.status}`, subtitle: j.start_url || "—", time: j.created_date, icon: Briefcase })),
          ...logs.map((l) => ({ id: l.id, type: "log", title: l.message, subtitle: l.category, time: l.timestamp || l.created_date, icon: ScrollText })),
        ].sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0)).slice(0, 15);
        if (mounted) setEvents(allEvents);
      } catch {}
    };
    load();
    // Subscribe to real-time updates
    const unsub = base44.entities.Session.subscribe(() => load());
    const unsub2 = base44.entities.Job.subscribe(() => load());
    return () => { mounted = false; unsub(); unsub2(); };
  }, []);

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Activity className="w-4 h-4" />Live Activity Feed</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
          ) : events.map((e) => {
            const Icon = e.icon;
            return (
              <div key={e.id} className="flex items-start gap-2 text-sm py-1.5 border-b last:border-0">
                <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="truncate">{e.title}</p>
                  {e.subtitle && <p className="text-xs text-muted-foreground truncate">{e.subtitle}</p>}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{e.time ? new Date(e.time).toLocaleTimeString() : ""}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}