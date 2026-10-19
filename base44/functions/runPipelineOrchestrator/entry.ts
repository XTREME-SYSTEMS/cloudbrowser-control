import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';

// Pipeline Orchestrator — auto-chains factory pipeline stages.
// Reads active FactoryPipeline records, determines the current stage,
// and dispatches the next stage's AgentTask if none is pending.
// This closes the autonomous execution gap: discover → buy → template →
// repo → build → deploy → connect → complete — all hands-off.

const STAGE_FLOW = [
  { status: 'discovering', task_type: 'discover_domains', next: 'buying' },
  { status: 'buying', task_type: 'buy_domain', next: 'templating' },
  { status: 'templating', task_type: 'generate_template', next: 'generating' },
  { status: 'generating', task_type: 'create_repo', next: 'building' },
  { status: 'building', task_type: 'build_system', next: 'deploying' },
  { status: 'deploying', task_type: 'build_system', next: 'connecting' },
  { status: 'connecting', task_type: 'google_connect', next: 'complete' },
];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const expectedSecret = secrets.get('WORKER_SECRET');
    const isWorker = !!(body?.worker_secret && expectedSecret && body.worker_secret === expectedSecret);
    if (!isWorker) {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sr = base44.asServiceRole.entities;

    // Load active pipelines (not complete, not failed)
    const pipelinePage = await sr.FactoryPipeline.filter(
      { status: { $nin: ['complete', 'failed'] } },
      { sort: '-created_date', limit: 50 }
    );
    const pipelines = pipelinePage.items || [];

    const dispatched = [];
    const skipped = [];
    const advanced = [];

    for (const pipeline of pipelines) {
      const stage = STAGE_FLOW.find((s) => s.status === pipeline.status);
      if (!stage) {
        skipped.push({ pipeline: pipeline.name, reason: `unknown status: ${pipeline.status}` });
        continue;
      }

      // Check if there's already a pending/in-progress task for this stage + pipeline
      const existingPage = await sr.AgentTask.filter(
        { task_type: stage.task_type, status: { $in: ['pending', 'in_progress'] }, description: { $regex: pipeline.id } },
        { limit: 1 }
      );
      if (existingPage.items?.length > 0) {
        skipped.push({ pipeline: pipeline.name, stage: stage.status, reason: 'task already pending' });
        continue;
      }

      // Check if the current stage's tasks are all completed (advance to next)
      const stageTasksPage = await sr.AgentTask.filter(
        { task_type: stage.task_type, status: 'completed', description: { $regex: pipeline.id } },
        { limit: 5 }
      );
      const stageTasks = stageTasksPage.items || [];

      // If the stage has completed tasks and the pipeline hasn't advanced, advance it
      if (stageTasks.length > 0 && stage.next !== 'complete') {
        await sr.FactoryPipeline.update(pipeline.id, { status: stage.next });
        advanced.push({ pipeline: pipeline.name, from: stage.status, to: stage.next });
      }

      // Build task description from pipeline config
      let config = {};
      try { config = JSON.parse(pipeline.config || '{}'); } catch {}

      const task = await sr.AgentTask.create({
        agent_name: 'orchestrator',
        task_type: stage.task_type,
        title: `${stage.task_type.replace(/_/g, ' ')} — ${pipeline.name}`,
        description: JSON.stringify({
          pipeline_id: pipeline.id,
          pipeline_name: pipeline.name,
          keywords: pipeline.keywords || '',
          tlds: pipeline.tlds || 'com,net,store',
          ...config,
        }),
        priority: 'high',
        autonomous: true,
        status: 'pending',
      });

      dispatched.push({ pipeline: pipeline.name, stage: stage.status, task_id: task.id, task_type: stage.task_type });
    }

    return Response.json({
      ok: true,
      pipelines_checked: pipelines.length,
      tasks_dispatched: dispatched.length,
      tasks_skipped: skipped.length,
      stages_advanced: advanced.length,
      dispatched,
      skipped,
      advanced,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}