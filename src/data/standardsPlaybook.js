// Operating standard for the heir-search / skip-trace line of business.
// Every rule below is tied to a named external authority or to a threshold that
// actually exists in the system. Nothing here is aspirational language: each
// entry states the rule, and where it is enforced.

export const AUTHORITIES = [
  { short: "BCG GPS", full: "Board for Certification of Genealogists — Genealogical Proof Standard, 5 elements" },
  { short: "FRE 702", full: "Federal Rules of Evidence 702, as amended December 2023" },
  { short: "CAFG", full: "Council for the Advancement of Forensic Genealogy — Standards of Practice and Conduct" },
  { short: "DPPA / GLBA / FCRA", full: "Driver's Privacy Protection Act; Gramm-Leach-Bliley Act; Fair Credit Reporting Act" },
];

// ── 1. OPERATIONAL STANDARD ────────────────────────────────────────────
export const OPERATIONAL_STANDARDS = [
  {
    id: "OS-01",
    title: "No conclusion before reasonably exhaustive research",
    authority: "BCG GPS element 1 · FRE 702(b)",
    rule: "A case cannot conclude while any applicable category in the source coverage register is unreviewed. Each category is recorded as searched, exhausted, or excluded with a stated reason.",
    enforcement: "Conclusion is blocked by coverage incompleteness, not merely scored lower.",
  },
  {
    id: "OS-02",
    title: "Every fact carries a citation a third party can retrieve",
    authority: "BCG GPS element 2 · CAFG 09",
    rule: "No finding reaches a report without repository, record set, identifier and access date. An uncited fact is not a fact, it is a lead.",
    enforcement: "Evidence records carry source_name, source_url, access_date and a content hash.",
  },
  {
    id: "OS-03",
    title: "Evidence is classified before it is weighed",
    authority: "BCG GPS element 3",
    rule: "Each item is classified original or derivative, primary or secondary, direct or indirect or negative, before it contributes to a conclusion.",
    enforcement: "Source reliability tiers set the floor of any confidence score.",
  },
  {
    id: "OS-04",
    title: "Contradictory evidence is resolved, never smoothed over",
    authority: "BCG GPS element 4",
    rule: "Conflicting records are surfaced as first-class items and block the conclusion until resolved, with the reason recorded. A discrepancy is not dropped because the remaining data looks consistent.",
    enforcement: "Target: an unresolved conflict blocks delivery.",
  },
  {
    id: "OS-05",
    title: "The reasoning chain is written out, not implied",
    authority: "BCG GPS element 5 · connective reliability",
    rule: "Each conclusion states three things: what information was considered and why, how it was used, and why that use yields this conclusion.",
    enforcement: "Report structure requires the three-part chain per conclusion.",
  },
  {
    id: "OS-06",
    title: "'Probable' and 'identified' are never conflated",
    authority: "FRE 702(d) — the failure mode most often cited in exclusion",
    rule: "A candidate is never promoted to an identified person. The word used is generated from the evidence classification, not written by prose.",
    enforcement: "Output vocabulary is closed and derived from the confidence field.",
  },
  {
    id: "OS-07",
    title: "Negative findings ship in the report",
    authority: "CAFG 11 · FRE 702(b)",
    rule: "A search that found nothing is a result and is reported. Withholding unhelpful findings breaches the standard and removes the evidence of diligence.",
    enforcement: "Search log is a required report section, including empty results.",
  },
  {
    id: "OS-08",
    title: "Scope states what was not examined, and why",
    authority: "FRE 702(d) practice standard",
    rule: "The report names every record set searched, every set deliberately skipped, and the reason for each skip.",
    enforcement: "Explicit not-examined list is a required report element.",
  },
  {
    id: "OS-09",
    title: "Same inputs must reproduce the same conclusion",
    authority: "Daubert testability · FRE 702(c)",
    rule: "A third party using the same data and methods must be able to replicate the result. A conclusion that cannot be reproduced cannot be defended at the admissibility stage.",
    enforcement: "Target: versioned runs with a diff against the previous run.",
  },
  {
    id: "OS-10",
    title: "A credentialed human signs every report",
    authority: "CAFG 09 · FRE 702 (qualified witness)",
    rule: "Software produces the sourced, exhibit-indexed draft. A named, credentialed reviewer verifies and signs it, and is available to testify. No report is delivered machine-signed.",
    enforcement: "Signature field is required before delivery.",
  },
  {
    id: "OS-11",
    title: "Provenance is recorded at the moment of acquisition",
    authority: "Chain-of-custody practice standard",
    rule: "Every stored fact records how it was obtained, when, from where and by which method, so the chain can be produced on demand.",
    enforcement: "Access date and content hash are mandatory on every evidence record.",
  },
  {
    id: "OS-12",
    title: "No prohibited acquisition method, ever",
    authority: "GLBA · DPPA · FCRA",
    rule: "No step impersonates a data subject or a third party. No financial-institution data is obtained. DMV and consumer-report data are only touched inside a recorded legal matter with a recorded permissible purpose.",
    enforcement: "Banned methods must be structurally impossible in the automation layer, not policy.",
  },
];

// ── 2. CONFIDENCE GATES (thresholds that actually exist in code) ───────
export const CONFIDENCE_GATES = [
  {
    id: "G1",
    gate: "Deceased identity lock",
    threshold: "confirmed flag + full legal name established + at least 2 corroborating data points",
    detail:
      "Corroboration counts death date, birth date, last residence, SSN state issued, obituary, funeral home. Below two points the lock does not open.",
    blocks: "Heir searching cannot begin. This is the mandatory gate before any heir work.",
  },
  {
    id: "G2",
    gate: "Single finding confidence",
    threshold: "source reliability floor + 8 per corroborating source (max +25) + 10 cross-verify bonus at 2+ sources, capped at 99",
    detail:
      "Scored from corroboration, source reliability and recency. Not from a model's opinion of its own answer.",
    blocks: "Low-score findings cannot be promoted into the identified set.",
  },
  {
    id: "G3",
    gate: "Corroboration requirement",
    threshold: "cross_verified only when at least 1 independent corroborating source exists; bonus tier at 2+",
    detail: "A single-source contact is a lead. It is never reported as a confirmed contact.",
    blocks: "Single-source facts stay flagged as unverified.",
  },
  {
    id: "G4",
    gate: "Recursive validation target",
    threshold: "QA score 85 or above",
    detail:
      "The recursive loop re-runs and repairs until the score reaches the target, with a bounded iteration count so a case cannot loop forever.",
    blocks: "Report is not marked complete below target. Unreached target escalates for human review rather than shipping.",
  },
  {
    id: "G5",
    gate: "Overall case confidence",
    threshold: "weighted — identity 30% · family tree 25% · heir contact quality 25% · source breadth 15% · probate records 5%",
    detail:
      "Weighted across evidence dimensions rather than averaged from narrative confidence, so a strong narrative cannot mask a thin record base.",
    blocks: "Case-level score gates the report-ready state.",
  },
  {
    id: "G6",
    gate: "Verified evidence before report release",
    threshold: "every included case must carry evidence records with status verified, a valid source URL, a retrieval timestamp and a content hash",
    detail: "Report and court-ready PDF stay disabled until the whole set passes.",
    blocks: "All report outputs are disabled, not merely warned about.",
  },
];

export const RELIABILITY_TIERS = [
  { tier: "Government and vital records", range: "90 – 98", examples: "Death certificate 98 · birth certificate 98 · marriage certificate 97 · probate court 96 · SSDI 95 · deed records 93 · county assessor 92" },
  { tier: "Genealogy databases", range: "75 – 82", examples: "Find A Grave 82 · Ancestry 80 · FamilySearch 78 · MyHeritage 75" },
  { tier: "Obituaries / newspapers / funeral homes", range: "72 – 78", examples: "Funeral homes 78 · obituaries 75 · newspaper archives 72" },
  { tier: "Verification services", range: "70 – 90", examples: "SMTP verified 90 · phone verified 85 · breach lookup 70 (proves existence, not ownership)" },
  { tier: "People-search aggregators", range: "58 – 65", examples: "Whitepages 65 · Pipl 62 · Spokeo 60 · BeenVerified 58" },
  { tier: "Social media", range: "55 – 70", examples: "LinkedIn 70 · Facebook 55" },
  { tier: "Unmatched source", range: "50", examples: "Defaults to the floor. An unrecognised source never starts above mid-range." },
];

// ── 3. END-TO-END WORKFLOW CHECKLIST ───────────────────────────────────
export const WORKFLOW_PHASES = [
  "Intake & authorization",
  "Identity lock",
  "Source sweep",
  "Evidence & scoring",
  "Validation",
  "Report & delivery",
];

export const WORKFLOW_STEPS = [
  { n: 1, phase: 0, action: "Capture case, client, the legal matter and its reference number", gate: "Permissible purpose recorded before any lookup runs", artifact: "Engagement record with scope, fee and deadline" },
  { n: 2, phase: 0, action: "Confirm a written scope and flat fee are agreed", gate: "No contingency, percentage or outcome-based term exists anywhere", artifact: "Signed engagement agreement" },
  { n: 3, phase: 0, action: "Record which state's licensing basis applies to the work", gate: "Where licensure is required, a licensed basis is named before proceeding", artifact: "Licensing basis on the case" },
  { n: 4, phase: 1, action: "Locate death records and obituaries for the subject", gate: "G1 — identity lock requires 2+ corroborating data points", artifact: "Death record, obituary, exhibit numbers" },
  { n: 5, phase: 1, action: "Lock the deceased identity and freeze it for the case", gate: "Heir searching must not start before the lock opens", artifact: "Locked identity with corroboration count" },
  { n: 6, phase: 2, action: "Enumerate applicable source categories for the jurisdiction and era", gate: "Every applicable category is assigned a status before the sweep starts", artifact: "Coverage plan" },
  { n: 7, phase: 2, action: "Execute the source sweep across the coverage register", gate: "Each category ends as searched, exhausted, or excluded with a reason", artifact: "Per-category search log incl. empty results" },
  { n: 8, phase: 2, action: "Trace associates two levels out — relatives, co-owners, business partners", gate: "Depth limited to two levels so effort stays proportionate to scope", artifact: "Association graph" },
  { n: 9, phase: 2, action: "Discover contact details for living candidates", gate: "Verification attempted before any contact is reported", artifact: "Contact candidates" },
  { n: 10, phase: 2, action: "Verify contacts — SMTP for email, carrier and line type for phone", gate: "Unverified contact is labelled a lead, never a confirmed contact", artifact: "Verification results" },
  { n: 11, phase: 3, action: "Convert every fact into a numbered evidence record", gate: "Source, access date and content hash mandatory", artifact: "Evidence register with exhibit numbers" },
  { n: 12, phase: 3, action: "Score each finding from source reliability and corroboration", gate: "G2 and G3 — single-source facts stay unverified", artifact: "Per-finding confidence" },
  { n: 13, phase: 3, action: "Deduplicate candidates and rank by degree of kinship", gate: "Non-heirs excluded — businesses, estates, cemeteries, the decedent", artifact: "Ranked heir list with relationship degree" },
  { n: 14, phase: 3, action: "Apply the state intestacy framework to establish priority classes", gate: "State-specific rules applied, not the generic majority framework", artifact: "Inheritance priority per heir" },
  { n: 15, phase: 3, action: "Identify contradictions across records and resolve each one", gate: "OS-04 — unresolved conflict blocks the case", artifact: "Conflict register with resolutions" },
  { n: 16, phase: 4, action: "Administrative review — completeness, citations, exhibit register", gate: "Every required report element present and accurate", artifact: "Administrative QA result" },
  { n: 17, phase: 4, action: "Technical review — each conclusion tested against its cited evidence", gate: "No conclusion exceeds what its citations support", artifact: "Technical QA result" },
  { n: 18, phase: 4, action: "Run the recursive validation loop — re-run, repair, re-score", gate: "G4 — target score 85+, bounded iterations", artifact: "Iteration log with before/after scores" },
  { n: 19, phase: 4, action: "Compute the overall case confidence across weighted dimensions", gate: "G5 — identity, tree, contact, breadth, probate", artifact: "Case confidence score" },
  { n: 20, phase: 4, action: "Confirm every included case carries verified evidence", gate: "G6 — report outputs stay disabled until this passes", artifact: "Verification state on the case" },
  { n: 21, phase: 5, action: "Assemble the report — numbered paragraphs, exhibit register, family tree", gate: "Tree cross-references exhibit numbers and paragraph references", artifact: "Final report draft" },
  { n: 22, phase: 5, action: "Credentialed human reviewer verifies and signs", gate: "OS-10 — no machine-signed report is delivered", artifact: "Signature and reviewer identity" },
  { n: 23, phase: 5, action: "Generate the court-ready PDF and archive a copy", gate: "PDF generated only from the signed, verified case", artifact: "Court-ready PDF in the archive folder" },
  { n: 24, phase: 5, action: "Deliver to the fiduciary and record retention limits", gate: "Personal data retained only as long as the matter justifies", artifact: "Delivery record and retention date" },
];

// ── 4. STANDARD OPERATING PROCEDURES ───────────────────────────────────
export const SOPS = [
  {
    id: "SOP-1",
    title: "Intake & authorization",
    procedures: [
      "Record the legal matter and reference number before any data lookup is run.",
      "Confirm the permissible purpose for any DMV or consumer-report access in writing first.",
      "Agree scope, flat fee and deadline in writing. Reject any outcome-dependent term.",
      "Name the licensing basis where the state regulates skip tracing for hire.",
      "Decline the case if the request is to locate someone in order to contact them in ways the standards prohibit.",
    ],
  },
  {
    id: "SOP-2",
    title: "Identity lock discipline",
    procedures: [
      "Require at least two independent corroborating data points before the lock opens.",
      "Never begin heir research against an unconfirmed identity — an error here invalidates everything downstream.",
      "Freeze the locked identity for the life of the case so later edits cannot silently change the subject.",
      "Record the corroboration count and its sources on the lock itself.",
    ],
  },
  {
    id: "SOP-3",
    title: "Source sweep discipline",
    procedures: [
      "Enumerate applicable categories for the jurisdiction and era before searching, not after.",
      "Give every category an explicit terminal status: searched, exhausted, or excluded with a reason.",
      "Record empty results as results. A silent omission is indefensible.",
      "Bound associate tracing to two levels by default and state the bound in the scope.",
      "Do not present a sweep as exhaustive when a category was skipped for cost or time.",
    ],
  },
  {
    id: "SOP-4",
    title: "Evidence handling",
    procedures: [
      "Assign an exhibit number to every fact at capture, not at report time.",
      "Capture source name, URL, access date and a content hash on every record.",
      "Record the acquisition method so a suppression challenge can be answered.",
      "Store under the private-by-default rule; living-person contact data never goes to public storage.",
      "Never re-key a value by hand. If it cannot be captured with provenance, it does not enter the register.",
    ],
  },
  {
    id: "SOP-5",
    title: "Conflict resolution",
    procedures: [
      "Raise a discrepancy as its own record the moment two credible sources disagree.",
      "Never average contradicting values into a compromise answer.",
      "Document the resolution as analysis, with the reasoning that chose one record over another.",
      "Escalate to a human reviewer when a conflict touches the identity lock or an heir's relationship.",
    ],
  },
  {
    id: "SOP-6",
    title: "QA and recursive validation",
    procedures: [
      "Run the completeness review and the technical review as separate passes with separate results.",
      "Re-run and repair through the recursive loop until the score reaches the target or the iteration bound is hit.",
      "On hitting the bound without reaching the target, escalate for human review — do not ship and do not silently downgrade the target.",
      "Keep the iteration log so improvement is auditable rather than asserted.",
    ],
  },
  {
    id: "SOP-7",
    title: "Report and signature",
    procedures: [
      "Include the scope statement, including what was not examined and why.",
      "Include negative findings and the search log with empty results.",
      "Keep 'probable' and 'identified' distinct everywhere in the document.",
      "Require a named credentialed reviewer's signature before release.",
      "Never describe the output as a legal opinion or a certification of heirship.",
    ],
  },
  {
    id: "SOP-8",
    title: "Data protection & retention",
    procedures: [
      "Living-person data is access-scoped to the authorized matter only.",
      "Retain personal data only as long as the matter justifies; record the retention date at delivery.",
      "Do not aggregate people-search data beyond the matter that justified acquiring it.",
      "Treat a retention or subject-access request as a case event with an owner and a due date.",
    ],
  },
  {
    id: "SOP-9",
    title: "Correction & re-delivery",
    procedures: [
      "If an in-scope heir surfaces after delivery, re-run the research and regenerate the court documents at no charge.",
      "Re-open the case record rather than issuing a standalone correction, so the register stays continuous.",
      "Log the miss and its root cause. A correction without a root cause is a recurring defect.",
    ],
  },
  {
    id: "SOP-10",
    title: "Claims and marketing integrity",
    procedures: [
      "Never publish a success rate the system cannot compute from its own case history.",
      "State the definition and the denominator whenever an accuracy figure is published.",
      "Never repeat a competitor's marketing claim as though it were measured fact.",
      "Represent credentials accurately, including whose licence the work runs under.",
    ],
  },
];

// ── 5. AGENT ROSTER ────────────────────────────────────────────────────
export const AGENT_ROSTER = [
  {
    group: "Research & evidence",
    note: "Does the finding work. Produces candidates and evidence, never a final conclusion.",
    agents: [
      { name: "web_researcher", role: "Runs source discovery and record retrieval across the coverage register." },
      { name: "autonomous_agent", role: "Executes multi-step research tasks with tool access and a bounded budget." },
      { name: "orchestrator", role: "Sequences the pipeline and routes work between specialist agents." },
      { name: "swarm", role: "Runs parallel specialist work across sources and reconciles the outputs." },
      { name: "swarm_lead", role: "Sets direction and stops criteria for a swarm run." },
      { name: "swarm_specialist", role: "Executes one assigned research lane inside a swarm run." },
    ],
  },
  {
    group: "Verification & QA",
    note: "Adversarial by design. Must be able to fail a case the research side believes it won.",
    agents: [
      { name: "heir_search_qa", role: "Administrative and completeness review of heir-search output." },
      { name: "heir_search_validator", role: "Technical review — tests each conclusion against the evidence cited for it." },
      { name: "qa_validator", role: "Independent validation pass over generated output." },
      { name: "visual_qa", role: "Checks rendered report and page output for defects." },
      { name: "clone_parity_engineer", role: "Compares output against a reference standard and reports divergence." },
      { name: "fortress_engineer", role: "Runs security and containment checks, including isolation between tenants." },
    ],
  },
  {
    group: "System & platform",
    note: "Builds and maintains the machinery the research runs on.",
    agents: [
      { name: "code_architect", role: "Designs system structure and build specifications." },
      { name: "code_analyst", role: "Reads and reasons about code without changing it." },
      { name: "vision_cortex", role: "Coordinates long-horizon autonomous system improvement." },
      { name: "replicator", role: "Rebuilds a reference interface or structure from a design input." },
    ],
  },
  {
    group: "Commercial",
    note: "Demand generation and brand. Kept separate from the research pipeline so incentive never touches findings.",
    agents: [
      { name: "growth_operator", role: "Runs growth experiments and opportunity scanning." },
      { name: "sales_engine", role: "Produces sales assets and outreach sequences." },
      { name: "social_strategist", role: "Plans and executes social distribution." },
      { name: "brand_guardian", role: "Enforces brand consistency across generated assets." },
    ],
  },
];

// ── 6. TECHNOLOGY STANDARD ─────────────────────────────────────────────
export const TECH_LAYERS = [
  {
    layer: "Browser engine",
    standard: "Headless Chrome fleet with stealth configuration, TLS fingerprint matching, a health-scored geo-targeted proxy pool and a tiered CAPTCHA fallback chain ending in a third-party solver.",
    status: "in_place",
    caveat: "Session share tokens are generated with a non-cryptographic random source and should be reissued from a secure generator.",
  },
  {
    layer: "Gateway / API",
    standard: "Single authenticated entry point. Tenant isolation fail-closed at the database policy layer, so an unset tenant context denies rather than permits.",
    status: "in_place",
    caveat: "Rate limiting is per-replica rather than global, so effective limits scale with instance count.",
  },
  {
    layer: "Deterministic core",
    standard: "Evidence engine, confidence scoring, deduplication and the intestacy framework are plain deterministic functions with no model in the path.",
    status: "in_place",
    caveat: "Source reliability scores are a maintained lookup table. They need an owner and a review cadence.",
  },
  {
    layer: "Identity lock",
    standard: "A gate function returns confirmed only when the flag, the full legal name and two or more corroborating data points all hold.",
    status: "in_place",
    caveat: "Confirmed that the gate exists and is fail-closed on missing data.",
  },
  {
    layer: "Recursive validation",
    standard: "Re-run, repair and re-score until the target is met, with a bounded iteration count and an escalation path when it is not.",
    status: "partial",
    caveat: "The loop and the target exist. Not yet verified that failing the target blocks delivery rather than only reporting below-target.",
  },
  {
    layer: "Report gating",
    standard: "Report and court-ready PDF outputs stay disabled unless every included case carries verified evidence records with URL, timestamp and content hash.",
    status: "in_place",
    caveat: "Verified in the report surface: the download controls are disabled, not warned.",
  },
  {
    layer: "Report generation & archive",
    standard: "Court-ready PDF generation from verified case findings, uploaded to the designated archive folder.",
    status: "in_place",
    caveat: "Not yet verified that the generator emits paragraph numbering and an exhibit register cross-referenced to the family tree.",
  },
  {
    layer: "Provenance & audit",
    standard: "Content hash and retrieval timestamp on every evidence record; acquisition method recorded so a suppression challenge can be answered.",
    status: "partial",
    caveat: "Hash and timestamp are in place. Acquisition method and basis for access are not yet verified per fact.",
  },
  {
    layer: "Reproducibility",
    standard: "Versioned runs, with a diff against the previous run, so drift surfaces instead of passing silently.",
    status: "gap",
    caveat: "This is the central engineering problem. Any step routed through a language model is not reproducible unless constrained to classification or replaced by a rule.",
  },
  {
    layer: "Conflict blocking",
    standard: "An unresolved contradiction blocks delivery rather than being noted and passed through.",
    status: "gap",
    caveat: "The single highest-value missing control, and the documented cause of a missed heir in a published case study.",
  },
  {
    layer: "Outcome ledger & unit economics",
    standard: "Every case records its outcome and its actual research hours, so an accuracy figure and an efficiency claim can both be computed rather than asserted.",
    status: "gap",
    caveat: "Without this, no defensible success rate can be published and no efficiency claim can be proven to a buyer.",
  },
  {
    layer: "Build reproducibility",
    standard: "Every deployed service pins its dependencies with a committed lockfile and passes install, test and lint in the release gate.",
    status: "partial",
    caveat: "Lockfiles are missing for the API, worker and engine services, so their builds are not reproducible.",
  },
];

export const TECH_STATUS_LABEL = {
  in_place: { label: "In place", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  partial: { label: "Partial", className: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  gap: { label: "Gap", className: "bg-destructive/10 text-destructive border-destructive/30" },
};

// ── 7. PRICING STANDARD ────────────────────────────────────────────────
export const PRICING_BASIS =
  "CAFG Standard 01 prohibits contingent, percentage and outcome-based fee agreements as a conflict of interest, because the firm's payment would rise or fall with the finding.";

export const PRICING_PRINCIPLES = [
  { rule: "Flat fee, agreed in writing before work begins.", detail: "Scope, fee and deadline are fixed at engagement. The fee does not move with the result." },
  { rule: "Never a share of the estate or of anything recovered.", detail: "The contingency model takes 30–50% of an inheritance. On a $100,000 estate a 33% fee costs $33,000, against roughly $3,000–4,000 for a 20-hour search at $150–200/hour." },
  { rule: "No hour overrun without written approval.", detail: "Exceeding the authorized research hours requires client approval before the work continues, not after the invoice." },
  { rule: "Third-party disbursements at cost, only after approval.", detail: "Government records, courier and translation fees are passed through at cost and only once approved." },
  { rule: "A missed in-scope heir is corrected at no charge.", detail: "If a new in-scope heir surfaces after delivery, the additional research and regenerated court documents are produced at no cost. This is the strongest accuracy commitment in the market and implies real liability." },
  { rule: "Indemnity is disclosed, not implied.", detail: "The leading firm carries $2,000,000 E&O and $5,000,000 general liability and states it. A fiduciary is buying insurability as much as research." },
  { rule: "Never publish an uncomputable success rate.", detail: "A 98% figure circulates in the market with no published methodology, sample size or definition of success." },
];

export const PRICING_BANDS = [
  { band: "1–2 expected heirs", price: "$595", hours: "up to 3 research hours" },
  { band: "3–6 expected heirs", price: "$895", hours: "up to 5 research hours" },
  { band: "7–14 expected heirs", price: "$1,495", hours: "up to 10 research hours" },
  { band: "15–25 expected heirs", price: "$2,695", hours: "up to 20 research hours" },
];

export const PRICING_BAND_NOTE =
  "Published market bands for flat-fee heir search, shown as the reference point our schedule is set against. The automation leverage sits inside the band — same price, faster and more auditable — not in undercutting it.";

// ── 8. BUSINESS MODEL STANDARD ─────────────────────────────────────────
export const BUSINESS_STANDARD = {
  buyer: {
    title: "The buyer is the fiduciary, never the heir",
    points: [
      "Executors, administrators, trustees, fiduciaries, bank and trust officers, and their counsel.",
      "The purchase reason is risk reduction: a defensible, sourced, court-ready report protects the person who relies on it.",
      "The heir is a beneficiary of the work, never the counterparty. Soliciting heirs is prohibited by CAFG Standard 02.",
      "Law firms running repeat searches are the natural channel, served through a partner arrangement with capped capacity.",
    ],
  },
  deliverable: {
    title: "The deliverable is the court-ready final report",
    points: [
      "All supporting documentation needed to establish the identity of the parties referred to in it.",
      "A family tree with names, birth and death dates, corresponding exhibit numbers and references to the numbered paragraphs of the report.",
      "A scope statement covering what was examined and, explicitly, what was not.",
      "Negative findings and the search log, including empty results.",
      "A named credentialed reviewer's signature, with that reviewer available to testify.",
    ],
  },
  objections: [
    {
      object: "An automated process cannot produce a sworn affidavit admissible in probate court.",
      answer: "The software produces the sourced, exhibit-indexed draft. A credentialed human reviews, signs and is available to testify under oath.",
      status: "gap",
    },
    {
      object: "It cannot conduct interviews with family members and witnesses.",
      answer: "Interviews are captured as attributed testimony and attached as exhibits, with the interviewer's identity recorded.",
      status: "partial",
    },
    {
      object: "It cannot navigate foreign civil records or closed archives.",
      answer: "Named as a first-class roadmap item with a partner strategy for jurisdictions that require in-country access. Not solved today.",
      status: "gap",
    },
    {
      object: "It cannot build a documented chain of heirship a judge will accept.",
      answer: "This is the intended core competency: a numbered evidence register, a cross-referenced tree and weighted confidence scoring.",
      status: "partial",
    },
    {
      object: "It cannot accept professional liability for the results.",
      answer: "Correct, and software never will. The operating entity must carry the indemnity and the licence; the automation is a method, not the liable party.",
      status: "gap",
    },
  ],
};

export const BUSINESS_INTEGRITY_RULES = [
  "No percentage, contingency or outcome-based fee, in any product configuration.",
  "No recruiting of heirs for the firm, for another firm, or for an attorney.",
  "No marketing claim the system cannot measure from its own records.",
  "No credentialed-sounding language on a machine-produced draft.",
  "No report described as a legal opinion or a certification of heirship.",
];