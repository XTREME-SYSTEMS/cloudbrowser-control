import React, { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

export default function OwnerBell() {
  const [items, setItems] = useState([]), [unread, setUnread] = useState(0), [open, setOpen] = useState(false);
  const { user } = useAuth();
  const load = async () => {
    if (!user) return;
    const [page, count] = await Promise.all([
      base44.entities.Notification.filter({ user_id: user.id }, { sort: '-created_date', limit: 15 }),
      base44.entities.Notification.count({ user_id: user.id, read: false }),
    ]);
    setItems(page.items); setUnread(count);
  };
  useEffect(() => { if (!user) return; load(); return base44.entities.Notification.subscribe(load); }, [user?.id]);
  const markAllRead = async () => {
    let result;
    do { result = await base44.entities.Notification.updateMany({ user_id: user.id, read: false }, { $set: { read: true } }); } while (result.has_more);
    await load();
  };
  const dot = sev => sev === 'critical' ? 'bg-rose-500' : sev === 'warn' ? 'bg-muted-foreground' : 'bg-emerald-500';
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button variant="ghost" size="icon" className="relative" aria-label="Owner alerts">
      <Bell className="w-4 h-4" />{unread > 0 && <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-rose-500 text-white text-[10px] grid place-items-center">{unread > 9 ? '9+' : unread}</span>}
    </Button></PopoverTrigger>
    <PopoverContent className="w-80 p-0" align="end">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/60"><span className="text-[10px] uppercase tracking-widest text-muted-foreground">Owner alerts</span>{unread > 0 && <button onClick={markAllRead} className="text-[11px] text-muted-foreground hover:text-foreground">Mark read</button>}</div>
      <div className="max-h-80 overflow-y-auto">
        {items.length === 0 && <p className="px-3 py-6 text-center text-xs text-muted-foreground">No alerts. The system is quiet.</p>}
        {items.map(n => <div key={n.id} className={`px-3 py-2.5 border-b border-border/40 ${n.read ? 'opacity-60' : ''}`}>
          <div className="flex items-center gap-2"><span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dot(n.severity)}`} /><p className="text-xs font-medium leading-tight">{n.title}</p></div>
          {n.body && <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{n.body}</p>}
        </div>)}
      </div>
    </PopoverContent>
  </Popover>;
}