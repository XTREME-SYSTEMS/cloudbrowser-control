import { base44 } from '@/api/base44Client';
import { DEFAULT_AGENTS, getAgentById } from './catalog';

// Create a new SwarmRun and dispatch parallel agent tasks.
export async function startSwarmRun({ prompt, agentIds, params = {} }) {
  const selected = agentIds?.length ? agentIds : DEFAULT_AGENTS;
  const run = await base44.entities.SwarmRun.create({
    prompt,
    status: 'running',
    task_count: selected.length,
    completed_count: 0,
    failed_count: 0,
    started_at: new Date().toISOString(),
    agent_config: { agents: selected, params: params || {} },
  });

  // Dispatch tasks in parallel — each agent gets the full prompt.
  const tasks = await Promise.all(
    selected.map(async (agentId) => {
      const agent = getAgentById(agentId);
      try {
        const task = await base44.entities.SwarmTask.create({
          agent_name: agentId,
          run_id: run.id,
          target_data: { prompt, params: params || {} },
          status: 'running',
          assigned_at: new Date().toISOString(),
        });
        return task;
      } catch (e) {
        return null;
      }
    })
  );

  return { run, tasks: tasks.filter(Boolean) };
}

// Poll a run's tasks until all complete, then mark the run.
export async function pollSwarmRun(runId) {
  const run = await base44.entities.SwarmRun.get(runId);
  const page = await base44.entities.SwarmTask.filter({ run_id: runId }, { sort: '-created_date', limit: 100 });
  const tasks = page.items || [];
  const completed = tasks.filter(t => t.status === 'completed' || t.status === 'failed');
  const failed = tasks.filter(t => t.status === 'failed');

  if (completed.length === tasks.length && tasks.length > 0 && run.status === 'running') {
    const status = failed.length === tasks.length ? 'failed' : 'completed';
    await base44.entities.SwarmRun.update(runId, {
      status,
      completed_count: completed.length,
      failed_count: failed.length,
      completed_at: new Date().toISOString(),
    });
  }

  return { run, tasks };
}

// Synthesize a run's task outputs into a final response.
export async function synthesizeRun(runId) {
  const page = await base44.entities.SwarmTask.filter({ run_id: runId, status: 'completed' }, { sort: 'created_date', limit: 100 });
  const tasks = page.items || [];
  const outputs = tasks.map(t => `### ${t.agent_name}\n${t.output || t.result_summary || '(no output)'}`).join('\n\n');

  const res = await base44.functions.invoke('invokeGatewayLLM', {
    prompt: `You are the Swarm Lead. Synthesize the following agent outputs into a single coherent response that directly addresses the original prompt. Lead with the most important findings. Be structured and concise.\n\nAGENT OUTPUTS:\n${outputs}`,
  });
  const synthesis = res?.data?.result || res?.data?.content || res?.data || '';

  await base44.entities.SwarmRun.update(runId, { status: 'synthesized', synthesis: typeof synthesis === 'string' ? synthesis : JSON.stringify(synthesis) });
  return synthesis;
}

// Approve an idea and dispatch a swarm run to build it.
export async function approveIdea(idea) {
  const prompt = `Build this idea: ${idea.title}\n\n${idea.description}\n\nCategory: ${idea.category}`;
  const { run } = await startSwarmRun({ prompt, agentIds: DEFAULT_AGENTS });
  await base44.entities.Idea.update(idea.id, { status: 'building', swarm_run_id: run.id });
  return run;
}