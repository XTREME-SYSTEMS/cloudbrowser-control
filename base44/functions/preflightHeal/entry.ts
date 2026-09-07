import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    const db = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const targetAction = String(body.action || 'all');

    const healed: any[] = [];
    const skipped: any[] = [];

    // 1. Expire stale promo codes
    if (targetAction === 'all' || targetAction === 'expire_promos') {
      const promos = await db.entities.PromoCode.filter({ status: 'active' }).catch(() => []);
      const now = new Date();
      let expired = 0;
      for (const p of promos) {
        if (p.valid_until && new Date(p.valid_until) < now) {
          await db.entities.PromoCode.update(p.id, { status: 'expired' });
          expired++;
        }
        if (p.used_count >= p.max_uses && p.status === 'active') {
          await db.entities.PromoCode.update(p.id, { status: 'exhausted' });
          expired++;
        }
      }
      healed.push({ action: 'expire_promos', count: expired });
    }

    // 2. Cleanup stale sessions (older than 30 min, still "active")
    if (targetAction === 'all' || targetAction === 'cleanup_stale_sessions') {
      const sessions = await db.entities.Session.filter({ status: 'active' }).catch(() => []);
      let cleaned = 0;
      for (const s of sessions) {
        if (s.created_date) {
          const age = Date.now() - new Date(s.created_date).getTime();
          if (age > 30 * 60 * 1000) {
            await db.entities.Session.update(s.id, { status: 'expired' });
            cleaned++;
          }
        }
      }
      healed.push({ action: 'cleanup_stale_sessions', count: cleaned });
    }

    // 3. Cleanup failed sandboxes older than 1 hour
    if (targetAction === 'all' || targetAction === 'cleanup_sandboxes') {
      const sandboxes = await db.entities.Sandbox.filter({ status: 'failed' }).catch(() => []);
      let cleaned = 0;
      for (const sb of sandboxes) {
        if (sb.created_date) {
          const age = Date.now() - new Date(sb.created_date).getTime();
          if (age > 60 * 60 * 1000) {
            await db.entities.Sandbox.update(sb.id, { status: 'terminated' });
            cleaned++;
          }
        }
      }
      healed.push({ action: 'cleanup_sandboxes', count: cleaned });
    }

    // 4. Retry failed webhook deliveries
    if (targetAction === 'all' || targetAction === 'retry_webhooks') {
      const deliveries = await db.entities.WebhookDelivery.filter({ status: 'failed' }).catch(() => []);
      let retried = 0;
      for (const d of deliveries.slice(0, 20)) {
        await db.entities.WebhookDelivery.update(d.id, { status: 'pending' });
        retried++;
      }
      healed.push({ action: 'retry_webhooks', count: retried });
    }

    // 5. Deactivate expired API keys
    if (targetAction === 'all' || targetAction === 'deactivate_expired_keys') {
      const keys = await db.entities.ApiKey.filter({ active: true }).catch(() => []);
      let deactivated = 0;
      const now = new Date();
      for (const k of keys) {
        if (k.expires_at && new Date(k.expires_at) < now) {
          await db.entities.ApiKey.update(k.id, { active: false });
          deactivated++;
        }
      }
      healed.push({ action: 'deactivate_expired_keys', count: deactivated });
    }

    // 6. Log the heal action
    const vcConnections = await db.entities.VisionCortexConnection.list('-created_date', 1).catch(() => []);
    if (vcConnections.length > 0) {
      const vc = vcConnections[0];
      await db.entities.VisionCortexConnection.update(vc.id, {
        last_heal_at: new Date().toISOString(),
        last_heal_result: `${healed.reduce((a, h) => a + h.count, 0)} items healed`,
        heal_count: (vc.heal_count || 0) + 1,
        issues_healed: (vc.issues_healed || 0) + healed.reduce((a, h) => a + h.count, 0),
      });
    }

    // Log to AutoHealLog
    await db.entities.AutoHealLog.create({
      target_type: 'engine',
      target_id: 'system',
      target_name: 'Vision Cortex Preflight Heal',
      issue_detected: targetAction === 'all' ? 'engine_degraded' : 'custom',
      action_taken: 'restart',
      action_result: 'success',
      details: { healed, skipped, triggered_by: user.email },
      healed_at: new Date().toISOString(),
    }).catch(() => {});

    return Response.json({
      healed_at: new Date().toISOString(),
      healed_by: user.email,
      actions: healed,
      total_healed: healed.reduce((a, h) => a + h.count, 0),
      message: `Heal complete: ${healed.reduce((a, h) => a + h.count, 0)} items healed across ${healed.length} actions`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}