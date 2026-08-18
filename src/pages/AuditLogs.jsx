import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollText } from "lucide-react";

const ACTION_COLORS = {
  create: "bg-green-100 text-green-700", update: "bg-blue-100 text-blue-700", delete: "bg-red-100 text-red-700",
  run: "bg-purple-100 text-purple-700", login: "bg-gray-100 text-gray-700", logout: "bg-gray-100 text-gray-700",
  export: "bg-orange-100 text-orange-700", config: "bg-yellow-100 text-yellow-700",
  share: "bg-indigo-100 text-indigo-700", schedule: "bg-pink-100 text-pink-700",
};

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try { setLogs(await base44.entities.AuditLog.list("-timestamp", 200)); }
      catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return <div className="flex justify-center h-64 items-center"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-heading font-bold flex items-center gap-2"><ScrollText className="w-7 h-7" />Audit Logs</h1>
        <p className="text-muted-foreground mt-1">Track all user actions and system events</p>
      </div>
      <Card>
        <CardHeader><CardTitle>All Activity ({logs.length})</CardTitle></CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No audit logs yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="pb-2 pr-4">Action</th><th className="pb-2 pr-4">User</th>
                    <th className="pb-2 pr-4">Entity</th><th className="pb-2 pr-4">Description</th><th className="pb-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b last:border-0">
                      <td className="py-2 pr-4"><span className={`px-2 py-0.5 rounded text-xs ${ACTION_COLORS[log.action] || "bg-gray-100"}`}>{log.action}</span></td>
                      <td className="py-2 pr-4">{log.user_email || "—"}</td>
                      <td className="py-2 pr-4">{log.entity_type || "—"}{log.entity_id ? ` (${log.entity_id.slice(0, 8)})` : ""}</td>
                      <td className="py-2 pr-4">{log.description}</td>
                      <td className="py-2 text-muted-foreground">{log.timestamp ? new Date(log.timestamp).toLocaleString() : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}