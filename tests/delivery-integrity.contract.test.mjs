/**
 * Report-delivery integrity contracts.
 *
 * P0 — nothing leaves the building claiming certification without a live,
 *      unstale certificate AND a named investigator's approval; drafts remain
 *      allowed but may not carry certification language.
 * P4 — a drifted or unreachable live page must not invalidate a properly
 *      preserved original, and must still route to a human.
 * P1 — kinship is never inferred from a surname, a shared address or
 *      co-ownership, and no verdict this engine can produce declares a legal heir.
 *
 * These exercise the real modules. Nothing here asserts a rule that lives only
 * in a comment.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  SEARCH_PATH_MODEL,
  QA_MODEL,
  VALIDATOR_MODEL,
  evaluateCertification,
  caseFingerprint,
  isCertificationStale,
  isCertified,
} from "../base44/shared/independentCertification.ts";

import { decideReverification } from "../base44/shared/sourceReverification.ts";

import {
  decideDelivery,
  resolveMode,
  findCertificationClaims,
  stripQuotedMaterial,
  QUOTED_MATERIAL_ATTRIBUTE,
  DELIVERY_GATE_VERSION,
} from "../base44/shared/deliveryGate.ts";

import {
  evaluateKinshipClaim,
  buildFamilyGraph,
  candidateHeirs,
  NEVER_A_LEGAL_HEIR_NOTICE,
} from "../base44/shared/kinshipEngine.ts";

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const CASE = (overrides = {}) => ({
  id: "case-1",
  deceased_name: "A. Decedent",
  deceased_dob: "1940-01-01",
  deceased_dod: "2024-06-01",
  death_location: "Travis County, TX",
  identified_heirs: [{ name: "B. Child", relationship: "child" }],
  family_tree: { children: ["B. Child"] },
  sources_checked: ["county assessor"],
  methods_used: ["obituary search"],
  ...overrides,
});

const liveCertification = (fingerprint) =>
  evaluateCertification({
    search_model: SEARCH_PATH_MODEL,
    qa_model: QA_MODEL,
    validator_model: VALIDATOR_MODEL,
    qa_score: 94,
    validator_score: 96,
    blocking_violations: [],
    corroboration: [{ finding_id: "F-1", independent_sources: 2 }],
    reverification: [{ finding_id: "F-1", evidence_intact: true, re_fetched: true, retrieval_status: "re_verified" }],
    hallucination_flags: [],
    sources_actually_queried: ["county assessor"],
    case_fingerprint: fingerprint,
  });

const APPROVAL = { approved: true, approved_by_email: "investigator@firm.example", approved_at: "2026-10-20T12:00:00Z" };

/* ------------------------------------------------------------------ */
/* P0 — the delivery gate                                              */
/* ------------------------------------------------------------------ */

test("a draft is always permitted and always watermarked", () => {
  const d = decideDelivery({ mode: "draft" });
  assert.equal(d.allowed, true);
  assert.equal(d.mode, "draft");
  assert.equal(d.watermark.tone, "draft");
  assert.match(d.watermark.title, /NOT CERTIFIED/);
  assert.equal(d.gate_version, DELIVERY_GATE_VERSION);
});

test("an unset mode resolves to draft, never to certified", () => {
  for (const raw of [undefined, null, "", "  ", "CERTIFIED!", "yes", 0, {}]) {
    assert.equal(resolveMode(raw), "draft", `mode ${JSON.stringify(raw)} must not be read as certified`);
  }
  assert.equal(resolveMode("certified"), "certified");
  assert.equal(resolveMode("  Certified  "), "certified");
});

test("requesting a certified report with no certificate is refused, not silently downgraded", () => {
  const d = decideDelivery({ mode: "certified", certification: null, current_fingerprint: caseFingerprint(CASE()) });
  assert.equal(d.allowed, false);
  assert.equal(d.refused_certified_delivery, true);
  assert.ok(d.failed_rules.includes("DEL-01"));
  assert.match(d.reasons.join(" "), /DEL-01/);
});

test("a certificate with no investigator approval is refused", () => {
  const fp = caseFingerprint(CASE());
  const d = decideDelivery({
    mode: "certified",
    certification: liveCertification(fp),
    investigator_review: null,
    current_fingerprint: fp,
  });
  assert.equal(d.allowed, false);
  assert.ok(d.failed_rules.includes("DEL-03"));
  assert.equal(d.certification_live, true, "the machine certification is real — it is simply not authority to deliver");
});

test("an investigator rejection refuses delivery outright", () => {
  const fp = caseFingerprint(CASE());
  const d = decideDelivery({
    mode: "certified",
    certification: liveCertification(fp),
    investigator_review: { rejected: true, rejection_reason: "identity not confirmed" },
    current_fingerprint: fp,
  });
  assert.equal(d.allowed, false);
  assert.ok(d.failed_rules.includes("DEL-04"));
  assert.equal(d.investigator_rejected, true);
  assert.equal(d.investigator_approved, false);
});

test("a rejection outranks a stray approval flag on the same record", () => {
  const fp = caseFingerprint(CASE());
  const d = decideDelivery({
    mode: "certified",
    certification: liveCertification(fp),
    investigator_review: { approved: true, rejected: true },
    current_fingerprint: fp,
  });
  assert.equal(d.allowed, false);
  assert.equal(d.investigator_approved, false);
});

test("a stale certificate is refused even with a live approval", () => {
  const certifiedOver = caseFingerprint(CASE());
  const certification = liveCertification(certifiedOver);
  // The case moves on: another heir is added after it was reviewed.
  const movedOn = caseFingerprint(CASE({ identified_heirs: [{ name: "C. Late", relationship: "child" }] }));

  const d = decideDelivery({
    mode: "certified",
    certification,
    investigator_review: APPROVAL,
    current_fingerprint: movedOn,
  });
  assert.equal(d.allowed, false);
  assert.ok(d.failed_rules.includes("DEL-02"));
  assert.equal(d.certification_stale, true);
});

test("a certificate that never recorded what it reviewed cannot be shown to be current", () => {
  const d = decideDelivery({
    mode: "certified",
    certification: liveCertification(""),
    investigator_review: APPROVAL,
    current_fingerprint: caseFingerprint(CASE()),
  });
  assert.equal(d.allowed, false);
  assert.equal(d.certification_stale, true);
});

test("certified delivery is permitted only when the certificate is live, unstale and approved", () => {
  const fp = caseFingerprint(CASE());
  const d = decideDelivery({
    mode: "certified",
    certification: liveCertification(fp),
    investigator_review: APPROVAL,
    current_fingerprint: fp,
  });
  assert.equal(d.allowed, true);
  assert.equal(d.mode, "certified");
  assert.deepEqual(d.failed_rules, []);
  assert.equal(d.watermark.tone, "certified");

  const stamp = d.watermark.lines.join(" | ");
  assert.match(stamp, new RegExp(QA_MODEL));
  assert.match(stamp, new RegExp(VALIDATOR_MODEL));
  assert.match(stamp, /investigator@firm\.example/);
});

test("the draft watermark contains no certification claim of its own", () => {
  const d = decideDelivery({ mode: "draft" });
  const claims = findCertificationClaims(d.watermark.lines.join(" "));
  assert.deepEqual(claims, [], `draft watermark must not assert: ${claims.join(", ")}`);
});

test("honest disclaimers are not mistaken for claims", () => {
  assert.deepEqual(findCertificationClaims("This document has not been independently certified."), []);
  assert.deepEqual(findCertificationClaims("No legal heir is declared here."), []);
  assert.deepEqual(findCertificationClaims("Not court-ready and not a legal heir determination."), []);
});

test("genuine certification language is detected", () => {
  assert.ok(findCertificationClaims("Official Findings Report").includes("official findings report"));
  assert.ok(findCertificationClaims("This case is COURT-READY.").includes("court-ready"));
  assert.ok(findCertificationClaims("The certified findings are attached.").includes("certified findings"));
  assert.ok(findCertificationClaims("Jane Doe is the legal heir.").includes("legal heir"));
});

/* ------------------------------------------------------------------ */
/* Quoted source material vs the document's own voice                  */
/* ------------------------------------------------------------------ */

const quoted = (kind, text) => `<div ${QUOTED_MATERIAL_ATTRIBUTE}="${kind}"><p>${text}</p></div>`;

test("a quoted phrase is not read as the document's own claim", () => {
  const html = `<h1>Draft Investigative Report</h1>${quoted("operator-notes", "earlier run: official findings report generated")}<p>Body.</p>`;
  assert.ok(
    findCertificationClaims(html).includes("official findings report"),
    "the raw text does contain it — which is why the exclusion has to be deliberate",
  );
  assert.deepEqual(findCertificationClaims(stripQuotedMaterial(html)), []);
});

test("a claim in the document's own voice is still caught once quoted material is removed", () => {
  const html = `<h1>Official Findings Report</h1>${quoted("operator-notes", "court-ready per an earlier note")}`;
  const claims = findCertificationClaims(stripQuotedMaterial(html));
  assert.ok(claims.includes("official findings report"));
  assert.ok(!claims.includes("court-ready"));
});

test("every quoted region is removed, and the unquoted text survives", () => {
  const html =
    `<p>Alpha</p>` +
    quoted("obituary-excerpt", "survived by his legal heirs") +
    `<p>Beta</p>` +
    quoted("operator-notes", "unofficial working notes") +
    `<p>Gamma</p>`;

  const stripped = stripQuotedMaterial(html);
  for (const marker of ["Alpha", "Beta", "Gamma"]) assert.ok(stripped.includes(marker));
  assert.ok(!stripped.includes("legal heir"));
  assert.deepEqual(findCertificationClaims(stripped), []);
});

test("an unterminated quoted region cannot swallow the rest of the document", () => {
  const html = `<h1>Official Findings Report</h1><div ${QUOTED_MATERIAL_ATTRIBUTE}="operator-notes"><p>note`;
  assert.ok(findCertificationClaims(stripQuotedMaterial(html)).includes("official findings report"));
});

test("a document with no quoted regions is scanned in full", () => {
  const html = "<h1>Court-Ready Findings</h1>";
  assert.equal(stripQuotedMaterial(html), html);
  assert.ok(findCertificationClaims(stripQuotedMaterial(html)).includes("court-ready"));
});

/* ------------------------------------------------------------------ */
/* Certification fingerprinting                                        */
/* ------------------------------------------------------------------ */

test("the case fingerprint is stable for identical content regardless of key order", () => {
  const a = caseFingerprint({ deceased_name: "X", sources_checked: ["a", "b"], family_tree: { children: ["y"] } });
  const b = caseFingerprint({ family_tree: { children: ["y"] }, sources_checked: ["a", "b"], deceased_name: "X" });
  assert.equal(a, b);
  assert.match(a, /^fp1-[a-f0-9]{16}$/);
});

test("the fingerprint changes when the reviewed content changes", () => {
  const base = caseFingerprint(CASE());
  assert.notEqual(base, caseFingerprint(CASE({ deceased_name: "Someone Else" })));
  assert.notEqual(base, caseFingerprint(CASE({ identified_heirs: [] })));
  assert.notEqual(base, caseFingerprint(CASE({ sources_checked: [] })));
  assert.equal(base, caseFingerprint(CASE()), "unchanged content must not report as changed");
});

test("staleness is only meaningful against a certification that exists", () => {
  assert.equal(isCertificationStale(null, "fp1-deadbeefdeadbeef"), false);
  assert.equal(isCertificationStale({ certified: false }, "fp1-deadbeefdeadbeef"), false);
  assert.equal(isCertificationStale({ certified: true, case_fingerprint: "fp1-1" }, "fp1-1"), false);
  assert.equal(isCertificationStale({ certified: true, case_fingerprint: "fp1-1" }, "fp1-2"), true);
});

test("the certification verdict carries the fingerprint it reviewed", () => {
  const fp = caseFingerprint(CASE());
  const v = liveCertification(fp);
  assert.equal(v.certified, true);
  assert.equal(v.case_fingerprint, fp);
  assert.equal(isCertified(v), true);
});

/* ------------------------------------------------------------------ */
/* P4 — preserved original vs live page                                */
/* ------------------------------------------------------------------ */

const TARGET = { finding_id: "F-1", source_url: "https://example.com/record", evidence_excerpt: "owner: A. Example" };
const NONE_CHECKED = { checked: false, intact: null };

test("a live confirmation re-verifies and is not routed to review", () => {
  const out = decideReverification(TARGET, { reachable: true, http_status: 200, excerpt_present: true }, NONE_CHECKED);
  assert.equal(out.status, "re_verified");
  assert.equal(out.evidence_intact, true);
  assert.equal(out.integrity_basis, "live_page");
  assert.equal(out.triggers_review, false);
  assert.equal(out.live_page_changed, false);
});

test("a drifted live page does NOT invalidate a preserved original, but does route to a human", () => {
  const out = decideReverification(
    TARGET,
    { reachable: true, http_status: 200, excerpt_present: false, hash_matches: false },
    { checked: true, intact: true, hash_matches: true },
  );
  assert.equal(out.status, "re_verified_preserved");
  assert.equal(out.evidence_intact, true, "the original is intact, so the evidence is not lost");
  assert.equal(out.integrity_basis, "preserved_snapshot");
  assert.equal(out.live_page_changed, true);
  assert.equal(out.triggers_review, true, "the publisher changed their page — that is for a human, not for silence");
  assert.match(out.preservation_note, /do not discard the evidence/i);
});

test("an unreachable live page does NOT invalidate a preserved original", () => {
  const out = decideReverification(
    TARGET,
    { reachable: false, http_status: 404 },
    { checked: true, intact: true, hash_matches: true },
  );
  assert.equal(out.status, "re_verified_preserved");
  assert.equal(out.evidence_intact, true);
  assert.equal(out.re_fetched, false, "nothing was successfully fetched, and that is stated plainly");
  assert.equal(out.triggers_review, true);
});

test("without a preserved original, a changed page is source_changed and never a pass", () => {
  const out = decideReverification(TARGET, { reachable: true, http_status: 200, excerpt_present: false }, NONE_CHECKED);
  assert.equal(out.status, "source_changed");
  assert.equal(out.evidence_intact, false);
  assert.equal(out.integrity_basis, "none");
  assert.equal(out.triggers_review, true);
});

test("a preserved copy that fails its own digest rescues nothing", () => {
  const out = decideReverification(
    TARGET,
    { reachable: true, http_status: 200, excerpt_present: false },
    { checked: true, intact: false, hash_matches: false },
  );
  assert.equal(out.status, "source_changed");
  assert.equal(out.evidence_intact, false);
  assert.equal(out.preserved_intact, false);
});

test("a live confirmation is not marked as needing review even when a snapshot also exists", () => {
  const out = decideReverification(
    TARGET,
    { reachable: true, http_status: 200, hash_matches: true, excerpt_present: true },
    { checked: true, intact: true, hash_matches: true },
  );
  assert.equal(out.status, "re_verified");
  assert.equal(out.triggers_review, false);
  assert.equal(out.integrity_basis, "preserved_snapshot", "the strongest available basis is named");
});

test("two unreachable sources with no preserved copy stay unverified", () => {
  const out = decideReverification(TARGET, { reachable: false }, { checked: false, intact: null });
  assert.equal(out.status, "unreachable");
  assert.equal(out.evidence_intact, false);
  assert.equal(out.triggers_review, false);
});

/* ------------------------------------------------------------------ */
/* P1 — kinship never inferred from a weak link                        */
/* ------------------------------------------------------------------ */

const withEvidence = (classes, extra = {}) => ({
  subject_id: "P1",
  relative_id: "P2",
  relation: "child",
  evidence: classes.map((evidence_class) => ({ evidence_class })),
  ...extra,
});

test("a surname match alone is rejected, not merely left unresolved", () => {
  const v = evaluateKinshipClaim(withEvidence(["surname_match"]));
  assert.equal(v.status, "rejected");
  assert.match(v.reasons.join(" "), /KIN-01/);
});

test("a shared address alone is rejected", () => {
  assert.equal(evaluateKinshipClaim(withEvidence(["shared_address"])).status, "rejected");
});

test("co-ownership alone is rejected", () => {
  const v = evaluateKinshipClaim(withEvidence(["co_ownership"]));
  assert.equal(v.status, "rejected");
});

test("an investigator's approval cannot rescue a surname-only claim", () => {
  const v = evaluateKinshipClaim(
    withEvidence(["surname_match"], { review: { decision: "approved", reviewer_email: "i@firm.example" } }),
  );
  assert.equal(v.status, "rejected", "the objection is the evidence, not the absence of a reviewer");
});

test("a vital record establishes a relationship", () => {
  const v = evaluateKinshipClaim(withEvidence(["vital_record"]));
  assert.equal(v.status, "established");
  assert.deepEqual(v.establishing, ["vital_record"]);
  assert.equal(v.requires_review, true);
});

test("supporting evidence alone stays unresolved until a human reviews it", () => {
  const pending = evaluateKinshipClaim(withEvidence(["published_genealogy"]));
  assert.equal(pending.status, "unresolved");
  assert.match(pending.reasons.join(" "), /KIN-03/);

  const reviewed = evaluateKinshipClaim(
    withEvidence(["published_genealogy"], { review: { decision: "approved", reviewer_email: "i@firm.example" } }),
  );
  assert.equal(reviewed.status, "established");
  assert.match(reviewed.reasons.join(" "), /human judgement/i);
});

test("a recorded conflict keeps a claim unresolved until a human resolves it", () => {
  const v = evaluateKinshipClaim(withEvidence(["vital_record"], { conflicts: [{ note: "two different birth years" }] }));
  assert.equal(v.status, "unresolved");
  assert.match(v.reasons.join(" "), /KIN-04/);
});

test("an undetermined relationship is unresolved", () => {
  const v = evaluateKinshipClaim({ ...withEvidence(["vital_record"]), relation: "unknown" });
  assert.equal(v.status, "unresolved");
  assert.match(v.reasons.join(" "), /KIN-05/);
});

test("a claim with no evidence at all is unresolved, never established", () => {
  const v = evaluateKinshipClaim({ subject_id: "P1", relative_id: "P2", relation: "child", evidence: [] });
  assert.equal(v.status, "unresolved");
  assert.match(v.reasons.join(" "), /KIN-02/);
});

test("an investigator rejection is recorded and overrides everything", () => {
  const v = evaluateKinshipClaim(
    withEvidence(["vital_record"], { review: { decision: "rejected", reviewer_email: "i@firm.example", note: "wrong person" } }),
  );
  assert.equal(v.status, "rejected");
  assert.match(v.reasons.join(" "), /KIN-06/);
  assert.match(v.reasons.join(" "), /wrong person/);
});

test("no verdict this engine can produce declares a legal heir", () => {
  const cases = [
    withEvidence(["vital_record"]),
    withEvidence(["surname_match"]),
    withEvidence(["published_genealogy"]),
    withEvidence(["shared_address"], { review: { decision: "approved" } }),
    { subject_id: "P1", relative_id: "P2", relation: "unknown", evidence: [] },
  ];
  for (const claim of cases) {
    const v = evaluateKinshipClaim(claim);
    assert.equal(v.legal_heir_declared, false);
    assert.equal(v.standing, "potential_heir");
    assert.equal(v.requires_review, true, "there is no path to an unreviewed conclusion");
  }
  assert.match(NEVER_A_LEGAL_HEIR_NOTICE, /never legal heirs/);
});

/* ------------------------------------------------------------------ */
/* P1 — the graph                                                      */
/* ------------------------------------------------------------------ */

test("an alias merges only with an establishing basis", () => {
  const graph = buildFamilyGraph({
    persons: [
      { id: "P1", name: "A. Decedent", aliases: [{ name: "A. D. Jr", basis: "vital_record" }] },
      { id: "P2", name: "B. Child", aliases: [{ name: "B. Smith", basis: "surname_match" }] },
    ],
    claims: [withEvidence(["vital_record"])],
  });

  const merged = graph.merged_identities.find((m) => m.kept === "P1");
  assert.deepEqual(merged.merged, ["A. D. Jr"]);

  const surnameOnly = graph.merged_identities.find((m) => m.kept === "P2");
  assert.deepEqual(surnameOnly.merged, [], "a shared surname merges nobody");
  assert.ok(graph.unknown_relatives.includes("B. Smith"), "the unmerged alias stays visible");
});

test("a claim naming someone with no person record is surfaced, never dropped", () => {
  const graph = buildFamilyGraph({
    persons: [{ id: "P1", name: "A. Decedent" }],
    claims: [{ subject_id: "P1", relative_id: "P-ghost", relative_name: "Unknown Person", relation: "child", evidence: [{ evidence_class: "vital_record" }] }],
  });
  assert.ok(graph.unknown_relatives.some((n) => n.includes("Unknown Person")));
});

test("a deceased relative is recorded as a branch, not as a candidate heir", () => {
  const graph = buildFamilyGraph({
    persons: [
      { id: "P1", name: "A. Decedent", deceased: true },
      { id: "P2", name: "B. Child" },
      { id: "P3", name: "C. Grandchild" },
    ],
    claims: [
      { subject_id: "P1", relative_id: "P2", relation: "child", evidence: [{ evidence_class: "vital_record" }] },
      { subject_id: "P2", relative_id: "P3", relation: "child", evidence: [{ evidence_class: "vital_record" }] },
    ],
  });

  assert.equal(graph.deceased_branches.length, 1);
  assert.equal(graph.deceased_branches[0].person_id, "P1");
  assert.ok(graph.deceased_branches[0].connected_ids.includes("P2"));

  const candidates = candidateHeirs(graph);
  assert.ok(candidates.every((c) => c.person_id !== "P1"), "the decedent is never a candidate heir");
  assert.ok(candidates.some((c) => c.person_id === "P2"));
});

test("candidates exclude historical relations and unestablished claims", () => {
  const graph = buildFamilyGraph({
    persons: [
      { id: "P1", name: "A. Decedent" },
      { id: "P2", name: "Ex Spouse" },
      { id: "P3", name: "Neighbour" },
    ],
    claims: [
      { subject_id: "P1", relative_id: "P2", relation: "former_spouse", historical: true, evidence: [{ evidence_class: "vital_record" }] },
      { subject_id: "P1", relative_id: "P3", relation: "sibling", evidence: [{ evidence_class: "shared_address" }] },
    ],
  });

  const candidates = candidateHeirs(graph);
  assert.deepEqual(candidates, [], "a former spouse is not a current heir candidate, and a shared address establishes nothing");
  assert.equal(graph.rejected_claims, 1);
  assert.equal(graph.established_claims, 1);
});

test("every candidate carries its basis and awaits a human", () => {
  const graph = buildFamilyGraph({
    persons: [
      { id: "P1", name: "A. Decedent" },
      { id: "P2", name: "B. Child" },
    ],
    claims: [{ subject_id: "P1", relative_id: "P2", relation: "child", evidence: [{ evidence_class: "obituary" }] }],
  });

  const candidates = candidateHeirs(graph);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].standing, "potential_heir");
  assert.equal(candidates[0].legal_heir_declared, false);
  assert.equal(candidates[0].requires_review, true);
  assert.deepEqual(candidates[0].basis, ["obituary"]);
});