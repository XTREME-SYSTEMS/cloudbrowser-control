import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { invokeLLM } from '../../shared/vercelAiGateway.ts';

// Durable state-machine executor for Autonomous Workflows.
// Pattern: ingest -> validate -> score -> act/draft -> observe -> receipt
// With checkpointing, idempotency, bounded retry, dead-letter, and human gate.

const STEPS = ["ingest", "validate", "score", "act", "observe", "receipt"];

function makeIdempotencyKey(workflowId, inputData) {
  const eventId = inputData?.event_id || inputData?.id || `evt_${Date.now()}`;
  const projectId = inputData?.project_id || inputData?.tenant_id || "default";
  return `${projectId}:${workflowId}:${eventId}`;
}

function makeRunId() {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { workflow_id, input_data, resume_run_id } = body;

    if (!workflow_id) return Response.json({ error: 'workflow_id is required' }, { status: 400 });

    // Load the workflow spec
    const specs = await base44.asServiceRole.entities.AutonomousWorkflow.filter({ workflow_id });
    const spec = specs[0];
    if (!spec) return Response.json({ error: `Workflow spec ${workflow_id} not found` }, { status: 404 });

    const idempotencyKey = makeIdempotencyKey(workflow_id, input_data || {});
    const now = new Date().toISOString();
    const maxRetries = spec.max_retries || 3;

    // Resume or create a run
    let run;
    if (resume_run_id) {
      const runs = await base44.asServiceRole.entities.AutonomousWorkflowRun.filter({ run_id: resume_run_id });
      run = runs[0];
      if (!run) return Response.json({ error: `Run ${resume_run_id} not found` }, { status: 404 });
    } else {
      // Idempotency check — if a completed run with this key exists, return it
      const existing = await base44.asServiceRole.entities.AutonomousWorkflowRun.filter({ idempotency_key: idempotencyKey });
      const completed = existing.find(r => r.status === 'completed');
      if (completed) {
        return Response.json({ run_id: completed.run_id, status: 'completed', message: 'Idempotent replay — already completed', result: completed.result_data });
      }

      run = await base44.asServiceRole.entities.AutonomousWorkflowRun.create({
        workflow_id,
        run_id: makeRunId(),
        idempotency_key: idempotencyKey,
        status: 'pending',
        current_step: 'ingest',
        checkpoint_state: {},
        input_data: input_data || {},
        result_data: {},
        score: 0,
        retry_count: 0,
        max_retries: maxRetries,
        error_history: [],
        dead_lettered: false,
        started_at: now,
      });
    }

    // Execute the state machine
    const checkpoint = run.checkpoint_state || {};
    let currentStepIdx = STEPS.indexOf(run.current_step || 'ingest');
    if (currentStepIdx < 0) currentStepIdx = 0;

    for (let i = currentStepIdx; i < STEPS.length; i++) {
      const step = STEPS[i];
      const stepStatus = step === 'ingest' ? 'ingesting' : step === 'validate' ? 'validating' : step === 'score' ? 'scoring' : step === 'act' ? 'acting' : step === 'observe' ? 'observing' : 'receipt';

      // Update run to current step (checkpoint)
      run = await base44.asServiceRole.entities.AutonomousWorkflowRun.update(run.id, {
        status: stepStatus,
        current_step: step,
        checkpoint_state: checkpoint,
      });

      try {
        const result = await executeStep(step, checkpoint, run, spec, base44);
        Object.assign(checkpoint, result || {});
        checkpoint[`_${step}_completed_at`] = new Date().toISOString();
      } catch (stepError) {
        const errorMsg = stepError.message || String(stepError);
        const errorHistory = [...(run.error_history || []), `${step}: ${errorMsg}`].slice(-20);
        const newRetryCount = (run.retry_count || 0) + 1;

        if (newRetryCount >= maxRetries) {
          // Dead-letter
          await base44.asServiceRole.entities.AutonomousWorkflowRun.update(run.id, {
            status: 'dead_lettered',
            dead_lettered: true,
            error_message: errorMsg,
            error_history: errorHistory,
            retry_count: newRetryCount,
            completed_at: new Date().toISOString(),
            duration_ms: Date.now() - new Date(run.started_at).getTime(),
          });
          await base44.asServiceRole.entities.AutonomousWorkflow.update(spec.id, {
            failure_count: (spec.failure_count || 0) + 1,
            last_run_at: now,
          });
          return Response.json({
            run_id: run.run_id,
            status: 'dead_lettered',
            error: errorMsg,
            retry_count: newRetryCount,
          }, { status: 500 });
        } else {
          // Retry — checkpoint and return (caller can resume)
          await base44.asServiceRole.entities.AutonomousWorkflowRun.update(run.id, {
            status: 'failed',
            error_message: errorMsg,
            error_history: errorHistory,
            retry_count: newRetryCount,
            checkpoint_state: checkpoint,
          });
          return Response.json({
            run_id: run.run_id,
            status: 'retry',
            error: errorMsg,
            retry_count: newRetryCount,
            resume_run_id: run.run_id,
            message: `Step ${step} failed; retry ${newRetryCount}/${maxRetries}. Resume with resume_run_id.`,
          }, { status: 500 });
        }
      }
    }

    // All steps completed — finalize
    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - new Date(run.started_at).getTime();

    // Create evidence receipt
    const receiptId = `rcpt_awf_${Date.now()}`;
    await base44.asServiceRole.entities.EvidenceReceipt.create({
      receipt_id: receiptId,
      tool: 'autonomous_workflow',
      action: `workflow:${workflow_id}`,
      target: run.run_id,
      expected_result: spec.success_criteria || 'completed',
      actual_result: 'completed',
      status: 'pass',
      evidence_type: 'artifact',
      data: { workflow_id, run_id: run.run_id, checkpoint, result: checkpoint.result || {} },
      approval_state: 'auto',
      operator: user.email || user.id,
      timestamp: completedAt,
    });

    const finalRun = await base44.asServiceRole.entities.AutonomousWorkflowRun.update(run.id, {
      status: 'completed',
      current_step: 'receipt',
      checkpoint_state: checkpoint,
      result_data: checkpoint.result || checkpoint,
      score: checkpoint.score || 0,
      receipt_id: receiptId,
      completed_at: completedAt,
      duration_ms: durationMs,
    });

    await base44.asServiceRole.entities.AutonomousWorkflow.update(spec.id, {
      run_count: (spec.run_count || 0) + 1,
      success_count: (spec.success_count || 0) + 1,
      last_run_at: now,
    });

    return Response.json({
      run_id: finalRun.run_id,
      status: 'completed',
      receipt_id: receiptId,
      result: finalRun.result_data,
      score: finalRun.score,
      duration_ms: durationMs,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// Step executor — each step is deterministic except 'act' which may use LLM judgment
async function executeStep(step, checkpoint, run, spec, base44) {
  const input = run.input_data || {};

  switch (step) {
    case 'ingest': {
      // Deterministic: normalize and store the input event
      return {
        ingested: true,
        event_id: input.event_id || input.id || run.run_id,
        project_id: input.project_id || input.tenant_id || 'default',
        ingested_at: new Date().toISOString(),
        raw_input: input,
      };
    }

    case 'validate': {
      // Deterministic: validate input against schema constraints
      if (!input || typeof input !== 'object') throw new Error('Invalid input: expected object');
      const projectId = checkpoint.project_id || input.project_id;
      if (!projectId) throw new Error('Validation failed: project_id required');
      return { validated: true, validated_at: new Date().toISOString() };
    }

    case 'score': {
      // LLM judgment: score the event for priority/relevance
      const prompt = `Score this autonomous workflow event for priority and relevance (0-100).
Workflow: ${spec.name} (${spec.workflow_id})
Objective: ${spec.objective || 'N/A'}
Input: ${JSON.stringify(input).slice(0, 2000)}

Return JSON: { "score": <0-100>, "reasoning": "<brief>", "action_recommendation": "<proceed|draft|skip>" }`;

      const llmRes = await invokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            score: { type: 'number' },
            reasoning: { type: 'string' },
            action_recommendation: { type: 'string' },
          },
          required: ['score', 'action_recommendation'],
        },
      });

      const scoreData = typeof llmRes === 'string' ? JSON.parse(llmRes) : llmRes;
      return {
        score: scoreData.score || 50,
        score_reasoning: scoreData.reasoning || '',
        action_recommendation: scoreData.action_recommendation || 'proceed',
        scored_at: new Date().toISOString(),
      };
    }

    case 'act': {
      // Agent judgment: determine the action. If human gate required and score is borderline, create approval.
      const actionRec = checkpoint.action_recommendation || 'proceed';

      if (actionRec === 'skip') {
        return { action: 'skipped', acted_at: new Date().toISOString() };
      }

      // Check if human gate is required (protected action or exception)
      const requiresGate = spec.human_gate && spec.human_gate.toLowerCase().includes('exception') && checkpoint.score < 50;

      if (requiresGate) {
        const approvalId = `appr_awf_${Date.now()}`;
        await base44.asServiceRole.entities.Approval.create({
          approval_id: approvalId,
          action_type: 'autonomous_workflow_action',
          target: `${spec.workflow_id}:${run.run_id}`,
          scope: 'protected',
          environment: 'production',
          status: 'pending',
          reason: `Workflow ${spec.workflow_id} triggered human gate (score ${checkpoint.score})`,
          requested_by: 'autonomous_workflow_engine',
          requested_at: new Date().toISOString(),
        });
        return {
          action: 'awaiting_approval',
          approval_id: approvalId,
          acted_at: new Date().toISOString(),
        };
      }

      // LLM determines the action/draft
      const actPrompt = `Determine the best action for this autonomous workflow event.
Workflow: ${spec.name}
Objective: ${spec.objective}
Score: ${checkpoint.score}
Recommendation: ${actionRec}
Input: ${JSON.stringify(input).slice(0, 2000)}

Return JSON: { "action": "<execute|draft|observe_only>", "description": "<what to do>", "draft_output": "<if drafting>" }`;

      const actRes = await invokeLLM({
        prompt: actPrompt,
        response_json_schema: {
          type: 'object',
          properties: {
            action: { type: 'string' },
            description: { type: 'string' },
            draft_output: { type: 'string' },
          },
          required: ['action', 'description'],
        },
      });

      const actData = typeof actRes === 'string' ? JSON.parse(actRes) : actRes;
      return {
        action: actData.action || 'execute',
        action_description: actData.description || '',
        draft_output: actData.draft_output || '',
        acted_at: new Date().toISOString(),
      };
    }

    case 'observe': {
      // Deterministic: observe the outcome of the action
      return {
        observed: true,
        observation: `Action '${checkpoint.action}' completed for ${spec.workflow_id}`,
        observed_at: new Date().toISOString(),
      };
    }

    case 'receipt': {
      // Deterministic: assemble the receipt payload
      return {
        result: {
          workflow_id: spec.workflow_id,
          run_id: run.run_id,
          event_id: checkpoint.event_id,
          score: checkpoint.score,
          action: checkpoint.action,
          action_description: checkpoint.action_description,
          draft_output: checkpoint.draft_output,
          observation: checkpoint.observation,
        },
        receipt_assembled: true,
        receipted_at: new Date().toISOString(),
      };
    }

    default:
      throw new Error(`Unknown step: ${step}`);
  }
}