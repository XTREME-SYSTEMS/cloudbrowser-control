// Job-domain rules for the portable queue. Pure and dependency-free so the
// API route layer and the contract tests share one source of truth.
import { ValidationError } from "./http.js";

export const ALLOWED_JOB_TYPES = Object.freeze(["engine.health", "artifact.prune"]);

export const JOB_STATUSES = Object.freeze([
  "queued",
  "leased",
  "succeeded",
  "failed",
  "dead_letter",
  "cancelled",
]);

export const TERMINAL_JOB_STATUSES = Object.freeze([
  "succeeded",
  "failed",
  "dead_letter",
  "cancelled",
]);

export const CANCELABLE_JOB_STATUSES = Object.freeze(["queued", "leased"]);

export const MAX_ATTEMPTS_CEILING = 20;
export const MAX_PAYLOAD_BYTES = 64 * 1024;
export const MIN_IDEMPOTENCY_KEY_LENGTH = 8;

export function isTerminalStatus(status) {
  return TERMINAL_JOB_STATUSES.includes(status);
}

export function canCancelStatus(status) {
  return CANCELABLE_JOB_STATUSES.includes(status);
}

/**
 * Validates and normalizes a job-creation request body.
 * Throws ValidationError with a caller-safe message on any violation.
 */
export function validateCreateJobInput(body) {
  const input = body && typeof body === "object" && !Array.isArray(body) ? body : {};

  const type = typeof input.type === "string" ? input.type.trim() : "";
  if (!type) throw new ValidationError("type is required");
  if (!ALLOWED_JOB_TYPES.includes(type)) throw new ValidationError(`unsupported job type: ${type}`);

  const payload = input.payload === undefined ? {} : input.payload;
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new ValidationError("payload must be an object");
  }
  if (JSON.stringify(payload).length > MAX_PAYLOAD_BYTES) {
    throw new ValidationError(`payload exceeds ${MAX_PAYLOAD_BYTES} bytes`);
  }

  let idempotencyKey = null;
  if (input.idempotency_key !== undefined && input.idempotency_key !== null) {
    if (typeof input.idempotency_key !== "string") {
      throw new ValidationError("idempotency_key must be a string");
    }
    const trimmed = input.idempotency_key.trim();
    if (trimmed.length < MIN_IDEMPOTENCY_KEY_LENGTH) {
      throw new ValidationError(`idempotency_key must be at least ${MIN_IDEMPOTENCY_KEY_LENGTH} characters`);
    }
    idempotencyKey = trimmed;
  }

  const priority = input.priority === undefined ? 5 : input.priority;
  if (!Number.isInteger(priority) || priority < 1 || priority > 9) {
    throw new ValidationError("priority must be an integer between 1 and 9");
  }

  const maxAttempts = input.max_attempts === undefined ? 5 : input.max_attempts;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > MAX_ATTEMPTS_CEILING) {
    throw new ValidationError(`max_attempts must be an integer between 1 and ${MAX_ATTEMPTS_CEILING}`);
  }

  return { type, payload, idempotencyKey, priority, maxAttempts };
}