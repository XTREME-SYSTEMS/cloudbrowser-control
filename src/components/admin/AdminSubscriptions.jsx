import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, CreditCard, TrendingUp } from "lucide-react";

const PLAN_COLORS = {
  free: "bg-muted text-muted-foreground",
  developer: "bg-blue-100 text-blue-700",
  startup: "bg-amber-100 text-amber-700",
  enterprise: "bg-purple-100 text-purple-700",
};

const STATUS_COLORS = {
  active: "bg-emerald-100 text-emerald-700",
  trialing: "bg-blue-100 text-blue-700",
  past_due: "bg-orange-100 text-orange-700",
  canceled: "bg-red-100 text-red-700",
  expired: "bg-muted text-muted-foreground",
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

  const totalRevenue = subs
    .filter(s => s.status === "active" && s.plan_tier !== "free")
    .reduce((sum, s) => sum + (s.monthly_price_usd || 0), 0);

  if (loading) return <div className="text-muted-foreground text-sm">Loading subscriptions…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Subscriptions</h1>
          <p className="text-muted-foreground text-sm mt-1">View and manage all user subscription plans.</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <TrendingUp className="w-4 h-4 text-amber-600" />
          <span className="font-semibold">${totalRevenue.toFixed(0)}/mo</span>
          <span className="text-muted-foreground">recurring revenue</span>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by plan or status…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="grid gap-3">
        {filtered.map(sub => (
          <Card key={sub.id} className="border-border/50">
            <CardContent className="pt-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                  <CreditCard className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm capitalize">{sub.plan_tier}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${PLAN_COLORS[sub.plan_tier] || PLAN_COLORS.free}`}>
                      {sub.plan_tier}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[sub.status] || STATUS_COLORS.expired}`}>
                      {sub.status}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {sub.max_concurrent_sessions || 0} concurrent · {sub.max_browser_hours || 0} browser hrs · {sub.max_agent_runs || 0} agent runs
                  </div>
                  {sub.current_period_end && (
                    <div className="text-xs text-muted-foreground/70 mt-0.5">
                      Period ends: {new Date(sub.current_period_end).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold">${(sub.monthly_price_usd || 0).toFixed(0)}/mo</div>
                <div className="text-xs text-muted-foreground">
                  Usage: {(sub.usage_browser_hours || 0).toFixed(1)}h · {sub.usage_agent_runs || 0} runs
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">No subscriptions found.</div>
        )}
      </div>
    </div>
  );
}