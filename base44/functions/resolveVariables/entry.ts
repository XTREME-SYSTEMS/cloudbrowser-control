import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// resolveVariables — Resolves VariableRegistry entries using the source
// priority chain (explicit → manifest → runtime → template_default → inferred → unresolved)
// and optionally computes an impact graph for configuration changes.
//
// Input:
//   keys?: string[]          — specific variable keys to resolve (omit = all)
//   compute_impact_graph?: boolean — map impact_domains to affected jobs/tests (default true)
//
// Returns:
//   { status, resolved: [...], unresolved: [...], impact_graph: {...} }

const PRIORITY = ['explicit', 'manifest', 'runtime', 'template_default', 'inferred', 'unresolved'];

function resolveValue(variable) {
  // 1. Explicit — a current_value already stored (operator-set)
  if (variable.current_value !== undefined && variable.current_value !== null && variable.current_value !== '') {
    return { value: variable.current_value, source: 'explicit' };
  }
  // 2. Manifest — value_source says it came from a manifest (trust stored source)
  if (variable.value_source === 'manifest' && variable.current_value) {
    return { value: variable.current_value, source: 'manifest' };
  }
  // 3. Runtime — value_source says runtime-resolved
  if (variable.value_source === 'runtime' && variable.current_value) {
    return { value: variable.current_value, source: 'runtime' };
  }
  // 4. Template default
  if (variable.default_value !== undefined && variable.default_value !== null && variable.default_value !== '') {
    return { value: variable.default_value, source: 'template_default' };
  }
  // 5/6. Nothing to resolve from — caller can request LLM inference separately
  return { value: null, source: 'unresolved' };
}

export default async function(req: any) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

  const sr = base44.asServiceRole.entities;
  const { keys, compute_impact_graph = true } = req.body || {};

  try {
    // Load variables — all or filtered by keys
    let variables;
    if (keys && Array.isArray(keys) && keys.length > 0) {
      // Fetch all then filter (SDK filter supports limited query shapes)
      const all = await sr.VariableRegistry.list('-created_date', 500);
      variables = (all || []).filter((v: any) => keys.includes(v.key));
    } else {
      variables = await sr.VariableRegistry.list('-created_date', 500);
    }

    const resolved: any[] = [];
    const unresolved: any[] = [];
    const updates: any[] = [];

    for (const v of variables) {
      const { value, source } = resolveValue(v);
      const entry = {
        key: v.key,
        group: v.group,
        type: v.type,
        current_value: value,
        value_source: source,
        previous_source: v.value_source || 'unresolved',
        sensitivity: v.sensitivity || 'normal',
        requires_approval: v.requires_approval || false,
        impact_domains: v.impact_domains || []
      };

      if (source === 'unresolved') {
        unresolved.push(entry);
      } else {
        resolved.push(entry);
        // Only update if the source or value actually changed
        if (v.value_source !== source || v.current_value !== value) {
          updates.push({
            id: v.id,
            current_value: value,
            value_source: source,
            last_resolved_at: new Date().toISOString()
          });
        }
      }
    }

    // Batch update changed variables
    if (updates.length > 0) {
      await sr.VariableRegistry.bulkUpdate(updates);
    }

    // Impact graph: map each impact domain → variable keys that affect it
    let impact_graph: any = {};
    if (compute_impact_graph) {
      for (const r of resolved) {
        for (const domain of r.impact_domains) {
          if (!impact_graph[domain]) impact_graph[domain] = [];
          impact_graph[domain].push(r.key);
        }
      }
    }

    return Response.json({
      status: 'success',
      total: variables.length,
      resolved_count: resolved.length,
      unresolved_count: unresolved.length,
      updated_count: updates.length,
      resolved: resolved.map(r => ({
        key: r.key,
        group: r.group,
        current_value: r.sensitivity === 'secret' ? '[redacted]' : r.current_value,
        value_source: r.value_source,
        previous_source: r.previous_source,
        requires_approval: r.requires_approval,
        impact_domains: r.impact_domains
      })),
      unresolved: unresolved.map(r => ({ key: r.key, group: r.group, value_source: r.value_source })),
      impact_graph,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('resolveVariables error:', error);
    return Response.json({ status: 'error', error: error.message }, { status: 500 });
  }
}