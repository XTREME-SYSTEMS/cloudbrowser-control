import crypto from 'node:crypto';
import { PROJECT, env } from './config.js';
import { GitHubClient, GitHubStateStore } from './github.js';
import { planNext, executeCodingPacket } from './agent.js';
import { collectValidation, classifyFailure } from './validation.js';
import { redact, sha256 } from './policy.js';

const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * 60000);
const hourBucket = (date) => date.toISOString().slice(0, 13);
const receiptId = (type) => `${type.toLowerCase()}-${new Date().toISOString().replace(/[-:.TZ]/g, '')}-${crypto.randomBytes(4).toString('hex')}`;

async function writeReceipt(github, type, data) {
  const id = receiptId(type);
  const payload = redact({ receipt_id: id, type, project: PROJECT.id, timestamp: new Date().toISOString(), ...data });
  payload.content_hash = sha256(payload);
  const path = `${PROJECT.receiptPath}/${new Date().toISOString().slice(0, 10)}/${id}.json`;
  await github.putFile(path, PROJECT.stateBranch, `${JSON.stringify(payload, null, 2)}\n`, `receipt: ${type} ${id}`);
  return { id, path, hash: payload.content_hash };
}

function due(state, now) {
  return !state.next_engineering_run_at || now >= new Date(state.next_engineering_run_at);
}

function leaseActive(state, now) {
  return Boolean(state.lease_expires_at && now < new Date(state.lease_expires_at));
}

async function acquireLease(store, owner, now, mutationEnabled) {
  let acquired = false;
  const result = await store.mutate((state) => {
    if (!mutationEnabled || !state.autonomous_mutation_enabled || state.approval_required || state.release_ready) return state;
    if (['PAUSED', 'FAILED_SAFE', 'READY_FOR_OPERATOR_APPROVAL'].includes(state.state)) return state;
    if (!due(state, now) || leaseActive(state, now)) return state;
    state.state = 'PLANNING';
    state.lease_owner = owner;
    state.lease_acquired_at = now.toISOString();
    state.lease_heartbeat_at = now.toISOString();
    state.lease_expires_at = addMinutes(now, PROJECT.leaseMinutes).toISOString();
    state.hour_bucket = hourBucket(now);
    acquired = true;
    return state;
  }, `autonomy: claim ${PROJECT.id} ${hourBucket(now)}`);
  return { acquired, state: result.state };
}

async function updateValidationState(store, validation, now) {
  return store.mutate((state) => {
    state.candidate_sha = validation.candidate_sha;
    state.latest_validation_run_id = validation.staging?.run?.run_id || state.latest_validation_run_id || null;
    state.latest_quality_score = validation.quality_score;
    state.last_release_gate_result = validation.clean_pass ? 'PASS' : 'FAIL';
    state.critical_count = validation.critical_findings;
    state.high_count = validation.high_findings;
    state.deployment_drift_count = validation.drift;

    if (validation.clean_pass) {
      const separated = !state.last_clean_at || (now.getTime() - new Date(state.last_clean_at).getTime()) >= 5 * 60000;
      if (state.last_clean_sha !== validation.candidate_sha) {
        state.consecutive_clean_passes = 1;
        state.last_clean_sha = validation.candidate_sha;
        state.last_clean_at = now.toISOString();
      } else if (separated) {
        state.consecutive_clean_passes += 1;
        state.last_clean_at = now.toISOString();
      }
      state.blocking_failures = [];
      state.last_failure_signature = null;
      state.failure_streak = 0;
      state.anti_thrash_triggered = false;
      if (state.consecutive_clean_passes >= PROJECT.requiredCleanPasses) {
        state.state = 'READY_FOR_OPERATOR_APPROVAL';
        state.release_ready = true;
        state.approval_required = true;
        state.autonomous_mutation_enabled = false;
        state.next_engineering_run_at = null;
      } else {
        state.state = 'MONITORING';
      }
    } else {
      state.consecutive_clean_passes = 0;
      state.last_clean_sha = null;
      state.last_clean_at = null;
      const failure = classifyFailure(validation);
      const total = (state.failure_signatures?.[failure.signature] || 0) + 1;
      state.failure_signatures = { ...(state.failure_signatures || {}), [failure.signature]: total };
      state.repair_attempts = { ...(state.repair_attempts || {}), [failure.signature]: total };
      state.failure_streak = state.last_failure_signature === failure.signature ? (state.failure_streak || 0) + 1 : 1;
      state.last_failure_signature = failure.signature;
      state.blocking_failures = [{ ...failure, occurrences: total, consecutive: state.failure_streak }];

      if (failure.type === 'GOVERNANCE_BLOCKED') {
        state.state = 'PAUSED';
        state.anti_thrash_triggered = false;
        state.autonomous_mutation_enabled = false;
        state.next_engineering_run_at = null;
      } else if (state.failure_streak >= 2) {
        state.state = 'PAUSED';
        state.anti_thrash_triggered = true;
        state.autonomous_mutation_enabled = false;
        state.next_engineering_run_at = null;
      } else {
        state.state = failure.type === 'INFRA_BLOCKED' ? 'INFRA_BLOCKED' : 'REPAIR_REQUIRED';
      }
    }
    return state;
  }, `autonomy: record validation ${validation.candidate_sha.slice(0, 12)}`);
}

async function releaseFailedLease(store, now, error) {
  return store.mutate((state) => {
    state.state = 'INFRA_BLOCKED';
    state.blocking_failures = [{ type: 'INFRA_BLOCKED', signature: sha256(String(error?.message || error)), message: 'Recoverable agent/workflow failure; see incident receipt.' }];
    state.lease_owner = null;
    state.lease_expires_at = null;
    state.lease_heartbeat_at = null;
    state.next_engineering_run_at = addMinutes(now, PROJECT.intervalMinutes).toISOString();
    return state;
  }, 'autonomy: release lease after recoverable workflow failure');
}

export async function runHeartbeat(input = {}) {
  const cfg = env();
  const now = new Date(input.triggeredAt || Date.now());
  const owner = input.owner || `vercel:${crypto.randomUUID()}`;
  const github = new GitHubClient(cfg.githubToken);
  const store = new GitHubStateStore(github);
  await store.ensure();

  const preValidation = (await store.read()).state;
  const candidateSha = await github.getBranchSha(PROJECT.candidateBranch);
  const validation = await collectValidation({
    github,
    candidateSha,
    stagingStatusUrl: cfg.stagingStatusUrl,
    stagingRunUrl: cfg.stagingRunUrl,
    stagingCertifyUrl: cfg.stagingCertifyUrl,
    stagingToken: cfg.stagingToken,
    suiteUrls: cfg.suiteUrls,
  });
  const validationReceipt = await writeReceipt(github, 'VALIDATION', { candidate_sha: candidateSha, environment: 'fortress-staging', validation });
  const scoreReceipt = await writeReceipt(github, 'SCORE', {
    candidate_sha: candidateSha,
    validation_receipt: validationReceipt.id,
    quality_score: validation.quality_score,
    pass_rate: validation.pass_rate,
    release_gate_status: validation.clean_pass ? 'PASS' : 'FAIL'
  });
  let state = (await updateValidationState(store, validation, now)).state;
  await writeReceipt(github, 'STATE_TRANSITION', { from: preValidation.state, to: state.state, reason: validation.clean_pass ? 'VALIDATION_CLEAN' : 'VALIDATION_NOT_CLEAN', candidate_sha: candidateSha });
  await writeReceipt(github, 'HEARTBEAT', { candidate_sha: candidateSha, state: state.state, validation_receipt: validationReceipt.id, score_receipt: scoreReceipt.id, quality_score: validation.quality_score });

  if (!validation.clean_pass && state.blocking_failures?.length) {
    const action = state.state === 'PAUSED'
      ? (state.anti_thrash_triggered ? 'BLOCKED_ANTI_THRASH' : 'BLOCKED_GOVERNANCE')
      : 'REPAIR_REQUIRED';
    await writeReceipt(github, 'REPAIR', {
      candidate_sha: candidateSha,
      action,
      failure: state.blocking_failures[0],
      next_state: state.state
    });
  }

  if (state.release_ready || state.state === 'READY_FOR_OPERATOR_APPROVAL') {
    await writeReceipt(github, 'COMPLETION', { candidate_sha: candidateSha, clean_passes: state.consecutive_clean_passes, state: 'READY_FOR_OPERATOR_APPROVAL' });
    return { status: 'READY_FOR_OPERATOR_APPROVAL', candidate_sha: candidateSha, validation, state };
  }
  if (state.state === 'PAUSED' || state.state === 'FAILED_SAFE') {
    const reason = state.anti_thrash_triggered ? 'ANTI_THRASH' : (state.blocking_failures?.[0]?.type || state.state);
    return { status: 'BLOCKED', reason, candidate_sha: candidateSha, validation, state };
  }
  if (state.approval_required || state.state === 'APPROVAL_REQUIRED') {
    return { status: 'APPROVAL_REQUIRED', candidate_sha: candidateSha, validation, state };
  }
  if (!cfg.mutationEnabled) return { status: 'VALIDATION_ONLY', reason: 'AUTONOMY_MUTATION_ENABLED is not true', candidate_sha: candidateSha, validation, state };

  if (!state.autonomous_mutation_enabled) {
    state = (await store.mutate((s) => { s.autonomous_mutation_enabled = true; return s; }, 'autonomy: enable branch-safe mutation from runtime config')).state;
  }

  const lease = await acquireLease(store, owner, now, cfg.mutationEnabled);
  if (!lease.acquired) return { status: 'MONITORING', candidate_sha: candidateSha, validation, state: lease.state };
  state = lease.state;
  const leaseReceipt = await writeReceipt(github, 'LEASE', { lease_owner: owner, hour_bucket: state.hour_bucket, expires_at: state.lease_expires_at, candidate_sha: candidateSha });
  await writeReceipt(github, 'STATE_TRANSITION', { from: preValidation.state, to: 'PLANNING', reason: 'HOURLY_LEASE_ACQUIRED', lease_receipt: leaseReceipt.id, candidate_sha: candidateSha });

  try {
    const evidence = {
      project: state,
      operator_constraints: { production: false, main_write: false, deployment: false, secrets: false, max_work_packets: 1, max_repair_attempts: PROJECT.maxRepairAttempts },
      repo: { full_name: PROJECT.repo, base_sha: state.base_sha, candidate_branch: PROJECT.candidateBranch, candidate_sha: candidateSha },
      staging: { app_id: PROJECT.stagingAppId, health: validation.staging?.status || null, drift: validation.drift },
      validation: { latest_run_id: validation.staging?.run?.run_id || null, score: validation.quality_score, failed_tests: state.blocking_failures, critical_count: validation.critical_findings, high_count: validation.high_findings, clean_pass_count: state.consecutive_clean_passes },
      open_work_packets: state.active_work_packet_id ? [state.active_work_packet_id] : [],
      recent_receipts: [validationReceipt.id, scoreReceipt.id, leaseReceipt.id],
      budget: { max_work_packets: 1, max_repair_attempts: PROJECT.maxRepairAttempts }
    };

    const planned = await planNext({ apiKey: cfg.openaiApiKey, primaryModel: cfg.primaryModel, fallbackModel: cfg.fallbackModel, evidence });
    const decisionReceipt = await writeReceipt(github, 'AGENT_DECISION', { candidate_sha: candidateSha, decision: planned.decision, routing: planned.meta });

    if (planned.decision.decision === 'WORK_PACKET') {
      const packet = { ...planned.decision.work_packet, working_branch: PROJECT.candidateBranch, starting_sha: candidateSha, deployment_allowed: false, main_write_allowed: false, production_allowed: false, secret_change_allowed: false };
      await writeReceipt(github, 'WORK_PACKET', { packet, decision_receipt: decisionReceipt.id });
      state = (await store.mutate((s) => { s.state = 'EXECUTING_BRANCH_WORK'; s.active_work_packet_id = packet.work_packet_id; s.work_packet_attempt = (s.work_packet_attempt || 0) + 1; return s; }, `autonomy: execute ${packet.work_packet_id}`)).state;
      const execution = await executeCodingPacket({ github, apiKey: cfg.openaiApiKey, model: cfg.codexModel, packet });
      const newSha = await github.getBranchSha(PROJECT.candidateBranch);
      await writeReceipt(github, 'CODE_EXECUTION', { work_packet_id: packet.work_packet_id, starting_sha: candidateSha, candidate_sha: newSha, execution });
      state = (await store.mutate((s) => {
        s.state = 'VALIDATING';
        s.candidate_sha = newSha;
        s.active_work_packet_id = null;
        s.lease_owner = null;
        s.lease_expires_at = null;
        s.lease_heartbeat_at = null;
        s.next_engineering_run_at = addMinutes(now, PROJECT.intervalMinutes).toISOString();
        s.consecutive_clean_passes = 0;
        s.last_clean_sha = null;
        s.last_clean_at = null;
        s.last_failure_signature = null;
        s.failure_streak = 0;
        s.anti_thrash_triggered = false;
        s.release_ready = false;
        s.approval_required = false;
        return s;
      }, `autonomy: await validation ${packet.work_packet_id}`)).state;
      await writeReceipt(github, 'STATE_TRANSITION', { from: 'EXECUTING_BRANCH_WORK', to: 'VALIDATING', reason: 'CODE_EXECUTION_COMPLETE', work_packet_id: packet.work_packet_id, candidate_sha: newSha });
      return { status: 'WORK_PACKET_EXECUTED', work_packet_id: packet.work_packet_id, candidate_sha: newSha, execution, state };
    }

    state = (await store.mutate((s) => {
      s.state = planned.decision.next_state || (planned.decision.decision === 'APPROVAL_REQUIRED' ? 'APPROVAL_REQUIRED' : 'MONITORING');
      if (planned.decision.decision === 'APPROVAL_REQUIRED') s.approval_required = true;
      s.lease_owner = null;
      s.lease_expires_at = null;
      s.lease_heartbeat_at = null;
      s.next_engineering_run_at = addMinutes(now, PROJECT.intervalMinutes).toISOString();
      return s;
    }, `autonomy: planner ${planned.decision.decision}`)).state;
    await writeReceipt(github, 'STATE_TRANSITION', { from: 'PLANNING', to: state.state, reason: `PLANNER_${planned.decision.decision}`, decision_receipt: decisionReceipt.id, candidate_sha: candidateSha });
    return { status: planned.decision.decision, decision: planned.decision, state };
  } catch (error) {
    await writeReceipt(github, 'INCIDENT', { candidate_sha: candidateSha, lease_owner: owner, class: 'RECOVERABLE_WORKFLOW_ERROR', error: { message: error?.message || String(error), name: error?.name || 'Error' } });
    state = (await releaseFailedLease(store, now, error)).state;
    return { status: 'INFRA_BLOCKED', candidate_sha: candidateSha, error: 'Recoverable workflow failure; see incident receipt.', state };
  }
}
