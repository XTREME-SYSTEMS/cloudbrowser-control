import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { DEPLOYMENT_VERSION } from '../../shared/deploymentVersion.ts';
import {
  POLICY_VERSION,
  GUARDIAN_MODEL,
  VALIDATOR_MODEL,
  classify,
  policyDigest,
} from '../../shared/openClawPolicy.ts';
import { observeFleet, observeMachine, diagnose } from '../../shared/openClawDiagnose.ts';
import { runDeviceCommand, deviceStatus } from '../../shared/desktopCommanderBridge.ts';
import { reclaimTempCommand, restartCommand, gatewayProbeCommand, parseGatewayProbe } from '../../shared/openClawMachine.ts';

// The OpenClaw autonomy cycle.
//
// One run: observe the platform and the paired machine, propose repairs, let the
// guardian gate them, apply what is automatic, verify the result independently, and
// record the whole thing. Three rules shape the code:
//
// 1. The catalogue is the ceiling. Repairs come only from shared/openClawPolicy.ts
//    and are matched by id; the model review that follows may refuse one, never
//    admit one the catalogue excludes. A failed review fails CLOSED: nothing it
//    could not review is applied.
// 2. The producer never certifies its own work. Every claim is re-measured after
//    the repair, and a different model than the guardian then rules on whether the
//    evidence proves it. A claim without a fresh measurement is not verifiable.
// 3. Refusals are recorded. A repair that was not made is written down with its
//    reason, so silence never looks like approval.

const HISTORY = 12;
const OVERLAP_GUARD_MS = 90 * 1000;

const GUARDIAN_SCHEMA = {
  type: 'object',
  properties: {
    decisions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          action: { type: 'string' },
          allow: { type: 'boolean' },
          reason: { type: 'string' },
        },
        required: ['action', 'allow', 'reason'],
      },
    },
    escalations: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
  },
  required: ['decisions'],
};

const VALIDATOR_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['verified', 'partly_verified', 'unproven'] },
    judgements: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          claim: { type: 'string' },
          proved: { type: 'boolean' },
          why: { type: 'string' },
        },
        required: ['claim', 'proved', 'why'],
      },
    },
    notes: { type: 'string' },
  },
  required: ['verdict', 'judgements'],
};

const SETTINGS = {
  'openclaw.enabled': 'true',
  'openclaw.platform_autofix': 'true',
};

function shorten(value, max = 1200) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/**
 * The device description the console needs. The raw view carries all 29 advertised
 * tools with their full descriptions, which is far too much to send with every
 * cycle — the pairing page owns that detail.
 */
function deviceSummary(device) {
  return {
    paired: Boolean(device?.paired),
    connected: Boolean(device?.connected),
    ready: Boolean(device?.ready),
    status: device?.status || "none",
    device_name: device?.device_name || null,
    tool_count: device?.tool_count || 0,
    last_used_at: device?.last_used_at || null,
  };
}

async function settingValue(base44, key, fallback) {
  const rows = await base44.asServiceRole.entities.Setting.filter({ setting_key: key });
  const value = rows[0]?.effective_value;
  return value === undefined || value === null || value === '' ? fallback : value;
}

async function currentSettings(base44) {
  const enabled = (await settingValue(base44, 'openclaw.enabled', 'true')) === 'true';
  const platformAutofix = (await settingValue(base44, 'openclaw.platform_autofix', 'true')) === 'true';
  return { enabled, platform_autofix: platformAutofix };
}

async function writeSetting(base44, key, value, reason) {
  const rows = await base44.asServiceRole.entities.Setting.filter({ setting_key: key });
  const payload = {
    desired_value: value,
    effective_value: value,
    apply_status: 'applied',
    changed_at: new Date().toISOString(),
    change_reason: reason,
  };
  if (rows.length) {
    await base44.asServiceRole.entities.Setting.update(rows[0].id, payload);
  } else {
    await base44.asServiceRole.entities.Setting.create({ setting_key: key, category: 'system', scope_type: 'platform', ...payload });
  }
  return value;
}

/** The guardian's model review. Its answer may only remove authority, never add it. */
async function runGuardianReview(base44, { problems, decisions, proposals }) {
  const prompt = [
    'You are the guardian of an autonomous repair system for a browser-automation platform and the operator\'s own machine.',
    'Your only power is to NARROW: you may refuse an action the policy already allows. You may never allow one the policy refused, and the policy is not yours to reinterpret.',
    '',
    'Repairs proposed, with why each was proposed:',
    JSON.stringify(proposals.map((p) => ({ action: p.action, target: p.target, why_proposed: p.proposed_because }))),
    'Deterministic policy verdict already applied:',
    JSON.stringify(decisions.map((d) => ({ action: d.id, risk: d.risk, allowed: d.allowed, requires_approval: d.requires_approval, policy_reason: d.reason }))),
    'What is actually wrong right now, as recorded:',
    JSON.stringify(problems),
    '',
    'For every proposed action decide allow true or false, with the concrete reason. Refuse when the evidence does not support the repair, when the reading could be stale or partial, when the cause looks different from the one proposed, or when the repair risks a live browser session, a running job or the operator\'s assistant. When in doubt, refuse: a refusal costs nothing and can be revisited, an unnecessary restart cannot be undone.',
    'Also list anything only a human can decide.',
    'Answer with JSON only.',
  ].join('\n');

  try {
    const review = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      model: GUARDIAN_MODEL,
      response_json_schema: GUARDIAN_SCHEMA,
    });
    return { ok: true, review };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

/** Apply the review as a one-way filter: allow=false removes, allow=true never adds. */
function narrowWithReview(decisions, review) {
  const verdicts = new Map((review?.decisions || []).map((entry) => [entry.action, entry]));
  return decisions.map((decision) => {
    const verdict = verdicts.get(decision.id);
    if (!verdict || verdict.allow !== false) return decision;
    if (!decision.allowed && !decision.requires_approval) return decision;
    return {
      ...decision,
      allowed: false,
      requires_approval: false,
      blocked: true,
      refused_by: 'guardian_model',
      reason: verdict.reason || 'The guardian refused this repair.',
    };
  });
}

/** An approval is queued with the exact command it would run, or it is not queued. */
function prepareApproval(decision, machine) {
  const approval = {
    id: `${decision.id}-${Date.now()}`,
    action: decision.id,
    label: decision.label,
    target: decision.target || decision.target_type,
    risk: decision.risk,
    reason: decision.reason,
    command: null,
    command_source: null,
    requested_at: new Date().toISOString(),
    status: 'pending',
  };
  if (decision.executor !== 'device') return approval;
  if (decision.id === 'machine.gateway_restart') {
    approval.command = restartCommand(machine);
    approval.command_source = 'the start mechanism discovered on the machine';
  } else {
    approval.command = reclaimTempCommand();
    approval.command_source = 'the fixed command in openClawMachine.ts';
  }
  return approval;
}

async function applyAction(base44, decision, machine) {
  const started_at = new Date().toISOString();
  const base = {
    id: decision.id,
    label: decision.label,
    target: decision.target || decision.target_type,
    risk: decision.risk,
    executor: decision.executor,
    operator_approved: Boolean(decision.operator_approved),
    started_at,
  };

  try {
    if (decision.executor === 'function') {
      const response = await base44.asServiceRole.functions.invoke(decision.function_name, {});
      const data = response?.data ?? response ?? {};
      const summary = data?.summary
        ? `${data.summary.healed ?? 0} of ${data.summary.total_actions ?? 0} repairs reported success by ${decision.function_name}`
        : `${decision.function_name} completed`;
      return { ...base, status: 'applied', summary, raw: shorten(data), finished_at: new Date().toISOString() };
    }

    if (decision.executor === 'device') {
      const command = decision.id === 'machine.gateway_restart' ? restartCommand(machine) : reclaimTempCommand();
      if (!command) {
        return {
          ...base,
          status: 'refused',
          command: null,
          summary: 'Refused: the restart mechanism was not discovered on the machine, so a restart could leave the assistant down.',
          finished_at: new Date().toISOString(),
        };
      }
      const result = await runDeviceCommand(base44, command, { timeoutMs: 30000 });
      return {
        ...base,
        status: result.ok ? 'applied' : 'failed',
        command,
        summary: result.ok
          ? `Ran on ${result.device_name || 'the paired machine'}${result.partial ? ' (the reading came back partial)' : ''}.`
          : 'The command did not complete cleanly on the machine.',
        raw: shorten(result.text),
        finished_at: new Date().toISOString(),
      };
    }

    return { ...base, status: 'failed', summary: `No executor is registered for ${decision.id}.`, finished_at: new Date().toISOString() };
  } catch (error) {
    return { ...base, status: 'failed', summary: `Failed: ${error.message}`, finished_at: new Date().toISOString() };
  }
}

async function runValidatorVerdict(base44, { actions, checks }) {
  const prompt = [
    'You are the validator for an autonomous repair system. You did not perform these repairs and you must not trust the summary. You are a different model from the guardian.',
    'Judge only whether the recorded evidence proves each claim. Every reading below was taken AFTER the repair and separately from the reading that triggered it.',
    '',
    'Repairs that were applied:',
    JSON.stringify(actions.map((action) => ({ action: action.id, target: action.target, status: action.status, summary: action.summary }))),
    'Claims and their re-measured evidence:',
    JSON.stringify(checks),
    '',
    'For each claim answer proved true or false with the reason. A repair recorded as applied is not evidence that it worked; a health endpoint answering is not evidence that browsers launch. Never round an unproven claim up because the system looks healthy now.',
    'Then give one overall verdict: verified (every claim proved), partly_verified (some proved), unproven (none proved or the evidence is missing). Say plainly what still needs a human or another cycle.',
    'Answer with JSON only.',
  ].join('\n');

  try {
    const out = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      model: VALIDATOR_MODEL,
      response_json_schema: VALIDATOR_SCHEMA,
    });
    const judgements = new Map((out?.judgements || []).map((entry) => [entry.claim, entry]));
    const allProved = checks.length > 0 && checks.every((check) => check.passed && judgements.get(check.claim)?.proved !== false);
    const anyProved = checks.some((check) => check.passed);
    return {
      verdict: allProved ? 'verified' : anyProved ? 'partly_verified' : 'unproven',
      judgements,
      notes: out?.notes || '',
    };
  } catch (error) {
    return {
      verdict: 'unproven',
      judgements: new Map(),
      notes: `The independent review could not be completed (${error.message}), so nothing from this cycle is counted as verified.`,
    };
  }
}

/** Re-measure every claim after the repair, then have it judged independently. */
async function validateOutcome(base44, { actions, fleet, machine }) {
  const applied = actions.filter((action) => action.status === 'applied');
  if (!applied.length) {
    return {
      model: null,
      verdict: 'not_needed',
      independent: false,
      checks: [],
      notes: 'Nothing was applied, so there was nothing to verify.',
    };
  }

  const checks = [];
  if (applied.some((action) => action.executor === 'function')) {
    const after = await observeFleet(base44);
    const beforeBad = (fleet?.engines || []).filter((engine) => !engine.serving).length;
    const afterBad = (after.engines || []).filter((engine) => !engine.serving).length;
    checks.push({
      claim: 'Every engine that was not serving browser work serves it again.',
      method: 'A fresh engine probe taken after the repair, not the reading that triggered it.',
      before: `${beforeBad} engine(s) not serving`,
      after: `${afterBad} engine(s) not serving`,
      passed: afterBad === 0,
    });
    const beforeFailed = fleet?.railway?.failed?.length ?? null;
    const afterFailed = after.railway?.failed?.length ?? null;
    if (beforeFailed !== null && afterFailed !== null) {
      checks.push({
        claim: 'No Railway service is left with a failed deployment.',
        method: 'A fresh project read taken after the repair.',
        before: `${beforeFailed} failed deployment(s)`,
        after: `${afterFailed} failed deployment(s)`,
        passed: afterFailed === 0,
      });
    }
  }

  if (applied.some((action) => action.executor === 'device')) {
    const after = await observeMachine(base44);
    const gateway = after?.gateway || {};
    checks.push({
      claim: 'The OpenClaw gateway is running and answers live on the machine.',
      method: 'A fresh device probe: process, health endpoint and port binding re-read after the command.',
      before: machine?.gateway?.health_ok ? 'live' : 'not live',
      after: gateway.running && gateway.health_ok ? 'live' : 'not live',
      passed: Boolean(gateway.running && gateway.health_ok),
    });
  }

  const verdict = await runValidatorVerdict(base44, { actions: applied, checks });

  return {
    model: VALIDATOR_MODEL,
    verdict: verdict.verdict,
    independent: true,
    checks: checks.map((check) => ({ ...check, judged: verdict.judgements.get(check.claim) || null })),
    notes: verdict.notes,
  };
}

async function runCycle(base44, user, triggeredBy, { onlyAction = null } = {}) {
  const started = Date.now();
  const cycleId = `oc-${started}`;
  const scheduled = triggeredBy === 'schedule';

  const settings = await currentSettings(base44);
  if (scheduled && !settings.enabled) {
    return { skipped: true, cycle_id: cycleId, message: 'OpenClaw autonomy is switched off, so the scheduled cycle did not run.' };
  }

  // Two cycles at once would apply the same repair twice. The scheduled path waits
  // for the previous one; an explicit request never waits.
  if (scheduled) {
    const recent = await base44.asServiceRole.entities.OpenClawCycle.list('-created_date', 1);
    const last = Array.isArray(recent) ? recent[0] : recent?.items?.[0];
    if (last?.created_date && started - new Date(last.created_date).getTime() < OVERLAP_GUARD_MS) {
      return { skipped: true, cycle_id: cycleId, message: 'A cycle already ran within the last 90 seconds.' };
    }
  }

  const [fleetResult, machineResult] = await Promise.allSettled([observeFleet(base44), observeMachine(base44)]);
  const fleet = fleetResult.status === 'fulfilled'
    ? fleetResult.value
    : { engines: [], railway: { ok: false, failed: [], error: fleetResult.reason?.message || 'unreadable' }, engine_key_configured: false };
  const machine = machineResult.status === 'fulfilled'
    ? machineResult.value
    : { connected: false, paired: false, status: 'error' };

  const detected = diagnose({ fleet, machine });
  const proposals = onlyAction
    ? [{ action: onlyAction, target: 'requested by the operator', proposed_because: 'The operator asked for this action by name.' }]
    : detected.proposals;

  const decisions = proposals.map((proposal) => ({
    ...classify(proposal.action, { platformAutofix: settings.platform_autofix }),
    target: proposal.target,
    proposed_because: proposal.proposed_because,
  }));

  // Guardian: the catalogue decides; the model may only take authority away. A
  // review that could not run leaves every repair refused rather than applied.
  let reviewed = decisions;
  let guardianNotes = decisions.length ? '' : 'Nothing was proposed, so the guardian was not asked to decide.';
  if (decisions.length) {
    const review = await runGuardianReview(base44, { problems: detected.problems, decisions, proposals });
    if (review.ok) {
      reviewed = narrowWithReview(decisions, review.review);
      guardianNotes = review.review?.notes || '';
    } else {
      reviewed = decisions.map((decision) => (decision.allowed || decision.requires_approval
        ? {
          ...decision,
          allowed: false,
          requires_approval: false,
          blocked: true,
          refused_by: 'guardian_unavailable',
          reason: `The guardian review could not be completed (${review.error}), and a repair never proceeds unreviewed.`,
        }
        : decision));
      guardianNotes = `The guardian review failed (${review.error}); every proposed repair was refused and can be proposed again next cycle.`;
    }
  }

  // An explicit request from an admin IS the approval, so approval-class actions
  // run on that path — which never widens the catalogue, it only shortens the queue.
  const operatorInvoked = Boolean(onlyAction);
  const toApply = [];
  const approvals = [];
  const refused = [];

  for (const decision of reviewed) {
    if (decision.blocked) {
      refused.push({ action: decision.id, reason: decision.reason, refused_by: decision.refused_by || 'policy' });
      continue;
    }
    if (decision.allowed) {
      toApply.push(decision);
      continue;
    }
    const approval = prepareApproval(decision, machine);
    if (decision.executor === 'device' && !approval.command) {
      refused.push({
        action: decision.id,
        reason: `${decision.reason} It was refused outright because the start mechanism was not discovered, so running it could leave the assistant down.`,
        refused_by: 'policy',
      });
      continue;
    }
    if (operatorInvoked) {
      toApply.push({ ...decision, operator_approved: true });
      continue;
    }
    approvals.push(approval);
  }

  const actions = [];
  for (const decision of toApply) {
    actions.push(await applyAction(base44, decision, machine));
  }

  const validation = await validateOutcome(base44, { actions, fleet, machine });

  const applied = actions.filter((action) => action.status === 'applied');
  const failed = actions.filter((action) => action.status === 'failed' || action.status === 'refused');

  const escalations = [
    // Only what a person must actually decide. A standing low-severity observation
    // stays in the problems list, where it is recorded, without marking every cycle
    // escalated — a signal that is always red tells the operator nothing.
    ...detected.problems
      .filter((problem) => !problem.suggest && problem.severity !== 'low')
      .map((problem) => `${problem.issue}: ${problem.evidence}`),
    ...(machine?.partial_reading ? ['The machine probe returned a partial reading, so the machine picture is incomplete.'] : []),
    ...(onlyAction && refused.length ? refused.map((entry) => `${entry.action} was refused: ${entry.reason}`) : []),
  ];

  let verdict = 'clean';
  if (applied.length) verdict = validation.verdict === 'verified' ? 'healed_verified' : 'healed_unverified';
  else if (failed.length) verdict = 'failed';
  else if (approvals.length) verdict = 'awaiting_approval';
  // A standing low-severity observation is recorded without calling every cycle
  // escalated: the verdict follows what was escalated, not what was noticed.
  else if (escalations.length) verdict = 'escalated';

  const status = verdict === 'failed' ? 'failed' : applied.length ? 'healed' : approvals.length ? 'awaiting_approval' : 'clean';

  const summary = [
    detected.problems.length ? `${detected.problems.length} problem(s) found` : 'nothing wrong found',
    applied.length ? `${applied.length} repair(s) applied` : null,
    approvals.length ? `${approvals.length} waiting on your approval` : null,
    refused.length ? `${refused.length} refused` : null,
    escalations.length ? `${escalations.length} escalated` : null,
  ].filter(Boolean).join(', ') + '.';

  const record = await base44.asServiceRole.entities.OpenClawCycle.create({
    cycle_id: cycleId,
    triggered_by: triggeredBy,
    status,
    verdict,
    summary,
    policy_version: POLICY_VERSION,
    observed: {
      engines: fleet.engines,
      railway: fleet.railway,
      machine: machine?.connected
        ? {
          device: machine.device || null,
          host: machine.host || null,
          partial_reading: Boolean(machine.partial_reading),
          gateway: machine.gateway,
          disk: machine.disk,
          memory: machine.memory,
          accounts: machine.accounts,
          start_mechanism: machine.start_mechanism,
        }
        : { connected: false, paired: Boolean(machine?.paired), status: machine?.status || null },
    },
    problems: detected.problems,
    guardian: {
      policy_version: POLICY_VERSION,
      model: decisions.length ? GUARDIAN_MODEL : null,
      verdict: !decisions.length ? 'no_action' : toApply.length ? 'approved' : approvals.length ? 'queued' : 'refused_all',
      allowed: toApply.map((decision) => decision.id),
      approval_required: approvals.map((approval) => approval.action),
      refused,
      reasons: reviewed.map((decision) => `${decision.id}: ${decision.reason}`),
      notes: guardianNotes,
    },
    actions,
    approvals,
    validation,
    escalations,
    duration_ms: Date.now() - started,
    requested_by_email: user?.email || null,
  });

  return { cycle: record, settings, device: deviceSummary(await deviceStatus(base44)) };
}

/**
 * A human deciding a queued approval. The catalogue is re-checked at the moment of
 * execution, so authority can only have narrowed between queueing and running.
 */
async function decideApproval(base44, user, body, approved) {
  const { cycle_id, approval_id } = body;
  if (!cycle_id || !approval_id) return { ok: false, error: 'A cycle and an approval are required.', _status: 400 };

  const cycle = await base44.asServiceRole.entities.OpenClawCycle.get(cycle_id);
  const approvals = Array.isArray(cycle.approvals) ? [...cycle.approvals] : [];
  const index = approvals.findIndex((entry) => entry.id === approval_id || entry.action === approval_id);
  if (index < 0) return { ok: false, error: 'That approval is not on this cycle.', _status: 404 };
  if (approvals[index].status !== 'pending') return { ok: false, error: `That approval was already ${approvals[index].status}.`, _status: 409 };

  const decided = {
    ...approvals[index],
    status: approved ? 'approved' : 'rejected',
    decided_by: user.email,
    decided_at: new Date().toISOString(),
  };

  if (!approved) {
    approvals[index] = decided;
    await base44.asServiceRole.entities.OpenClawCycle.update(cycle.id, { approvals });
    return { ok: true, approval: decided };
  }

  const decision = classify(approvals[index].action, { platformAutofix: true });
  if (decision.blocked) {
    const error = `It was not run: ${decision.reason}`;
    approvals[index] = { ...decided, status: 'refused', error };
    await base44.asServiceRole.entities.OpenClawCycle.update(cycle.id, { approvals });
    return { ok: false, refused: true, error };
  }

  const machine = await observeMachine(base44);
  const action = await applyAction(base44, { ...decision, target: approvals[index].target }, machine);
  const validation = await validateOutcome(base44, { actions: [action], fleet: await observeFleet(base44), machine });

  approvals[index] = { ...decided, status: action.status === 'applied' ? 'executed' : 'failed', action_status: action.status };
  const actions = [...(cycle.actions || []), action];
  const verdict = action.status === 'applied' ? (validation.verdict === 'verified' ? 'healed_verified' : 'healed_unverified') : 'failed';

  const updated = await base44.asServiceRole.entities.OpenClawCycle.update(cycle.id, {
    approvals,
    actions,
    validation,
    verdict,
    status: action.status === 'applied' ? 'healed' : 'failed',
    summary: `${cycle.summary || ''} You approved ${approvals[index].label}: ${action.summary}`.trim(),
  });

  return { ok: action.status === 'applied', approval: approvals[index], action, validation, cycle: updated };
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    let body = {};
    try {
      body = await req.json();
    } catch {
      // An empty body falls through to the status action.
    }
    const action = body.action || 'status';

    if (action === 'policy') {
      return Response.json({ ok: true, ...policyDigest(), settings: await currentSettings(base44), __v: DEPLOYMENT_VERSION });
    }

    if (action === 'status') {
      const cycles = await base44.asServiceRole.entities.OpenClawCycle.list('-created_date', HISTORY);
      const list = Array.isArray(cycles) ? cycles : cycles?.items || [];
      const pending = list.flatMap((cycle) => (cycle.approvals || [])
        .filter((approval) => approval.status === 'pending')
        .map((approval) => ({ ...approval, cycle_id: cycle.id, cycle_created: cycle.created_date })));

      return Response.json({
        ok: true,
        policy_version: POLICY_VERSION,
        cycles: list,
        pending,
        device: deviceSummary(await deviceStatus(base44)),
        settings: await currentSettings(base44),
        __v: DEPLOYMENT_VERSION,
      });
    }

    if (action === 'set_setting') {
      const key = body.key;
      if (!Object.prototype.hasOwnProperty.call(SETTINGS, key)) {
        return Response.json({ error: 'That setting is not switchable from here.' }, { status: 400 });
      }
      const value = body.value ? 'true' : 'false';
      await writeSetting(base44, key, value, `Set to ${value} in the OpenClaw console by ${user.email}.`);
      return Response.json({ ok: true, settings: await currentSettings(base44) });
    }

    // Read the paired machine on its own, so a probe can be inspected without
    // running a whole cycle — and so a partial reading is visible as partial.
    if (action === 'machine') {
      const device = await deviceStatus(base44);
      if (!device.ready) return Response.json({ ok: true, device: deviceSummary(device) });
      const result = await runDeviceCommand(base44, gatewayProbeCommand(), { timeoutMs: 30000 });
      return Response.json({
        ok: true,
        device: deviceSummary(device),
        partial: result.partial,
        command: gatewayProbeCommand(),
        text: shorten(result.text, 4000),
        parsed: parseGatewayProbe(result.text),
      });
    }

    if (action === 'cycle') {
      const result = await runCycle(base44, user, body.triggered_by === 'schedule' ? 'schedule' : 'operator');
      return Response.json({ ok: true, ...result, __v: DEPLOYMENT_VERSION });
    }

    if (action === 'run') {
      const actionId = body.action_id || body.id;
      const settings = await currentSettings(base44);
      const decision = classify(actionId, { platformAutofix: settings.platform_autofix });
      if (decision.blocked) {
        return Response.json({ ok: false, refused: true, action: actionId, reason: decision.reason }, { status: 403 });
      }
      const result = await runCycle(base44, user, 'operator', { onlyAction: actionId });
      return Response.json({ ok: true, ...result, __v: DEPLOYMENT_VERSION });
    }

    if (action === 'approve' || action === 'reject') {
      const outcome = await decideApproval(base44, user, body, action === 'approve');
      const status = outcome._status || 200;
      delete outcome._status;
      return Response.json({ ...outcome, __v: DEPLOYMENT_VERSION }, { status });
    }

    return Response.json({ error: `Unknown action "${action}".` }, { status: 400 });
  } catch (error) {
    console.error('openClawAgent failed:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}