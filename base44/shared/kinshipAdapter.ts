/**
 * KINSHIP ADAPTER — a case record becomes a relationship graph
 * ==========================================================================
 * The kinship engine judges relationship claims; it does not know how a case is
 * stored. This module is that seam, and it is deliberately the most conservative
 * place in the pipeline.
 *
 * The rule it obeys: it maps what the case actually records and nothing else.
 *
 *   • A relationship is mapped only from an exact, unambiguous term. "Son"
 *     becomes a child claim; "step-son", "half-brother" and "great-niece" become
 *     UNKNOWN, because each is a different relationship in succession and
 *     collapsing them into the plain term would assert something the record does
 *     not say. An unrecognised term lands on KIN-05 and stays unresolved, which
 *     surfaces the mapping gap instead of hiding it behind a plausible word.
 *
 *   • Evidence is read from the claim itself. Case-level fields such as
 *     `sources_checked` are never attributed to an individual relationship: a
 *     list of sources the case consulted says nothing about which source supports
 *     which heir, and borrowing it would manufacture a basis for every claim at
 *     once. An heir with no recorded evidence produces a claim with no evidence,
 *     which the engine reports as KIN-02 unresolved. That is the honest reading
 *     of a record that does not carry the basis for its own conclusions.
 *
 * The consequence is deliberate: a case whose relationships were never recorded
 * at claim level produces a graph where nothing is established. That is not a
 * failure of the adapter. It is the pipeline reporting a real gap in its own
 * evidence capture, which is exactly what a reviewer needs to see.
 */

import {
  buildFamilyGraph,
  candidateHeirs,
  NEVER_A_LEGAL_HEIR_NOTICE,
  KINSHIP_VERSION,
  type EvidenceClass,
  type FamilyGraph,
  type FamilyPerson,
  type HeirCandidate,
  type KinshipClaim,
  type KinshipEvidence,
  type RelationKind,
} from "./kinshipEngine.ts";

/** Exact terms only. Anything absent from this table maps to "unknown". */
const RELATION_TERMS: Record<string, RelationKind> = {
  spouse: "spouse",
  husband: "spouse",
  wife: "spouse",
  "ex-spouse": "former_spouse",
  "ex spouse": "former_spouse",
  "former spouse": "former_spouse",
  divorced: "former_spouse",
  child: "child",
  children: "child",
  son: "child",
  daughter: "child",
  parent: "parent",
  mother: "parent",
  father: "parent",
  sibling: "sibling",
  brother: "sibling",
  sister: "sibling",
  grandchild: "grandchild",
  grandson: "grandchild",
  granddaughter: "grandchild",
  grandparent: "grandparent",
  grandmother: "grandparent",
  grandfather: "grandparent",
  niece: "niece_nephew",
  nephew: "niece_nephew",
  "niece/nephew": "niece_nephew",
  aunt: "aunt_uncle",
  uncle: "aunt_uncle",
  cousin: "cousin",
};

const VALID_EVIDENCE_CLASSES: EvidenceClass[] = [
  "vital_record",
  "probate_filing",
  "obituary",
  "census",
  "court_record",
  "published_genealogy",
  "news_article",
  "social_profile",
  "people_search",
  "property_record",
  "surname_match",
  "shared_address",
  "co_ownership",
];

/**
 * An exact term maps; everything else is undetermined. No prefix stripping: a
 * step-child is not a child, and a half-sibling is not a sibling, in any
 * succession the courts apply.
 */
export function relationKindFromText(text: unknown): RelationKind {
  const key = String(text ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return RELATION_TERMS[key] || "unknown";
}

/**
 * Evidence recorded against one claim. Only recognised classes survive; an
 * unrecognised class is dropped rather than guessed at, because guessing here
 * would put a basis on a relationship that the record never asserted.
 */
export function claimEvidenceFrom(raw: unknown): KinshipEvidence[] {
  if (!Array.isArray(raw)) return [];
  const out: KinshipEvidence[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const evidence_class = String(rec.evidence_class ?? rec.class ?? rec.type ?? "").trim() as EvidenceClass;
    if (!VALID_EVIDENCE_CLASSES.includes(evidence_class)) continue;
    out.push({
      evidence_class,
      source_url: typeof rec.source_url === "string" ? rec.source_url : undefined,
      retrieved_at: typeof rec.retrieved_at === "string" ? rec.retrieved_at : undefined,
      content_hash: typeof rec.content_hash === "string" ? rec.content_hash : undefined,
      excerpt: typeof rec.excerpt === "string" ? rec.excerpt : undefined,
      detail: typeof rec.detail === "string" ? rec.detail : undefined,
    });
  }
  return out;
}

export interface KinshipSummary {
  graph: FamilyGraph;
  candidates: HeirCandidate[];
  counts: {
    persons: number;
    established: number;
    unresolved: number;
    rejected: number;
    unknown_relatives: number;
    conflicts: number;
    deceased_branches: number;
    candidates: number;
  };
  /** True when no relationship in the case is supported by a recorded establishing record. */
  no_recorded_basis: boolean;
  /** What the graph supports and what it does not. Safe to print on any artifact. */
  disclosure: string;
  rule_versions: { kinship: string };
}

const DECEASED_ID = "deceased";

/**
 * Build the relationship graph for a case record. Deterministic and pure, so the
 * same case always yields the same graph and a reviewer can reproduce it.
 */
export function caseToFamilyGraph(record: unknown): KinshipSummary {
  const rec = (record || {}) as Record<string, unknown>;
  const heirs = Array.isArray(rec.identified_heirs) ? (rec.identified_heirs as Record<string, unknown>[]) : [];

  const persons: FamilyPerson[] = [
    {
      id: DECEASED_ID,
      name: String(rec.deceased_name || "Unknown decedent"),
      deceased: true,
      deceased_basis: String(rec.status || ""),
    },
  ];
  const claims: KinshipClaim[] = [];

  heirs.forEach((heir, index) => {
    if (!heir || typeof heir !== "object") return;
    const id = `heir-${index}`;
    const name = String(heir.name || "").trim();
    if (!name) return;

    persons.push({
      id,
      name,
      // An heir recorded as not living is still a person in the graph, and their
      // descendants are reached through the branch recorded for them.
      deceased: heir.is_living === false,
      deceased_basis: heir.is_living === false ? "recorded as not living" : undefined,
    });

    claims.push({
      subject_id: DECEASED_ID,
      relative_id: id,
      subject_name: String(rec.deceased_name || ""),
      relative_name: name,
      relation: relationKindFromText(heir.relationship),
      // Read only from the claim. Never borrowed from the case.
      evidence: claimEvidenceFrom(heir.evidence ?? heir.relationship_evidence),
      conflicts: Array.isArray(heir.conflicts) ? (heir.conflicts as Array<{ note?: string }>) : [],
    });
  });

  const graph = buildFamilyGraph({ persons, claims });

  // The decedent is the root of this graph, not a branch within it. Left in, the
  // subject of the search would be listed as a predeceased relative and the count
  // an investigator reads would name one more deceased family member than exists.
  // The field is for the OTHER relatives who predeceased, whose descendants may
  // stand in the place of the person they predeceased.
  graph.deceased_branches = graph.deceased_branches.filter((b) => b.person_id !== DECEASED_ID);

  const candidates = candidateHeirs(graph);
  const noRecordedBasis = graph.established_claims === 0 && claims.length > 0;

  const counts = {
    persons: persons.length,
    established: graph.established_claims,
    unresolved: graph.unresolved_claims,
    rejected: graph.rejected_claims,
    unknown_relatives: graph.unknown_relatives.length,
    conflicts: graph.conflicts.length,
    deceased_branches: graph.deceased_branches.length,
    candidates: candidates.length,
  };

  return {
    graph,
    candidates,
    counts,
    no_recorded_basis: noRecordedBasis,
    disclosure: disclosureFor(counts, noRecordedBasis),
    rule_versions: { kinship: KINSHIP_VERSION },
  };
}

function disclosureFor(counts: KinshipSummary["counts"], noRecordedBasis: boolean): string {
  if (counts.persons <= 1) {
    return `No relationship claims are recorded for this case, so nothing is established and nothing is rejected. ${NEVER_A_LEGAL_HEIR_NOTICE}`;
  }

  const parts = [
    `${counts.unresolved} of ${counts.established + counts.unresolved + counts.rejected} recorded relationship(s) are unresolved`,
    `${counts.established} supported by a recorded source`,
    `${counts.rejected} refused because the only basis recorded was a shared surname, address or co-ownership`,
  ];
  if (counts.conflicts > 0) parts.push(`${counts.conflicts} recorded conflict(s) awaiting a human`);
  if (counts.unknown_relatives > 0) parts.push(`${counts.unknown_relatives} named relative(s) with no person record`);

  let text = `${parts.join("; ")}.`;
  if (noRecordedBasis) {
    text += " No relationship in this case is supported by an establishing record, so they are carried as research leads pending primary documentation, not as established next of kin.";
  }
  text += ` ${NEVER_A_LEGAL_HEIR_NOTICE}`;
  return text;
}

/** The graph as an auditor should receive it: claims with their basis and gaps. */
export function summariseForAudit(summary: KinshipSummary) {
  return {
    counts: summary.counts,
    no_recorded_basis: summary.no_recorded_basis,
    disclosure: summary.disclosure,
    relationships: summary.graph.edges.map((edge) => ({
      relation: edge.relation,
      status: edge.status,
      historical: edge.historical,
      evidence_classes: edge.evidence_classes,
      reasons: edge.reasons,
    })),
    unknown_relatives: summary.graph.unknown_relatives,
    conflicts: summary.graph.conflicts,
    deceased_branches: summary.graph.deceased_branches,
    merged_identities: summary.graph.merged_identities,
    rule_versions: summary.rule_versions,
  };
}