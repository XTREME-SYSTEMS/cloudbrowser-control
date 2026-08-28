import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, ShieldCheck, Wrench, CheckCircle2, AlertTriangle, Lock, Sparkles } from "lucide-react";

const STATUS_STYLES = {
  pending: { variant: "secondary", icon: AlertTriangle, label: "Pending" },
  in_progress: { variant: "default", icon: Wrench, label: "In Progress" },
  implemented: { variant: "default", icon: CheckCircle2, label: "Implemented" },
  auditing: { variant: "default", icon: ShieldCheck, label: "Auditing" },
  audited: { variant: "default", icon: ShieldCheck, label: "Audited" },
  failed: { variant: "destructive", icon: AlertTriangle, label: "Failed" },
  optimized: { variant: "default", icon: Sparkles, label: "Optimized" },
  blocked: { variant: "secondary", icon: Lock, label: "Blocked" },
};

export default function Enhancements() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.SystemEnhancement.list("-priority", 50);
      setItems(list);
    } catch (e) {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const runCycle = async () => {
    setRunning(true);
    try {
      await base44.functions.invoke("runEnhancementCycle", { action: "cycle" });
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setRunning(false);
    }
  };

  const stats = {
    total: items.length,
    optimized: items.filter(i => i.status === "optimized").length,
    inProgress: items.filter(i => ["in_progress", "implemented", "auditing"].includes(i.status)).length,
    blocked: items.filter(i => i.status === "blocked").length,
    failed: items.filter(i => i.status === "failed").length,
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <ShieldCheck className="w-6 h-6" /> Fortress Engineer
          </h1>
          <p className="text-muted-foreground text-sm">Autonomous self-improving hardening & enhancement ledger</p>
        </div>
        <Button onClick={runCycle} disabled={running || loading}>
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Run Cycle
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Optimized" value={stats.optimized} tone="text-green-600" />
        <StatCard label="In Progress" value={stats.inProgress} tone="text-blue-600" />
        <StatCard label="Blocked" value={stats.blocked} tone="text-amber-600" />
        <StatCard label="Failed" value={stats.failed} tone="text-red-600" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const st = STATUS_STYLES[item.status] || STATUS_STYLES.pending;
            const Icon = st.icon;
            return (
              <Card key={item.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Icon className="w-4 h-4" /> {item.title}
                      </CardTitle>
                      <CardDescription className="mt-1">{item.description}</CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant={st.variant}>{st.label}</Badge>
                      <span className="text-xs text-muted-foreground">P{item.priority}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-2 text-sm">
                  {item.acceptance_criteria?.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">Acceptance criteria:</span>
                      <ul className="list-disc list-inside text-xs mt-1 space-y-0.5">
                        {item.acceptance_criteria.map((c, i) => <li key={i}>{c}</li>)}
                      </ul>
                    </div>
                  )}
                  {item.implementation_notes && (
                    <div className="text-xs bg-muted p-2 rounded-md whitespace-pre-wrap">{item.implementation_notes}</div>
                  )}
                  {item.blocked_reason && (
                    <div className="text-xs text-amber-600 flex items-center gap-1"><Lock className="w-3 h-3" /> {item.blocked_reason}</div>
                  )}
                  {item.audit_result && (
                    <div className="text-xs flex items-center gap-2">
                      <span className="text-muted-foreground">Audit:</span>
                      <Badge variant={item.audit_result.passed ? "default" : "destructive"}>{item.audit_result.passed ? "Passed" : "Failed"} · {item.audit_result.score}%</Badge>
                      {item.fix_attempts > 0 && <span className="text-muted-foreground">fixes: {item.fix_attempts}</span>}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, tone = "" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`text-2xl font-bold font-heading ${tone}`}>{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}