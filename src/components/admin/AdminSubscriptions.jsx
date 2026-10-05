import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, CreditCard, TrendingUp, Users, Zap } from "lucide-react";

const PLAN_BADGE = {
  free: "bg-neutral-100 text-neutral-600",
  developer: "bg-blue-100 text-blue-700",
  startup: "bg-amber-100 text-amber-700",
  enterprise: "bg-purple-100 text-purple-700",
};

const STATUS_BADGE = {
  active: "bg-emerald-100 text-emerald-700",
  trialing: "bg-blue-100 text-blue-700",
  past_due: "bg-orange-100 text-orange-700",
  canceled: "bg-red-100 text-red-700",
  expired: "bg-neutral-100 text-neutral-500",
};

export default function AdminSubscriptions() {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const data = await base44.entities.Subscription.list("-created_date", 200);
        setSubs(data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const filtered = subs.filter(s =>
    !search ||
    (s.plan_tier || "").includes(search.toLowerCase()) ||
    (s.status || "").includes(search.toLowerCase())
  );

  const activeSubs = subs.filter(s => s.status === "active");
  const payingSubs = activeSubs.filter(s => s.plan_tier !== "free");
  const totalRevenue = payingSubs.reduce((sum, s) => sum + (s.monthly_price_usd || 0), 0);

  if (loading) {
    return <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{Array.from({length:4}).map((_,i)=><div key={i} className="h-28 rounded-2xl bg-white border border-neutral-200 animate-pulse" />)}</div>;
  }

  const summaryCards = [
    { label: "MRR", value: `$${totalRevenue.toFixed(0)}`, icon: TrendingUp, accent: "from-amber-400 to-yellow-500" },
    { label: "Paying", value: payingSubs.length, icon: CreditCard, accent: "from-blue-400 to-blue-600" },
    { label: "Free Tier", value: activeSubs.filter(s => s.plan_tier === "free").length, icon: Users, accent: "from-neutral-400 to-neutral-600" },
    { label: "Total", value: subs.length, icon: Zap, accent: "from-violet-400 to-purple-600" },
  ];

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summaryCards.map(c => (
          <Card key={c.label} className="border-neutral-200">
            <CardContent className="pt-5">
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${c.accent} flex items-center justify-center mb-3`}>
                <c.icon className="w-4.5 h-4.5 text-white" />
              </div>
              <div className="text-2xl font-bold text-neutral-900">{c.value}</div>
              <div className="text-xs text-neutral-500 mt-0.5">{c.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <Input
          placeholder="Search by plan or status…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 bg-white border-neutral-200"
        />
      </div>

      {/* List */}
      <div className="grid gap-3">
        {filtered.map(sub => (
          <Card key={sub.id} className="border-neutral-200 hover:shadow-sm transition-shadow">
            <CardContent className="pt-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shrink-0">
                  <CreditCard className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-neutral-900 capitalize">{sub.plan_tier}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${PLAN_BADGE[sub.plan_tier] || PLAN_BADGE.free}`}>
                      {sub.plan_tier}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_BADGE[sub.status] || STATUS_BADGE.expired}`}>
                      {sub.status}
                    </span>
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">
                    {sub.max_concurrent_sessions || 0} concurrent · {sub.max_browser_hours || 0} browser hrs · {sub.max_agent_runs || 0} agent runs
                  </div>
                  {sub.current_period_end && (
                    <div className="text-xs text-neutral-400 mt-0.5">
                      Renews: {new Date(sub.current_period_end).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-neutral-900">${(sub.monthly_price_usd || 0).toFixed(0)}<span className="text-xs font-normal text-neutral-400">/mo</span></div>
                <div className="text-xs text-neutral-500 mt-0.5">
                  {(sub.usage_browser_hours || 0).toFixed(1)}h used · {sub.usage_agent_runs || 0} runs
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-16 text-neutral-400">
            <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <div className="text-sm font-medium">No subscriptions found</div>
          </div>
        )}
      </div>
    </div>
  );
}