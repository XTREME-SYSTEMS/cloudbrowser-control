import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    const body = await req.json();
    const action = String(body.action || '');

    if (action === 'create') {
      const code = String(body.code || '').toUpperCase().trim();
      if (!code) return Response.json({ error: 'Code is required' }, { status: 400 });

      const existing = await base44.asServiceRole.entities.PromoCode.filter({ code }).catch(() => []);
      if (existing.length > 0) return Response.json({ error: 'Promo code already exists' }, { status: 400 });

      const promo = await base44.asServiceRole.entities.PromoCode.create({
        code,
        description: String(body.description || ''),
        discount_type: body.discount_type || 'plan_upgrade',
        discount_value: Number(body.discount_value || 0),
        granted_plan: body.granted_plan || 'developer',
        granted_months: Number(body.granted_months || 1),
        max_uses: Number(body.max_uses || 100),
        used_count: 0,
        valid_from: body.valid_from || new Date().toISOString(),
        valid_until: body.valid_until || null,
        status: 'active',
        applicable_plans: body.applicable_plans || ['free'],
        target_user_email: body.target_user_email || '',
        redeemed_by: [],
      });
      return Response.json({ promo, message: 'Promo code created' });
    }

    if (action === 'list') {
      const promos = await base44.asServiceRole.entities.PromoCode.list('-created_date', 100);
      return Response.json({ promos });
    }

    if (action === 'disable') {
      const promoId = String(body.promo_id || '');
      if (!promoId) return Response.json({ error: 'promo_id required' }, { status: 400 });
      await base44.asServiceRole.entities.PromoCode.update(promoId, { status: 'disabled' });
      return Response.json({ message: 'Promo disabled' });
    }

    if (action === 'redeem') {
      // Any authenticated user can redeem a promo
      const code = String(body.code || '').toUpperCase().trim();
      if (!code) return Response.json({ error: 'Code is required' }, { status: 400 });

      const promos = await base44.asServiceRole.entities.PromoCode.filter({ code, status: 'active' }).catch(() => []);
      const promo = promos[0];
      if (!promo) return Response.json({ error: 'Invalid or expired promo code' }, { status: 400 });

      if (promo.used_count >= promo.max_uses) {
        await base44.asServiceRole.entities.PromoCode.update(promo.id, { status: 'exhausted' });
        return Response.json({ error: 'Promo code has reached its usage limit' }, { status: 400 });
      }

      if (promo.valid_until && new Date(promo.valid_until) < new Date()) {
        await base44.asServiceRole.entities.PromoCode.update(promo.id, { status: 'expired' });
        return Response.json({ error: 'Promo code has expired' }, { status: 400 });
      }

      if (promo.target_user_email && promo.target_user_email !== user.email) {
        return Response.json({ error: 'This promo code is not for your account' }, { status: 403 });
      }

      if (promo.redeemed_by && promo.redeemed_by.includes(user.id)) {
        return Response.json({ error: 'You have already redeemed this promo code' }, { status: 400 });
      }

      // Apply the promo: upgrade the user's subscription
      const PLAN_LIMITS = {
        developer: { max_concurrent_sessions: 25, max_browser_hours: 100, max_agent_runs: 15, max_search_calls: 1000, max_fetch_calls: 1000, max_proxy_gb: 1, data_retention_days: 30, captcha_solving_enabled: true, stealth_mode: 'basic', monthly_price_usd: 29 },
        startup: { max_concurrent_sessions: 100, max_browser_hours: 500, max_agent_runs: 50, max_search_calls: 1000, max_fetch_calls: 10000, max_proxy_gb: 5, data_retention_days: 30, captcha_solving_enabled: true, stealth_mode: 'basic', monthly_price_usd: 99 },
        enterprise: { max_concurrent_sessions: 250, max_browser_hours: 500, max_agent_runs: 100, max_search_calls: 10000, max_fetch_calls: 10000, max_proxy_gb: 10, data_retention_days: 90, captcha_solving_enabled: true, stealth_mode: 'advanced', monthly_price_usd: 0 },
      };
      const grantedPlan = promo.granted_plan || 'developer';
      const limits = PLAN_LIMITS[grantedPlan] || PLAN_LIMITS.developer;
      const months = promo.granted_months || 1;
      const periodEnd = new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000).toISOString();

      const subs = await base44.asServiceRole.entities.Subscription.filter({ created_by_id: user.id }).catch(() => []);
      if (subs.length > 0) {
        await base44.asServiceRole.entities.Subscription.update(subs[0].id, {
          plan_tier: grantedPlan,
          status: 'active',
          billing_cycle: 'monthly',
          current_period_start: new Date().toISOString(),
          current_period_end: periodEnd,
          ...limits,
        });
      } else {
        await base44.asServiceRole.entities.Subscription.create({
          created_by_id: user.id,
          plan_tier: grantedPlan,
          status: 'active',
          billing_cycle: 'monthly',
          current_period_start: new Date().toISOString(),
          current_period_end: periodEnd,
          ...limits,
        });
      }

      // Update promo usage
      const redeemedBy = [...(promo.redeemed_by || []), user.id];
      const newUsedCount = promo.used_count + 1;
      const newStatus = newUsedCount >= promo.max_uses ? 'exhausted' : 'active';
      await base44.asServiceRole.entities.PromoCode.update(promo.id, {
        used_count: newUsedCount,
        redeemed_by: redeemedBy,
        status: newStatus,
      });

      return Response.json({
        message: `Promo redeemed! You now have the ${grantedPlan} plan for ${months} month(s).`,
        granted_plan: grantedPlan,
        granted_months: months,
        period_end: periodEnd,
      });
    }

    return Response.json({ error: 'Unknown action. Use: create, list, disable, redeem' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}