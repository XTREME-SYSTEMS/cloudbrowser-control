/**
 * Shared content for the interface comparison.
 *
 * Every option renders the SAME case and the SAME sections, so the choice is
 * made on how the work is arranged, not on one option happening to show more
 * data than another.
 */

export const CASES = [
  {
    id: "c1",
    name: "Lucile C Wright",
    location: "Pensacola, FL",
    status: "partial",
    verdict: "Not certified",
  },
  {
    id: "c2",
    name: "Paul C. Lingard",
    location: "County unknown",
    status: "found",
    verdict: "Not certified",
  },
];

/** The ten existing review sections, grouped into four blocks. */
export const SECTIONS = [
  { group: "Subject", items: ["Overview", "Family Tree", "Identity Review"] },
  { group: "Evidence", items: ["Evidence", "Source Coverage"] },
  { group: "Review", items: ["QA & Certification", "Approvals"] },
  { group: "Output", items: ["Research Gaps", "History", "Reports"] },
];

export const GATE = [
  { label: "Certification", value: "Not certified" },
  { label: "Evidence", value: "Unverified" },
  { label: "Approval", value: "Pending" },
];

export const STATS = [
  { label: "People in graph", value: 6 },
  { label: "Claims supported", value: 0 },
  { label: "Claims unresolved", value: 2 },
  { label: "Conflicts", value: 0 },
  { label: "Evidence records", value: 0 },
  { label: "Open gaps", value: 5 },
];

export const GAPS = [
  "The case rests on no recorded source evidence, so nothing could be re-verified.",
  "The deceased person's identity is not confirmed.",
  "A licensed people-search provider is unavailable: credential missing.",
];

/** Data sources, for the enrichment-grid option. */
export const SOURCE_COLUMNS = ["Property", "Owner", "Contacts", "Relatives", "Evidence", "QA", "Gate"];

/** Distress and ownership signals, for the property-first options. */
export const SIGNALS = [
  { label: "Tax delinquent", tone: "amber" },
  { label: "Probate", tone: "amber" },
  { label: "Absentee owner", tone: "slate" },
  { label: "Lien filed", tone: "amber" },
];