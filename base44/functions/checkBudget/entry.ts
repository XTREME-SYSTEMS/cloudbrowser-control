import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Budget enforcement: checks if a project has exceeded its cost budget before a job runs.
// Returns { allowed: boolean, remaining: number, used: number, limit: number }

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { projectId, estimatedCost } = body;

    if (!projectId) {
      return Response.json({ error: 'projectId required' }, { status: 400 });
    }

    // Get the project
    const project = await base44.entities.Project.get(projectId);
    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 });
    }

    // Budget is stored in project.default_session_config.budget_usd (or 0 = unlimited)
    const budget = project.default_session_config?.budget_usd || 0;

    // Sum all CostEntry records for this project
    const costEntries = await base44.entities.CostEntry.filter({ project_id: projectId });
    const used = costEntries.reduce((sum: number, entry: any) => sum + (entry.cost_usd || 0), 0);

    const remaining = budget > 0 ? Math.max(0, budget - used) : Infinity;
    const estCost = estimatedCost || 0;
    const allowed = budget === 0 || (used + estCost) <= budget;

    // If not allowed, log an audit entry
    if (!allowed) {
      await base44.asServiceRole.entities.AuditLog.create({
        action: 'budget_exceeded',
        entity_type: 'Project',
        entity_id: projectId,
        details: { used, budget, estimated: estCost, remaining },
      }).catch(() => {});
    }

    return Response.json({
      allowed,
      budget,
      used: Number(used.toFixed(4)),
      remaining: budget > 0 ? Number(remaining.toFixed(4)) : null,
      estimatedCost: estCost,
      wouldExceed: !allowed,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}