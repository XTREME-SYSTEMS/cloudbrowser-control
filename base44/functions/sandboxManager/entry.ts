import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const action = body.action || 'list';

    // ── List sandboxes ──
    if (action === 'list') {
      const sandboxes = await base44.entities.Sandbox.list('-created_date', 50);
      return Response.json({ sandboxes });
    }

    // ── Create sandbox ──
    if (action === 'create') {
      const sandbox = await base44.entities.Sandbox.create({
        name: body.name || 'New Sandbox',
        description: body.description || '',
        status: 'active',
        scope: body.scope || 'isolated',
        created_by_agent: body.createdByAgent ?? false,
        config: body.config || {},
        provisioning_status: 'not_required',
      });
      return Response.json({ sandbox, message: 'Sandbox created' }, { status: 201 });
    }

    // ── Provision sandbox externally ──
    if (action === 'provision') {
      const sandboxId = body.sandboxId;
      const sandbox = await base44.entities.Sandbox.get(sandboxId);
      if (!sandbox) return Response.json({ error: 'Sandbox not found' }, { status: 404 });

      await base44.entities.Sandbox.update(sandboxId, {
        provisioning_status: 'in_progress',
        provisioned_externally: true,
      });

      // Provision on connected integrations
      const integrations = await base44.entities.Integration.filter({ status: 'connected' });
      const results = [];
      for (const int of integrations) {
        try {
          if (int.service_type === 'vercel') {
            const vercelResult = await base44.functions.invoke('vercelApi', { action: 'list' });
            results.push({ service: 'vercel', status: 'synced', data: vercelResult.data });
          } else if (int.service_type === 'supabase') {
            const syncResult = await base44.functions.invoke('syncIntegration', { service_type: 'supabase' });
            results.push({ service: 'supabase', status: 'synced', data: syncResult.data });
          } else if (int.service_type === 'googledrive') {
            const syncResult = await base44.functions.invoke('syncIntegration', { service_type: 'googledrive' });
            results.push({ service: 'googledrive', status: 'synced', data: syncResult.data });
          }
        } catch (err) {
          results.push({ service: int.service_type, status: 'error', error: err.message });
        }
      }

      await base44.entities.Sandbox.update(sandboxId, {
        provisioning_status: 'completed',
        provisioned_externally: true,
        resources: results,
      });

      return Response.json({ sandboxId, results, message: 'External provisioning complete' });
    }

    // ── Archive sandbox ──
    if (action === 'archive') {
      await base44.entities.Sandbox.update(body.sandboxId, { status: 'archived' });
      return Response.json({ message: 'Sandbox archived' });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}