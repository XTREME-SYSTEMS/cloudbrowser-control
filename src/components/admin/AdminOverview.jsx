import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CreditCard, DollarSign, Server, Bot, Ticket, AlertTriangle, CheckCircle2, Activity, Eye } from "lucide-react";

export default function AdminOverview() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [subs, jobs, sessions, agents, promos, sandboxes, apiKeys] = await Promise.all([
          base44.entities.Subscription.list("-created_date", 200).catch(() => []),
          base44.entities.Job.list("-created_date", 100).catch(() => []),
          base44.entities.Session.list("-created_date", 50).catch(() => []),
          base44.entities.UserAgent.list("-created_date", 50).catch(() => []),
          base44.entities.PromoCode.list("-created_date", 50).catch(() => []),
          base44.entities.Sandbox.list("-created_date", 50).catch(() => []),
          base44.entities.ApiKey.list("-created_date", 50).catch(() => []),
        ]);

        const activeSubs = subs.filter(s => s.status === "active");
        const payingSubs = activeSubs.filter(s => s.plan_tier !== "free");
        const revenue = payingSubs.reduce((sum, s) => sum + (s.monthly_price_usd || 0), 0);

        setStats({
          totalSubs: subs.length,
          payingSubs: payingSubs.length,
          freeSubs: activeSubs.filter(s => s.plan_tier === "free").length,
          monthlyRevenue: revenue,
          activeSessions: sessions.filter(s => s.status === "active").length,
          totalJobs: jobs.length,
          failedJobs: jobs.filter(j => j.status === "failed" || j.status === "error").length,
          totalAgents: agents.length,
          activePromos: promos.filter(p => p.status === "active").length,
          totalSandboxes: sandboxes.length,
          activeApiKeys: apiKeys.filter(k => k.active !== false).length,
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="text-muted-foreground text-sm">Loading overview…</div>;

  const cards = [
    { label: "Total Subscriptions", value: stats.totalSubs, icon: CreditCard, sub: `${stats.payingSubs} paying · ${stats.freeSubs} free` },
    { label: "Monthly Revenue", value: `$${stats.monthlyRevenue.toFixed(0)}`, icon: DollarSign, sub: "From active paid plans" },
    { label: "Active Sessions", value: stats.activeSessions, icon: Activity, sub: "Currently running browsers" },
    { label: "Total Jobs", value: stats.totalJobs, icon: Server, sub: `${stats.failedJobs} failed` },
    { label: "AI Agents", value: stats.totalAgents, icon: Bot, sub: "User-created agents" },
    { label: "Active Promos", value: stats.activePromos, icon: Ticket, sub: "Promo codes in circulation" },
    { label: "Sandboxes", value: stats.totalSandboxes, icon: Server, sub: "Provisioned environments" },
    { label: "Active API Keys", value: stats.activeApiKeys, icon: Users, sub: "Keys in use" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">System Overview</h1>
        <p className="text-muted-foreground text-sm mt-1">Platform health and key metrics at a glance.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map(c => (
          <Card key={c.label} className="border-border/50">
            <CardContent className="pt-5">
              <div className="flex items-center justify-between mb-2">
                <c.icon className="w-5 h-5 text-amber-600" />
              </div>
              <div className="text-2xl font-heading font-bold">{c.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{c.label}</div>
              <div className="text-xs text-muted-foreground/70 mt-0.5">{c.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-amber-200 bg-amber-50/30">
        <CardContent className="pt-5">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-5 h-5 text-amber-600" />
            <h3 className="font-semibold text-sm">Vision Cortex Status</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Vision Cortex monitors the system, uses the platform, and auto-fixes/auto-heals issues autonomously.
            Configure the connection in the Vision Cortex tab.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}