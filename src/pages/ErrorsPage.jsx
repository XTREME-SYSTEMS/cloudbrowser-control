import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Clock, Bug } from "lucide-react";

const CATEGORY_COLORS = { network: "text-blue-500", timeout: "text-orange-500", selector: "text-purple-500", auth: "text-red-500", captcha: "text-yellow-500", engine: "text-red-600", other: "text-muted-foreground" };

export default function ErrorsPage() {
  const [patterns, setPatterns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const errs = await base44.entities.ErrorPattern.list("-last_seen", 100);
        setPatterns(errs);
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-heading font-bold flex items-center gap-2"><Bug className="w-7 h-7" />Error Monitoring</h1>
        <p className="text-muted-foreground mt-1">Grouped error patterns across all jobs</p>
      </div>

      {patterns.length === 0 ? (
        <Card><CardContent className="pt-6 text-center"><p className="text-muted-foreground">No errors detected. Everything is running smoothly!</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {patterns.map((p) => (
            <Card key={p.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className={`w-4 h-4 ${CATEGORY_COLORS[p.category] || "text-muted-foreground"}`} />
                      <span className="text-xs uppercase text-muted-foreground">{p.category}</span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">{p.count} occurrences</span>
                    </div>
                    <p className="text-sm font-medium truncate">{p.message}</p>
                    {p.stack && <pre className="text-xs text-muted-foreground mt-1 p-2 rounded bg-muted/50 overflow-x-auto max-h-32">{p.stack}</pre>}
                    {p.affected_jobs?.length > 0 && <p className="text-xs text-muted-foreground mt-1">Affected jobs: {p.affected_jobs.length}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="w-3 h-3" />Last seen</div>
                    <p className="text-xs">{p.last_seen ? new Date(p.last_seen).toLocaleString() : "—"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}