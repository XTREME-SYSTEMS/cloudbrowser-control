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
  assert.ok(source.includes("target_owner_name || \"\""));
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

test("strategic reports use existing cases and fail closed without source evidence", async () => {
  const source = await read("src/pages/StrategicReport.jsx");
  assert.doesNotMatch(source, /TARGET_SUBJECTS/);
  assert.doesNotMatch(source, /Paul C\. Lingard|Donald Roy Yandell|Lucile C Wright/);
  assert.ok(source.includes('base44.entities.SkipTrace.filter('));
  assert.ok(source.includes('subject.evidence_verified'));
  assert.ok(source.includes('evidenceRecords.some(isValidEvidenceRecord)'));
  assert.ok(source.includes('!isTestFixture(t)'));
});

test("heir-search actions require a case ID linked to the displayed subject", async () => {
  const source = await read("src/pages/StrategicReport.jsx");
  assert.ok(source.includes('subjects.find(subject => subject.heir_search_id)'));
  assert.ok(source.includes('QA was not run against an unrelated case'));
  assert.ok(source.includes('Comparison was not run against an unrelated case'));
  assert.ok(source.includes('No report was generated for an unrelated case'));
  assert.ok(source.includes('!hs.deceased_name'));
  assert.doesNotMatch(source, /subjects\[0\]\?\.target/);
  assert.ok(source.includes('typeof result === "string"'));
});

test("investigative PDF does not claim sources were queried or cross-verified without evidence", async () => {
  const source = await read("src/lib/strategicReportPDF.js");
  assert.ok(source.includes("not a checklist of sources searched"));
  assert.ok(source.includes("No source references supplied"));
  assert.ok(source.includes("not a legal opinion, court certification"));
  assert.doesNotMatch(source, /241\+|30\+ source category methodology|Each category was queried|cross-verified contact data/i);
  assert.doesNotMatch(source, /drawStrategicPillarsPage|STRATEGIC PILLARS/);
});
