import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import {
  MODEL_FOR_ROLE,
  PRODUCER_SCHEMA,
  ASSURANCE_SCHEMAS,
  REVISION_SCHEMA,
  RECOMMENDATION_SCHEMA,
  buildProducerMessages,
  buildAssuranceMessages,
  buildRevisionMessages,
  buildRecommendationMessages,
  collectEvidence,
  evaluateEvidence,
  resolveIterationCap,
  scoreRun,
  computeModelSeparation,
  resolveRunnableService,
  agentForRole,
} from '../../shared/serviceRun.ts';
import {
  SPINE,
  buildStageSkeleton,
} from '../../shared/serviceSpine.ts';
import { fallbackEnhancement, missingEnhancementSlots } from '../../shared/promptEnhancer.ts';

/**
 * Runs one catalogue service end to end, through the frozen nine-stage spine:
 *
 *   1 Plan · 2 Discovery · 3 Strategy · 4 Implementation ·
 *   5 Validation · 6 QA · 7 Auto-Recommendation · 8 Iteration · 9 Final Results
 *
 * The work happens behind the lines. What lands on the record is one result per
 * stage, the brief of record, the evidence with its source and retrieval time,
 * what was iterated and why it stopped, and a one-line reason whenever delivery
 * is refused.
 *
 * A run is never green on its own assurance: evidence that the producing agent
 * asserted stays `claimed_unverified` until something re-fetches it, so the
 * best an unverified run can reach is a working result, never a delivery.
 */

const CLOCK = () => new Date().toISOString();

/** Truncate a stage's published result so the record stays readable. */
const condense = (parts, limit = 900) => {
  const joined = (parts || []).filter(Boolean).join(' · ');
  return joined.length > limit ? `${joined.slice(0, limit)}…` : joined;
};

const stageDigestOf = (stages) =>
  (stages || [])
    .map((s) => `  ${s.n}. ${s.name} [${s.status}] — ${s.result || 'no result'}`)
    .join('\n');

/** One review call. A review that does not complete is never treated as a pass. */
async function runReview(base44, service, role, context) {
  const agent = agentForRole(service, role);
  const model = MODEL_FOR_ROLE[role];
  const name = agent ? agent.name : role;
  try {
    const brief = buildAssuranceMessages(service, role, context);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `${brief.system}\n\n---\n\n${brief.user}`,
      response_json_schema: ASSURANCE_SCHEMAS[role],
      model,
    });
    if (result && typeof result === 'object') {
      return { ...result, agent: name, model };
    }
  } catch (error) {
    console.error(`[runServiceWorkflow] ${role} review failed:`, error?.message);
  }
  return role === 'guardian'
    ? {
        agent: name,
        model,
        allowed: false,
        blocks: ['The guardian review did not complete — delivery is not permitted on an unreviewed run.'],
        reasons: [],
      }
    : { agent: name, model, score: 0, verdict: 'failed', reasons: ['The review did not complete.'] };
}

/** Write the producing agent's per-step results into stages 2-4 and 1. */
function composeWorkStages(stages, producerSteps) {
  let failed = 0;
  stages
    .filter((s) => s.n <= 4)
    .forEach((stage) => {
      if (!stage.sub_steps.length) {
        stage.status = 'done';
        stage.result = stage.result || 'No domain step of this service lands in this stage; its own output is stated above.';
        return;
      }
      stage.sub_steps = stage.sub_steps.map((sub) => {
        const claimed = (producerSteps || []).find((p) => Number(p?.n) === sub.n);
        const status = claimed?.status === 'done' ? 'done' : claimed ? 'failed' : 'skipped';
        if (status !== 'done') failed += 1;
        return {
          ...sub,
          status,
          result: claimed?.result || sub.expected_result,
          credential_missing: claimed?.credential_missing || '',
        };
      });
      stage.status = stage.sub_steps.some((s) => s.status === 'failed') ? 'failed' : 'done';
      stage.result = condense(stage.sub_steps.map((s) => `${s.n}. ${s.name}: ${s.result}`));
    });
  return failed;
}

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

    // ── A single stage re-run, on a run that already exists ──
    if (body?.run_id && body?.only_stage) {
      return await rerunStage(base44, body);
    }

    const sentence = typeof body?.sentence === 'string' ? body.sentence.trim() : '';
    const answers = typeof body?.answers === 'string' ? body.answers.trim() : '';
    if (!sentence) {
      return Response.json({ error: 'A plain-language instruction is required.' }, { status: 400 });
    }

    const { service, error: resolveError } = resolveRunnableService(body?.service_slug);
    if (!service) {
      return Response.json({ error: resolveError }, { status: 400 });
    }

    const cap = resolveIterationCap(body?.max_iterations);

    // ── The run opens with all nine stages already on the record ──
    const stages = buildStageSkeleton(service);
    const setStage = (key, patch) => {
      const stage = stages.find((s) => s.key === key);
      if (stage) Object.assign(stage, patch);
    };
    const runningStage = () => stages.find((s) => s.status === 'running');

    run = await base44.entities.ServiceRun.create({
      service_slug: service.slug,
      service_name: service.name,
      status: 'running',
      current_stage: SPINE[0].name,
      current_stage_n: 1,
      input_sentence: sentence,
      steps_total: service.workflow.length,
      steps: service.workflow.map((s) => ({ n: s.n, name: s.name, status: 'pending', result: '', output: '' })),
      stages,
      deliverables: service.deliverables,
      requested_by_email: user.email,
    });

    const commit = async (extra = {}) => {
      const active = runningStage();
      const updated = await base44.entities.ServiceRun.update(run.id, {
        stages,
        current_stage: active ? active.name : SPINE[SPINE.length - 1].name,
        current_stage_n: active ? active.n : SPINE.length,
        ...extra,
      });
      run = updated;
      return updated;
    };

    const failRun = async (message) => {
      setStage('final_results', { status: 'failed', finished_at: CLOCK(), result: message });
      await commit({
        status: 'failed',
        verdict: 'failed',
        delivery_allowed: false,
        block_reason: message,
        error: message,
        duration_ms: Date.now() - startedAt,
        completed_at: CLOCK(),
      });
      return Response.json({ success: false, run_id: run.id, verdict: 'failed', block_reason: message, error: message });
    };

    // ── 1. PLAN — the brief of record ──
    setStage('plan', { status: 'running', started_at: CLOCK() });
    await commit();

    let enhanced = null;
    let promptStandard = 'standard-10';
    if (typeof body?.enhanced_prompt === 'string' && body.enhanced_prompt.trim()) {
      enhanced = { prompt: body.enhanced_prompt, standards_applied: [], open_questions: [] };
      promptStandard = 'operator-supplied';
    } else {
      try {
        const res = await base44.functions.invoke('enhanceServicePrompt', {
          sentence,
          service_slug: service.slug,
          surface: 'runServiceWorkflow',
          answers,
        });
        const data = res?.data || res;
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

    const enhancedPrompt = [enhanced.prompt, answers ? `OPERATOR'S ANSWER OF RECORD: ${answers}` : '']
      .filter(Boolean)
      .join('\n\n');
    const briefGaps = missingEnhancementSlots(enhanced);
    const openQuestions = (Array.isArray(enhanced.open_questions) ? enhanced.open_questions : []).filter(Boolean);

    setStage('plan', {
      status: 'done',
      finished_at: CLOCK(),
      result: condense([
        `Brief of record built against ${(enhanced.standards_applied || []).length} standards`,
        briefGaps.length ? `sections missing from the brief: ${briefGaps.join(', ')}` : 'every optimization slot filled',
        `objective: ${enhanced.objective || sentence}`,
      ]),
    });
    ['discovery', 'strategy', 'implementation'].forEach((key) =>
      setStage(key, { status: 'running', started_at: CLOCK() }),
    );
    await commit({
      enhanced_prompt: enhancedPrompt,
      prompt_standard: promptStandard,
      enhancement: { ...enhanced, stage_plan: enhanced.stage_plan || [], open_questions: openQuestions },
      decision_questions: openQuestions,
    });

    // ── 2-4. DISCOVERY · STRATEGY · IMPLEMENTATION — the producing pass ──
    let producer = null;
    try {
      const brief = buildProducerMessages(service, enhancedPrompt, sentence);
      producer = await base44.integrations.Core.InvokeLLM({
        prompt: `${brief.system}\n\n---\n\n${brief.user}`,
        response_json_schema: PRODUCER_SCHEMA,
        model: MODEL_FOR_ROLE.producer,
      });
    } catch (error) {
      console.error('[runServiceWorkflow] producer failed:', error?.message);
    }
    if (!producer || typeof producer !== 'object') {
      return await failRun('The producing agent did not return a usable result.');
    }

    let producerSteps = Array.isArray(producer.steps) ? producer.steps : [];
    let producerSummary = String(producer.producer_summary || '');
    let evidenceState = collectEvidence(producerSteps);
    composeWorkStages(stages, producerSteps);

    // A question the producing agent cannot answer from the brief is surfaced on
    // the finished result. It only stops the run when the agent states that no
    // honest work is possible without it — a target list or a legal basis it
    // would otherwise have to invent.
    const decision = producer.decision_required;
    const asked = [decision?.question, ...openQuestions].filter(Boolean);
    const assumptionNote = decision?.working_assumption
      ? `WORKING ASSUMPTION OF RECORD: ${decision.working_assumption}`
      : '';

    if (decision?.question && decision?.blocking === true) {
      await commit({
        producer_summary: producerSummary,
        decision_questions: asked,
        status: 'blocked',
        verdict: 'blocked',
        delivery_allowed: false,
        block_reason: `Needs your decision: ${decision.question}`,
        duration_ms: Date.now() - startedAt,
        completed_at: CLOCK(),
      });
      return Response.json({
        success: true, run_id: run.id, verdict: 'blocked',
        block_reason: `Needs your decision: ${decision.question}`,
        decision_questions: asked, needs_decision: true,
      });
    }

    const assuranceContext = () => ({
      sentence,
      enhancedPrompt: [enhancedPrompt, assumptionNote].filter(Boolean).join('\n\n'),
      producerSummary,
      producerSteps,
      stageResults: stages,
      evidence: evidenceState.evidence,
      unavailable: evidenceState.unavailable,
    });

    const separationOf = (assurance) => {
      const separation = computeModelSeparation([
        MODEL_FOR_ROLE.producer,
        assurance?.qa?.model || MODEL_FOR_ROLE.qa,
        assurance?.guardian?.model || MODEL_FOR_ROLE.guardian,
        assurance?.validator?.model || MODEL_FOR_ROLE.validator,
      ]);
      assurance.model_separation_ok = separation.ok;
      assurance.model_families = separation.families;
      return assurance;
    };

    // ── 5. VALIDATION — a separate model family ──
    setStage('validation', { status: 'running', started_at: CLOCK() });
    await commit({ producer_summary: producerSummary, evidence: evidenceState.evidence, unavailable_sources: evidenceState.unavailable });
    let assurance = { validator: await runReview(base44, service, 'validator', assuranceContext()) };
    setStage('validation', {
      status: 'done',
      finished_at: CLOCK(),
      result: condense([
        `scored ${assurance.validator.score ?? 0}/100`,
        `${(assurance.validator.unverified || []).length} claim(s) left unverified`,
        assurance.validator.notes || '',
      ]),
    });

    // ── 6. QA — the score and the refusal ──
    setStage('qa', { status: 'running', started_at: CLOCK() });
    await commit({ assurance: separationOf({ ...assurance }), status: 'assurance' });
    const [qaResult, guardianResult] = await Promise.all([
      runReview(base44, service, 'qa', assuranceContext()),
      runReview(base44, service, 'guardian', assuranceContext()),
    ]);
    assurance = separationOf({ ...assurance, qa: qaResult, guardian: guardianResult });
    setStage('qa', {
      status: 'done',
      finished_at: CLOCK(),
      result: condense([
        `QA ${assurance.qa.score ?? 0}/100`,
        assurance.guardian.allowed ? 'guardian permitted delivery' : `guardian refused: ${(assurance.guardian.blocks || [])[0] || 'grounds not stated'}`,
        (assurance.qa.failed_rules || []).length ? `failed rules: ${(assurance.qa.failed_rules || []).join(', ')}` : '',
      ]),
    });
    await commit({ assurance, evidence: evidenceState.evidence, unavailable_sources: evidenceState.unavailable });

    // ── 7. AUTO-RECOMMENDATION ──
    setStage('auto_recommendation', { status: 'running', started_at: CLOCK() });
    let recommendations = [];
    let risksToWatch = [];
    try {
      const recBrief = buildRecommendationMessages(service, {
        sentence,
        scored: scoreRun(producer, assurance, evaluateEvidence(evidenceState.evidence, evidenceState.unevidenced_steps, evidenceState.unavailable)),
        assurance,
        evidenceEval: evaluateEvidence(evidenceState.evidence, evidenceState.unevidenced_steps, evidenceState.unavailable),
        stageDigest: stageDigestOf(stages),
        iterations: [],
      });
      const rec = await base44.integrations.Core.InvokeLLM({
        prompt: `${recBrief.system}\n\n---\n\n${recBrief.user}`,
        response_json_schema: RECOMMENDATION_SCHEMA,
        model: MODEL_FOR_ROLE.qa,
      });
      recommendations = Array.isArray(rec?.recommendations) ? rec.recommendations : [];
      risksToWatch = Array.isArray(rec?.risks_to_watch) ? rec.risks_to_watch : [];
    } catch (error) {
      console.error('[runServiceWorkflow] recommendation failed:', error?.message);
    }
    setStage('auto_recommendation', {
      status: 'done',
      finished_at: CLOCK(),
      result: condense([
        `${recommendations.length} recommendation(s) for next time`,
        recommendations[0] || 'no recommendation returned',
      ]),
    });

    // ── 8. ITERATION — review, revise, review again, until QA clears ──
    setStage('iteration', { status: 'running', started_at: CLOCK() });
    const iterations = [];
    let iterationStop = '';
    const clears = (a) =>
      a?.guardian?.allowed !== false &&
      Number(a?.qa?.score || 0) >= 85 &&
      Number(a?.validator?.score || 0) >= 85;

    if (clears(assurance)) {
      iterationStop = 'QA cleared on the first pass — no iteration was needed.';
    } else {
      for (let n = 1; n <= cap; n += 1) {
        const qaBefore = Number(assurance?.qa?.score || 0);
        const enteredBecause = assurance?.guardian?.allowed === false
          ? `Guardian refused: ${(assurance.guardian.blocks || [])[0] || 'grounds not stated'}`
          : `QA scored ${qaBefore}, below the 85 gate.`;

        let revised = null;
        try {
          const revBrief = buildRevisionMessages(service, {
            sentence,
            enhancedPrompt,
            producerSummary,
            producerSteps,
            failedRules: assurance?.qa?.failed_rules || [],
            blocks: assurance?.guardian?.blocks || [],
            qaScore: qaBefore,
          });
          revised = await base44.integrations.Core.InvokeLLM({
            prompt: `${revBrief.system}\n\n---\n\n${revBrief.user}`,
            response_json_schema: REVISION_SCHEMA,
            model: MODEL_FOR_ROLE.producer,
          });
        } catch (error) {
          console.error(`[runServiceWorkflow] revision ${n} failed:`, error?.message);
        }

        if (!revised || !Array.isArray(revised.steps)) {
          iterations.push({ n, entered_because: enteredBecause, changed: [], qa_before: qaBefore, qa_after: qaBefore, guardian_allowed: assurance?.guardian?.allowed === true, result: 'the revision pass did not return usable work' });
          iterationStop = `Iteration ${n} could not produce a revision, so the loop stopped rather than repeating the same failure.`;
          break;
        }

        producerSteps = revised.steps;
        producerSummary = String(revised.producer_summary || producerSummary);
        evidenceState = collectEvidence(producerSteps);
        composeWorkStages(stages, producerSteps);

        assurance = separationOf({
          ...assurance,
          validator: await runReview(base44, service, 'validator', assuranceContext()),
          qa: await runReview(base44, service, 'qa', assuranceContext()),
          guardian: await runReview(base44, service, 'guardian', assuranceContext()),
        });

        const qaAfter = Number(assurance?.qa?.score || 0);
        iterations.push({
          n,
          entered_because: enteredBecause,
          changed: Array.isArray(revised.revisions_made) ? revised.revisions_made : [],
          qa_before: qaBefore,
          qa_after: qaAfter,
          guardian_allowed: assurance?.guardian?.allowed === true,
          result: clears(assurance) ? 'the gate cleared' : 'still below the gate',
        });
        await commit({ assurance, stages, evidence: evidenceState.evidence, unavailable_sources: evidenceState.unavailable, iterations });

        if (clears(assurance)) {
          iterationStop = `QA cleared on iteration ${n}.`;
          break;
        }
        if (assurance?.guardian?.allowed === false) {
          // A policy refusal is not something a revision can clear, so the loop
          // stops instead of burning passes on it.
          iterationStop = `The guardian refused on grounds a revision cannot clear, so the loop stopped at iteration ${n}.`;
          break;
        }
        if (n === cap) {
          iterationStop = `The cap of ${cap} iteration(s) was reached with QA still at ${qaAfter}, below the 85 gate.`;
        }
      }
    }

    setStage('iteration', {
      status: 'done',
      finished_at: CLOCK(),
      result: condense([
        `${iterations.length} pass(es) after the first review`,
        iterationStop || 'stopped without a stated reason',
        iterations.length ? `QA moved ${iterations[0].qa_before} to ${iterations[iterations.length - 1].qa_after}` : '',
      ]),
    });

    // ── 9. FINAL RESULTS ──
    const evaluation = evaluateEvidence(evidenceState.evidence, evidenceState.unevidenced_steps, evidenceState.unavailable);
    const scored = scoreRun(producer, assurance, { ...evaluation, unavailable: evidenceState.unavailable });

    const steps = service.workflow.map((s) => {
      const claimed = producerSteps.find((p) => Number(p?.n) === s.n);
      const status = claimed?.status === 'done' ? 'done' : claimed ? 'failed' : 'skipped';
      return {
        n: s.n,
        name: s.name,
        status,
        result: claimed?.result || s.result,
        output: claimed?.output || '',
      };
    });

    setStage('final_results', {
      status: scored.verdict === 'failed' ? 'failed' : 'done',
      finished_at: CLOCK(),
      result: condense([
        `${scored.verdict} at ${scored.overall_score}/100`,
        scored.delivery_allowed ? 'delivery permitted' : scored.block_reason,
      ]),
    });

    const providerAgent = agentForRole(service, 'producer');
    const finalStatus = scored.verdict === 'delivered'
      ? 'delivered'
      : scored.verdict === 'conditional'
        ? 'conditional'
        : scored.verdict === 'blocked'
          ? 'blocked'
          : 'failed';

    const updated = await commit({
      status: finalStatus,
      verdict: scored.verdict,
      overall_score: scored.overall_score,
      delivery_allowed: scored.delivery_allowed,
      block_reason: scored.block_reason,
      evidence_status: evaluation.status,
      evidence: evidenceState.evidence,
      unavailable_sources: evidenceState.unavailable,
      iterations,
      iteration_stop_reason: iterationStop,
      recommendations,
      risks_to_watch: risksToWatch,
      steps,
      steps_completed: scored.steps_done,
      producer_summary: producerSummary,
      assurance,
      monitoring: {
        signals: [
          { key: 'step_completion', value: scored.step_completion },
          { key: 'qa_score', value: Number(assurance?.qa?.score) || 0 },
          { key: 'validator_score', value: Number(assurance?.validator?.score) || 0 },
          { key: 'guardian_allowed', value: assurance?.guardian?.allowed === true },
          { key: 'evidence_live_verified', value: evaluation.verified_live },
          { key: 'iterations', value: iterations.length },
        ],
        alerts: scored.alerts,
      },
      duration_ms: Date.now() - startedAt,
      completed_at: CLOCK(),
      notes: providerAgent ? `Produced by ${providerAgent.name} (${providerAgent.specialty}).` : '',
    });

    return Response.json({
      success: true,
      run_id: run.id,
      service: { slug: service.slug, name: service.name, steps: service.workflow.length },
      prompt_standard: promptStandard,
      verdict: scored.verdict,
      overall_score: scored.overall_score,
      delivery_allowed: scored.delivery_allowed,
      block_reason: scored.block_reason,
      decision_questions: asked,
      evidence_status: evaluation.status,
      iterations: iterations.length,
      iteration_stop_reason: iterationStop,
      alerts: scored.alerts,
      run: updated,
    });
  } catch (error) {
    console.error('[runServiceWorkflow] failed:', error?.message);
    if (run && base44Ref) {
      try {
        await base44Ref.entities.ServiceRun.update(run.id, {
          status: 'failed',
          verdict: 'failed',
          error: String(error?.message || 'unknown error'),
          block_reason: String(error?.message || 'unknown error'),
          duration_ms: Date.now() - startedAt,
          completed_at: CLOCK(),
        });
      } catch (nested) {
        console.error('[runServiceWorkflow] could not record failure:', nested?.message);
      }
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Re-runs ONE stage on a run that already exists, which is how the operator
 * presses a control on a single step instead of paying for the whole service
 * again. Re-running Implementation invalidates the reviews that judged it, so
 * they are returned to pending rather than left standing over changed work.
 */
async function rerunStage(base44, body) {
  const run = await base44.entities.ServiceRun.get(body.run_id);
  if (!run) {
    return Response.json({ error: 'Run not found.' }, { status: 404 });
  }
  const { service, error: resolveError } = resolveRunnableService(run.service_slug);
  if (!service) {
    return Response.json({ error: resolveError }, { status: 400 });
  }

  const key = String(body.only_stage);
  const stages = Array.isArray(run.stages) && run.stages.length === SPINE.length
    ? run.stages
    : buildStageSkeleton(service);
  const stage = stages.find((s) => s.key === key);
  if (!stage) {
    return Response.json({ error: `Unknown stage: ${key}. Expected one of ${SPINE.map((s) => s.key).join(', ')}.` }, { status: 400 });
  }

  const sentence = run.input_sentence || '';
  const enhancedPrompt = run.enhanced_prompt || '';
  let producerSteps = Array.isArray(run.steps) ? run.steps : [];
  let producerSummary = run.producer_summary || '';
  let assurance = run.assurance || {};
  let evidenceState = collectEvidence(producerSteps);
  let refreshedRecommendations = run.recommendations || [];
  let refreshedRisks = run.risks_to_watch || [];

  const context = () => ({
    sentence,
    enhancedPrompt,
    producerSummary,
    producerSteps,
    stageResults: stages,
    evidence: evidenceState.evidence.length ? evidenceState.evidence : run.evidence || [],
    unavailable: evidenceState.unavailable.length ? evidenceState.unavailable : run.unavailable_sources || [],
  });

  const requested = key;
  stage.status = 'running';
  stage.started_at = CLOCK();
  await base44.entities.ServiceRun.update(run.id, { stages, current_stage: stage.name, current_stage_n: stage.n, status: 'running' });

  if (requested === 'implementation') {
    try {
      const brief = buildProducerMessages(service, enhancedPrompt, sentence);
      const produced = await base44.integrations.Core.InvokeLLM({
        prompt: `${brief.system}\n\n---\n\n${brief.user}`,
        response_json_schema: PRODUCER_SCHEMA,
        model: MODEL_FOR_ROLE.producer,
      });
      if (produced && Array.isArray(produced.steps)) {
        producerSteps = produced.steps;
        producerSummary = String(produced.producer_summary || producerSummary);
        evidenceState = collectEvidence(producerSteps);
      }
    } catch (error) {
      console.error('[runServiceWorkflow] stage re-run failed:', error?.message);
    }
    composeWorkStages(stages, producerSteps);
    // The reviews judged the previous work, so they no longer stand.
    ['validation', 'qa', 'auto_recommendation', 'iteration', 'final_results'].forEach((k) => {
      const s = stages.find((x) => x.key === k);
      if (s) {
        s.status = 'pending';
        s.result = '';
        s.skipped_reason = 'Implementation was re-run; this stage must run again on the new work.';
      }
    });
    stage.status = 'done';
    stage.finished_at = CLOCK();
    return Response.json({
      success: true,
      run_id: run.id,
      stage: stage.name,
      stages,
      verdict: 'blocked',
      block_reason: 'Implementation was re-run, so the reviews no longer stand. Run Validation and QA again before any delivery.',
      run: await base44.entities.ServiceRun.update(run.id, {
        stages,
        steps: producerSteps.map((p) => ({ n: p.n, name: p.name, status: p.status, result: p.result || '', output: p.output || '' })),
        producer_summary: producerSummary,
        evidence: evidenceState.evidence,
        unavailable_sources: evidenceState.unavailable,
        status: 'blocked',
        verdict: 'blocked',
        delivery_allowed: false,
        block_reason: 'Implementation was re-run, so the reviews no longer stand. Run Validation and QA again before any delivery.',
      }),
    });
  }

  // A review stage, re-run on the work already on the record.
  if (requested === 'validation' || requested === 'qa' || requested === 'auto_recommendation') {
    if (requested === 'validation') {
      assurance = { ...assurance, validator: await runReview(base44, service, 'validator', context()) };
      stage.result = condense([`scored ${assurance.validator?.score ?? 0}/100`, `${(assurance.validator?.unverified || []).length} claim(s) left unverified`]);
    }
    if (requested === 'qa') {
      const [qaResult, guardianResult] = await Promise.all([
        runReview(base44, service, 'qa', context()),
        runReview(base44, service, 'guardian', context()),
      ]);
      assurance = { ...assurance, qa: qaResult, guardian: guardianResult };
      stage.result = condense([
        `QA ${assurance.qa?.score ?? 0}/100`,
        assurance.guardian?.allowed ? 'guardian permitted delivery' : `guardian refused: ${(assurance.guardian?.blocks || [])[0] || 'grounds not stated'}`,
      ]);
    }
    if (requested === 'auto_recommendation') {
      try {
        const recBrief = buildRecommendationMessages(service, {
          sentence,
          scored: scoreRun({ steps: producerSteps }, assurance, evaluateEvidence(evidenceState.evidence, evidenceState.unevidenced_steps, evidenceState.unavailable)),
          assurance,
          evidenceEval: evaluateEvidence(evidenceState.evidence, evidenceState.unevidenced_steps, evidenceState.unavailable),
          stageDigest: stageDigestOf(stages),
          iterations: run.iterations || [],
        });
        const rec = await base44.integrations.Core.InvokeLLM({
          prompt: `${recBrief.system}\n\n---\n\n${recBrief.user}`,
          response_json_schema: RECOMMENDATION_SCHEMA,
          model: MODEL_FOR_ROLE.qa,
        });
        refreshedRecommendations = Array.isArray(rec?.recommendations) ? rec.recommendations : refreshedRecommendations;
        refreshedRisks = Array.isArray(rec?.risks_to_watch) ? rec.risks_to_watch : refreshedRisks;
        stage.result = condense([`${(refreshedRecommendations || []).length} recommendation(s)`, (refreshedRecommendations || [])[0] || '']);
      } catch (error) {
        console.error('[runServiceWorkflow] recommendation re-run failed:', error?.message);
      }
    }
    stage.status = 'done';
    stage.finished_at = CLOCK();

    const evaluation = evaluateEvidence(evidenceState.evidence, evidenceState.unevidenced_steps, evidenceState.unavailable);
    const scored = scoreRun({ steps: producerSteps }, assurance, { ...evaluation, unavailable: evidenceState.unavailable });

    return Response.json({
      success: true,
      run_id: run.id,
      stage: stage.name,
      stages,
      verdict: scored.verdict,
      block_reason: scored.block_reason,
      run: await base44.entities.ServiceRun.update(run.id, {
        stages,
        assurance,
        status: scored.verdict === 'delivered' ? 'delivered' : scored.verdict === 'conditional' ? 'conditional' : scored.verdict === 'blocked' ? 'blocked' : 'failed',
        verdict: scored.verdict,
        overall_score: scored.overall_score,
        delivery_allowed: scored.delivery_allowed,
        block_reason: scored.block_reason,
        evidence_status: evaluation.status,
        recommendations: refreshedRecommendations,
        risks_to_watch: refreshedRisks,
      }),
    });
  }

  // A non-review stage: recompute the verdict from what is already recorded.
  stage.status = 'done';
  stage.finished_at = CLOCK();
  const evaluation = evaluateEvidence(evidenceState.evidence, evidenceState.unevidenced_steps, evidenceState.unavailable);
  const scored = scoreRun({ steps: producerSteps }, assurance, { ...evaluation, unavailable: evidenceState.unavailable });
  return Response.json({
    success: true,
    run_id: run.id,
    stage: stage.name,
    stages,
    verdict: scored.verdict,
    block_reason: scored.block_reason,
    run: await base44.entities.ServiceRun.update(run.id, {
      stages,
      status: scored.verdict === 'delivered' ? 'delivered' : scored.verdict === 'conditional' ? 'conditional' : 'blocked',
      verdict: scored.verdict,
      overall_score: scored.overall_score,
      delivery_allowed: scored.delivery_allowed,
      block_reason: scored.block_reason,
    }),
  });
}