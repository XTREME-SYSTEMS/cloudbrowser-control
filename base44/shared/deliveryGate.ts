/**
 * REPORT DELIVERY GATE
 * ==========================================================================
 * One module decides whether investigative findings may leave the building, and
 * with what words on them. Every report, export, download and upload path calls
 * it, so there is exactly one answer to "may this go out, and what may it
 * claim?" rather than one answer per function.
 *
 * Two modes, and the difference between them is the whole point:
 *
 *   DRAFT — always permitted. A working document of unverified leads is a
 *   legitimate thing for an investigator to have. It must be watermarked as
 *   such, and it must not contain certification language. Unfinished work is
 *   not dishonest; dressing it up as verified is.
 *
 *   CERTIFIED — permitted only when ALL of the following hold:
 *     1. the case holds a live independent certification (CERT-01..CERT-09);
 *     2. that certification is not stale — the case still matches what was
 *        reviewed, so a certificate cannot outlive the work it describes;
 *     3. a named investigator has approved delivery, and has not rejected it.
 *
 * Independence and investigator approval are deliberately separate conditions.
 * Three models agreeing is a check on the work; it is not authority to deliver
 * it. Neither substitutes for the other, and neither is inferred from a score.
 *
 * A refused certification request is REFUSED, not quietly downgraded: a caller
 * who asked for a certified document and silently received a draft has been
 * misled by us, which is the exact failure this module exists to prevent.
 */

import {
  isCertified,
  isCertificationStale,
  type CertificationVerdict,
} from "./independentCertification.ts";

export const DELIVERY_GATE_VERSION = "delivery-1.0.0";

export type DeliveryMode = "draft" | "certified";

/** A human decision. Recorded separately from the machine certification, never merged into it. */
export interface InvestigatorReview {
  approved?: boolean;
  approved_by_email?: string;
  approved_at?: string;
  rejected?: boolean;
  rejection_reason?: string;
  annotations?: Array<{ note?: string; author_email?: string; at?: string }>;
}

export interface DeliveryRequest {
  /** What the caller asked for. Anything other than "certified" resolves to draft. */
  mode?: string | null;
  certification?: CertificationVerdict | Record<string, unknown> | null;
  investigator_review?: InvestigatorReview | null;
  /** Recomputed from the case as it stands NOW, not from the certificate. */
  current_fingerprint?: string | null;
}

export interface Watermark {
  tone: "certified" | "draft";
  title: string;
  lines: string[];
}

export interface DeliveryDecision {
  gate_version: string;
  requested_mode: DeliveryMode;
  /** The mode granted. Equal to requested_mode whenever `allowed` is true. */
  mode: DeliveryMode;
  allowed: boolean;
  refused_certified_delivery: boolean;
  certification_present: boolean;
  certification_live: boolean;
  certification_stale: boolean;
  investigator_approved: boolean;
  investigator_rejected: boolean;
  failed_rules: string[];
  reasons: string[];
  watermark: Watermark;
}

export const DELIVERY_RULES = {
  DEL_01: "No live independent certification is attached to this case.",
  DEL_02: "The certification is stale: the case has changed since it was reviewed.",
  DEL_03: "No investigator has approved delivery of this case.",
  DEL_04: "An investigator has rejected delivery of this case.",
} as const;

export function resolveMode(requested: unknown): DeliveryMode {
  return String(requested ?? "").trim().toLowerCase() === "certified" ? "certified" : "draft";
}

export function decideDelivery(request: DeliveryRequest): DeliveryDecision {
  const requested = resolveMode(request.mode);
  const certification = request.certification || null;
  const review = request.investigator_review || null;

  const live = isCertified(certification);
  const stale = live ? isCertificationStale(certification, request.current_fingerprint || "") : false;
  const rejected = review?.rejected === true;
  const approved = review?.approved === true && !rejected;

  const failedRules: string[] = [];
  const reasons: string[] = [];

  if (requested === "certified") {
    if (!live) {
      failedRules.push("DEL-01");
      reasons.push(`DEL-01: ${DELIVERY_RULES.DEL_01}`);
    }
    if (live && stale) {
      failedRules.push("DEL-02");
      reasons.push(`DEL-02: ${DELIVERY_RULES.DEL_02}`);
    }
    if (rejected) {
      failedRules.push("DEL-04");
      reasons.push(`DEL-04: ${DELIVERY_RULES.DEL_04}`);
    } else if (!approved) {
      failedRules.push("DEL-03");
      reasons.push(`DEL-03: ${DELIVERY_RULES.DEL_03}`);
    }
  }

  const allowed = failedRules.length === 0;

  return {
    gate_version: DELIVERY_GATE_VERSION,
    requested_mode: requested,
    mode: allowed ? requested : "draft",
    allowed,
    refused_certified_delivery: !allowed,
    certification_present: certification !== null,
    certification_live: live,
    certification_stale: stale,
    investigator_approved: approved,
    investigator_rejected: rejected,
    failed_rules: failedRules,
    reasons,
    watermark: watermarkFor({
      mode: allowed ? requested : "draft",
      certification: certification as CertificationVerdict | null,
      review,
      failedRules,
    }),
  };
}

function watermarkFor(input: {
  mode: DeliveryMode;
  certification: CertificationVerdict | null;
  review: InvestigatorReview | null;
  failedRules: string[];
}): Watermark {
  if (input.mode === "certified") {
    const c = input.certification;
    const lines = [
      `Search model: ${c?.search_model || "unrecorded"}`,
      `QA: ${c?.qa_score ?? "—"}/100 (${c?.qa_model || "unrecorded"})`,
      `Validator: ${c?.validator_score ?? "—"}/100 (${c?.validator_model || "unrecorded"})`,
      `Rule set: ${c?.certifier_version || "unrecorded"} · certified ${c?.certified_at || "unrecorded"}`,
      `Approved by: ${input.review?.approved_by_email || "unrecorded"}${input.review?.approved_at ? ` on ${input.review.approved_at}` : ""}`,
      `Verified sources: ${c?.verified_finding_ids?.length ?? 0}`,
    ];
    return { tone: "certified", title: "INDEPENDENTLY CERTIFIED", lines };
  }

  const lines = [
    "Unverified investigative leads. This document has not been independently certified and must not be represented as verified or as sufficient for court filing.",
    "Relationship statements are research candidates, not legal determinations. No legal heir is declared here.",
    "Identity, relationship and contact details require confirmation against primary records before any filing or correspondence.",
  ];
  if (input.failedRules.length > 0) {
    lines.push(
      `Certified delivery was requested and refused: ${input.failedRules
        .map((r) => `${r} — ${(DELIVERY_RULES as Record<string, string>)[r] || r}`)
        .join(" ")}`,
    );
  }
  return { tone: "draft", title: "DRAFT — NOT CERTIFIED", lines };
}

/**
 * Certification language that must never appear on an uncertified artifact.
 * Used by tests to prove the draft path makes no claim, and defensively at
 * build time so a regression is loud rather than shipped.
 */
export const CERTIFICATION_CLAIM_PHRASES = [
  "court-ready",
  "court ready",
  "independently certified",
  "certified findings",
  "official findings report",
  "legal heir",
  "certified heir",
  "verified heir",
];

/**
 * A disclaimer negates the claim near it — "has not been independently
 * certified", "no legal heir is declared here". Reading the preceding clause
 * rather than only the immediately preceding characters is what lets an honest
 * draft state plainly what it is NOT, without tripping its own detector.
 */
const NEGATION_TOKENS = ["not ", "no ", "non-", "never ", "neither ", "cannot ", "can't ", "isn't ", "without "];

function isNegated(haystack: string, index: number): boolean {
  const before = haystack.slice(Math.max(0, index - 48), index);
  return NEGATION_TOKENS.some((token) => before.includes(token));
}

export interface CertificationClaimHit {
  phrase: string;
  /** The surrounding text, so a refusal can say where the claim was rather than only that one exists. */
  context: string;
}

/**
 * Phrases that assert certification, ignoring negated uses — "not certified"
 * and "no legal heir is declared" are honest disclaimers, not claims.
 */
export function describeCertificationClaims(text: string): CertificationClaimHit[] {
  const hay = String(text || "").toLowerCase();
  const hits: CertificationClaimHit[] = [];
  for (const phrase of CERTIFICATION_CLAIM_PHRASES) {
    let index = hay.indexOf(phrase);
    while (index !== -1) {
      if (!isNegated(hay, index)) {
        hits.push({
          phrase,
          context: hay.slice(Math.max(0, index - 60), index + phrase.length + 60).replace(/\s+/g, " ").trim(),
        });
        break;
      }
      index = hay.indexOf(phrase, index + 1);
    }
  }
  return hits;
}

export function findCertificationClaims(text: string): string[] {
  return describeCertificationClaims(text).map((hit) => hit.phrase);
}

/**
 * Marks a region of a report that is QUOTED source material — an investigator's
 * own notes, an obituary excerpt — as opposed to something the document asserts
 * in its own voice.
 *
 * The certification scan runs on what the document claims, not on what it
 * quotes. Rewriting an investigator's notes to satisfy a lint would be a form of
 * falsification, and dropping them would destroy the record. An obituary that
 * happens to contain the words "legal heirs" is evidence about the decedent, not
 * a claim by this report.
 */
export const QUOTED_MATERIAL_ATTRIBUTE = "data-quoted-material";

/**
 * Remove quoted regions before scanning. Valid because a marked region never
 * contains a nested div — notes and excerpts are rendered as paragraphs.
 */
export function stripQuotedMaterial(html: string): string {
  const openTag = `<div ${QUOTED_MATERIAL_ATTRIBUTE}="`;
  const closeTag = "</div>";
  let out = String(html || "");
  let index = out.indexOf(openTag);

  while (index !== -1) {
    const close = out.indexOf(closeTag, index);
    if (close === -1) return out.slice(0, index);
    out = out.slice(0, index) + out.slice(close + closeTag.length);
    index = out.indexOf(openTag);
  }
  return out;
}

/** What the document asserts in its own voice, with quoted source material removed. */
export function assertiveText(html: string): string {
  return stripQuotedMaterial(html);
}