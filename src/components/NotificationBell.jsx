import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Bell, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    try { setNotifications(await base44.entities.Notification.list("-created_date", 20)); } catch {}
  };
  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const unread = notifications.filter((n) => !n.read).length;

  const markAllRead = async (e) => {
    e.stopPropagation();
    for (const n of notifications.filter((n) => !n.read)) {
      await base44.entities.Notification.update(n.id, { read: true });
    }
    load();
  };

  const clickNotif = (n) => {
    base44.entities.Notification.update(n.id, { read: true }).catch(() => {});
    if (n.link) navigate(n.link);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="relative p-1.5 rounded-md hover:bg-sidebar-accent">
        <Bell className="w-5 h-5" />
        {unread > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-72 bg-popover border border-border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between p-3 border-b">
              <span className="text-sm font-medium">Notifications</span>
              {unread > 0 && <button onClick={markAllRead} className="text-xs text-primary flex items-center gap-1"><Check className="w-3 h-3" />Mark all read</button>}
            </div>
            {notifications.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">No notifications</p>
            ) : (
              notifications.map((n) => (
                <button key={n.id} onClick={() => clickNotif(n)} className={`w-full text-left p-3 border-b hover:bg-accent/50 ${!n.read ? "bg-primary/5" : ""}`}>
                  <div className="flex items-start gap-2">
                    {!n.read && <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{n.title}</p>
                      {n.body && <p className="text-xs text-muted-foreground truncate">{n.body}</p>}
                      <p className="text-xs text-muted-foreground mt-0.5">{new Date(n.created_date).toLocaleString()}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}