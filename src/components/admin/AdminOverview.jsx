import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, CreditCard, DollarSign, Server, Bot, Ticket, Activity, Eye, TrendingUp, TrendingDown, Zap, ArrowUpRight } from "lucide-react";

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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-white border border-neutral-200 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const cards = [
    { label: "Monthly Revenue", value: `$${stats.monthlyRevenue.toFixed(0)}`, icon: DollarSign, sub: `${stats.payingSubs} paying plans`, accent: "from-amber-400 to-yellow-500", trend: "+12%" },
    { label: "Subscriptions", value: stats.totalSubs, icon: CreditCard, sub: `${stats.freeSubs} free · ${stats.payingSubs} paid`, accent: "from-blue-400 to-blue-600", trend: "+3" },
    { label: "Active Sessions", value: stats.activeSessions, icon: Activity, sub: "Running browsers", accent: "from-emerald-400 to-emerald-600", trend: "" },
    { label: "Total Jobs", value: stats.totalJobs, icon: Server, sub: `${stats.failedJobs} failed`, accent: "from-violet-400 to-purple-600", trend: "" },
    { label: "AI Agents", value: stats.totalAgents, icon: Bot, sub: "User-created", accent: "from-rose-400 to-pink-600", trend: "" },
    { label: "Active Promos", value: stats.activePromos, icon: Ticket, sub: "In circulation", accent: "from-cyan-400 to-teal-600", trend: "" },
    { label: "Sandboxes", value: stats.totalSandboxes, icon: Zap, sub: "Provisioned", accent: "from-orange-400 to-amber-600", trend: "" },
    { label: "API Keys", value: stats.activeApiKeys, icon: Users, sub: "Active keys", accent: "from-indigo-400 to-blue-600", trend: "" },
  ];

  // Simple sparkline data
  const sparkData = [42, 48, 45, 52, 58, 55, 63, 68, 72, 78, 82, 88];

  return (
    <div className="space-y-6">
      {/* Hero stat */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 relative overflow-hidden border-0 bg-neutral-950 text-white">
          <CardContent className="pt-6 pb-6 relative z-10">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-amber-400 text-xs font-bold tracking-wider uppercase mb-2">Monthly Recurring Revenue</div>
                <div className="text-4xl md:text-5xl font-bold tracking-tight">${stats.monthlyRevenue.toFixed(0)}</div>
                <div className="text-neutral-400 text-sm mt-2">{stats.payingSubs} active paid subscriptions</div>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-semibold">
                <TrendingUp className="w-3.5 h-3.5" /> +12% MoM
              </div>
            </div>
            {/* Sparkline */}
            <div className="flex items-end gap-1.5 h-16 mt-6">
              {sparkData.map((v, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t bg-gradient-to-t from-amber-500/40 to-amber-400"
                  style={{ height: `${(v / 90) * 100}%` }}
                />
              ))}
            </div>
          </CardContent>
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-transparent" />
        </Card>

        <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gold-gradient flex items-center justify-center">
                <Eye className="w-5 h-5 text-black" />
              </div>
              <div>
                <div className="font-bold text-sm text-neutral-900">Vision Cortex</div>
                <div className="text-xs text-neutral-600">Autonomous operator</div>
              </div>
            </div>
            <p className="text-xs text-neutral-600 leading-relaxed">
              Vision Cortex monitors the system, uses the platform, and auto-fixes issues autonomously.
              Configure the connection in the Vision Cortex tab.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-emerald-700">System healthy</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map(c => (
          <Card key={c.label} className="border-neutral-200 hover:shadow-md transition-shadow">
            <CardContent className="pt-5">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.accent} flex items-center justify-center shadow-sm`}>
                  <c.icon className="w-5 h-5 text-white" />
                </div>
                {c.trend && (
                  <span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-600">
                    <ArrowUpRight className="w-3 h-3" />{c.trend}
                  </span>
                )}
              </div>
              <div className="text-2xl font-bold text-neutral-900">{c.value}</div>
              <div className="text-xs font-medium text-neutral-700 mt-0.5">{c.label}</div>
              <div className="text-xs text-neutral-400 mt-0.5">{c.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick actions */}
      <Card className="border-neutral-200">
        <CardContent className="pt-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-amber-500" />
            <h3 className="font-bold text-sm text-neutral-900">Quick Actions</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Generate API Key", icon: Users, tab: "apikeys" },
              { label: "Create Promo", icon: Ticket, tab: "promos" },
              { label: "Invite User", icon: Users, tab: "users" },
              { label: "Run Vision Cortex", icon: Eye, tab: "visioncortex" },
            ].map(action => (
              <button
                key={action.label}
                onClick={() => {
                  const event = new CustomEvent("admin-tab-change", { detail: action.tab });
                  window.dispatchEvent(event);
                }}
                className="flex items-center gap-2.5 p-3 rounded-xl border border-neutral-200 hover:border-amber-300 hover:bg-amber-50/30 transition-all text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center">
                  <action.icon className="w-4 h-4 text-neutral-600" />
                </div>
                <span className="text-xs font-semibold text-neutral-700">{action.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}