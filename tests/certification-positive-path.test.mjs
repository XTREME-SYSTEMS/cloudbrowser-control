/**
 * POSITIVE CERTIFICATION PATH — the whole chain, and every way it is refused.
 * ==========================================================================
 * Proves the complete authorised workflow end to end:
 *
 *   evidence retrieval -> preserved source -> identity resolution -> kinship
 *   analysis -> independent QA -> independent Validator -> deterministic
 *   certification -> investigator approval -> certified report -> authorised
 *   delivery
 *
 * IMPORTANT — these are SYNTHETIC fixtures. They are constructed in this file,
 * never read from the database and never written to it. A green run here proves
 * the RULES permit a certified delivery; it is NOT evidence that any real case
 * has been certified. Real-case validation is a separate exercise that requires
 * a genuine case with genuine preserved evidence and a named investigator's
 * approval, and no automated test may stand in for it.
 *
 * The negative half is the load-bearing half: rejection, staleness, tampering,
 * conflicting evidence and a missing approval must each be refused.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { caseToFamilyGraph } from "../base44/shared/kinshipAdapter.ts";
import { NEVER_A_LEGAL_HEIR_NOTICE } from "../base44/shared/kinshipEngine.ts";
import {
  SEARCH_PATH_MODEL,
  QA_MODEL,
  VALIDATOR_MODEL,
  evaluateCertification,
  caseFingerprint,
} from "../base44/shared/independentCertification.ts";
import { decideDelivery } from "../base44/shared/deliveryGate.ts";
import { resolveExportVerification } from "../base44/shared/exportVerification.ts";
import {
  buildCaseQueueRow,
  buildEvidenceLedger,
  buildResearchGaps,
  latestAssignment,
  summariseKinshipForUi,
} from "../base44/shared/investigatorBrief.ts";

/* ------------------------------------------------------------------ */
/* Synthetic fixtures                                                  */
/* ------------------------------------------------------------------ */

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

/** A case whose relationships ARE recorded at claim level, with preserved sources. */
const SYNTHETIC_VERIFIABLE_CASE = () => ({
  id: "synth-case-verifiable",
  case_reference: "SYNTH-1",
  deceased_name: "SYNTHETIC Decedent (test fixture)",
  deceased_dob: "1940-01-01",
  deceased_dod: "2024-06-01",
  death_location: "Travis County, TX",
  status: "found",
  deceased_confirmed: true,
  sources_checked: ["county vital records", "probate docket index"],
  methods_used: ["vital record request", "probate docket search"],
  family_tree: { children: ["SYNTHETIC Daughter (test fixture)"] },
  identified_heirs: [
    {
      name: "SYNTHETIC Daughter (test fixture)",
      relationship: "daughter",
      is_living: true,
      evidence: [
        {
          evidence_class: "vital_record",
          source_url: "https://example.gov/vital/synth-1",
          retrieved_at: "2026-10-01T10:00:00Z",
          content_hash: HASH_A,
          excerpt: "synthetic fixture, not a real record",
        },
        {
          evidence_class: "obituary",
          source_url: "https://example.news/obituary/synth-1",
          retrieved_at: "2026-10-01T10:05:00Z",
          content_hash: HASH_B,
        },
      ],
    },
    {
      // Same surname and nothing else. This must never become a relationship.
      name: "SYNTHETIC Cousin (test fixture)",
      relationship: "cousin",
      is_living: true,
      evidence: [{ evidence_class: "surname_match", detail: "surname only, no record" }],
    },
  ],
});

const SYNTHETIC_APPROVAL = {
  approved: true,
  approved_by_email: "investigator@firm.example",
  approved_at: "2026-10-20T12:00:00Z",
};

const liveVerdict = (fingerprint) =>
  evaluateCertification({
    search_model: SEARCH_PATH_MODEL,
    qa_model: QA_MODEL,
    validator_model: VALIDATOR_MODEL,
    qa_score: 94,
    validator_score: 96,
    blocking_violations: [],
    corroboration: [{ finding_id: "F-1", independent_sources: 2 }],
    reverification: [
      { finding_id: "F-1", evidence_intact: true, re_fetched: true, retrieval_status: "re_verified" },
    ],
    hallucination_flags: [],
    sources_actually_queried: ["county vital records", "probate docket index"],
    case_fingerprint: fingerprint,
  });

/* ------------------------------------------------------------------ */
/* 1-2. Evidence retrieval and kinship analysis                        */
/* ------------------------------------------------------------------ */

test("the chain starts from a recorded source, not a name", () => {
  const graph = caseToFamilyGraph(SYNTHETIC_VERIFIABLE_CASE());

  assert.equal(graph.counts.persons, 3, "the decedent and both recorded relatives");
  assert.equal(graph.counts.established, 1, "only the claim carrying a vital record is established");
  assert.equal(graph.counts.rejected, 1, "a surname-only claim is refused");
  assert.equal(graph.counts.unresolved, 0);
  assert.equal(graph.no_recorded_basis, false);
});

test("kinship is never inferred from a surname, a shared address or co-ownership", () => {
  const graph = caseToFamilyGraph({
    deceased_name: "SYNTHETIC Decedent (test fixture)",
    identified_heirs: [
      {
        name: "SYNTHETIC Sibling (test fixture)",
        relationship: "brother",
        is_living: true,
        evidence: [{ evidence_class: "shared_address" }, { evidence_class: "co_ownership" }],
      },
    ],
  });

  assert.equal(graph.counts.established, 0);
  assert.equal(graph.counts.rejected, 1);
  assert.equal(graph.candidates.length, 0, "nothing with no establishing record is put forward as a candidate");
});

test("a relationship term the engine will not infer stays unresolved instead of being collapsed", () => {
  const graph = caseToFamilyGraph({
    deceased_name: "SYNTHETIC Decedent (test fixture)",
    identified_heirs: [
      {
        name: "SYNTHETIC Step-son (test fixture)",
        relationship: "step-son",
        is_living: true,
        evidence: [
          { evidence_class: "vital_record", source_url: "https://example.gov/vital/synth-9", content_hash: HASH_A },
        ],
      },
    ],
  });

  // A step-son is not a son in any succession the courts apply, so the mapping
  // gap is surfaced rather than filled in with a plausible word.
  assert.equal(graph.counts.unresolved, 1);
  assert.equal(graph.counts.established, 0);
});

test("no graph verdict ever declares a legal heir", () => {
  const graph = caseToFamilyGraph(SYNTHETIC_VERIFIABLE_CASE());
  assert.ok(
    graph.disclosure.includes(NEVER_A_LEGAL_HEIR_NOTICE),
    "every disclosure carries the never-a-legal-heir notice",
  );
  assert.ok(graph.candidates.length >= 1, "a living person on an established branch is a research lead");
});

/* ------------------------------------------------------------------ */
/* 3-4. Independent QA, Validator, and the deterministic gate          */
/* ------------------------------------------------------------------ */

test("three distinct models are required, and produce a live certification", () => {
  const verdict = liveVerdict(caseFingerprint(SYNTHETIC_VERIFIABLE_CASE()));

  assert.equal(verdict.model_separation_ok, true);
  assert.equal(verdict.certified, true);
  assert.deepEqual(verdict.failed_rules, []);
  assert.deepEqual(verdict.verified_finding_ids, ["F-1"]);
  assert.equal(verdict.overall_score, 95);
});

test("a case with no preserved source at all cannot be certified", () => {
  const verdict = evaluateCertification({
    search_model: SEARCH_PATH_MODEL,
    qa_model: QA_MODEL,
    validator_model: VALIDATOR_MODEL,
    qa_score: 99,
    validator_score: 99,
    corroboration: [],
    reverification: [],
    hallucination_flags: [],
    sources_actually_queried: ["county vital records"],
    case_fingerprint: caseFingerprint(SYNTHETIC_VERIFIABLE_CASE()),
  });

  assert.equal(verdict.certified, false);
  assert.ok(verdict.failed_rules.includes("CERT-09"), "an absence of proof is not a pass");
});

/* ------------------------------------------------------------------ */
/* 5-6. Approval, certified report and authorised delivery             */
/* ------------------------------------------------------------------ */

test("THE POSITIVE PATH: a certified, approved, current case is authorised for delivery", () => {
  const record = SYNTHETIC_VERIFIABLE_CASE();
  const fingerprint = caseFingerprint(record);

  // identity resolution + kinship analysis
  const kinship = caseToFamilyGraph(record);
  // independent QA + Validator + deterministic certification
  const certification = liveVerdict(fingerprint);
  // investigator approval
  const delivery = decideDelivery({
    mode: "certified",
    certification,
    investigator_review: SYNTHETIC_APPROVAL,
    current_fingerprint: fingerprint,
  });

  assert.equal(delivery.allowed, true, `refused: ${delivery.failed_rules?.join(", ")}`);
  assert.equal(delivery.mode, "certified");
  assert.deepEqual(delivery.failed_rules, []);

  // the same verdict drives the spreadsheet labels
  const verification = resolveExportVerification({
    certification,
    investigator_review: SYNTHETIC_APPROVAL,
    current_fingerprint: fingerprint,
  });
  assert.equal(verification.certification_status, "CERTIFIED");
  assert.equal(verification.evidence_status, "VERIFIED");
  assert.equal(verification.investigator_approval, "APPROVED");
  assert.equal(verification.exportable_as_certified, true);

  // and the investigator's queue row agrees with both
  const row = buildCaseQueueRow({ record, verification, kinship, assignment: { assigned_to_email: "investigator@firm.example" } });
  assert.equal(row.exportable_as_certified, true);
  assert.equal(row.assigned_to_email, "investigator@firm.example");
  assert.equal(row.relationship_counts.established, 1);

  // a fully authorised case carries no open gaps
  const gaps = buildResearchGaps({
    verification,
    kinship,
    blockedSources: null,
    deceased_confirmed: true,
  });
  assert.deepEqual(gaps, [], "a delivered case must not still be advertising gaps");
});

/* ------------------------------------------------------------------ */
/* The refusal matrix                                                  */
/* ------------------------------------------------------------------ */

test("a missing approval refuses certified delivery but still permits a labelled draft", () => {
  const fingerprint = caseFingerprint(SYNTHETIC_VERIFIABLE_CASE());
  const certification = liveVerdict(fingerprint);

  const certified = decideDelivery({
    mode: "certified",
    certification,
    investigator_review: null,
    current_fingerprint: fingerprint,
  });
  assert.equal(certified.allowed, false);
  assert.ok(certified.failed_rules.includes("DEL-03"));

  const draft = decideDelivery({
    mode: "draft",
    certification,
    investigator_review: null,
    current_fingerprint: fingerprint,
  });
  assert.equal(draft.allowed, true, "a working draft remains legitimate");
  assert.equal(draft.mode, "draft");
  assert.match(String(draft.watermark?.title || ""), /DRAFT/i, "the draft says what it is on its face");
});

test("a rejected approval is carried through as a rejection, not as absence", () => {
  const fingerprint = caseFingerprint(SYNTHETIC_VERIFIABLE_CASE());
  const verification = resolveExportVerification({
    certification: liveVerdict(fingerprint),
    investigator_review: { rejected: true, rejection_reason: "identity not confirmed" },
    current_fingerprint: fingerprint,
  });

  assert.equal(verification.investigator_approval, "REJECTED");
  assert.equal(verification.exportable_as_certified, false);
});

test("a case edited after review is stale, and the stale certificate releases nothing", () => {
  const reviewed = caseFingerprint(SYNTHETIC_VERIFIABLE_CASE());
  const edited = caseFingerprint({
    ...SYNTHETIC_VERIFIABLE_CASE(),
    identified_heirs: [{ name: "SYNTHETIC Other (test fixture)", relationship: "child" }],
  });
  assert.notEqual(reviewed, edited);

  const verification = resolveExportVerification({
    certification: liveVerdict(reviewed),
    investigator_review: SYNTHETIC_APPROVAL,
    current_fingerprint: edited,
  });

  assert.equal(verification.certification_status, "STALE");
  assert.equal(verification.exportable_as_certified, false);
});

test("tampered evidence fails re-verification and blocks delivery even with an approval", () => {
  const fingerprint = caseFingerprint(SYNTHETIC_VERIFIABLE_CASE());

  const tampered = evaluateCertification({
    search_model: SEARCH_PATH_MODEL,
    qa_model: QA_MODEL,
    validator_model: VALIDATOR_MODEL,
    qa_score: 98,
    validator_score: 98,
    corroboration: [{ finding_id: "F-1", independent_sources: 3 }],
    reverification: [
      { finding_id: "F-1", evidence_intact: false, re_fetched: true, retrieval_status: "content_changed" },
    ],
    hallucination_flags: [],
    sources_actually_queried: ["county vital records"],
    case_fingerprint: fingerprint,
  });

  assert.equal(tampered.certified, false);
  assert.ok(tampered.failed_rules.includes("CERT-05"));
  assert.deepEqual(tampered.verified_finding_ids, []);
  assert.deepEqual(tampered.unverified_finding_ids, ["F-1"]);

  const delivery = decideDelivery({
    mode: "certified",
    certification: tampered,
    investigator_review: SYNTHETIC_APPROVAL,
    current_fingerprint: fingerprint,
  });
  assert.equal(delivery.allowed, false, "an approval cannot launder unverified evidence");
});

test("conflicting evidence becomes a reviewable gap rather than being resolved silently", () => {
  const record = SYNTHETIC_VERIFIABLE_CASE();
  record.identified_heirs[0].conflicts = [
    { note: "vital record names a different mother than the obituary" },
  ];

  const kinship = caseToFamilyGraph(record);
  assert.equal(kinship.counts.conflicts, 1);

  const verification = resolveExportVerification({
    certification: liveVerdict(caseFingerprint(record)),
    investigator_review: SYNTHETIC_APPROVAL,
    current_fingerprint: caseFingerprint(record),
  });
  const gaps = buildResearchGaps({ verification, kinship, blockedSources: null, deceased_confirmed: true });

  const conflictGaps = gaps.filter((g) => g.code === "KIN-04");
  assert.equal(conflictGaps.length, 1, "an unresolved conflict is surfaced as its own gap");
  assert.match(conflictGaps[0].message, /await/i);
});

test("a blocked source is disclosed as a gap, never skipped quietly", () => {
  const verification = resolveExportVerification({});
  const gaps = buildResearchGaps({
    verification,
    kinship: null,
    blockedSources: {
      blocked: [{ source: "Licensed people-search provider", credential_missing: "PROVIDER_API_KEY" }],
    },
    deceased_confirmed: true,
  });

  const blocked = gaps.filter((g) => g.code === "SRC-BLOCKED");
  assert.equal(blocked.length, 1);
  assert.match(blocked[0].message, /PROVIDER_API_KEY/);
});

/* ------------------------------------------------------------------ */
/* The review surface's own mapping                                    */
/* ------------------------------------------------------------------ */

test("an unconfirmed identity raises its own gap", () => {
  const verification = resolveExportVerification({});
  const gaps = buildResearchGaps({ verification, kinship: null, blockedSources: null, deceased_confirmed: false });
  assert.ok(gaps.some((g) => g.code === "ID-01"));
});

test("the evidence ledger carries only what a record actually holds", () => {
  const ledger = buildEvidenceLedger([
    {
      id: "trace-1",
      search_results: {
        evidence_records: [
          { finding_id: "F-1", source_url: "https://example.gov/vital/synth-1", retrieved_at: "2026-10-01T10:00:00Z", content_hash: HASH_A, status: "verified" },
          { finding_id: "F-2", source_url: "https://example.news/obituary/synth-1", retrieved_at: "2026-10-01T10:05:00Z", content_hash: null, status: "unverified" },
        ],
      },
    },
  ]);

  assert.equal(ledger.length, 2);
  assert.equal(ledger[0].content_hash, HASH_A);
  assert.equal(ledger[1].content_hash, null, "a missing hash renders as absent, not as integrity");
  assert.equal(ledger[1].trace_id, "trace-1");
  assert.deepEqual(buildEvidenceLedger(null), []);
});

test("the newest assignment in the audit trail wins", () => {
  const audit = [
    { timestamp: "2026-10-20T13:00:00Z", metadata: { kind: "investigator_assignment", assigned_to_email: "second@firm.example" } },
    { timestamp: "2026-10-19T09:00:00Z", metadata: { kind: "investigator_assignment", assigned_to_email: "first@firm.example" } },
    { timestamp: "2026-10-18T09:00:00Z", metadata: { kind: "something_else" } },
  ];

  const latest = latestAssignment(audit);
  assert.equal(latest.assigned_to_email, "second@firm.example");
  assert.equal(latest.assigned_at, "2026-10-20T13:00:00Z");
  assert.equal(latestAssignment([]), null);
  assert.equal(latestAssignment(audit, "no_such_kind"), null);
});

test("the UI summary of the graph matches the graph it summarises", () => {
  const graph = caseToFamilyGraph(SYNTHETIC_VERIFIABLE_CASE());
  const ui = summariseKinshipForUi(graph);

  assert.equal(ui.relationships.length, 2);
  assert.equal(ui.counts.established, graph.counts.established);
  assert.equal(ui.disclosure, graph.disclosure);
  assert.ok(ui.relationships.every((r) => typeof r.status === "string"));

  const empty = summariseKinshipForUi(null);
  assert.equal(empty.counts, null);
  assert.deepEqual(empty.relationships, []);
});