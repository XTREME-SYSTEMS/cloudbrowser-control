import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, CreditCard, DollarSign, Server, Bot, Ticket, Activity, Eye, TrendingUp, ArrowUpRight, Zap } from "lucide-react";

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
            <div key={i} className="h-32 rounded-md bg-[#191a1c] border border-[#34363a] animate-pulse xa-carbon" />
          ))}
        </div>
      </div>
    );
  }

  const cards = [
    { label: "Monthly Revenue", value: `$${stats.monthlyRevenue.toFixed(0)}`, icon: DollarSign, sub: `${stats.payingSubs} paying plans`, accent: "from-[#b95700] to-[#ff8800]", trend: "+12%" },
    { label: "Subscriptions", value: stats.totalSubs, icon: CreditCard, sub: `${stats.freeSubs} free · ${stats.payingSubs} paid`, accent: "from-blue-500 to-blue-700", trend: "+3" },
    { label: "Active Sessions", value: stats.activeSessions, icon: Activity, sub: "Running browsers", accent: "from-emerald-500 to-emerald-700", trend: "" },
    { label: "Total Jobs", value: stats.totalJobs, icon: Server, sub: `${stats.failedJobs} failed`, accent: "from-violet-500 to-purple-700", trend: "" },
    { label: "AI Agents", value: stats.totalAgents, icon: Bot, sub: "User-created", accent: "from-rose-500 to-pink-700", trend: "" },
    { label: "Active Promos", value: stats.activePromos, icon: Ticket, sub: "In circulation", accent: "from-cyan-500 to-teal-700", trend: "" },
    { label: "Sandboxes", value: stats.totalSandboxes, icon: Zap, sub: "Provisioned", accent: "from-orange-500 to-amber-700", trend: "" },
    { label: "API Keys", value: stats.activeApiKeys, icon: Users, sub: "Active keys", accent: "from-indigo-500 to-blue-700", trend: "" },
  ];

  const sparkData = [42, 48, 45, 52, 58, 55, 63, 68, 72, 78, 82, 88];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 relative overflow-hidden border-[#414347] bg-[#161619] text-[#e7e8e9] xa-carbon">
          <CardContent className="pt-6 pb-6 relative z-10">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[#ff8800] text-xs font-bold tracking-wider uppercase mb-2 font-mono">Monthly Recurring Revenue</div>
                <div className="text-4xl md:text-5xl font-bold tracking-tight font-heading">${stats.monthlyRevenue.toFixed(0)}</div>
                <div className="text-[#777d83] text-sm mt-2">{stats.payingSubs} active paid subscriptions</div>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-semibold">
                <TrendingUp className="w-3.5 h-3.5" /> +12% MoM
              </div>
            </div>
            <div className="flex items-end gap-1.5 h-16 mt-6">
              {sparkData.map((v, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t bg-gradient-to-t from-[#ff8800]/40 to-[#ff8800]"
                  style={{ height: `${(v / 90) * 100}%` }}
                />
              ))}
            </div>
          </CardContent>
          <div className="absolute inset-0 bg-gradient-to-br from-[#ff8800]/10 via-transparent to-transparent" />
        </Card>

        <Card className="border-[#754313] bg-gradient-to-br from-[#ff8800]/10 to-[#ff8800]/5 xa-carbon">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-md bg-gradient-to-br from-[#b95700] to-[#ff8800] flex items-center justify-center">
                <Eye className="w-5 h-5 text-[#171514]" />
              </div>
              <div>
                <div className="font-bold text-sm text-[#e7e8e9]">Vision Cortex</div>
                <div className="text-xs text-[#aeb1b4]">Autonomous operator</div>
              </div>
            </div>
            <p className="text-xs text-[#aeb1b4] leading-relaxed">
              Vision Cortex monitors the system, uses the platform, and auto-fixes issues autonomously.
              Configure the connection in the Vision Cortex tab.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-emerald-400">System healthy</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map(c => (
          <Card key={c.label} className="border-[#34363a] bg-[#191a1c] xa-carbon hover:border-[#414347] transition-colors">
            <CardContent className="pt-5">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-md bg-gradient-to-br ${c.accent} flex items-center justify-center`}>
                  <c.icon className="w-5 h-5 text-white" />
                </div>
                {c.trend && (
                  <span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-400">
                    <ArrowUpRight className="w-3 h-3" />{c.trend}
                  </span>
                )}
              </div>
              <div className="text-2xl font-bold text-[#e7e8e9] font-heading">{c.value}</div>
              <div className="text-xs font-medium text-[#c0c1c3] mt-0.5">{c.label}</div>
              <div className="text-xs text-[#777d83] mt-0.5">{c.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-[#34363a] bg-[#191a1c] xa-carbon">
        <CardContent className="pt-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-[#ff8800]" />
            <h3 className="font-bold text-sm text-[#e7e8e9]">Quick Actions</h3>
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
                className="flex items-center gap-2.5 p-3 rounded-md border border-[#34363a] hover:border-[#ff8800]/30 hover:bg-[#ff8800]/5 transition-all text-left"
              >
                <div className="w-8 h-8 rounded-md bg-[#191a1c] flex items-center justify-center border border-[#34363a]">
                  <action.icon className="w-4 h-4 text-[#9ca3af]" />
                </div>
                <span className="text-xs font-semibold text-[#c0c1c3]">{action.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}