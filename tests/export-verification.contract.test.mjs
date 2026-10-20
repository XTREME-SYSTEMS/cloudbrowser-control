/**
 * Spreadsheet export integrity contracts.
 *
 * A spreadsheet is a delivery surface with no watermark: it is filtered, sorted,
 * mailed on and read months later by someone who never saw the case. These tests
 * hold the three export paths to the rule that a row states its own verification
 * status, resolved from the case server-side, and that an uncertified result can
 * never be exported in a form that reads as verified.
 *
 * P1 covers the labels themselves across every state the gate can produce —
 * missing certification, stale certification, rejected approval — and P2 the
 * column arithmetic that keeps existing sheets readable.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  EXPORT_VERIFICATION_COLUMNS,
  APPROVAL_ACTION_TYPE,
  resolveExportVerification,
  approvalRecordToReview,
  buildApprovalMap,
  columnLetter,
  findColumnConflict,
} from "../base44/shared/exportVerification.ts";

import {
  SEARCH_PATH_MODEL,
  QA_MODEL,
  VALIDATOR_MODEL,
  evaluateCertification,
  caseFingerprint,
} from "../base44/shared/independentCertification.ts";

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
/* The labels                                                          */
/* ------------------------------------------------------------------ */

test("an export with no case behind it is uncertified and unverified, never blank", () => {
  const v = resolveExportVerification({});
  assert.equal(v.certification_status, "NOT CERTIFIED");
  assert.equal(v.evidence_status, "UNVERIFIED");
  assert.equal(v.investigator_approval, "PENDING");
  assert.equal(v.exportable_as_certified, false);
  for (const cell of v.row) assert.notEqual(cell, "", "a blank cell reads as 'nothing to declare'");
});

test("missing certification is reported as missing, not as a lesser success", () => {
  const v = resolveExportVerification({
    certification: null,
    investigator_review: APPROVAL,
    current_fingerprint: caseFingerprint(CASE()),
  });
  assert.equal(v.certification_status, "NOT CERTIFIED");
  assert.ok(v.failed_rules.includes("DEL-01"));
  assert.equal(v.exportable_as_certified, false, "an investigator's approval cannot certify work that was never reviewed");
});

test("a stale certification is labelled STALE rather than CERTIFIED", () => {
  const certifiedOver = caseFingerprint(CASE());
  const movedOn = caseFingerprint(CASE({ identified_heirs: [{ name: "C. Late", relationship: "child" }] }));
  const v = resolveExportVerification({
    certification: liveCertification(certifiedOver),
    investigator_review: APPROVAL,
    current_fingerprint: movedOn,
  });
  assert.equal(v.certification_status, "STALE");
  assert.ok(v.failed_rules.includes("DEL-02"));
  assert.equal(v.exportable_as_certified, false);
});

test("a rejected investigator approval is carried through as REJECTED, not as absence", () => {
  const fp = caseFingerprint(CASE());
  const v = resolveExportVerification({
    certification: liveCertification(fp),
    investigator_review: { rejected: true, rejection_reason: "identity not confirmed" },
    current_fingerprint: fp,
  });
  assert.equal(v.investigator_approval, "REJECTED");
  assert.equal(v.exportable_as_certified, false);
  assert.ok(v.failed_rules.includes("DEL-04"));
});

test("certified work with no sign-off shows CERTIFIED beside PENDING", () => {
  const fp = caseFingerprint(CASE());
  const v = resolveExportVerification({
    certification: liveCertification(fp),
    investigator_review: null,
    current_fingerprint: fp,
  });
  // Three columns, three questions: the review did happen, the release did not.
  assert.equal(v.certification_status, "CERTIFIED");
  assert.equal(v.investigator_approval, "PENDING");
  assert.equal(v.exportable_as_certified, false);
  assert.ok(v.failed_rules.includes("DEL-03"));
});

test("only a live, unstale, approved case exports as certified", () => {
  const fp = caseFingerprint(CASE());
  const v = resolveExportVerification({
    certification: liveCertification(fp),
    investigator_review: APPROVAL,
    current_fingerprint: fp,
  });
  assert.equal(v.certification_status, "CERTIFIED");
  assert.equal(v.investigator_approval, "APPROVED");
  assert.equal(v.evidence_status, "VERIFIED");
  assert.equal(v.exportable_as_certified, true);
  assert.deepEqual(v.failed_rules, []);
});

test("a certificate that mixes verified and unverified findings reports PARTIAL", () => {
  const fp = caseFingerprint(CASE());
  const cert = liveCertification(fp);
  cert.unverified_finding_ids = ["F-2"];
  const v = resolveExportVerification({
    certification: cert,
    investigator_review: APPROVAL,
    current_fingerprint: fp,
  });
  assert.equal(v.certification_status, "CERTIFIED");
  assert.equal(v.evidence_status, "PARTIAL", "certified is not the same claim as fully sourced");
});

test("verified sources without certification still read PARTIAL, never VERIFIED", () => {
  const v = resolveExportVerification({
    certification: { certified: false, verified_finding_ids: ["F-1"] },
    investigator_review: APPROVAL,
    current_fingerprint: caseFingerprint(CASE()),
  });
  assert.equal(v.certification_status, "NOT CERTIFIED");
  assert.equal(v.evidence_status, "PARTIAL");
});

test("a caller-supplied confidence figure cannot promote a case", () => {
  // The payload an exporter might be handed: a high producer score, nothing else.
  const v = resolveExportVerification({
    certification: { certified: false, confidence_score: 99, qa_score: 100, validator_score: 100 },
    investigator_review: null,
    current_fingerprint: caseFingerprint(CASE()),
  });
  assert.equal(v.certification_status, "NOT CERTIFIED");
  assert.equal(v.evidence_status, "UNVERIFIED");
  assert.equal(v.exportable_as_certified, false);
});

test("the row is emitted in the declared column order", () => {
  assert.deepEqual([...EXPORT_VERIFICATION_COLUMNS], [
    "Certification Status",
    "Evidence Status",
    "Investigator Approval",
  ]);
  const v = resolveExportVerification({});
  assert.equal(v.row.length, EXPORT_VERIFICATION_COLUMNS.length);
  assert.equal(v.row[0], v.certification_status);
  assert.equal(v.row[1], v.evidence_status);
  assert.equal(v.row[2], v.investigator_approval);
});

/* ------------------------------------------------------------------ */
/* Approval records                                                    */
/* ------------------------------------------------------------------ */

test("only a granted approval grants approval", () => {
  for (const status of ["pending", "expired", "revoked", "", "GRANTED"]) {
    const review = approvalRecordToReview({ status });
    assert.equal(review?.approved === true, false, `${status} must not authorise delivery`);
    assert.equal(review?.rejected === true, false);
  }
  assert.equal(approvalRecordToReview({ status: "granted" })?.approved, true);
  assert.equal(approvalRecordToReview({ status: "rejected" })?.rejected, true);
  assert.equal(approvalRecordToReview(null), null);
});

test("a rejection keeps its reason, so a refusal can say why", () => {
  const review = approvalRecordToReview({
    status: "rejected",
    reason: "deceased identity unconfirmed",
    approved_by: "i@firm.example",
  });
  assert.equal(review.rejected, true);
  assert.equal(review.rejection_reason, "deceased identity unconfirmed");
  assert.equal(review.approved_by_email, "i@firm.example");
});

test("the latest approval per case wins, and rows with no case are ignored", () => {
  const map = buildApprovalMap([
    { target: "case-1", status: "rejected", reason: "later decision" },
    { target: "case-1", status: "granted" },
    { status: "granted" },
    { target: "case-2", status: "granted" },
  ]);
  assert.equal(map["case-1"].rejected, true, "the newest row decides, not the first approval found");
  assert.equal(map["case-2"].approved, true);
  assert.equal(Object.keys(map).length, 2);
});

test("buildApprovalMap reads a paginated result and tolerates junk", () => {
  assert.deepEqual(buildApprovalMap(null), {});
  assert.deepEqual(buildApprovalMap({ items: [] }), {});
  const map = buildApprovalMap({ items: [{ target: "c", status: "granted" }] });
  assert.equal(map.c.approved, true);
});

test("the approval action type is the one the delivery gate reads", () => {
  // Shared so the writer and the readers cannot drift apart.
  assert.equal(APPROVAL_ACTION_TYPE, "heir_search_report_approval");
});

/* ------------------------------------------------------------------ */
/* Column arithmetic                                                   */
/* ------------------------------------------------------------------ */

test("column letters stay correct past Z", () => {
  assert.equal(columnLetter(1), "A");
  assert.equal(columnLetter(14), "N");
  assert.equal(columnLetter(17), "Q");
  assert.equal(columnLetter(26), "Z");
  assert.equal(columnLetter(27), "AA");
  assert.equal(columnLetter(31), "AE");
  assert.equal(columnLetter(34), "AH");
  assert.equal(columnLetter(0), "A", "a zero width is clamped rather than yielding an empty range");
});

/* ------------------------------------------------------------------ */
/* The export paths themselves                                         */
/* ------------------------------------------------------------------ */

const EXPORTS = {
  exportHeirToSheet: {
    path: "base44/functions/exportHeirToSheet/entry.ts",
    columns: 17,
    rowSites: 2,
    deepColumns: 34,
    conditionalHeader: true,
  },
  exportSkipTraceToSheet: {
    path: "base44/functions/exportSkipTraceToSheet/entry.ts",
    columns: 20,
    rowSites: 1,
    conditionalHeader: true,
  },
  syncHeirSheet: {
    path: "base44/functions/syncHeirSheet/entry.ts",
    columns: 19,
    rowSites: 2,
    conditionalHeader: false,
  },
};

const source = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

function countColumns(body) {
  const literals = (body.match(/"(?:[^"\\]|\\.)*"/g) || []).length;
  const spreads = (body.match(/\.\.\.EXPORT_VERIFICATION_COLUMNS/g) || []).length;
  return literals + spreads * EXPORT_VERIFICATION_COLUMNS.length;
}

for (const [name, spec] of Object.entries(EXPORTS)) {
  test(`${name} writes one verification cell per declared column`, () => {
    const src = source(spec.path);

    const columns = src.match(/const COLUMNS = \[([\s\S]*?)\];/);
    assert.ok(columns, `${name} must define COLUMNS`);
    assert.equal(
      countColumns(columns[1]),
      spec.columns,
      `${name} column count drifted — the header row and the data rows would misalign`,
    );

    // Every row-building site must append the three indicators, or a row would
    // be shorter than its header and silently shift on read.
    const rowSites = (src.match(/\.\.\.verification\.row/g) || []).length;
    assert.equal(rowSites, spec.rowSites, `${name} has ${spec.rowSites} row site(s); each must append the indicators`);

    // The verification columns are appended, never inserted: existing columns
    // keep their positions so downstream reads of A..N keep working.
    assert.ok(
      /"Export Date",\s*\n\s*\.\.\.EXPORT_VERIFICATION_COLUMNS|"Sync Date",\s*\n\s*\.\.\.EXPORT_VERIFICATION_COLUMNS|"Duration \(s\)",\s*\n\s*\.\.\.EXPORT_VERIFICATION_COLUMNS/.test(src),
      `${name} must append the verification columns after the existing ones`,
    );
  });

  test(`${name} resolves verification rather than trusting the payload`, () => {
    const src = source(spec.path);
    assert.ok(
      /resolveExportVerification\(|resolveCaseVerificationForExport\(/.test(src),
      `${name} must resolve verification from the case record`,
    );
  });

  test(`${name} does not read the header row at a stale width`, () => {
    const src = source(spec.path);
    assert.ok(!/!A1:N1|!A1:AE1/.test(src), `${name} still contains a hardcoded header range`);
    if (spec.conditionalHeader) {
      // These write the header row only when it is missing or too narrow, so the
      // width they read it at must be derived from the columns they write.
      assert.ok(/columnLetter\(/.test(src), `${name} must derive its header range width`);
    } else {
      // syncHeirSheet rewrites the header row wholesale, so it has no stale width
      // to read; what matters is that it clears every column it writes.
      assert.ok(/columnLetter\(/.test(src) || /A2:Z/.test(src), `${name} must clear the columns it writes`);
    }
  });
}

test("the deep findings tab is widened along with the main tab", () => {
  const src = source(EXPORTS.exportHeirToSheet.path);
  const deep = src.match(/const DEEP_COLUMNS = \[([\s\S]*?)\];/);
  assert.ok(deep);
  assert.equal(countColumns(deep[1]), EXPORTS.exportHeirToSheet.deepColumns);
});

test("syncHeirSheet projects every field the fingerprint hashes", () => {
  // A narrower projection would recompute a different fingerprint and mark a
  // perfectly current certificate stale — a false alarm on every row.
  const src = source(EXPORTS.syncHeirSheet.path);
  const projection = src.match(/fields: \[([\s\S]*?)\]/);
  assert.ok(projection, "syncHeirSheet must project an explicit field list");
  for (const field of [
    "deceased_name",
    "deceased_dob",
    "deceased_dod",
    "death_location",
    "identified_heirs",
    "family_tree",
    "sources_checked",
    "methods_used",
    "certification",
  ]) {
    assert.ok(
      projection[1].includes(`"${field}"`),
      `syncHeirSheet must project ${field} — caseFingerprint() hashes it`,
    );
  }
});

test("a tab holding another writer's layout is detected positionally", () => {
  const expected = ["Case Ref", "Deceased Name", "Heir Name"];
  assert.equal(findColumnConflict(expected, ["Case Ref", "Deceased Name", "Heir Name"]), null);
  assert.equal(
    findColumnConflict(expected, ["Case Ref", "Deceased Name", "Heir Name", "Extra"])?.index,
    undefined,
    "extra columns past the end are not a conflict — that is how a tab is widened",
  );

  // The real case: the tracking sync writes Status where this export writes Heir Name.
  const conflict = findColumnConflict(expected, ["Case Ref", "Deceased Name", "Status"]);
  assert.equal(conflict.index, 2);
  assert.equal(conflict.expected, "Heir Name");
  assert.equal(conflict.existing, "Status");

  const blanks = findColumnConflict(expected, ["Case Ref", "", "Heir Name"]);
  assert.equal(blanks.index, 1, "a blank header is a conflict, not a match");
  assert.equal(blanks.existing, "");
});

test("exportHeirToSheet refuses rather than writing into a conflicting layout", () => {
  const src = source(EXPORTS.exportHeirToSheet.path);
  assert.ok(/findColumnConflict\(COLUMNS, existingHeader\)/.test(src));
  assert.ok(/column_conflict: true/.test(src));
  const status = src.match(/column_conflict: true,[\s\S]*?\}, \{ status: (\d+) \}/);
  assert.equal(status?.[1], "409", "a conflicting layout is a refusal, not a warning");
});

test("syncHeirSheet clears every column it writes", () => {
  const src = source(EXPORTS.syncHeirSheet.path);
  const clear = src.match(/!A2:(\w+)/);
  assert.ok(clear, "syncHeirSheet must clear a bounded range");
  const clearedWidth = clear[1].split("").reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 64), 0);
  assert.ok(
    clearedWidth >= EXPORTS.syncHeirSheet.columns,
    `the clear range covers ${clearedWidth} columns but the sheet writes ${EXPORTS.syncHeirSheet.columns}`,
  );
});

test("an uncertified export is still permitted, and reports itself as a draft", () => {
  for (const [name, spec] of Object.entries(EXPORTS)) {
    const src = source(spec.path);
    assert.ok(
      /export_mode: verification\.exportable_as_certified \? "certified" : "draft"|certified_cases/.test(src),
      `${name} must tell the caller which mode it exported in`,
    );
  }
});