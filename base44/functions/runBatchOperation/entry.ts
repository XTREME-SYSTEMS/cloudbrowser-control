import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';

function applyTemplate(template, vars, index, batchName) {
  const replace = (str) => { if (!str) return str; return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`)); };
  const title = replace(template.title) || `${batchName || 'Site'} ${index + 1}`;
  return { title, build_type: template.build_type || 'website', what_to_build: replace(template.what_to_build) || '', how_it_looks: replace(template.how_it_looks) || '', how_it_functions: replace(template.how_it_functions) || '', what_it_connects_to: replace(template.what_it_connects_to) || '', what_it_says: replace(template.what_it_says) || '', how_it_operates: replace(template.how_it_operates) || '', deliver_to: replace(template.deliver_to) || '' };
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const expectedSecret = secrets.get('WORKER_SECRET');
    const isWorker = !!(body?.worker_secret && expectedSecret && body.worker_secret === expectedSecret);
    if (!isWorker) { const user = await base44.auth.me(); if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 }); }

    const name = body.name || 'Untitled Batch';
    const size = Math.min(Math.max(Number(body.batch_size) || 1, 1), 10000);
    const template = body.template || {};
    const deployTargets = Array.isArray(body.deploy_targets) ? body.deploy_targets : [];

    let vars = [];
    try { vars = typeof body.variables === 'string' ? JSON.parse(body.variables) : body.variables; if (!Array.isArray(vars)) vars = []; } catch (e) { vars = []; }

    const freeMode = body.free_mode !== false;
    const phases = { google_connect: body.google_connect !== false, social_connect: body.social_connect !== false, video_generate: !freeMode && body.video_generate === true, content_optimize: body.content_optimize !== false };

    let ownerId = null;
    if (!isWorker) { const user = await base44.auth.me(); ownerId = user?.id || null; }

    const batch = await base44.asServiceRole.entities.BatchOperation.create({ name, batch_size: size, template_spec: JSON.stringify(template), variables: JSON.stringify(vars), deploy_targets: deployTargets.join(','), ...phases, status: 'dispatching', progress: 0 });

    const builds = [];
    const tasks = [];

    for (let i = 0; i < size; i++) {
      const v = vars[i] || {};
      const spec = applyTemplate(template, v, i, name);
      const domain = v.domain || `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${i + 1}.com`;
      builds.push({ ...spec, status: 'spec_submitted', owner_id: ownerId, batch_id: batch.id });
      tasks.push({ agent_name: 'meta_architect', task_type: 'build_system', title: `Build: ${spec.title}`, description: JSON.stringify({ ...spec, build_index: i, domain, free_mode: freeMode, batch_id: batch.id, owner_id: ownerId }), priority: 'high', autonomous: true, status: 'pending' });
      if (phases.google_connect) tasks.push({ agent_name: 'growth_operator', task_type: 'google_connect', domain, title: `Google: ${spec.title}`, description: JSON.stringify({ domain, site: spec.title }), priority: 'medium', autonomous: true, status: 'pending' });
      if (phases.social_connect) tasks.push({ agent_name: 'social_strategist', task_type: 'social_connect', domain, title: `Social: ${spec.title}`, description: JSON.stringify({ domain, site: spec.title }), priority: 'medium', autonomous: true, status: 'pending' });
      if (phases.video_generate) tasks.push({ agent_name: 'social_strategist', task_type: 'video_generate', domain, title: `Video: ${spec.title}`, description: JSON.stringify({ domain, site: spec.title, prompt: spec.what_to_build || spec.title }), priority: 'medium', autonomous: true, status: 'pending' });
      if (phases.content_optimize) tasks.push({ agent_name: 'growth_operator', task_type: 'content_optimize', domain, title: `Content: ${spec.title}`, description: JSON.stringify({ domain, site: spec.title, content: spec.what_it_says, what_to_build: spec.what_to_build }), priority: 'medium', autonomous: true, status: 'pending' });
    }

    for (let i = 0; i < builds.length; i += 500) await base44.asServiceRole.entities.SystemBuild.bulkCreate(builds.slice(i, i + 500));
    for (let i = 0; i < tasks.length; i += 500) await base44.asServiceRole.entities.AgentTask.bulkCreate(tasks.slice(i, i + 500));

    await base44.asServiceRole.entities.BatchOperation.update(batch.id, { status: 'running', task_count: tasks.length });

    return Response.json({ batch_id: batch.id, batch_name: name, sites: size, builds_created: builds.length, tasks_dispatched: tasks.length, phases, status: 'running' });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}