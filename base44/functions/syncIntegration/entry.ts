import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const serviceType = body.service_type;
    const action = body.action || 'test';

    // ── Google Drive sync ──
    if (serviceType === 'googledrive') {
      const { accessToken } = await base44.asServiceRole.connectors.getCurrentAppUserConnection('69db1e5e75a5f8c15c80cf34');
      const res = await fetch('https://www.googleapis.com/drive/v3/files?pageSize=50&fields=files(id,name,mimeType,modifiedTime)', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(`Drive API error: ${res.status}`);
      const data = await res.json();
      return Response.json({ files: data.files || [], count: (data.files || []).length });
    }

    // ── Supabase sync ──
    if (serviceType === 'supabase') {
      const { accessToken } = await base44.asServiceRole.connectors.getCurrentAppUserConnection('69e521c8418f5cecefb2567c');
      const projectsRes = await fetch('https://api.supabase.com/v1/projects', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!projectsRes.ok) throw new Error(`Supabase API error: ${projectsRes.status}`);
      const projects = await projectsRes.json();
      return Response.json({ projects, count: projects.length });
    }

    // ── GitHub sync ──
    if (serviceType === 'github') {
      const { accessToken } = await base44.asServiceRole.connectors.getConnection('github');
      const res = await fetch('https://api.github.com/user/repos?per_page=50&sort=updated', {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json' },
      });
      if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
      const repos = await res.json();
      return Response.json({ repos, count: repos.length });
    }

    // ── Vercel (delegates to vercelApi function) ──
    if (serviceType === 'vercel') {
      const result = await base44.functions.invoke('vercelApi', { action: 'list' });
      return Response.json(result.data || result);
    }

    return Response.json({ error: 'Unknown service type' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}