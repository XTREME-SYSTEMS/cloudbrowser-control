/**
 * Independent certification + mechanical source re-verification contracts.
 *
 * These tests exercise the real rule engine and the real re-verifier. Nothing
 * here pattern-matches source text, because a rule that is only asserted in a
 * comment is not a rule.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  QA_MODEL,
  VALIDATOR_MODEL,
  SEARCH_PATH_MODEL,
  CERTIFICATION_THRESHOLDS,
  CERTIFIER_VERSION,
  assertModelSeparation,
  evaluateCertification,
  refusalReason,
  isCertified,
} from "../base44/shared/independentCertification.ts";

import {
  sha256Hex,
  reverifySource,
  reverifyAll,
  collectEvidenceRecords,
  isReverifiableTarget,
} from "../base44/shared/sourceReverification.ts";

import {
  SOURCE_ADAPTERS,
  reportSourceReadiness,
  adapterReadiness,
  blockedSourcesDisclosure,
} from "../base44/shared/sourceAdapters.ts";

/* ------------------------------------------------------------------ */
/* Model separation                                                    */
/* ------------------------------------------------------------------ */

test("the three actors run on three distinct models", () => {
  assert.notEqual(SEARCH_PATH_MODEL, QA_MODEL);
  assert.notEqual(SEARCH_PATH_MODEL, VALIDATOR_MODEL);
  assert.notEqual(QA_MODEL, VALIDATOR_MODEL);
});

test("model separation passes when the producer, QA and Validator all differ", () => {
  const r = assertModelSeparation({
    search_model: SEARCH_PATH_MODEL,
    qa_model: QA_MODEL,
    validator_model: VALIDATOR_MODEL,
  });
  assert.equal(r.ok, true);
});

test("model separation fails when QA shares the producer's model", () => {
  const r = assertModelSeparation({
    search_model: SEARCH_PATH_MODEL,
    qa_model: SEARCH_PATH_MODEL,
    validator_model: VALIDATOR_MODEL,
  });
  assert.equal(r.ok, false);
  assert.match(r.reason, /self-assessment/i);
});

test("model separation fails when the two reviewers share a model", () => {
  const r = assertModelSeparation({
    search_model: SEARCH_PATH_MODEL,
    qa_model: QA_MODEL,
    validator_model: QA_MODEL,
  });
  assert.equal(r.ok, false);
});

test("model separation fails when any model identity is unrecorded", () => {
  const r = assertModelSeparation({ search_model: SEARCH_PATH_MODEL, qa_model: QA_MODEL, validator_model: "" });
  assert.equal(r.ok, false);
  assert.match(r.reason, /unrecorded/i);
});

/* ------------------------------------------------------------------ */
/* The deterministic gate                                              */
/* ------------------------------------------------------------------ */

const passingInput = () => ({
  search_model: SEARCH_PATH_MODEL,
  qa_model: QA_MODEL,
  validator_model: VALIDATOR_MODEL,
  qa_score: 94,
  validator_score: 96,
  blocking_violations: [],
  corroboration: [{ finding_id: "F-1", independent_sources: 2 }],
  reverification: [{ finding_id: "F-1", evidence_intact: true, re_fetched: true, retrieval_status: "re_verified" }],
  hallucination_flags: [],
  sources_actually_queried: ["county assessor", "obituary archive"],
});

test("a case meeting every condition is certified", () => {
  const v = evaluateCertification(passingInput());
  assert.equal(v.certified, true);
  assert.deepEqual(v.failed_rules, []);
  assert.equal(v.qa_model, QA_MODEL);
  assert.equal(v.validator_model, VALIDATOR_MODEL);
  assert.equal(v.search_model, SEARCH_PATH_MODEL);
  assert.equal(v.certifier_version, CERTIFIER_VERSION);
  assert.deepEqual(v.verified_finding_ids, ["F-1"]);
});

test("a high score cannot outvote a blocking rule", () => {
  const v = evaluateCertification({
    ...passingInput(),
    qa_score: 100,
    validator_score: 100,
    blocking_violations: [{ rule: "AUTH-01", severity: "blocking" }],
  });
  assert.equal(v.certified, false);
  assert.ok(v.failed_rules.includes("CERT-03"));
  assert.equal(v.overall_score, 100, "the score is still reported, it simply does not decide");
});

test("perfect scores cannot survive a failed model separation", () => {
  const v = evaluateCertification({
    ...passingInput(),
    qa_score: 100,
    validator_score: 100,
    qa_model: SEARCH_PATH_MODEL,
  });
  assert.equal(v.certified, false);
  assert.equal(v.model_separation_ok, false);
  assert.ok(v.failed_rules.includes("CERT-01"));
});

test("CERT-02 refuses when a reviewer returned no score", () => {
  const v = evaluateCertification({ ...passingInput(), qa_score: null });
  assert.equal(v.certified, false);
  assert.ok(v.failed_rules.includes("CERT-02"));
});

test("CERT-04 refuses a finding resting on a single source", () => {
  const v = evaluateCertification({
    ...passingInput(),
    corroboration: [{ finding_id: "F-9", independent_sources: 1 }],
  });
  assert.equal(v.certified, false);
  assert.ok(v.failed_rules.includes("CERT-04"));
  assert.match(v.reasons.join(" "), /F-9/);
});

test("CERT-05 refuses when a source could not be mechanically re-verified", () => {
  const v = evaluateCertification({
    ...passingInput(),
    reverification: [{ finding_id: "F-2", evidence_intact: false, re_fetched: false, retrieval_status: "unreachable" }],
  });
  assert.equal(v.certified, false);
  assert.ok(v.failed_rules.includes("CERT-05"));
  assert.deepEqual(v.unverified_finding_ids, ["F-2"]);
});

test("CERT-06 refuses an unresolved hallucination flag", () => {
  const v = evaluateCertification({ ...passingInput(), hallucination_flags: ["impossible date of birth"] });
  assert.equal(v.certified, false);
  assert.ok(v.failed_rules.includes("CERT-06"));
});

test("CERT-07 refuses a score below the threshold, and the threshold is real", () => {
  const v = evaluateCertification({ ...passingInput(), qa_score: CERTIFICATION_THRESHOLDS.minimum_score - 1 });
  assert.equal(v.certified, false);
  assert.ok(v.failed_rules.includes("CERT-07"));

  const edge = evaluateCertification({ ...passingInput(), qa_score: CERTIFICATION_THRESHOLDS.minimum_score });
  assert.equal(edge.certified, true, "exactly at the threshold passes");
});

test("CERT-08 refuses a case that records no sources actually queried", () => {
  const v = evaluateCertification({ ...passingInput(), sources_actually_queried: [] });
  assert.equal(v.certified, false);
  assert.ok(v.failed_rules.includes("CERT-08"));
});

test("CERT-09 refuses a case whose evidence register is empty, closing the vacuous pass", () => {
  const v = evaluateCertification({ ...passingInput(), reverification: [] });
  assert.equal(v.certified, false);
  assert.ok(v.failed_rules.includes("CERT-09"));
  assert.deepEqual(v.verified_finding_ids, []);
});

test("CERT-09 refuses a case where nothing survived re-verification", () => {
  const v = evaluateCertification({
    ...passingInput(),
    reverification: [
      { finding_id: "F-1", evidence_intact: false, re_fetched: false, retrieval_status: "unreachable" },
      { finding_id: "F-2", evidence_intact: false, re_fetched: true, retrieval_status: "source_changed" },
    ],
  });
  assert.equal(v.certified, false);
  assert.ok(v.failed_rules.includes("CERT-09"));
  assert.deepEqual(v.unverified_finding_ids, ["F-1", "F-2"]);
});

test("every failing rule is named in the refusal, not summarised away", () => {
  const v = evaluateCertification({ ...passingInput(), qa_score: 10, validator_score: 10, hallucination_flags: ["x"] });
  assert.ok(v.failed_rules.includes("CERT-06"));
  assert.ok(v.failed_rules.includes("CERT-07"));
  const reason = refusalReason(v);
  assert.match(reason, /CERT-06/);
  assert.match(reason, /CERT-07/);
});

test("isCertified demands both the verdict and demonstrable separation", () => {
  assert.equal(isCertified({ certified: true, model_separation_ok: true }), true);
  assert.equal(isCertified({ certified: true, model_separation_ok: false }), false);
  assert.equal(isCertified(null), false);
});

/* ------------------------------------------------------------------ */
/* Mechanical re-verification                                          */
/* ------------------------------------------------------------------ */

const realFetch = globalThis.fetch;
const stubFetch = (impl) => { globalThis.fetch = impl; };
const restoreFetch = () => { globalThis.fetch = realFetch; };

const PAGE = "<html><body>Property record — owner: A. Example, phone 555-0100</body></html>";

test("the digest is a 64-character sha-256 hex string", async () => {
  const hash = await sha256Hex("abc");
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.equal(hash, await sha256Hex("abc"));
  assert.notEqual(hash, await sha256Hex("abd"));
});

test("an invalid target is rejected before any fetch is attempted", async () => {
  let called = false;
  stubFetch(async () => { called = true; return { ok: true, status: 200, redirected: false, text: async () => PAGE }; });
  try {
    const out = await reverifySource({ finding_id: "F-1", source_url: "not-a-url" });
    assert.equal(out.status, "invalid_target");
    assert.equal(out.evidence_intact, false);
    assert.equal(called, false);
  } finally { restoreFetch(); }

  const noId = await reverifySource({ finding_id: "", source_url: "https://example.com/a" });
  assert.equal(noId.status, "invalid_target");
  assert.match(noId.error, /finding_id/i);
});

test("isReverifiableTarget requires both an id and a real http url", () => {
  assert.equal(isReverifiableTarget({ finding_id: "F-1", source_url: "https://example.com/a" }), true);
  assert.equal(isReverifiableTarget({ finding_id: "F-1", source_url: "ftp://example.com/a" }), false);
  assert.equal(isReverifiableTarget({ finding_id: "", source_url: "https://example.com/a" }), false);
});

test("a re-fetch that still carries the recorded excerpt re-verifies", async () => {
  stubFetch(async () => ({ ok: true, status: 200, redirected: false, text: async () => PAGE }));
  try {
    const out = await reverifySource({
      finding_id: "F-1",
      source_url: "https://example.com/record",
      evidence_excerpt: "owner: A. Example",
    });
    assert.equal(out.status, "re_verified");
    assert.equal(out.re_fetched, true);
    assert.equal(out.evidence_intact, true);
    assert.equal(out.excerpt_present, true);
  } finally { restoreFetch(); }
});

test("whitespace and case differences do not cause a false miss", async () => {
  stubFetch(async () => ({ ok: true, status: 200, redirected: false, text: async () => "<div>OWNER:\n\n   A.   Example</div>" }));
  try {
    const out = await reverifySource({
      finding_id: "F-1",
      source_url: "https://example.com/record",
      evidence_excerpt: "owner: a. example",
    });
    assert.equal(out.excerpt_present, true);
    assert.equal(out.evidence_intact, true);
  } finally { restoreFetch(); }
});

test("an exact byte match re-verifies even without an excerpt", async () => {
  stubFetch(async () => ({ ok: true, status: 200, redirected: false, text: async () => PAGE }));
  try {
    const out = await reverifySource({
      finding_id: "F-1",
      source_url: "https://example.com/record",
      content_hash: await sha256Hex(PAGE),
    });
    assert.equal(out.hash_matches, true);
    assert.equal(out.evidence_intact, true);
  } finally { restoreFetch(); }
});

test("a changed page with no matching evidence is reported as source_changed, not as verified", async () => {
  stubFetch(async () => ({ ok: true, status: 200, redirected: false, text: async () => "<html>Service unavailable — maintenance</html>" }));
  try {
    const out = await reverifySource({
      finding_id: "F-1",
      source_url: "https://example.com/record",
      content_hash: await sha256Hex(PAGE),
      evidence_excerpt: "owner: A. Example",
    });
    assert.equal(out.status, "source_changed");
    assert.equal(out.re_fetched, true);
    assert.equal(out.evidence_intact, false);
    assert.equal(out.excerpt_present, false);
  } finally { restoreFetch(); }
});

test("a 404 is an unreachable source, never a negative finding", async () => {
  stubFetch(async () => ({ ok: false, status: 404, redirected: false, text: async () => "" }));
  try {
    const out = await reverifySource({ finding_id: "F-1", source_url: "https://example.com/gone" });
    assert.equal(out.status, "unreachable");
    assert.equal(out.re_fetched, false);
    assert.equal(out.evidence_intact, false);
    assert.equal(out.http_status, 404);
  } finally { restoreFetch(); }
});

test("a transport error is reported as unreachable with its cause", async () => {
  stubFetch(async () => { throw new Error("connection reset by peer"); });
  try {
    const out = await reverifySource({ finding_id: "F-1", source_url: "https://example.com/x" });
    assert.equal(out.status, "unreachable");
    assert.match(out.error, /connection reset/);
    assert.equal(out.evidence_intact, false);
  } finally { restoreFetch(); }
});

test("a timeout is reported as unreachable, and never as a pass", async () => {
  stubFetch(async () => {
    const err = new Error("aborted");
    err.name = "AbortError";
    throw err;
  });
  try {
    const out = await reverifySource({ finding_id: "F-1", source_url: "https://example.com/slow" }, { timeout_ms: 1 });
    assert.equal(out.status, "unreachable");
    assert.match(out.error, /No response/i);
  } finally { restoreFetch(); }
});

test("reverifyAll counts outcomes and never throws on a mixed batch", async () => {
  stubFetch(async (url) => {
    if (String(url).includes("gone")) return { ok: false, status: 404, redirected: false, text: async () => "" };
    return { ok: true, status: 200, redirected: false, text: async () => PAGE };
  });
  try {
    const report = await reverifyAll([
      { finding_id: "F-1", source_url: "https://example.com/ok", evidence_excerpt: "owner: A. Example" },
      { finding_id: "F-2", source_url: "https://example.com/gone" },
    ]);
    assert.equal(report.outcomes.length, 2);
    assert.equal(report.re_verified, 1);
    assert.equal(report.failed, 1);
    assert.equal(report.counts_by_status.re_verified, 1);
    assert.equal(report.counts_by_status.unreachable, 1);
  } finally { restoreFetch(); }
});

test("evidence records are collected from a bare array and from stored wrappers", () => {
  const bare = collectEvidenceRecords([
    { finding_id: "F-1", source_url: "https://a.example/x", content_hash: "a".repeat(64) },
  ]);
  assert.equal(bare.length, 1);
  assert.equal(bare[0].finding_id, "F-1");

  const wrapped = collectEvidenceRecords({
    evidence_records: [{ finding_id: "F-2", source_url: "https://b.example/y" }],
    skip_traces: [{ search_results: { evidence_records: [{ finding_id: "F-3", source_url: "https://c.example/z" }] } }],
  });
  assert.deepEqual(wrapped.map((r) => r.finding_id), ["F-2", "F-3"]);

  assert.deepEqual(collectEvidenceRecords(null), []);
});

/* ------------------------------------------------------------------ */
/* Honest coverage                                                     */
/* ------------------------------------------------------------------ */

test("with no credentials configured, every source is BLOCKED and none is silently skipped", () => {
  const report = reportSourceReadiness({});
  assert.equal(report.available.length, 0);
  assert.equal(report.blocked.length, SOURCE_ADAPTERS.length);
  assert.match(report.summary, /0 of \d+ licensed and public sources are configured/);
});

test("a blocked adapter names the exact credential it is missing", () => {
  const report = reportSourceReadiness({});
  const tloxp = report.blocked.find((b) => b.id === "tloxp");
  assert.ok(tloxp);
  assert.deepEqual(tloxp.missing_credentials, ["TLOXP_API_KEY", "TLOXP_SUBSCRIBER_ID"]);
  assert.match(tloxp.authority, /permissible-use|FCRA/i);
});

test("an adapter resolves to available only when every required credential is present", () => {
  const adapter = SOURCE_ADAPTERS.find((a) => a.id === "ssdi");
  assert.equal(adapterReadiness({}, adapter).status, "blocked");
  assert.equal(adapterReadiness({ SSDI_ACCESS_TOKEN: "t" }, adapter).status, "available");
  assert.equal(adapterReadiness({ SSDI_ACCESS_TOKEN: "   " }, adapter).status, "blocked");
});

test("the disclosure names every unavailable source and says they were not searched", () => {
  const disclosure = blockedSourcesDisclosure(reportSourceReadiness({}));
  assert.match(disclosure, /NOT searched/);
  assert.match(disclosure, /TLOxp/);
  assert.match(disclosure, /TLOXP_API_KEY/);
});

test("no disclosure is emitted when every source is available", () => {
  const env = {};
  for (const adapter of SOURCE_ADAPTERS) for (const key of adapter.credential_env) env[key] = "present";
  const report = reportSourceReadiness(env);
  assert.equal(report.blocked.length, 0);
  assert.equal(blockedSourcesDisclosure(report), "");
});