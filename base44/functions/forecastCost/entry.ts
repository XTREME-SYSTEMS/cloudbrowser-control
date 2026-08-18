import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

export default async function (req) {
  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const daysElapsed = Math.max(1, Math.ceil((now - monthStart) / (1000 * 60 * 60 * 24)));
    const daysInMonth = Math.ceil((nextMonth - monthStart) / (1000 * 60 * 60 * 24));

    // Get this month's costs
    const costs = await base44.entities.CostEntry.list("-created_date", 500);
    const monthCosts = costs.filter((c) => c.timestamp && new Date(c.timestamp) >= monthStart);
    const monthTotal = monthCosts.reduce((sum, c) => sum + (c.cost || 0), 0);

    // Get last 30 days for trend
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const last30 = costs.filter((c) => c.timestamp && new Date(c.timestamp) >= thirtyDaysAgo);
    const last30Total = last30.reduce((sum, c) => sum + (c.cost || 0), 0);
    const dailyAvg = last30Total / 30;

    // Project: current spend + (daily avg * remaining days)
    const remainingDays = daysInMonth - daysElapsed;
    const projected = monthTotal + (dailyAvg * remainingDays);

    // Category breakdown
    const byCategory = {};
    for (const c of monthCosts) {
      byCategory[c.category] = (byCategory[c.category] || 0) + (c.cost || 0);
    }

    // Check budget
    const settings = await base44.entities.CostSettings.list("-created_date", 1);
    const costSettings = settings[0] || {};
    const budget = costSettings.monthly_budget || 0;
    const alertThreshold = costSettings.alert_threshold_pct || 80;
    const budgetUsedPct = budget > 0 ? Math.round((projected / budget) * 100) : 0;
    const willExceedBudget = budget > 0 && projected > budget;

    return Response.json({
      month_to_date: monthTotal,
      projected_monthly: projected,
      daily_average: dailyAvg,
      days_elapsed: daysElapsed,
      days_in_month: daysInMonth,
      remaining_days: remainingDays,
      by_category: byCategory,
      budget: budget,
      budget_used_pct: budgetUsedPct,
      will_exceed_budget: willExceedBudget,
      alert_threshold: alertThreshold,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}