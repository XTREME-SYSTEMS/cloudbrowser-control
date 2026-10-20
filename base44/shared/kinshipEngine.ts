/**
 * KINSHIP ENGINE
 * ==========================================================================
 * A family relationship is a CLAIM, and a claim needs evidence of the right
 * kind. This module is the rule that decides which evidence counts.
 *
 * Three things are never sufficient on their own, however suggestive they look:
 *
 *   - a shared surname,
 *   - a shared address,
 *   - co-ownership of property.
 *
 * Each of those is a reason to go and look. None of them is a reason to
 * conclude. People share surnames by coincidence, share addresses as tenants,
 * lodgers, roommates and carers, and co-own property as business partners,
 * lenders and unrelated joint tenants. Treating any of them as proof of kinship
 * is the single most common way a genealogy investigation produces a confident,
 * wrong answer — and in an heirship context that means telling a stranger they
 * have inherited something.
 *
 * So the engine separates evidence into three tiers:
 *
 *   ESTABLISHING  a record that names the relationship itself (vital record,
 *                 probate filing, obituary naming survivors, census household,
 *                 court record). One of these can carry a claim.
 *   SUPPORTING    suggestive but not dispositive (published genealogy, news
 *                 article, social profile, people-search aggregator, property
 *                 record). These corroborate; they never establish.
 *   NON_KINSHIP   carries no kinship weight at all (surname match, shared
 *                 address, co-ownership). Recorded, disclosed, disregarded.
 *
 * And one absolute rule, enforced by the shape of the data rather than by
 * convention: this engine NEVER declares a legal heir. It produces research
 * candidates with standing "potential_heir" and a basis, and every one of them
 * carries `requires_review: true`. Who is a legal heir is a question for a court
 * applying the intestacy statute of the relevant jurisdiction, and no amount of
 * clever matching changes that.
 */

export const KINSHIP_VERSION = "kinship-1.0.0";

export const NEVER_A_LEGAL_HEIR_NOTICE =
  "This engine identifies research candidates, never legal heirs. Succession is determined by a court applying the intestacy law of the relevant jurisdiction.";

export type RelationKind =
  | "spouse"
  | "former_spouse"
  | "child"
  | "parent"
  | "sibling"
  | "grandchild"
  | "grandparent"
  | "niece_nephew"
  | "aunt_uncle"
  | "cousin"
  | "unknown";

export type EvidenceClass =
  | "vital_record"
  | "probate_filing"
  | "obituary"
  | "census"
  | "court_record"
  | "published_genealogy"
  | "news_article"
  | "social_profile"
  | "people_search"
  | "property_record"
  | "surname_match"
  | "shared_address"
  | "co_ownership";

export type ClaimStatus = "established" | "unresolved" | "rejected";

/** A record that names the relationship itself. One of these can carry a claim. */
export const ESTABLISHING_EVIDENCE: EvidenceClass[] = [
  "vital_record",
  "probate_filing",
  "obituary",
  "census",
  "court_record",
];

/** Suggestive, never dispositive. Corroborates an establishing record. */
export const SUPPORTING_EVIDENCE: EvidenceClass[] = [
  "published_genealogy",
  "news_article",
  "social_profile",
  "people_search",
  "property_record",
];

/** Carries no kinship weight. Recorded and disclosed so it is never silently relied on. */
export const NON_KINSHIP_EVIDENCE: EvidenceClass[] = [
  "surname_match",
  "shared_address",
  "co_ownership",
];

export interface KinshipEvidence {
  evidence_class: EvidenceClass;
  source_url?: string;
  retrieved_at?: string;
  content_hash?: string;
  excerpt?: string;
  /** For a non-kinship indicator, the raw observation (the shared address, the surname). */
  detail?: string;
}

export interface KinshipReview {
  decision?: "approved" | "rejected" | "corrected" | null;
  reviewer_email?: string;
  at?: string;
  note?: string;
}

export interface KinshipClaim {
  subject_id?: string;
  relative_id?: string;
  subject_name?: string;
  relative_name?: string;
  relation?: RelationKind;
  evidence?: KinshipEvidence[];
  /** Recorded disagreements between pieces of evidence, e.g. two different birth years. */
  conflicts?: Array<{ note?: string; between?: string[] }>;
  /** A prior marriage or other historical link, which is real but not a current one. */
  historical?: boolean;
  review?: KinshipReview;
}

export interface KinshipVerdict {
  claim_key: string;
  relation: RelationKind;
  status: ClaimStatus;
  /** Always "potential_heir". There is no other value this engine can produce. */
  standing: "potential_heir";
  /** Present and permanently false, so a caller cannot read a yes out of silence. */
  legal_heir_declared: false;
  establishing: string[];
  supporting: string[];
  disregarded: string[];
  requires_review: boolean;
  reasons: string[];
  rule_versions: { kinship: string };
}

const isEstablishing = (c: EvidenceClass) => ESTABLISHING_EVIDENCE.includes(c);
const isNonKinship = (c: EvidenceClass) => NON_KINSHIP_EVIDENCE.includes(c);

function claimKey(claim: KinshipClaim): string {
  const s = claim.subject_id || claim.relative_id || "";
  const r = claim.relative_name || claim.relative_id || "";
  return `${s}->${r}:${claim.relation || "unknown"}`;
}

/**
 * The decision table. Every rule below is named, and none of them can be
 * outvoted: a claim fails if any single rule fails.
 */
export function evaluateKinshipClaim(claim: KinshipClaim): KinshipVerdict {
  const evidence = Array.isArray(claim.evidence) ? claim.evidence : [];
  const classes = evidence.map((e) => e.evidence_class).filter(Boolean) as EvidenceClass[];

  const establishing = classes.filter(isEstablishing);
  const supporting = classes.filter((c) => SUPPORTING_EVIDENCE.includes(c));
  const disregarded = classes.filter(isNonKinship);

  const relation: RelationKind = claim.relation || "unknown";
  const review = claim.review || null;
  const reviewed = review?.decision === "approved" || review?.decision === "corrected";
  // Blockers stop a claim being called established. Notes explain how it got
  // there. Both are recorded: a claim carried by an investigator's judgement
  // says so on its face rather than reading like a document match.
  const blockers: string[] = [];
  const notes: string[] = [];

  // KIN-01. The rule the whole module exists for. A claim resting only on
  // surnames, addresses or co-ownership is refused outright — and an
  // investigator's approval does not rescue it, because the objection is that
  // the evidence cannot distinguish kin from an unrelated person who shares an
  // address, not that nobody has looked at it yet.
  const onlyNonKinship = classes.length > 0 && establishing.length === 0 && supporting.length === 0 && disregarded.length > 0;
  if (onlyNonKinship) {
    return verdict(claim, "rejected", establishing, supporting, disregarded, [
      `KIN-01: The only basis recorded is ${[...new Set(disregarded)].join(", ")}. A shared surname, address or co-ownership does not establish kinship: unrelated tenants, lodgers, carers and business partners share all three. Recorded and disclosed, but disregarded as a basis. Investigator review cannot substitute for evidence that can tell kin from a stranger.`,
    ]);
  }

  if (classes.length === 0) {
    blockers.push("KIN-02: No evidence of any kind is recorded for this claim.");
  }

  // KIN-03. Suggestive evidence cannot establish a relationship on its own. It
  // can only do so with a human on the record, and then it says so.
  if (establishing.length === 0 && supporting.length > 0) {
    if (reviewed) {
      notes.push(
        `KIN-03: Established on investigator review of supporting evidence only (${[...new Set(supporting)].join(", ")}). Reviewed by ${review?.reviewer_email || "an unnamed reviewer"}, so the basis is a human judgement and is disclosed as such.`,
      );
    } else {
      blockers.push(
        `KIN-03: Only supporting evidence is recorded (${[...new Set(supporting)].join(", ")}). These corroborate a relationship but cannot establish one, and no investigator has reviewed this claim.`,
      );
    }
  }

  // KIN-04. A recorded conflict is a thing a person has to resolve.
  const conflicts = Array.isArray(claim.conflicts) ? claim.conflicts : [];
  if (conflicts.length > 0 && !reviewed) {
    blockers.push(
      `KIN-04: ${conflicts.length} unresolved conflict(s) recorded${conflicts[0]?.note ? `: ${conflicts[0].note}` : ""}. Contradictory evidence is not averaged away; it is resolved by a human or it stays unresolved.`,
    );
  }

  // KIN-05. An unknown relation is a placeholder, not a finding.
  if (relation === "unknown") {
    blockers.push("KIN-05: The relationship itself is undetermined, so nothing can be concluded about succession.");
  }

  // KIN-06. A rejection by a human outranks every other consideration.
  if (review?.decision === "rejected") {
    return verdict(claim, "rejected", establishing, supporting, disregarded, [
      `KIN-06: Rejected by ${review?.reviewer_email || "an investigator"}${review?.at ? ` on ${review.at}` : ""}${review?.note ? `: ${review.note}` : "."}`,
    ]);
  }

  if (blockers.length === 0 && establishing.length > 0) {
    notes.push(`KIN-07: Supported by ${[...new Set(establishing)].join(", ")}.`);
  }

  return verdict(
    claim,
    blockers.length > 0 ? "unresolved" : "established",
    establishing,
    supporting,
    disregarded,
    [...blockers, ...notes],
  );
}

function verdict(
  claim: KinshipClaim,
  status: ClaimStatus,
  establishing: EvidenceClass[],
  supporting: EvidenceClass[],
  disregarded: EvidenceClass[],
  reasons: string[],
): KinshipVerdict {
  return {
    claim_key: claimKey(claim),
    relation: claim.relation || "unknown",
    status,
    standing: "potential_heir",
    legal_heir_declared: false,
    establishing: [...new Set(establishing)],
    supporting: [...new Set(supporting)],
    disregarded: [...new Set(disregarded)],
    // Every claim requires a human, whatever its status. There is no path
    // through this engine that produces an unreviewed conclusion.
    requires_review: true,
    reasons,
    rule_versions: { kinship: KINSHIP_VERSION },
  };
}

export interface FamilyPerson {
  id: string;
  name: string;
  /** Alternative identities believed to be the same person, each with the basis for believing it. */
  aliases?: Array<{ name?: string; basis?: EvidenceClass; source_url?: string }>;
  deceased?: boolean;
  deceased_basis?: string;
}

export interface FamilyEdge {
  from: string;
  to: string;
  relation: RelationKind;
  status: ClaimStatus;
  historical: boolean;
  evidence_classes: string[];
  requires_review: boolean;
  reasons: string[];
}

export interface FamilyGraph {
  nodes: FamilyPerson[];
  edges: FamilyEdge[];
  merged_identities: Array<{ kept: string; merged: string[]; basis: string[]; requires_review: boolean }>;
  /** Named in claims but not resolvable to a person record — kept visible, never dropped. */
  unknown_relatives: string[];
  /** People recorded as deceased, with the ids of the living relatives connected to them. */
  deceased_branches: Array<{ person_id: string; name: string; connected_ids: string[] }>;
  conflicts: Array<{ claim_key: string; note: string }>;
  established_claims: number;
  unresolved_claims: number;
  rejected_claims: number;
  rule_versions: { kinship: string };
}

/**
 * Build the family graph from claims. Persons are never invented: a claim that
 * names someone with no person record lands in `unknown_relatives` so the gap is
 * visible rather than silently resolved.
 */
export function buildFamilyGraph(input: {
  persons?: FamilyPerson[];
  claims?: KinshipClaim[];
}): FamilyGraph {
  const persons = Array.isArray(input.persons) ? input.persons : [];
  const claims = Array.isArray(input.claims) ? input.claims : [];

  const byId = new Map<string, FamilyPerson>();
  for (const p of persons) if (p?.id) byId.set(p.id, p);

  // ── Alternative identities ───────────────────────────────────────────────
  // An alias is only merged when it carries an establishing basis. A shared
  // surname merges nobody: it is the same trap as KIN-01, one level up.
  const mergedIdentities: FamilyGraph["merged_identities"] = [];
  const suppressed = new Set<string>();
  for (const person of persons) {
    const aliases = Array.isArray(person.aliases) ? person.aliases : [];
    if (aliases.length === 0) continue;
    const accepted = aliases.filter((a) => a?.basis && isEstablishing(a.basis));
    const rejectedAliases = aliases.filter((a) => !a?.basis || !isEstablishing(a.basis));

    if (accepted.length > 0) {
      mergedIdentities.push({
        kept: person.id,
        merged: accepted.map((a) => String(a.name || "")).filter(Boolean),
        basis: [...new Set(accepted.map((a) => String(a.basis)))],
        requires_review: true,
      });
    }
    if (rejectedAliases.length > 0) {
      mergedIdentities.push({
        kept: person.id,
        merged: [],
        basis: [],
        requires_review: true,
      });
      for (const a of rejectedAliases) {
        const name = String(a.name || "").trim();
        if (name) suppressed.add(name);
      }
    }
  }

  const edges: FamilyEdge[] = [];
  const unknownRelatives: string[] = [];
  const conflicts: FamilyGraph["conflicts"] = [];
  let established = 0;
  let unresolved = 0;
  let rejected = 0;

  for (const claim of claims) {
    const v = evaluateKinshipClaim(claim);
    if (v.status === "established") established += 1;
    else if (v.status === "rejected") rejected += 1;
    else unresolved += 1;

    const from = claim.subject_id || "";
    const to = claim.relative_id || "";
    const names = [claim.subject_name, claim.relative_name].map((n) => String(n || "").trim()).filter(Boolean);

    const missing = [from, to].filter((id) => id && !byId.has(id));
    if (missing.length > 0 || !to) {
      const label = names.join(" / ") || v.claim_key;
      unknownRelatives.push(label);
    }

    if (Array.isArray(claim.conflicts)) {
      for (const c of claim.conflicts) {
        conflicts.push({ claim_key: v.claim_key, note: String(c?.note || "Unspecified conflict") });
      }
    }

    edges.push({
      from,
      to,
      relation: v.relation,
      status: v.status,
      historical: claim.historical === true,
      evidence_classes: [...v.establishing, ...v.supporting, ...v.disregarded],
      requires_review: true,
      reasons: v.reasons,
    });
  }

  // ── Deceased branches ────────────────────────────────────────────────────
  // A deceased relative still matters: their descendants may stand in the place
  // of the person they predeceased. Recorded as a branch, never as a candidate.
  const deceased = persons.filter((p) => p?.deceased === true);
  const deceasedBranches = deceased.map((p) => ({
    person_id: p.id,
    name: p.name,
    connected_ids: [
      ...new Set(
        edges
          .filter((e) => e.from === p.id || e.to === p.id)
          .map((e) => (e.from === p.id ? e.to : e.from))
          .filter(Boolean),
      ),
    ],
  }));

  const suppressedNames = [...suppressed].filter((name) => name.length > 0);

  return {
    nodes: persons,
    edges,
    merged_identities: mergedIdentities,
    unknown_relatives: [...new Set([...unknownRelatives, ...suppressedNames])],
    deceased_branches: deceasedBranches,
    conflicts,
    established_claims: established,
    unresolved_claims: unresolved,
    rejected_claims: rejected,
    rule_versions: { kinship: KINSHIP_VERSION },
  };
}

export interface HeirCandidate {
  person_id: string;
  name: string;
  relation: RelationKind;
  standing: "potential_heir";
  legal_heir_declared: false;
  basis: string[];
  requires_review: true;
  reasons: string[];
}

/**
 * Candidates for further research — not a list of heirs. Only established,
 * non-historical edges to a living person qualify, and every candidate is
 * returned as a research subject awaiting a human.
 *
 * A person recorded as deceased is excluded from candidates even where the
 * relationship is established; their descendants are reached through the branch
 * the graph records for them, which is a separate and deliberate step.
 */
export function candidateHeirs(graph: FamilyGraph): HeirCandidate[] {
  const byId = new Map(graph.nodes.map((p) => [p.id, p]));

  return graph.edges
    .filter((e) => e.status === "established")
    .filter((e) => e.historical !== true)
    .map((e) => {
      const person = byId.get(e.to);
      if (!person || person.deceased === true) return null;
      return {
        person_id: person.id,
        name: person.name,
        relation: e.relation,
        standing: "potential_heir" as const,
        legal_heir_declared: false as const,
        basis: e.evidence_classes,
        requires_review: true as const,
        reasons: e.reasons,
      };
    })
    .filter((c): c is HeirCandidate => c !== null);
}