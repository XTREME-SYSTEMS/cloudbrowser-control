import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';

const RAILWAY_GRAPHQL_URL = 'https://backboard.railway.app/graphql/v2';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { name, capabilities = ['scraper', 'headless_browser'], region = 'us-west' } = body;

    // Create sandbox record
    const sandbox = await base44.entities.Sandbox.create({
      name: name || `Sandbox ${new Date().toLocaleDateString()}`,
      status: 'creating',
      capabilities,
      region,
      max_sessions: 3,
      max_browser_hours: 5,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      provisioning_logs: 'Starting Railway provisioning...',
    });

    // Provision via Railway API
    const railwayToken = secrets.get('RAILWAY_TOKEN');
    let railwayServiceId = null;
    let railwayDomain = null;
    let engineUrl = null;
    let logs = 'Sandbox record created.\n';

    if (railwayToken) {
      try {
        // Get project ID
        const tokenRes = await fetch(RAILWAY_GRAPHQL_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Project-Access-Token': railwayToken.trim() },
          body: JSON.stringify({ query: 'query { projectToken { projectId } }' }),
        });
        const tokenData = await tokenRes.json();
        const projectId = tokenData?.data?.projectToken?.projectId;
        logs += `Railway project: ${projectId}\n`;

        if (projectId) {
          // Create a new service from the existing engine template
          const createMutation = `
            mutation CreateService($projectId: String!, $name: String!) {
              serviceCreate(projectId: $projectId, name: $name) {
                id
              }
            }
          `;
          const svcRes = await fetch(RAILWAY_GRAPHQL_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Project-Access-Token': railwayToken.trim() },
            body: JSON.stringify({ query: createMutation, variables: { projectId, name: `sandbox-${sandbox.id.substring(0, 8)}` } }),
          });
          const svcData = await svcRes.json();
          railwayServiceId = svcData?.data?.serviceCreate?.id;
          logs += `Railway service created: ${railwayServiceId}\n`;

          // Generate a domain for the service
          if (railwayServiceId) {
            const domainMutation = `
              mutation GenerateDomain($serviceId: String!) {
                serviceDomainGenerate(serviceId: $serviceId) {
                  id
                  domain
                }
              }
            `;
            const domainRes = await fetch(RAILWAY_GRAPHQL_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Project-Access-Token': railwayToken.trim() },
              body: JSON.stringify({ query: domainMutation, variables: { serviceId: railwayServiceId } }),
            });
            const domainData = await domainRes.json();
            railwayDomain = domainData?.data?.serviceDomainGenerate?.domain;
            engineUrl = railwayDomain ? `https://${railwayDomain}` : null;
            logs += `Domain generated: ${railwayDomain || 'failed'}\n`;
          }
        }
      } catch (e) {
        logs += `Railway provisioning error: ${e.message}\n`;
      }
    } else {
      logs += 'RAILWAY_TOKEN not set — sandbox created without Railway provisioning. Using shared engine.\n';
      // Fallback: use the shared engine
      engineUrl = secrets.get('ENGINE_URL') || 'https://cloudbrowser-engine.up.railway.app';
    }

    // Generate an API key for this sandbox
    let sandboxApiKey = null;
    try {
      const keyRes = await base44.functions.invoke('createApiKey', {
        name: `Sandbox: ${name}`,
        scopes: ['sessions:read', 'sessions:write', 'scrape:run'],
      });
      sandboxApiKey = keyRes.data?.api_key || keyRes.api_key;
      logs += `API key generated for sandbox\n`;
    } catch (e) {
      logs += `API key generation failed: ${e.message}\n`;
    }

    // Update sandbox with provisioning results
    const updated = await base44.entities.Sandbox.update(sandbox.id, {
      status: 'active',
      railway_service_id: railwayServiceId,
      railway_domain: railwayDomain,
      engine_url: engineUrl,
      api_key: sandboxApiKey,
      provisioning_logs: logs,
      last_activity_at: new Date().toISOString(),
    });

    return Response.json({
      success: true,
      sandbox: updated,
      api_key: sandboxApiKey,
      engine_url: engineUrl,
      logs,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}