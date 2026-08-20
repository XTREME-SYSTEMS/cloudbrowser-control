import { PROJECT } from './config.js';
import { DECISIONS, validateWorkPacket, assertPathAllowed, redact } from './policy.js';

function outputText(response) {
  for (const item of response.output || []) {
    if (item.type !== 'message') continue;
    for (const part of item.content || []) if (part.type === 'output_text' && part.text) return part.text;
  }
  if (typeof response.output_text === 'string') return response.output_text;
  throw new Error('OpenAI response did not contain output text');
}

async function structuredResponse(apiKey, model, name, schema, system, input) {
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      store: false,
      input: [
        { role: 'system', content: [{ type: 'input_text', text: system }] },
        { role: 'user', content: [{ type: 'input_text', text: JSON.stringify(redact(input)) }] }
      ],
      text: { format: { type: 'json_schema', name, strict: true, schema } }
    })
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 500)}`);
  const body = await res.json();
  return { value: JSON.parse(outputText(body)), response_id: body.id || null, model: body.model || model };
}

const workPacketSchema = {
  type: 'object', additionalProperties: false,
  required: ['work_packet_id','project_id','goal','reason','source_failure','starting_sha','working_branch','allowed_paths','forbidden_paths','acceptance_criteria','required_tests','regression_scope','max_files_changed','max_attempts','rollback_reference','deployment_allowed','main_write_allowed','production_allowed','secret_change_allowed','operator_approval_required'],
  properties: {
    work_packet_id: { type: 'string' }, project_id: { type: 'string' }, goal: { type: 'string' }, reason: { type: 'string' }, source_failure: { type: ['string','null'] }, starting_sha: { type: 'string' }, working_branch: { type: 'string' },
    allowed_paths: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 12 }, forbidden_paths: { type: 'array', items: { type: 'string' } }, acceptance_criteria: { type: 'array', items: { type: 'string' }, minItems: 1 }, required_tests: { type: 'array', items: { type: 'string' } }, regression_scope: { type: 'array', items: { type: 'string' } },
    max_files_changed: { type: 'integer', minimum: 1, maximum: 12 }, max_attempts: { type: 'integer', minimum: 1, maximum: 3 }, rollback_reference: { type: 'string' },
    deployment_allowed: { type: 'boolean' }, main_write_allowed: { type: 'boolean' }, production_allowed: { type: 'boolean' }, secret_change_allowed: { type: 'boolean' }, operator_approval_required: { type: 'boolean' }
  }
};

const plannerSchema = {
  type: 'object', additionalProperties: false,
  required: ['decision','reason_code','evidence_ids','risk_class','work_packet','validation_plan','approval_required','next_state'],
  properties: {
    decision: { type: 'string', enum: [...DECISIONS] }, reason_code: { type: 'string' }, evidence_ids: { type: 'array', items: { type: 'string' } }, risk_class: { type: 'string', enum: ['READ_ONLY','BRANCH_SAFE','PROTECTED'] },
    work_packet: { anyOf: [{ type: 'null' }, workPacketSchema] }, validation_plan: { type: 'array', items: { type: 'string' } }, approval_required: { type: 'boolean' }, next_state: { type: 'string', enum: ['MONITORING','REPAIR_REQUIRED','INFRA_BLOCKED','APPROVAL_REQUIRED'] }
  }
};

function validatePlannerDecision(value) {
  if (!DECISIONS.has(value.decision)) throw new Error('Planner emitted unsupported decision');
  if (value.work_packet) validateWorkPacket(value.work_packet);
  if (value.decision === 'WORK_PACKET' && value.risk_class !== 'BRANCH_SAFE') throw new Error('WORK_PACKET must be BRANCH_SAFE');
  if (value.decision === 'WORK_PACKET' && !value.work_packet) throw new Error('WORK_PACKET decision missing work packet');
  if (value.decision !== 'WORK_PACKET' && value.work_packet) throw new Error('Non-work decision may not include work packet');
  if (value.decision === 'APPROVAL_REQUIRED' && !value.approval_required) throw new Error('Approval decision must set approval_required');
  if (value.decision === 'READY_FOR_APPROVAL') {
    if (!value.approval_required) throw new Error('READY_FOR_APPROVAL must request operator approval');
    if (value.next_state !== 'MONITORING') throw new Error('Planner cannot promote durable state to release-ready');
  }
  return value;
}

export async function planNext({ apiKey, primaryModel, fallbackModel, evidence }) {
  if (!apiKey) return { decision: { decision: 'BLOCKED', reason_code: 'OPENAI_API_KEY_MISSING', evidence_ids: [], risk_class: 'READ_ONLY', work_packet: null, validation_plan: [], approval_required: false, next_state: 'INFRA_BLOCKED' }, meta: { blocked: true } };
  const system = `You are CloudBrowser Autonomous Engineering Planner. Source truth is the supplied immutable evidence. Choose the smallest safe next action. Exactly one work packet maximum. Never write main/master, deploy production, change secrets, perform destructive data/schema operations, spend money, message customers, or claim tests passed without receipts. Prefer VALIDATE_ONLY when evidence is ambiguous. WORK_PACKET must target ${PROJECT.candidateBranch} or another autonomous/ or repair/ branch and must set deployment_allowed, main_write_allowed, production_allowed, secret_change_allowed, and operator_approval_required to false. READY_FOR_APPROVAL is advisory only: set next_state=MONITORING because only the independent validator may transition durable state to READY_FOR_OPERATOR_APPROVAL.`;
  let first;
  try {
    first = await structuredResponse(apiKey, primaryModel, 'cloudbrowser_planner_decision', plannerSchema, system, evidence);
  } catch (firstError) {
    if (!fallbackModel) throw firstError;
    const fallback = await structuredResponse(apiKey, fallbackModel, 'cloudbrowser_planner_decision', plannerSchema, system, evidence);
    return { decision: validatePlannerDecision(fallback.value), meta: { model: fallback.model, response_id: fallback.response_id, fallback: true, first_error: firstError.message } };
  }
  return { decision: validatePlannerDecision(first.value), meta: { model: first.model, response_id: first.response_id, fallback: false } };
}

const editSchema = {
  type: 'object', additionalProperties: false, required: ['summary','edits','tests_to_run'],
  properties: {
    summary: { type: 'string' },
    edits: { type: 'array', maxItems: 12, items: { type: 'object', additionalProperties: false, required: ['path','content'], properties: { path: { type: 'string' }, content: { type: 'string' } } } },
    tests_to_run: { type: 'array', items: { type: 'string' } }
  }
};

async function gatherSources(github, packet) {
  const out = [];
  for (const allowed of packet.allowed_paths) {
    const entries = await github.listPath(allowed, packet.working_branch);
    for (const entry of entries) {
      if (out.length >= packet.max_files_changed * 3) break;
      if (entry.type !== 'file') continue;
      const file = await github.getFile(entry.path, packet.working_branch);
      if (file?.content && file.content.length <= 120000) out.push({ path: entry.path, content: file.content });
    }
  }
  return out;
}

export async function executeCodingPacket({ github, apiKey, model, packet }) {
  validateWorkPacket(packet);
  if (!apiKey) throw new Error('OPENAI_API_KEY missing for coding executor');
  const sources = await gatherSources(github, packet);
  const system = `You are a bounded coding executor. Implement exactly one work packet. Return complete replacement contents only for files that must change. Do not edit files outside allowed paths. Do not touch main/master, deployments, production, secrets, payments, customer messaging, or destructive operations. Preserve existing conventions. Do not fabricate tests as passed.`;
  const result = await structuredResponse(apiKey, model, 'cloudbrowser_code_edits', editSchema, system, { packet, sources });
  if (result.value.edits.length > packet.max_files_changed) throw new Error('Coding output exceeds max_files_changed');
  for (const edit of result.value.edits) assertPathAllowed(edit.path, packet.allowed_paths, packet.forbidden_paths || []);
  const writes = [];
  for (const edit of result.value.edits) {
    const existing = await github.getFile(edit.path, packet.working_branch);
    const response = await github.putFile(edit.path, packet.working_branch, edit.content, `${packet.work_packet_id}: ${packet.goal}`, existing?.sha || null);
    writes.push({ path: edit.path, commit_sha: response.commit?.sha || null });
  }
  return { summary: result.value.summary, writes, tests_to_run: result.value.tests_to_run, response_id: result.response_id, model: result.model };
}
