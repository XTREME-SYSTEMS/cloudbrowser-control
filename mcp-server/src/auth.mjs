import { timingSafeEqual } from "node:crypto";

export function readBearerToken(headerValue) {
  if (typeof headerValue !== "string") return null;
  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export function constantTimeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function bearerAuthorized(headerValue, expectedToken) {
  const presented = readBearerToken(headerValue);
  return !!presented && constantTimeEqual(presented, expectedToken);
}
