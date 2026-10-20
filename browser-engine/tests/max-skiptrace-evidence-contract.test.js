import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.resolve(here, "..", "..", "base44", "functions", "runMaxSkipTrace", "entry.ts");

test("MAX skip-trace never marks candidate-only output as found", async () => {
  const source = await readFile(sourcePath, "utf8");
  assert.match(source, /const status = hasVerifiedEvidence && candidateConfidence >= 70 \? "found" : hasCandidateData \? "partial" : "failed"/);
  assert.match(source, /confidence_score: hasVerifiedEvidence \? Math\.min\(99, candidateConfidence\) : 0/);
  assert.match(source, /candidate_data_unverified: !hasVerifiedEvidence && hasCandidateData/);
  assert.doesNotMatch(source, /const status = overallConfidence >= 70/);
});

test("MAX skip-trace distinguishes attempted source categories from checked evidence", async () => {
  const source = await readFile(sourcePath, "utf8");
  assert.match(source, /sources_attempted: normalized\.sources/);
  assert.match(source, /sources_checked: \[\]/);
  assert.match(source, /evidence_records: evidenceRecords/);
  assert.match(source, /if \(spreadsheet_url && hasVerifiedEvidence\)/);
});

test("MAX skip-trace report prompt forbids invented source verification", async () => {
  const source = await readFile(sourcePath, "utf8");
  assert.match(source, /Never claim a source was searched, queried, or confirmed/);
  assert.match(source, /Do not invent citations, source URLs, identity matches, contact verification/);
  assert.match(source, /no verifiable evidence records were supplied/);
});
