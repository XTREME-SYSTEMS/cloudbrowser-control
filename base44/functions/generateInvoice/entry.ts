import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

export default async function (req) {
  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { month, year } = body;
    const now = new Date();
    const m = month || now.getMonth();
    const y = year || now.getFullYear();

    const monthStart = new Date(y, m, 1);
    const monthEnd = new Date(y, m + 1, 1);

    const costs = await base44.entities.CostEntry.list("-created_date", 1000);
    const monthCosts = costs.filter((c) => c.timestamp && new Date(c.timestamp) >= monthStart && new Date(c.timestamp) < monthEnd);

    const byCategory = {};
    let total = 0;
    for (const c of monthCosts) {
      byCategory[c.category] = byCategory[c.category] || { amount: 0, cost: 0, entries: 0 };
      byCategory[c.category].amount += c.amount || 0;
      byCategory[c.category].cost += c.cost || 0;
      byCategory[c.category].entries++;
      total += c.cost || 0;
    }

    const invoice = {
      invoice_number: `INV-${y}${String(m + 1).padStart(2, "0")}-${Date.now().toString(36)}`,
      period: `${monthStart.toLocaleDateString()} - ${monthEnd.toLocaleDateString()}`,
      user_email: user.email,
      line_items: Object.entries(byCategory).map(([cat, data]) => ({
        category: cat,
        entries: data.entries,
        amount: data.amount,
        cost: data.cost,
      })),
      total: total,
      generated_at: new Date().toISOString(),
    };

    return Response.json({ invoice });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}