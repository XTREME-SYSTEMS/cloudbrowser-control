import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { SERVICE_CATALOG } from '../../shared/serviceCatalog.ts';
import { buildEnhancementMessages, ENHANCEMENT_SCHEMA, PROMPT_STANDARDS } from '../../shared/promptEnhancer.ts';

/**
 * THE AI EXECUTIVE ASSISTANT
 *
 * The operator talks; this decides what to do and then does it. Three actions:
 *
 *   brief   — read the workspace and report what is running, what is blocked
 *             and what needs a human decision, with no work queued.
 *   command — enhance the operator's sentence, then take an action plan out of
 *             it: queue work for named agents, launch a service run, or answer.
 *   enhance — return only the enhanced prompt, for use by a page or a step.
 *
 * Every instruction passes through the same enhancement standard first, so the
 * agents are never asked to work from a half-formed request.
 */

const ASSISTANT_ACTIONS = ['outreach', 'follow_up', 'message', 'schedule', 'monitor', 'research', 'delivery', 'internal'];
const ASSISTANT_CHANNELS = ['voice', 'sms', 'mms', 'whatsapp', 'email', 'calendar', 'internal', 'browser'];

const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    reasoning: { type: 'string' },
    launch_service_slug: { type: 'string' },
    launch_sentence: { type: 'string' },
    actions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          kind: { type: 'string' },
          channel: { type: 'string' },
          owner_agent: { type: 'string' },
          priority: { type: 'string' },
          instruction: { type: 'string' },
          due_in_hours: { type: 'number' },
        },
        required: ['title', 'kind', 'owner_agent'],
      },
    },
  },
  required: ['reply'],
};

const BRIEF_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string' },
    doing_well: { type: 'array', items: { type: 'string' } },
    needs_attention: { type: 'array', items: { type: 'string' } },
    next_actions: { type: 'array', items: { type: 'string' } },
    decisions_required: { type: 'array', items: { type: 'string' } },
  },
  required: ['headline'],
};

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden — the executive assistant operates the workspace.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const action = typeof body?.action === 'string' ? body.action : 'brief';

    // ─────────────────────────────────────────────────────────────
    // ENHANCE — the prompt engine on its own
    // ─────────────────────────────────────────────────────────────
    if (action === 'enhance') {
      const sentence = String(body?.sentence || '').trim();
      if (!sentence) return Response.json({ error: 'A sentence is required.' }, { status: 400 });
      const res = await base44.functions.invoke('enhanceServicePrompt', {
        sentence,
        service_slug: body?.service_slug || null,
        step_name: body?.step_name || null,
        step_number: typeof body?.step_number === 'number' ? body.step_number : null,
        surface: body?.surface || 'executive_assistant',
      });
      return Response.json(res?.data || res);
    }

    // ─────────────────────────────────────────────────────────────
    // Read the workspace — shared by brief and command
    // ─────────────────────────────────────────────────────────────
    const [recentRunsRes, openTasksRes, blockedRunsRes, blockedTasksRes] = await Promise.allSettled([
      base44.entities.ServiceRun.filter({}, { sort: '-created_date', limit: 15 }),
      base44.entities.OpsTask.filter({ status: 'open' }, { sort: '-created_date', limit: 40 }),
      base44.entities.ServiceRun.count({ verdict: 'blocked' }),
      base44.entities.OpsTask.count({ status: 'blocked' }),
    ]);

    const recentRuns = recentRunsRes.status === 'fulfilled' ? recentRunsRes.value?.items || recentRunsRes.value || [] : [];
    const openTasks = openTasksRes.status === 'fulfilled' ? openTasksRes.value?.items || openTasksRes.value || [] : [];
    const blockedRuns = blockedRunsRes.status === 'fulfilled' ? blockedRunsRes.value || 0 : 0;
    const blockedTasks = blockedTasksRes.status === 'fulfilled' ? blockedTasksRes.value || 0 : 0;

    const workspaceState = {
      services_available: SERVICE_CATALOG.map((s) => ({
        slug: s.slug,
        name: s.name,
        group: s.group,
        steps: s.workflow.length,
        pricing: s.pricing.range,
      })),
      recent_runs: recentRuns.map((r) => ({
        service: r.service_name,
        verdict: r.verdict,
        score: r.overall_score,
        delivery_allowed: r.delivery_allowed,
        alerts: r.monitoring?.alerts || [],
        when: r.created_date,
      })),
      blocked_runs_total: blockedRuns,
      open_tasks: openTasks.map((t) => ({
        title: t.title,
        kind: t.kind,
        channel: t.channel,
        owner_agent: t.owner_agent,
        priority: t.priority,
      })),
      blocked_tasks_total: blockedTasks,
    };

    if (action === 'brief') {
      const prompt = [
        'You are the operator\'s AI executive assistant for a browser-automation and data-intelligence platform.',
        'You are reporting on the workspace as it actually is. You never invent activity and you never report a number that is not in the state below.',
        '',
        'WORKSPACE STATE (this is the whole truth you have):',
        JSON.stringify(workspaceState, null, 1),
        '',
        'Write the operating brief: what is running, what is blocked and why, what the operator must decide, and the next actions in priority order.',
        'When there is no activity, say so plainly instead of inventing progress. Return JSON only.',
      ].join('\n');

      let brief = null;
      try {
        brief = await base44.integrations.Core.InvokeLLM({ prompt, response_json_schema: BRIEF_SCHEMA });
      } catch (error) {
        console.error('[executiveAssistant] brief model failed:', error?.message);
      }
      if (!brief || typeof brief !== 'object') {
        brief = {
          headline: 'Brief unavailable — the model call did not complete. The raw workspace state is attached below.',
          doing_well: [],
          needs_attention: blockedRuns > 0 ? [`${blockedRuns} service run(s) blocked by the guardian.`] : [],
          next_actions: [],
          decisions_required: [],
        };
      }

      return Response.json({
        success: true,
        action: 'brief',
        generated_at: new Date().toISOString(),
        brief,
        workspace_state: workspaceState,
      });
    }

    // ─────────────────────────────────────────────────────────────
    // COMMAND — enhance the sentence, then act on it
    // ─────────────────────────────────────────────────────────────
    const sentence = String(body?.sentence || '').trim();
    if (!sentence) {
      return Response.json({ error: 'Tell the assistant what you want done.' }, { status: 400 });
    }

    let enhanced = null;
    try {
      const enhanceRes = await base44.functions.invoke('enhanceServicePrompt', {
        sentence,
        service_slug: body?.service_slug || null,
        surface: 'executive_assistant',
      });
      const data = enhanceRes?.data || enhanceRes;
      if (data?.enhanced?.prompt) enhanced = data.enhanced;
    } catch (error) {
      console.error('[executiveAssistant] enhancement failed:', error?.message);
    }

    const enhancedPrompt = enhanced?.prompt || sentence;

    const planPrompt = [
      'You are the operator\'s AI executive assistant. You have already turned their sentence into a precise work brief.',
      '',
      `OPERATOR SAID: """${sentence}"""`,
      '',
      `ENHANCED BRIEF OF RECORD: """${enhancedPrompt}"""`,
      '',
      'PLATFORM SERVICES YOU MAY LAUNCH (use the slug exactly):',
      SERVICE_CATALOG.map((s) => `- ${s.slug} — ${s.name}: ${s.tagline}`).join('\n'),
      '',
      'WORKSPACE STATE:',
      JSON.stringify(workspaceState, null, 1),
      '',
      'Decide what actually needs doing and who owns it. Rules:',
      '- Queue work for named agents; the operator performs no manual steps.',
      `- kind must be one of: ${ASSISTANT_ACTIONS.join(', ')}. channel must be one of: ${ASSISTANT_CHANNELS.join(', ')}.`,
      '- Set launch_service_slug only when a platform service genuinely covers the request; otherwise leave it empty and queue tasks instead.',
      '- If the request cannot be done (missing authority, credential or decision), say so in reply and queue only the task that unblocks it.',
      'Return JSON only.',
    ].join('\n');

    let plan = null;
    try {
      plan = await base44.integrations.Core.InvokeLLM({ prompt: planPrompt, response_json_schema: PLAN_SCHEMA });
    } catch (error) {
      console.error('[executiveAssistant] planning failed:', error?.message);
    }
    if (!plan || typeof plan !== 'object') {
      return Response.json(
        { error: 'The assistant could not produce an action plan. Nothing was queued.', enhanced_prompt: enhancedPrompt },
        { status: 502 },
      );
    }

    // Queue the tasks the plan asked for.
    const safeKind = (v) => (ASSISTANT_ACTIONS.includes(v) ? v : 'internal');
    const safeChannel = (v) => (ASSISTANT_CHANNELS.includes(v) ? v : 'internal');
    const plannedActions = Array.isArray(plan.actions) ? plan.actions.slice(0, 20) : [];

    let createdTasks = [];
    if (plannedActions.length) {
      createdTasks = await base44.entities.OpsTask.bulkCreate(
        plannedActions.map((a) => ({
          title: String(a.title || 'Untitled action').slice(0, 200),
          kind: safeKind(a.kind),
          channel: safeChannel(a.channel),
          owner_agent: String(a.owner_agent || 'Executive Assistant').slice(0, 120),
          status: 'open',
          priority: ['low', 'normal', 'high', 'urgent'].includes(a.priority) ? a.priority : 'normal',
          instruction: String(a.instruction || a.title || ''),
          due_at:
            typeof a.due_in_hours === 'number' && a.due_in_hours >= 0
              ? new Date(Date.now() + a.due_in_hours * 3600000).toISOString()
              : undefined,
          source: 'executive_assistant',
          service_slug: plan.launch_service_slug || undefined,
          payload: { enhanced_prompt_applied: true },
        })),
      );
    }

    // Launch a service run when the plan named one.
    let launchedRun = null;
    if (plan.launch_service_slug) {
      try {
        const runRes = await base44.functions.invoke('runServiceWorkflow', {
          service_slug: plan.launch_service_slug,
          sentence: plan.launch_sentence || sentence,
          enhanced_prompt: enhancedPrompt,
        });
        const data = runRes?.data || runRes;
        launchedRun = {
          run_id: data?.run_id || null,
          verdict: data?.verdict || null,
          score: data?.overall_score ?? null,
          delivery_allowed: data?.delivery_allowed ?? false,
          alerts: data?.alerts || [],
          error: data?.error || null,
        };
      } catch (error) {
        console.error('[executiveAssistant] service launch failed:', error?.message);
        launchedRun = { error: error.message };
      }
    }

    return Response.json({
      success: true,
      action: 'command',
      reply: String(plan.reply || 'Queued.'),
      reasoning: String(plan.reasoning || ''),
      enhanced_prompt: enhancedPrompt,
      standards_applied: enhanced?.standards_applied || [],
      open_questions: enhanced?.open_questions || [],
      tasks_created: Array.isArray(createdTasks)
        ? createdTasks.map((t) => ({ id: t.id, title: t.title, owner_agent: t.owner_agent, kind: t.kind, channel: t.channel }))
        : [],
      launched_run: launchedRun,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[executiveAssistant] failed:', error?.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}