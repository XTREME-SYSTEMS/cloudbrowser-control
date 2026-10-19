// Proxy Rotation Manager — health-scored, geo-targeted, auto-evicting proxy pool.
// Consumed by runAutonomousBrowserTask to pick the best proxy for a stealth session.
import { decrypt } from './crypto.ts';

export interface ProxyPick {
  proxyId: string;
  config: { server: string; username?: string; password?: string };
  meta: { name: string; country: string; ip_type: string; health_score: number; protocol: string };
}

// Pick the best proxy by geo + health (weighted random among alive proxies).
export async function pickBestProxy(base44, opts: { geo?: string; rotationGroup?: string; ipType?: string; protocol?: string } = {}): Promise<ProxyPick | null> {
  const query: any = { active: true };
  if (opts.rotationGroup) query.rotation_group = opts.rotationGroup;
  const { items } = await base44.asServiceRole.entities.Proxy.filter(query, { sort: '-health_score', limit: 50 });
  if (!items || !items.length) return null;

  let candidates = items;
  if (opts.geo) {
    const geo = opts.geo.toLowerCase();
    const geoMatch = items.filter((p) =>
      (p.country || '').toLowerCase() === geo ||
      (p.state || '').toLowerCase() === geo ||
      (p.city || '').toLowerCase() === geo
    );
    if (geoMatch.length) candidates = geoMatch;
  }
  if (opts.ipType) {
    const filtered = candidates.filter((p) => p.ip_type === opts.ipType);
    if (filtered.length) candidates = filtered;
  }
  if (opts.protocol) {
    const filtered = candidates.filter((p) => p.protocol === opts.protocol);
    if (filtered.length) candidates = filtered;
  }

  // Exclude dead proxies (health < 10)
  const alive = candidates.filter((p) => (p.health_score ?? 50) >= 10);
  if (!alive.length) return null;

  // Weighted random by health score (higher health = more likely)
  const totalWeight = alive.reduce((sum, p) => sum + Math.max(p.health_score ?? 50, 1), 0);
  let r = Math.random() * totalWeight;
  let picked = alive[0];
  for (const p of alive) {
    r -= Math.max(p.health_score ?? 50, 1);
    if (r <= 0) { picked = p; break; }
  }

  let password = '';
  if (picked.password_encrypted) {
    try { password = await decrypt(picked.password_encrypted) || ''; } catch (e) {}
  }
  const config: any = { server: picked.server };
  if (picked.username) config.username = picked.username;
  if (password) config.password = password;

  return {
    proxyId: picked.id,
    config,
    meta: { name: picked.name, country: picked.country, ip_type: picked.ip_type, health_score: picked.health_score ?? 50, protocol: picked.protocol },
  };
}

// Record a proxy test result — adjusts health score and auto-evicts below 10.
export async function recordProxyResult(base44, proxyId: string, ok: boolean, latencyMs: number, exitIp?: string): Promise<void> {
  if (!proxyId) return;
  try {
    const current = await base44.asServiceRole.entities.Proxy.get(proxyId);
    if (!current) return;
    const failures = ok ? 0 : (current.consecutive_failures || 0) + 1;
    const healthDelta = ok ? Math.min(10, 5) : -20;
    const newHealth = Math.max(0, Math.min(100, (current.health_score ?? 50) + healthDelta));
    const autoEvict = newHealth < 10;
    await base44.asServiceRole.entities.Proxy.update(proxyId, {
      health_score: newHealth,
      last_tested_at: new Date().toISOString(),
      last_exit_ip: exitIp || current.last_exit_ip,
      consecutive_failures: failures,
      last_latency_ms: latencyMs,
      active: autoEvict ? false : current.active,
    });
  } catch (e) { /* best-effort */ }
}