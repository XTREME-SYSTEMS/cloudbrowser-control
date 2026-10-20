/**
 * Contract tests for the strict search validation gate.
 *
 * These transpile and execute the real rule engine rather than pattern-matching
 * its source, so a rule that is deleted, renamed, or quietly downgraded from
 * blocking to advisory fails here.
 *
 * Run: node --test tests/search-validation.contract.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const sourcePath = new URL('../base44/shared/searchValidation.ts', import.meta.url);
const source = readFileSync(sourcePath, 'utf8');

const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});

const mod = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);

const {
  validateSearchRequest,
  validateEvidenceRecord,
  validateRetrievalOutcome,
  validateRelationship,
  validateReport,
  authorizeSearch,
  blockingRules,
  listPermissiblePurposes,
  isPermissiblePurpose,
  EVIDENCE_STATES,
  EVIDENCE_STATE_ORDER,
  REGULATED_DATA_CATEGORIES,
} = mod;

const HEX64 = 'a'.repeat(64);
const NOW = '2026-10-20T12:00:00.000Z';

const validAuth = {
  permissible_purpose: 'fiduciary_duty',
  legal_matter: 'Estate of J. Doe — probate administration, Harris County',
  case_reference: 'PROB-2026-00412',
  requested_by_id: 'user_123',
  subject_name: 'J. Doe',
  data_categories: [],
};

const rulesOf = (result) => result.violations.map((v) => v.rule);

/* ------------------------------------------------------------------ */
/* AUTH — the FCRA §604 gate                                           */
/* ------------------------------------------------------------------ */

test('a fully authorised search passes with no violations', () => {
  const r = validateSearchRequest(validAuth);
  assert.equal(r.ok, true);
  assert.deepEqual(r.violations, []);
  assert.equal(typeof r.summary, 'string');
});

test('an absent permissible purpose fails as a blocking rule', () => {
  const r = validateSearchRequest({ ...validAuth, permissible_purpose: undefined });
  assert.equal(r.ok, false);
  assert.ok(rulesOf(r).includes('AUTH-01'));
  assert.equal(blockingRules(r)[0].severity, 'blocking');
});

test('a purpose that is not on the FCRA §604 list fails as blocking', () => {
  const r = validateSearchRequest({ ...validAuth, permissible_purpose: 'because_i_want_to' });
  assert.equal(r.ok, false);
  assert.ok(rulesOf(r).includes('AUTH-01'));
  assert.match(r.violations[0].message, /circumstances and no other/);
});

test('a purpose must be an enumerated id, not merely non-empty', () => {
  assert.equal(isPermissiblePurpose('fiduciary_duty'), true);
  assert.equal(isPermissiblePurpose('Fiduciary Duty'), false);
  assert.equal(isPermissiblePurpose(''), false);
  assert.equal(isPermissiblePurpose(null), false);
  assert.ok(listPermissiblePurposes().length >= 8);
});

test('the documented legal matter is required, not reconstructed later', () => {
  const r = validateSearchRequest({ ...validAuth, legal_matter: '   ' });
  assert.equal(r.ok, false);
  assert.ok(rulesOf(r).includes('AUTH-02'));
});

test('a case reference is required so the search is traceable', () => {
  const r = validateSearchRequest({ ...validAuth, case_reference: undefined });
  assert.equal(r.ok, false);
  assert.ok(rulesOf(r).includes('AUTH-03'));
});

test('an unidentified requesting operator fails — the system cannot assert purpose for itself', () => {
  const r = validateSearchRequest({ ...validAuth, requested_by_id: undefined, requested_by_email: undefined });
  assert.equal(r.ok, false);
  assert.ok(rulesOf(r).includes('AUTH-04'));
});

test('an email alone is enough to identify the operator', () => {
  const r = validateSearchRequest({ ...validAuth, requested_by_id: undefined, requested_by_email: 'pi@firm.com' });
  assert.equal(r.ok, true);
});

test('a litigation purpose authorises driver records', () => {
  const r = validateSearchRequest({ ...validAuth, permissible_purpose: 'litigation', data_categories: ['driver_record'] });
  assert.equal(r.ok, true);
});

test('a general business purpose does NOT authorise driver records (DPPA is narrower)', () => {
  const r = validateSearchRequest({
    ...validAuth,
    permissible_purpose: 'business_transaction',
    data_categories: ['driver_record'],
  });
  assert.equal(r.ok, false);
  assert.ok(rulesOf(r).includes('AUTH-05'));
  assert.match(r.violations.find((v) => v.rule === 'AUTH-05').message, /DPPA/);
});

test('a fiduciary duty purpose does NOT authorise medical records', () => {
  const r = validateSearchRequest({ ...validAuth, data_categories: ['medical'] });
  assert.equal(r.ok, false);
  assert.ok(rulesOf(r).includes('AUTH-05'));
});

test('every regulated data category maps to its own authority', () => {
  assert.equal(Object.keys(REGULATED_DATA_CATEGORIES).length, 4);
  assert.match(REGULATED_DATA_CATEGORIES.driver_record.authority, /DPPA/);
  assert.match(REGULATED_DATA_CATEGORIES.financial.authority, /GLBA/);
  assert.match(REGULATED_DATA_CATEGORIES.medical.authority, /HIPAA/);
  // medical must be the narrowest of the four
  assert.ok(
    REGULATED_DATA_CATEGORIES.medical.allowedPurposes.length <
      REGULATED_DATA_CATEGORIES.credit_header.allowedPurposes.length
  );
});

test('authorizeSearch is the same gate the search path calls', () => {
  assert.equal(typeof authorizeSearch, 'function');
  assert.equal(authorizeSearch({}).ok, false);
});

/* ------------------------------------------------------------------ */
/* EVIDENCE — the promotion ladder is sequential and gated              */
/* ------------------------------------------------------------------ */

test('the ladder has six states in ascending order', () => {
  assert.equal(EVIDENCE_STATES.length, 6);
  assert.deepEqual(EVIDENCE_STATES, [
    'unverified_candidate',
    'source_retrieved',
    'identity_corroborated',
    'relationship_documented',
    'investigator_reviewed',
    'report_approved',
  ]);
  const ranks = EVIDENCE_STATES.map((s) => EVIDENCE_STATE_ORDER[s]);
  assert.deepEqual(ranks, [0, 1, 2, 3, 4, 5]);
});

test('a bare candidate lead needs nothing beyond a known state', () => {
  const r = validateEvidenceRecord({ state: 'unverified_candidate' });
  assert.equal(r.ok, true);
});

test('a retrieved finding passes with a source, timestamp and method', () => {
  const r = validateEvidenceRecord({
    state: 'source_retrieved',
    source_url: 'https://records.example.gov/deed/123',
    retrieved_at: NOW,
    extraction_method: 'html parse',
  });
  assert.equal(r.ok, true);
});

test('claiming a retrieved source without recording one is blocking', () => {
  const r = validateEvidenceRecord({ state: 'source_retrieved', retrieved_at: NOW });
  assert.equal(r.ok, false);
  assert.ok(rulesOf(r).includes('EVID-02'));
});

test('corroboration demands a SHA-256 content hash', () => {
  const r = validateEvidenceRecord({
    state: 'identity_corroborated',
    source_url: 'https://records.example.gov/deed/123',
    retrieved_at: NOW,
    extraction_method: 'html parse',
  });
  assert.equal(r.ok, false);
  assert.ok(rulesOf(r).includes('EVID-03'));
});

test('a malformed hash is rejected', () => {
  const r = validateEvidenceRecord({
    state: 'identity_corroborated',
    source_url: 'https://records.example.gov/deed/123',
    retrieved_at: NOW,
    extraction_method: 'html parse',
    content_hash: 'not-a-hash',
  });
  assert.equal(r.ok, false);
  assert.ok(rulesOf(r).includes('EVID-04'));
});

test('a correct 64-hex digest satisfies the integrity gates', () => {
  const r = validateEvidenceRecord({
    state: 'identity_corroborated',
    source_url: 'https://records.example.gov/deed/123',
    retrieved_at: NOW,
    extraction_method: 'html parse',
    content_hash: HEX64,
  });
  assert.equal(r.ok, true);
});

test('a model confidence value can never sit on a corroborated finding', () => {
  const r = validateEvidenceRecord({
    state: 'identity_corroborated',
    source_url: 'https://records.example.gov/deed/123',
    retrieved_at: NOW,
    extraction_method: 'html parse',
    content_hash: HEX64,
    llm_confidence: 0.97,
  });
  assert.equal(r.ok, false);
  assert.ok(rulesOf(r).includes('EVID-07'));
});

test('an unparseable retrieval timestamp is blocking', () => {
  const r = validateEvidenceRecord({
    state: 'source_retrieved',
    source_url: 'https://records.example.gov/deed/123',
    retrieved_at: 'sometime last week',
    extraction_method: 'html parse',
  });
  assert.equal(r.ok, false);
  assert.ok(rulesOf(r).includes('EVID-05'));
});

test('an unrecognised evidence state is blocking', () => {
  const r = validateEvidenceRecord({ state: 'probably_true' });
  assert.equal(r.ok, false);
  assert.ok(rulesOf(r).includes('EVID-01'));
});

test('investigator review must record its own outcome', () => {
  const r = validateEvidenceRecord({
    state: 'investigator_reviewed',
    source_url: 'https://records.example.gov/deed/123',
    retrieved_at: NOW,
    extraction_method: 'html parse',
    content_hash: HEX64,
    identity_association: 'J. Doe b.1960',
    investigator_review_status: 'approved',
  });
  assert.equal(r.ok, true);
});

/* ------------------------------------------------------------------ */
/* RETRIEVAL — a failure is never a negative finding                    */
/* ------------------------------------------------------------------ */

test('a transport failure recorded as "no records found" is blocking', () => {
  const r = validateRetrievalOutcome({ status: 'failed', error: 'no records found' });
  assert.equal(r.ok, false);
  assert.ok(rulesOf(r).includes('RETR-03'));
});

test('other absence phrasings on a failure are caught too', () => {
  for (const error of ['no results returned', 'nothing found', 'not found in index', 'zero matches']) {
    const r = validateRetrievalOutcome({ status: 'failed', error });
    assert.equal(r.ok, false, `"${error}" should be blocking`);
    assert.ok(rulesOf(r).includes('RETR-03'));
  }
});

test('the rule does not misfire on a genuine transport error', () => {
  for (const error of ['connection reset by peer', '403 forbidden by provider', 'DNS resolution failed']) {
    const r = validateRetrievalOutcome({ status: 'failed', error });
    assert.equal(r.ok, true, `"${error}" is an honest failure and must pass`);
    assert.equal(rulesOf(r).includes('RETR-03'), false);
  }
});

test('a genuine not-found is a legitimate outcome', () => {
  const r = validateRetrievalOutcome({ status: 'not_found', http_status: 404 });
  assert.equal(r.ok, true);
});

test('an unrecognised retrieval status is blocking', () => {
  const r = validateRetrievalOutcome({ status: 'ok' });
  assert.equal(r.ok, false);
  assert.ok(rulesOf(r).includes('RETR-01'));
});

test('a silent failure with no cause is at least major', () => {
  const r = validateRetrievalOutcome({ status: 'timeout' });
  assert.equal(r.ok, true, 'a timeout alone is not blocking');
  assert.ok(rulesOf(r).includes('RETR-02'));
});

/* ------------------------------------------------------------------ */
/* IDENTITY — kinship is never inferred from a shared attribute          */
/* ------------------------------------------------------------------ */

test('kinship from a shared address alone is rejected', () => {
  const r = validateRelationship({
    person_a: 'A Doe',
    person_b: 'B Doe',
    relationship: 'sibling',
    basis: ['shared_address'],
    supporting_sources: [{}, {}],
  });
  assert.equal(r.ok, false);
  assert.ok(rulesOf(r).includes('IDENT-02'));
});

test('kinship from a surname plus shared property is still rejected', () => {
  const r = validateRelationship({
    basis: ['same_surname', 'shared_property'],
    supporting_sources: [{}, {}],
  });
  assert.equal(r.ok, false);
  assert.ok(rulesOf(r).includes('IDENT-02'));
});

test('one affirmative record is enough to pass, and corroboration is advisory', () => {
  const r = validateRelationship({ basis: ['birth_record'], supporting_sources: [{}] });
  assert.equal(r.ok, true);
  assert.ok(rulesOf(r).includes('IDENT-04'), 'single-source reliance is flagged as major');
});

test('a relationship with no recorded basis is blocking', () => {
  const r = validateRelationship({ basis: [], supporting_sources: [{}, {}] });
  assert.equal(r.ok, false);
  assert.ok(rulesOf(r).includes('IDENT-01'));
});

test('a relationship with no supporting document is blocking', () => {
  const r = validateRelationship({ basis: ['birth_record'], supporting_sources: [] });
  assert.equal(r.ok, false);
  assert.ok(rulesOf(r).includes('IDENT-03'));
});

test('two people sharing a name require a discriminator', () => {
  const r = validateRelationship({
    basis: ['birth_record'],
    supporting_sources: [{}, {}],
    same_name_ambiguity: true,
  });
  assert.equal(r.ok, false);
  assert.ok(rulesOf(r).includes('IDENT-05'));
});

test('a discriminator resolves the same-name ambiguity', () => {
  const r = validateRelationship({
    basis: ['birth_record'],
    supporting_sources: [{}, {}],
    same_name_ambiguity: true,
    discriminator: 'DOB 1960-03-04, address 1998-2004',
  });
  assert.equal(r.ok, true);
});

/* ------------------------------------------------------------------ */
/* REPORT — what the system may not assert                             */
/* ------------------------------------------------------------------ */

test('the system may not declare an heir', () => {
  const r = validateReport({
    declares_heir: true,
    sources_actually_queried: ['a'],
    investigator_approval: 'M. Rodriguez',
    version: '1.0',
  });
  assert.equal(r.ok, false);
  assert.ok(rulesOf(r).includes('REP-01'));
});

test('the system may not assert a legal conclusion', () => {
  const r = validateReport({
    declares_legal_conclusion: true,
    sources_actually_queried: ['a'],
    investigator_approval: 'M. Rodriguez',
    version: '1.0',
  });
  assert.equal(r.ok, false);
  assert.ok(rulesOf(r).includes('REP-02'));
});

test('an approved report requires a named signer and a version', () => {
  const r = validateReport({ sources_actually_queried: ['a'], limitations_recorded: true, version: '1.0' });
  assert.equal(r.ok, false);
  assert.ok(rulesOf(r).includes('REP-05'));

  const ok = validateReport({
    sources_actually_queried: ['a'],
    limitations_recorded: true,
    investigator_approval: 'M. Rodriguez',
    version: '1.0',
  });
  assert.equal(ok.ok, true);
});

/* ------------------------------------------------------------------ */
/* No score may outvote a blocking rule                                 */
/* ------------------------------------------------------------------ */

test('a single blocking rule fails the whole result', () => {
  const r = validateSearchRequest({
    permissible_purpose: 'fiduciary_duty',
    legal_matter: 'Estate of J. Doe',
    // case_reference deliberately omitted
    requested_by_id: 'user_123',
    subject_name: 'J. Doe',
  });
  assert.equal(r.ok, false);
  assert.ok(blockingRules(r).length >= 1);
  assert.match(r.summary, /blocking/);
});

/* ------------------------------------------------------------------ */
/* Provenance of the rules themselves                                   */
/* ------------------------------------------------------------------ */

test('the rule table states the three benchmarked companies and the statutes', () => {
  for (const company of ['TLOxp', 'Tracers', 'LexisNexis']) {
    assert.ok(source.includes(company), `rule table should name ${company}`);
  }
  for (const statute of ['FCRA', 'DPPA', 'GLBA']) {
    assert.ok(source.includes(statute), `rule table should cite ${statute}`);
  }
});

test('every rule id follows the domain prefix convention', () => {
  const ids = [...source.matchAll(/rule:\s*"([A-Z]+-\d+)"/g)].map((m) => m[1]);
  assert.ok(ids.length >= 20, `expected at least 20 rule ids, found ${ids.length}`);
  for (const id of ids) {
    assert.match(id, /^(AUTH|EVID|RETR|IDENT|REP)-\d+$/);
  }
});