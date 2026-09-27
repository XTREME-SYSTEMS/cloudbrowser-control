import test from "node:test";
import assert from "node:assert/strict";
import { readBearerToken, constantTimeEqual, bearerAuthorized } from "../src/auth.mjs";

test("reads a bearer token", () => {
  assert.equal(readBearerToken("Bearer abc123"), "abc123");
  assert.equal(readBearerToken("bearer token-value"), "token-value");
  assert.equal(readBearerToken("Basic abc"), null);
  assert.equal(readBearerToken(undefined), null);
});

test("constant-time helper rejects unequal values and lengths", () => {
  assert.equal(constantTimeEqual("alpha", "alpha"), true);
  assert.equal(constantTimeEqual("alpha", "bravo"), false);
  assert.equal(constantTimeEqual("a", "longer"), false);
});

test("bearer authorization is fail-closed", () => {
  const expected = "k".repeat(32);
  const wrong = "x".repeat(32);
  assert.equal(bearerAuthorized(`Bearer ${expected}`, expected), true);
  assert.equal(bearerAuthorized(`Bearer ${wrong}`, expected), false);
  assert.equal(bearerAuthorized(undefined, expected), false);
});
