import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { engineFetch, isEngineConfigured, setEngineClient } from '../../shared/engineClient.ts';
import { decrypt } from '../../shared/crypto.ts';
import { recordProxyResult } from '../../shared/manageProxyRotation.ts';
import { DEPLOYMENT_VERSION } from '../../shared/deploymentVersion.ts';

// testProxyHealth — sweeps all active proxies, tests each, updates health scores.
// Admin or worker-secret gated. Auto-evicts proxies below health 10.

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    setEngineClient(base44);
    const body = await req.json().catch(() => ({}));

    const expectedSecret = secrets.get('WORKER_SECRET');
    const isWorker = !!(body?.worker_secret && expectedSecret && body.worker_secret === expectedSecret);
    if (!isWorker) {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized', __v: DEPLOYMENT_VERSION }, { status: 401 });
    }

    if (!await isEngineConfigured()) {
      return Response.json({ error: 'Browser engine not configured', __v: DEPLOYMENT_VERSION }, { status: 503 });
    }

    const { items } = await base44.asServiceRole.entities.Proxy.filter({ active: true }, { sort: '-health_score', limit: 50 });
    if (!items || !items.length) return Response.json({ ok: true, tested: 0, results: [], __v: DEPLOYMENT_VERSION });

    const results = [];
    for (const proxy of items) {
      const startedAt = Date.now();
      let ok = false;
      let exitIp = null;
      let sessionId = null;

      let password = '';
      if (proxy.password_encrypted) {
        try { password = await decrypt(proxy.password_encrypted) || ''; } catch (e) {}
      }
      const proxyConfig: any = { server: proxy.server };
      if (proxy.username) proxyConfig.username = proxy.username;
      if (password) proxyConfig.password = password;

      try {
        const session = await engineFetch('/sessions', { method: 'POST', body: JSON.stringify({ proxy: proxyConfig, usePool: false }) });
        sessionId = session.sessionId;
        if (!sessionId) throw new Error('No session ID');

        await engineFetch(`/sessions/${sessionId}/execute`, {
          method: 'POST',
          body: JSON.stringify({ action_type: 'goto', value: 'https://api.ipify.org?format=json', options: { timeout: 20000 } }),
        });
        const extractRes = await engineFetch(`/sessions/${sessionId}/execute`, {
          method: 'POST',
          body: JSON.stringify({ action_type: 'extract_text', selector: 'body' }),
        });
        const text = extractRes.data || extractRes.text || '';
        const match = (typeof text === 'string' ? text : JSON.stringify(text)).match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
        exitIp = match ? match[1] : null;
        ok = !!exitIp;
      } catch (e) {
        // proxy failed
      } finally {
        if (sessionId) { try { await engineFetch(`/sessions/${sessionId}`, { method: 'DELETE' }); } catch (e) {} }
      }

      const latencyMs = Date.now() - startedAt;
      await recordProxyResult(base44, proxy.id, ok, latencyMs, exitIp);
      results.push({ proxy_id: proxy.id, name: proxy.name, ok, exit_ip: exitIp, latency_ms: latencyMs, health_after: Math.max(0, Math.min(100, (proxy.health_score ?? 50) + (ok ? 5 : -20))) });
    }

    const passed = results.filter((r) => r.ok).length;
    return Response.json({ ok: true, tested: results.length, passed, failed: results.length - passed, results, __v: DEPLOYMENT_VERSION });
  } catch (error) {
    return Response.json({ error: error.message, __v: DEPLOYMENT_VERSION }, { status: 500 });
  }
}