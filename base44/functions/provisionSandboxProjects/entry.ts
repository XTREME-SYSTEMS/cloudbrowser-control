import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden — admin only' }, { status: 403 });

    const body = await req.json();
    const { build_id, project_name, providers } = body;

    if (!project_name) return Response.json({ error: 'project_name is required' }, { status: 400 });
    const targetProviders = providers || ['supabase', 'railway', 'googledrive', 'github'];

    const slug = project_name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 40);
    const results = {};

    for (const provider of targetProviders) {
      const record = await base44.asServiceRole.entities.SandboxProject.create({
        provider,
        project_name: `${slug}-${provider}-sandbox`,
        project_type: `${provider}_sandbox`,
        parent_build_id: build_id || null,
        status: 'creating',
        approval_status: 'pending',
        sandbox_config: { plan: 'free', region: 'us-east-1', private: true }
      });

      try {
        let externalId, externalUrl;

        if (provider === 'supabase') {
          const { accessToken } = await base44.asServiceRole.connectors.getConnection('supabase');
          // Get first organization
          const orgRes = await fetch('https://api.supabase.com/v1/organizations', {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          if (!orgRes.ok) throw new Error(`Supabase orgs failed: ${orgRes.status}`);
          const orgs = await orgRes.json();
          if (!orgs || orgs.length === 0) throw new Error('No Supabase organizations found');
          const orgId = orgs[0].id;
          const dbPass = `Sb${Date.now()}!${Math.random().toString(36).slice(2, 10)}`;
          const createRes = await fetch('https://api.supabase.com/v1/projects', {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: `${slug}-sb`, organization_id: orgId, db_pass: dbPass, region: 'us-east-1', plan: 'free' })
          });
          if (!createRes.ok) {
            const errBody = await createRes.text();
            throw new Error(`Supabase create failed: ${createRes.status} ${errBody}`);
          }
          const data = await createRes.json();
          externalId = data.id;
          externalUrl = `https://supabase.com/dashboard/project/${data.id}`;
        }

        else if (provider === 'googledrive') {
          const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');
          const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: `${slug}-sandbox`, mimeType: 'application/vnd.google-apps.folder' })
          });
          if (!createRes.ok) throw new Error(`Drive create failed: ${createRes.status}`);
          const data = await createRes.json();
          externalId = data.id;
          externalUrl = `https://drive.google.com/drive/folders/${data.id}`;
        }

        else if (provider === 'github') {
          const { accessToken } = await base44.asServiceRole.connectors.getConnection('github');
          const createRes = await fetch('https://api.github.com/user/repos', {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', Accept: 'application/vnd.github+json' },
            body: JSON.stringify({ name: `${slug}-sandbox`, private: true, auto_init: true, description: `Sandbox project for ${project_name}` })
          });
          if (!createRes.ok) {
            const errBody = await createRes.text();
            throw new Error(`GitHub create failed: ${createRes.status} ${errBody}`);
          }
          const data = await createRes.json();
          externalId = String(data.id);
          externalUrl = data.html_url;
        }

        else if (provider === 'railway') {
          const railwayToken = secrets.get('RAILWAY_TOKEN');
          if (!railwayToken) throw new Error('RAILWAY_TOKEN secret not set');
          const gqlRes = await fetch('https://backboard.railway.app/graphql/v2', {
            method: 'POST',
            headers: { Authorization: `Bearer ${railwayToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: `mutation ProjectCreate($input: ProjectCreateInput!) { projectCreate(input: $input) { project { id name } } }`,
              variables: { input: { name: `${slug}-sandbox`, description: `Sandbox for ${project_name}` } }
            })
          });
          if (!gqlRes.ok) throw new Error(`Railway create failed: ${gqlRes.status}`);
          const gqlData = await gqlRes.json();
          if (gqlData.errors) throw new Error(gqlData.errors.map(e => e.message).join('; '));
          externalId = gqlData.data.projectCreate.project.id;
          externalUrl = `https://railway.app/project/${externalId}`;
        }

        else throw new Error(`Unknown provider: ${provider}`);

        await base44.asServiceRole.entities.SandboxProject.update(record.id, {
          external_id: externalId,
          external_url: externalUrl,
          status: 'active'
        });
        results[provider] = { success: true, id: externalId, url: externalUrl, record_id: record.id };
      } catch (err) {
        await base44.asServiceRole.entities.SandboxProject.update(record.id, {
          status: 'failed',
          error: err.message
        });
        results[provider] = { success: false, error: err.message, record_id: record.id };
      }
    }

    return Response.json({ success: true, results, project_name: slug });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}