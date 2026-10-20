import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import {
  MODEL_FOR_ROLE,
  PRODUCER_SCHEMA,
  ASSURANCE_SCHEMAS,
  buildProducerMessages,
  buildAssuranceMessages,
  scoreRun,
  computeModelSeparation,
  resolveRunnableService,
  agentForRole,
} from '../../shared/serviceRun.ts';
import { fallbackEnhancement } from '../../shared/promptEnhancer.ts';

/**
 * Runs one catalogue service end to end.
 *
 * The producing agent executes every numbered step. Then the QA agent, the
 * policy guardian and the independent validator each review the run on their
 * own model family, and the guardian's verdict is a gate rather than a vote:
 * a high QA score cannot average away a blocked delivery.
 *
 * The resulting ServiceRun record is what the dashboard monitors.
 */
export default async function (req) {
  const startedAt = Date.now();
  let run = null;
  let base44Ref = null;

  try {
    const base44 = createClientFromRequest(req);
    base44Ref = base44;
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden — running a production service is an operator action.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const sentence = typeof body?.sentence === 'string' ? body.sentence.trim() : '';
    if (!sentence) {
      return Response.json({ error: 'A plain-language instruction is required.' }, { status: 400 });
    }

    const { service, error: resolveError } = resolveRunnableService(body?.service_slug);
    if (!service) {
      return Response.json({ error: resolveError }, { status: 400 });
    }

    // ── Open the run so monitoring sees it immediately ──
    run = await base44.entities.ServiceRun.create({
      service_slug: service.slug,
      service_name: service.name,
      status: 'running',
      input_sentence: sentence,
      steps_total: service.workflow.length,
      steps: service.workflow.map((s) => ({
        n: s.n,
        name: s.name,
        status: 'pending',
        result: '',
        output: '',
      })),
      deliverables: service.deliverables,
      requested_by_email: user.email,
    });

    // ── 1. The prompt of record ──
    let enhanced = null;
    let promptStandard = 'standard-10';
    if (typeof body?.enhanced_prompt === 'string' && body.enhanced_prompt.trim()) {
      enhanced = { prompt: body.enhanced_prompt, standards_applied: [] };
      promptStandard = 'operator-supplied';
    } else {
      try {
        const enhanceRes = await base44.functions.invoke('enhanceServicePrompt', {
          sentence,
          service_slug: service.slug,
          surface: 'runServiceWorkflow',
        });
        const data = enhanceRes?.data || enhanceRes;
        if (data?.enhanced?.prompt) {
          enhanced = data.enhanced;
          promptStandard = data.enhancement_ran ? 'standard-10' : 'fallback-unenhanced';
        }
      } catch (error) {
        console.error('[runServiceWorkflow] enhancement failed:', error?.message);
      }
      if (!enhanced) {
        enhanced = fallbackEnhancement(sentence, service);
        promptStandard = 'fallback-unenhanced';
      }
    }

    const enhancedPrompt = enhanced.prompt;

    // ── 2. The producing agent executes the workflow ──
    const producerBrief = buildProducerMessages(service, enhancedPrompt, sentence);
    let producer = null;
    try {
      producer = await base44.integrations.Core.InvokeLLM({
        prompt: `${producerBrief.system}\n\n---\n\n${producerBrief.user}`,
        response_json_schema: PRODUCER_SCHEMA,
        model: MODEL_FOR_ROLE.producer,
      });
    } catch (error) {
      console.error('[runServiceWorkflow] producer failed:', error?.message);
    }
    if (!producer || typeof producer !== 'object') {
      await base44.entities.ServiceRun.update(run.id, {
        status: 'failed',
        enhanced_prompt: enhancedPrompt,
        prompt_standard: promptStandard,
        error: 'The producing agent did not return a usable result.',
        duration_ms: Date.now() - startedAt,
        completed_at: new Date().toISOString(),
      });
      return Response.json({ error: 'The producing agent did not return a usable result.', run_id: run.id }, { status: 502 });
    }

    // ── 3. The three assurance agents, on three other model families ──
    const providerAgent = agentForRole(service, 'producer');
    const producedSteps = Array.isArray(producer.steps) ? producer.steps : [];
    const assuranceContext = {
      sentence,
      enhancedPrompt,
      producerSummary: String(producer.producer_summary || ''),
      producerSteps: producedSteps,
    };

    const roles = ['qa', 'guardian', 'validator'];
    const settled = await Promise.allSettled(
      roles.map((role) => {
        const brief = buildAssuranceMessages(service, role, assuranceContext);
        return base44.integrations.Core.InvokeLLM({
          prompt: `${brief.system}\n\n---\n\n${brief.user}`,
          response_json_schema: ASSURANCE_SCHEMAS[role],
          model: MODEL_FOR_ROLE[role],
        });
      }),
    );

    const assurance = {};
    roles.forEach((role, index) => {
      const outcome = settled[index];
      const agent = agentForRole(service, role);
      if (outcome.status === 'fulfilled' && outcome.value && typeof outcome.value === 'object') {
        assurance[role] = { ...outcome.value, agent: agent ? agent.name : role, model: MODEL_FOR_ROLE[role] };
      } else {
        console.error(`[runServiceWorkflow] ${role} review failed:`, outcome.reason?.message);
        assurance[role] =
          role === 'guardian'
            ? { agent: agent ? agent.name : role, model: MODEL_FOR_ROLE[role], allowed: false, blocks: ['The guardian review did not complete — delivery is not permitted on an unreviewed run.'], reasons: [] }
            : { agent: agent ? agent.name : role, model: MODEL_FOR_ROLE[role], score: 0, verdict: 'failed', reasons: ['The review did not complete.'] };
      }
    });

    const separation = computeModelSeparation([
      MODEL_FOR_ROLE.producer,
      MODEL_FOR_ROLE.qa,
      MODEL_FOR_ROLE.guardian,
      MODEL_FOR_ROLE.validator,
    ]);
    assurance.model_separation_ok = separation.ok;
    assurance.model_families = separation.families;

    // ── 4. Score it, gate it, record it ──
    const scored = scoreRun(producer, assurance);

    const steps = service.workflow.map((s) => {
      const claimed = producedSteps.find((p) => Number(p?.n) === s.n);
      const status = claimed?.status === 'done' ? 'done' : claimed ? 'failed' : 'skipped';
      return {
        n: s.n,
        name: s.name,
        status,
        result: claimed?.result || s.result,
        output: claimed?.output || '',
      };
    });

    const updated = await base44.entities.ServiceRun.update(run.id, {
      status: scored.verdict === 'blocked' ? 'blocked' : scored.delivery_allowed ? 'delivered' : 'failed',
      enhanced_prompt: enhancedPrompt,
      prompt_standard: promptStandard,
      steps,
      steps_completed: scored.steps_done,
      producer_summary: String(producer.producer_summary || ''),
      assurance,
      overall_score: scored.overall_score,
      verdict: scored.verdict,
      delivery_allowed: scored.delivery_allowed,
      monitoring: {
        signals: [
          { key: 'step_completion', value: scored.step_completion },
          { key: 'qa_score', value: Number(assurance?.qa?.score) || 0 },
          { key: 'validator_score', value: Number(assurance?.validator?.score) || 0 },
          { key: 'guardian_allowed', value: assurance?.guardian?.allowed === true },
        ],
        alerts: scored.alerts,
      },
      duration_ms: Date.now() - startedAt,
      completed_at: new Date().toISOString(),
      notes: providerAgent ? `Produced by ${providerAgent.name} (${providerAgent.specialty}).` : '',
    });

    return Response.json({
      success: true,
      run_id: run.id,
      service: { slug: service.slug, name: service.name, steps: service.workflow.length },
      prompt_standard: promptStandard,
      enhanced_prompt: enhancedPrompt,
      verdict: scored.verdict,
      overall_score: scored.overall_score,
      delivery_allowed: scored.delivery_allowed,
      alerts: scored.alerts,
      run: updated,
    });
  } catch (error) {
    console.error('[runServiceWorkflow] failed:', error?.message);
    if (run && base44Ref) {
      try {
        await base44Ref.entities.ServiceRun.update(run.id, {
          status: 'failed',
          error: String(error?.message || 'unknown error'),
          duration_ms: Date.now() - startedAt,
          completed_at: new Date().toISOString(),
        });
      } catch (nested) {
        console.error('[runServiceWorkflow] could not record failure:', nested?.message);
      }
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
}