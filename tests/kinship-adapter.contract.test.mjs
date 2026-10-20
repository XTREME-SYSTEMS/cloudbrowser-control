/**
 * Kinship adapter contracts.
 *
 * The adapter is the seam between how a case is stored and what the kinship
 * engine judges. It is the place where evidence could most easily be invented —
 * a case-level source list looks like it supports every relationship in the case
 * — so these tests hold it to mapping only what the record actually says.
 *
 * P1 covers the term mapping and the no-borrowed-evidence rule; P2 covers the
 * graph a case produces, and that no path through it declares a legal heir.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  caseToFamilyGraph,
  claimEvidenceFrom,
  relationKindFromText,
  summariseForAudit,
} from "../base44/shared/kinshipAdapter.ts";

import { NEVER_A_LEGAL_HEIR_NOTICE } from "../base44/shared/kinshipEngine.ts";
import { findCertificationClaims } from "../base44/shared/deliveryGate.ts";

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const CASE = (overrides = {}) => ({
  id: "case-1",
  deceased_name: "A. Decedent",
  status: "found",
  sources_checked: ["county assessor", "obituary index"],
  methods_used: ["obituary search"],
  identified_heirs: [],
  ...overrides,
});

const HEIR = (overrides = {}) => ({ name: "B. Child", relationship: "child", is_living: true, ...overrides });

/* ------------------------------------------------------------------ */
/* P1 — relationship terms map only when unambiguous                    */
/* ------------------------------------------------------------------ */

test("plain relationship terms map to their kind", () => {
  assert.equal(relationKindFromText("son"), "child");
  assert.equal(relationKindFromText("Daughter"), "child");
  assert.equal(relationKindFromText("  CHILD "), "child");
  assert.equal(relationKindFromText("wife"), "spouse");
  assert.equal(relationKindFromText("brother"), "sibling");
  assert.equal(relationKindFromText("grandson"), "grandchild");
  assert.equal(relationKindFromText("niece/nephew"), "niece_nephew");
  assert.equal(relationKindFromText("Ex-Spouse"), "former_spouse");
});

test("qualified relationships are left undetermined rather than flattened", () => {
  // Each of these is a DIFFERENT relationship in succession. Mapping them onto
  // the plain term would assert something the record does not say.
  for (const term of ["step-son", "stepson", "half-brother", "great-niece", "adopted daughter", "grand-nephew"]) {
    assert.equal(relationKindFromText(term), "unknown", `${term} must not be flattened to its plain term`);
  }
});

test("an unknown or absent relationship is undetermined, never guessed", () => {
  for (const raw of ["", "   ", null, undefined, "associate", "neighbour", 42, {}]) {
    assert.equal(relationKindFromText(raw), "unknown");
  }
});

/* ------------------------------------------------------------------ */
/* P1 — evidence is read from the claim, never borrowed                 */
/* ------------------------------------------------------------------ */

test("recognised evidence classes are carried with their provenance", () => {
  const out = claimEvidenceFrom([
    { evidence_class: "vital_record", source_url: "https://example.com/vr", retrieved_at: "2026-10-01T00:00:00Z", content_hash: "a".repeat(64) },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].evidence_class, "vital_record");
  assert.equal(out[0].source_url, "https://example.com/vr");
  assert.equal(out[0].content_hash, "a".repeat(64));
});

test("an unrecognised evidence class is dropped, not guessed at", () => {
  assert.deepEqual(claimEvidenceFrom([{ evidence_class: "vibes" }]), []);
  assert.deepEqual(claimEvidenceFrom([{ evidence_class: "family_resemblance" }]), []);
  assert.deepEqual(claimEvidenceFrom([{ class: "unknown_thing" }]), []);
  assert.deepEqual(claimEvidenceFrom("not an array"), []);
  assert.deepEqual(claimEvidenceFrom([null, "x", 5]), []);
});

test("case-level sources are never attributed to an individual relationship", () => {
  // The case consulted an obituary index and a county assessor. Neither says
  // which heir that supports, so neither may become a basis for any claim.
  const summary = caseToFamilyGraph(
    CASE({
      identified_heirs: [HEIR()],
      deceased_details: { obituary_text: "survived by his son" },
      sources_checked: ["obituary"], // even a source whose NAME is an evidence class
      methods_used: ["vital_record lookup"],
    }),
  );

  assert.equal(summary.counts.established, 0, "a case-level source list must not establish any relationship");
  assert.equal(summary.counts.unresolved, 1);
  assert.deepEqual(summary.graph.edges[0].evidence_classes, []);
  assert.deepEqual(summary.graph.edges[0].reasons.join(" ").includes("KIN-02"), true);
});

/* ------------------------------------------------------------------ */
/* P2 — the graph a case produces                                      */
/* ------------------------------------------------------------------ */

test("a case with no recorded relationship basis says so plainly", () => {
  const summary = caseToFamilyGraph(CASE({ identified_heirs: [HEIR(), HEIR({ name: "C. Child" })] }));

  assert.equal(summary.counts.persons, 3, "the decedent plus two heirs");
  assert.equal(summary.no_recorded_basis, true);
  assert.equal(summary.counts.candidates, 0, "no relationship is supported, so nobody is a research candidate");
  assert.match(summary.disclosure, /No relationship in this case is supported by an establishing record/);
  assert.match(summary.disclosure, /never legal heirs/);
});

test("a relationship carried by a vital record is established and becomes a candidate", () => {
  const summary = caseToFamilyGraph(
    CASE({ identified_heirs: [HEIR({ evidence: [{ evidence_class: "vital_record", source_url: "https://example.com/vr" }] })] }),
  );

  assert.equal(summary.counts.established, 1);
  assert.equal(summary.no_recorded_basis, false);
  assert.equal(summary.counts.candidates, 1);
  assert.equal(summary.candidates[0].standing, "potential_heir");
  assert.equal(summary.candidates[0].legal_heir_declared, false);
  assert.equal(summary.candidates[0].requires_review, true);
  assert.deepEqual(summary.candidates[0].basis, ["vital_record"]);
});

test("a relationship resting only on a shared surname is rejected", () => {
  const summary = caseToFamilyGraph(
    CASE({ identified_heirs: [HEIR({ relationship: "sibling", evidence: [{ evidence_class: "surname_match" }] })] }),
  );

  assert.equal(summary.counts.rejected, 1);
  assert.equal(summary.counts.established, 0);
  assert.match(summary.graph.edges[0].reasons.join(" "), /KIN-01/);
  assert.deepEqual(summary.candidates, []);
});

test("a supporting source alone is unresolved until a human reviews it", () => {
  const summary = caseToFamilyGraph(
    CASE({ identified_heirs: [HEIR({ evidence: [{ evidence_class: "published_genealogy" }] })] }),
  );

  assert.equal(summary.counts.unresolved, 1);
  assert.equal(summary.counts.established, 0);
  assert.equal(summary.counts.candidates, 0);
});

test("a qualified term stays unresolved even with strong evidence", () => {
  // "step-son" with a vital record is still not a determination of the term's
  // meaning: KIN-05 keeps it unresolved for a person to resolve.
  const summary = caseToFamilyGraph(
    CASE({ identified_heirs: [HEIR({ relationship: "step-son", evidence: [{ evidence_class: "vital_record" }] })] }),
  );

  assert.equal(summary.counts.unresolved, 1);
  assert.match(summary.graph.edges[0].reasons.join(" "), /KIN-05/);
});

test("a person recorded as not living is a branch, never a candidate", () => {
  const summary = caseToFamilyGraph(
    CASE({
      identified_heirs: [
        HEIR({ name: "Deceased Son", is_living: false, evidence: [{ evidence_class: "vital_record" }] }),
        HEIR({ name: "Living Grandchild" }),
      ],
    }),
  );

  assert.equal(summary.counts.deceased_branches, 1);
  assert.equal(summary.graph.deceased_branches[0].name, "Deceased Son");
  assert.ok(!summary.candidates.some((c) => c.name === "Deceased Son"));
});

test("an heir with no name is not invented into the graph", () => {
  const summary = caseToFamilyGraph(CASE({ identified_heirs: [HEIR({ name: "" }), null, HEIR({ name: "Real Person" })] }));
  assert.equal(summary.counts.persons, 2, "the decedent and the one named heir");
  assert.equal(summary.counts.unresolved, 1);
});

test("a case with no heirs yields no claims and no candidates", () => {
  const summary = caseToFamilyGraph(CASE({ identified_heirs: [] }));
  assert.equal(summary.counts.persons, 1);
  assert.deepEqual(summary.graph.edges, []);
  assert.deepEqual(summary.candidates, []);
  assert.match(summary.disclosure, /No relationship claims are recorded/);
});

test("a case with no identified_heirs field at all is handled", () => {
  const summary = caseToFamilyGraph({ deceased_name: "X" });
  assert.equal(summary.counts.persons, 1);
  assert.equal(summary.disclosure.includes(NEVER_A_LEGAL_HEIR_NOTICE), true);
});

test("the graph is deterministic for the same case", () => {
  const record = CASE({ identified_heirs: [HEIR({ evidence: [{ evidence_class: "vital_record" }] })] });
  assert.deepEqual(caseToFamilyGraph(record).graph, caseToFamilyGraph(record).graph);
});

/* ------------------------------------------------------------------ */
/* P2 — what reaches the auditor and the report                        */
/* ------------------------------------------------------------------ */

test("the audit view carries the basis and the gaps, not just a count", () => {
  const summary = caseToFamilyGraph(
    CASE({
      identified_heirs: [
        HEIR({ evidence: [{ evidence_class: "obituary" }] }),
        HEIR({ name: "C. Cousin", relationship: "cousin", evidence: [{ evidence_class: "shared_address" }] }),
        HEIR({ name: "D. Unknown", relationship: "step-brother" }),
      ],
    }),
  );

  const audit = summariseForAudit(summary);
  assert.equal(audit.counts.established, 1);
  assert.equal(audit.counts.rejected, 1);
  assert.equal(audit.counts.unresolved, 1);
  assert.equal(audit.relationships.length, 3);
  assert.ok(audit.relationships.every((r) => Array.isArray(r.reasons) && r.reasons.length > 0));
  assert.ok(audit.relationships.every((r) => r.status !== "established" || r.evidence_classes.length > 0),
    "nothing may be established without a recorded basis");
  assert.equal(audit.rule_versions.kinship.length > 0, true);
});

test("the disclosure an auditor and a report both receive makes no certification claim", () => {
  const cases = [
    CASE({ identified_heirs: [HEIR()] }),
    CASE({
      identified_heirs: [
        HEIR({ evidence: [{ evidence_class: "vital_record" }] }),
        HEIR({ name: "C. Cousin", relationship: "cousin", evidence: [{ evidence_class: "surname_match" }] }),
      ],
    }),
    CASE({ identified_heirs: [] }),
  ];

  for (const record of cases) {
    const summary = caseToFamilyGraph(record);
    const claims = findCertificationClaims(summary.disclosure);
    assert.deepEqual(claims, [], `the disclosure must not assert: ${claims.join(", ")}`);
  }
});

test("no path through the adapter declares a legal heir", () => {
  const scenarios = [
    CASE({ identified_heirs: [HEIR({ evidence: [{ evidence_class: "vital_record" }] })] }),
    CASE({ identified_heirs: [HEIR()] }),
    CASE({ identified_heirs: [HEIR({ relationship: "son", evidence: [{ evidence_class: "probate_filing" }] })] }),
  ];

  for (const record of scenarios) {
    const summary = caseToFamilyGraph(record);
    for (const candidate of summary.candidates) {
      assert.equal(candidate.legal_heir_declared, false);
      assert.equal(candidate.requires_review, true);
    }
    assert.match(summary.disclosure, /never legal heirs|No relationship claims/);
  }
});