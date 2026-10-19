import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");

test("production skip-trace fallback has no synthetic or ad-hoc scraping success path", async () => {
  const source = await read("base44/functions/runSkipTraceFallback/entry.ts");
  assert.doesNotMatch(source, /runSkipTraceMock/);
  assert.doesNotMatch(source, /directScrapeSkipTrace/);
  assert.ok(source.includes("hasVerifiableEvidence"));
  assert.ok(source.includes("evidence_verified"));
  assert.ok(source.includes("No synthetic fallback was used"));
});

test("autonomous swarm requires verified evidence before completing a task", async () => {
  const source = await read("base44/functions/runAutonomousSwarm/entry.ts");
  assert.ok(source.includes('result?.status !== "found" || result?.evidence_verified !== true || result?.verification_status !== "verified"'));
  assert.ok(source.includes("Unverified candidate data; human review required"));
});

test("skip-trace status and confidence are evidence-gated and unverified candidates are not sheet-exported", async () => {
  const source = await read("base44/functions/runSkipTrace/entry.ts");
  assert.ok(source.includes("const hasVerifiedEvidence ="));
  assert.ok(source.includes("results.verification_status ="));
  assert.ok(source.includes("confidence_score: hasVerifiedEvidence ? overallConfidence : 0"));
  assert.ok(source.includes("if (spreadsheet_url && hasVerifiedEvidence)"));
});

test("mock endpoint cannot persist generated investigative records", async () => {
  const source = await read("base44/functions/runSkipTraceMock/entry.ts");
  assert.ok(source.includes("body?.test_mode !== true"));
  assert.ok(source.includes('status: "test_fixture"'));
  assert.doesNotMatch(source, /entities\.SkipTrace\.(create|update|filter)/);
  assert.doesNotMatch(source, /\+1\s*\(/);
});
