import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, Check, Zap, Building2, Users } from "lucide-react";

const PLAN_DATA = [
  { name: "free", display_name: "Free", price: 0, sessions: 5, concurrent: 2, features: ["5 sessions/month", "2 concurrent", "7-day retention", "Community support"], icon: Users, color: "gray" },
  { name: "starter", display_name: "Starter", price: 29, sessions: 100, concurrent: 5, features: ["100 sessions/month", "5 concurrent", "14-day retention", "Email support", "API access"], icon: Zap, color: "blue" },
  { name: "pro", display_name: "Pro", price: 99, sessions: 1000, concurrent: 20, features: ["1,000 sessions/month", "20 concurrent", "30-day retention", "Priority support", "API + Webhooks", "Custom proxies"], icon: CreditCard, color: "purple" },
  { name: "enterprise", display_name: "Enterprise", price: 499, sessions: 10000, concurrent: 100, features: ["10,000 sessions/month", "100 concurrent", "90-day retention", "Dedicated support", "SLA guarantee", "Custom integrations", "Team management"], icon: Building2, color: "orange" },
];

export default function Billing() {
  const [subscription, setSubscription] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const subs = await base44.entities.Subscription.list("-created_date", 1);
        setSubscription(subs[0] || null);
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const selectPlan = async (planName) => {
    try {
      const user = await base44.auth.me();
      if (subscription) {
        await base44.entities.Subscription.update(subscription.id, { plan_name: planName });
      } else {
        await base44.entities.Subscription.create({ user_id: user.id, plan_name: planName, status: "active", credits_remaining: PLAN_DATA.find(p => p.name === planName).sessions });
      }
      const subs = await base44.entities.Subscription.list("-created_date", 1);
      setSubscription(subs[0]);
    } catch (e) { alert(e.response?.data?.error || e.message); }
  };

  const generateInvoice = async () => {
    try {
      const res = await base44.functions.invoke("generateInvoice", {});
      alert(`Invoice ${res.data.invoice.invoice_number} generated. Total: $${res.data.invoice.total.toFixed(2)}`);
    } catch (e) { alert(e.message); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-heading font-bold flex items-center gap-2"><CreditCard className="w-7 h-7" />Billing & Plans</h1>
        <p className="text-muted-foreground mt-1">Manage your subscription and usage</p>
      </div>

      {/* Current plan */}
      {subscription && (
        <Card className="bg-primary/5 border-primary">
          <CardContent className="pt-6 flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Current Plan</p>
              <p className="text-2xl font-bold capitalize">{subscription.plan_name}</p>
              <p className="text-sm text-muted-foreground mt-1">{subscription.credits_remaining || 0} credits remaining</p>
            </div>
            <Button onClick={generateInvoice} variant="outline">Generate Invoice</Button>
          </CardContent>
        </Card>
      )}

      {/* Plan grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLAN_DATA.map((plan) => {
          const Icon = plan.icon;
          const isCurrent = subscription?.plan_name === plan.name;
          return (
            <Card key={plan.name} className={isCurrent ? "border-primary ring-2 ring-primary/20" : ""}>
              <CardHeader>
                <div className="flex items-center gap-2"><Icon className="w-5 h-5" /><CardTitle className="text-base">{plan.display_name}</CardTitle></div>
                <p className="text-2xl font-bold">${plan.price}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-1.5 text-sm">
                  {plan.features.map((f) => <li key={f} className="flex items-start gap-2"><Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />{f}</li>)}
                </ul>
                <Button onClick={() => selectPlan(plan.name)} disabled={isCurrent} className="w-full" variant={isCurrent ? "outline" : "default"}>
                  {isCurrent ? "Current Plan" : `Select ${plan.display_name}`}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}