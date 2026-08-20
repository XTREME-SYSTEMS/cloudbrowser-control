import crypto from 'node:crypto';

export const DECISIONS = new Set([
  'WORK_PACKET', 'VALIDATE_ONLY', 'BLOCKED', 'APPROVAL_REQUIRED', 'READY_FOR_APPROVAL', 'NOOP',
]);

const PROTECTED_BRANCHES = new Set(['main', 'master']);
const SECRET_KEY = /(secret|token|password|api[_-]?key|authorization|cookie|private[_-]?key)/i;
const SECRET_VALUE = /(sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9]{20,}|Bearer\s+[A-Za-z0-9._~-]{12,})/i;

export function assertBranchSafe(branch) {
  if (!branch || PROTECTED_BRANCHES.has(branch.toLowerCase())) {
    throw new Error('Protected branch operation blocked');
  }
  if (!branch.startsWith('autonomous/') && !branch.startsWith('repair/') && !branch.startsWith('autonomy/')) {
    throw new Error(`Branch is outside autonomous allowlist: ${branch}`);
  }
}

export function assertPathAllowed(path, allowed = [], forbidden = []) {
  if (!path || path.startsWith('/') || path.includes('..')) throw new Error(`Unsafe path: ${path}`);
  if (forbidden.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    throw new Error(`Forbidden path: ${path}`);
  }
  if (!allowed.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    throw new Error(`Path outside work packet allowlist: ${path}`);
  }
}

export function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, SECRET_KEY.test(k) ? '[REDACTED]' : redact(v)]));
  }
  if (typeof value === 'string' && SECRET_VALUE.test(value)) return '[REDACTED]';
  return value;
}

export function containsSecretLike(value) {
  return JSON.stringify(value, (key, val) => {
    if (SECRET_KEY.test(key)) return '__SECRET_KEY__';
    return val;
  }).includes('__SECRET_KEY__') || SECRET_VALUE.test(JSON.stringify(value));
}

export function sha256(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
}

export function validateWorkPacket(packet) {
  const required = ['work_packet_id','project_id','goal','starting_sha','working_branch','allowed_paths','forbidden_paths','acceptance_criteria','required_tests','regression_scope','max_files_changed','max_attempts','rollback_reference'];
  for (const key of required) if (packet?.[key] === undefined || packet?.[key] === null) throw new Error(`Invalid work packet: missing ${key}`);
  assertBranchSafe(packet.working_branch);
  if (packet.project_id !== 'cloudbrowser-control') throw new Error('Work packet project mismatch');
  if (packet.deployment_allowed || packet.main_write_allowed || packet.production_allowed || packet.secret_change_allowed) throw new Error('Protected capability requested');
  if (!Array.isArray(packet.allowed_paths) || !packet.allowed_paths.length) throw new Error('Work packet requires allowed_paths');
  if (!Array.isArray(packet.acceptance_criteria) || !packet.acceptance_criteria.length) throw new Error('Work packet requires acceptance criteria');
  if (packet.max_files_changed < 1 || packet.max_files_changed > 12) throw new Error('max_files_changed outside 1..12');
  if (packet.max_attempts < 1 || packet.max_attempts > 3) throw new Error('max_attempts outside 1..3');
  if (containsSecretLike(packet)) throw new Error('Secret-like content rejected from work packet');
  return packet;
}

export function isCleanValidation(v) {
  return Boolean(v && v.quality_score === 100 && v.pass_rate === 100 && v.critical_findings === 0 && v.high_findings === 0 && v.drift === 0 && v.mandatory_gates_pass === true && v.staging_health === 'PASS' && v.receipt_integrity === 'PASS');
}
