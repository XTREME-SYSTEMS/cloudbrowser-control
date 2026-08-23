import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { encrypt, decrypt } from "../../shared/crypto.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const action = body.action || 'list';

    // ── Save: encrypt and store the token in an Integration record ──
    if (action === 'save') {
      const token = body.token;
      if (!token) return Response.json({ error: 'Token required' }, { status: 400 });

      const encrypted = await encrypt(token);
      const existing = await base44.entities.Integration.filter({ service_type: 'vercel' });

      if (existing.length > 0) {
        await base44.entities.Integration.update(existing[0].id, {
          status: 'connected',
          has_credentials: true,
          credentials_encrypted: encrypted,
          sync_enabled: body.syncEnabled ?? true,
          config: { sandboxIsolated: body.sandboxIsolated ?? true },
          last_synced: new Date().toISOString(),
        });
      } else {
        await base44.entities.Integration.create({
          name: 'Vercel',
          service_type: 'vercel',
          status: 'connected',
          connection_mode: 'secret',
          has_credentials: true,
          credentials_encrypted: encrypted,
          sync_enabled: body.syncEnabled ?? true,
          config: { sandboxIsolated: body.sandboxIsolated ?? true },
          last_synced: new Date().toISOString(),
        });
      }
      return Response.json({ ok: true, message: 'Vercel credentials saved' });
    }

    // ── Get decrypted token helper ──
    const getVercelToken = async () => {
      const records = await base44.entities.Integration.filter({ service_type: 'vercel', status: 'connected' });
      if (records.length === 0) throw new Error('Vercel not connected. Use the Connection Wizard to connect.');
      const decrypted = await decrypt(records[0].credentials_encrypted);
      if (!decrypted) throw new Error('Failed to decrypt Vercel credentials');
      return decrypted;
    };

    const vercelApi = async (path, token, method = 'GET', bodyData = null) => {
      const res = await fetch(`https://api.vercel.com${path}`, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: bodyData ? JSON.stringify(bodyData) : undefined,
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Vercel API error (${res.status}): ${err}`);
      }
      return res.json();
    };

    // ── List projects ──
    if (action === 'list') {
      const token = await getVercelToken();
      const data = await vercelApi('/v9/projects', token);
      return Response.json({ projects: data.projects || [], count: (data.projects || []).length });
    }

    // ── List deployments ──
    if (action === 'deployments') {
      const token = await getVercelToken();
      const projectId = body.projectId;
      const path = projectId ? `/v6/deployments?projectId=${projectId}&limit=20` : '/v6/deployments?limit=20';
      const data = await vercelApi(path, token);
      return Response.json({ deployments: data.deployments || [] });
    }

    // ── Trigger deployment ──
    if (action === 'deploy') {
      const token = await getVercelToken();
      const data = await vercelApi('/v13/deployments', token, 'POST', {
        name: body.projectName,
        target: body.target || 'production',
        gitSource: body.gitSource || undefined,
      });
      return Response.json({ deployment: data, message: 'Deployment triggered' });
    }

    // ── Get user/team info ──
    if (action === 'user') {
      const token = await getVercelToken();
      const data = await vercelApi('/v2/user', token);
      return Response.json({ user: data.user || data });
    }

    // ── Sync: fetch projects and store metadata ──
    if (action === 'sync') {
      const token = await getVercelToken();
      const projectsData = await vercelApi('/v9/projects?limit=100', token);
      const records = await base44.entities.Integration.filter({ service_type: 'vercel' });
      if (records[0]) {
        await base44.entities.Integration.update(records[0].id, {
          last_synced: new Date().toISOString(),
          metadata: { ...records[0].metadata, projects: projectsData.projects || [] },
        });
      }
      return Response.json({ synced: (projectsData.projects || []).length, message: 'Vercel sync complete' });
    }

    // ── Test connection ──
    if (action === 'test') {
      const token = await getVercelToken();
      const data = await vercelApi('/v2/user', token);
      return Response.json({ ok: true, user: data.user?.username || 'connected' });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}