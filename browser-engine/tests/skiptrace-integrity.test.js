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
  assert.match(source, /hasVerifiableEvidence/);
  assert.ok(source.includes("result?.evidence_verified !== true"));
  assert.match(source, /No synthetic fallback was used/);
});

test("autonomous swarm requires verified evidence before completing a task", async () => {
  const source = await read("base44/functions/runAutonomousSwarm/entry.ts");
  assert.ok(source.includes("result?.evidence_verified !== true"));
  assert.ok(source.includes('result?.verification_status !== "verified"'));
  assert.ok(source.includes('result?.status !== "found"'));
  assert.match(source, /unverified candidate/i);
});

test("skip-trace status and confidence are evidence-gated and unverified candidates are not sheet-exported", async () => {
  const source = await read("base44/functions/runSkipTrace/entry.ts");
  assert.match(source, /hasVerifiedEvidence/);
  assert.ok(source.includes('result?.verification_status !== "verified"'));
  assert.match(source, /confidence_score:\s*hasVerifiedEvidence\s*\?\s*overallConfidence\s*:\s*0/);
  assert.match(source, /if\s*\(spreadsheet_url\s*&&\s*hasVerifiedEvidence\)/);
});

test("mock endpoint cannot persist generated investigative records", async () => {
  const source = await read("base44/functions/runSkipTraceMock/entry.ts");
  assert.match(source, /test_mode\s*!==\s*true/);
  assert.ok(source.includes('result?.status !== "found"'));
  assert.doesNotMatch(source, /entities\.SkipTrace\.(create|update|filter)/);
  assert.doesNotMatch(source, /\+1\s*\(/);
});
