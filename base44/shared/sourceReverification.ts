/**
 * MECHANICAL SOURCE RE-VERIFICATION
 * ==========================================================================
 * The Validator cannot honestly be asked to "confirm each source citation is
 * real and accessible" while being handed a summary of counts. Checking that a
 * URL still resolves is a MACHINE task, and here it is performed mechanically
 * rather than asserted by a language model.
 *
 * What this does, for each recorded finding:
 *   - re-fetches the recorded source_url;
 *   - recomputes a SHA-256 digest of the bytes returned;
 *   - compares that digest to the content_hash captured at retrieval time;
 *   - checks that the recorded evidence excerpt is still present in the body.
 *
 * PRESERVED ORIGINAL vs LIVE PAGE
 * --------------------------------------------------------------------------
 * A live web page is a moving target. New adverts, a changed timestamp, a
 * re-rendered template, a paywall, or the page simply being taken down will all
 * change or break a fetch — and none of that says anything about whether the
 * evidence we relied on was sound when we captured it.
 *
 * So the two are kept apart:
 *   - `preserved_intact` is about the ORIGINAL artifact. When a preserved copy
 *     exists and still matches its own recorded digest, the evidence we hold is
 *     exactly what we captured.
 *   - `live_page_changed` is about the publisher. It means the page today is
 *     not what it was.
 *
 * A drifted or unreachable live page sitting underneath a sound preserved
 * original therefore resolves to `re_verified_preserved` with
 * `triggers_review: true`. It is NOT treated as a lost source, because the
 * original is not lost — but it IS routed to a human, because the publisher
 * changing their page is a fact an investigator needs to know. A failure to
 * reach a page is an error, never a negative finding.
 */

export const REVERIFICATION_VERSION = "reverify-2.0.0";

const DEFAULT_TIMEOUT_MS = 20000;
const MAX_BODY_CHARS = 2_000_000;

export type ReverificationStatus =
  | "re_verified"
  | "re_verified_preserved"
  | "source_changed"
  | "unreachable"
  | "invalid_target";

/**
 * What a finding's integrity actually rests on. Keeping these apart is the
 * difference between "the source we captured is sound" and "a web page we
 * fetched today agrees with us".
 */
export type IntegrityBasis = "preserved_snapshot" | "live_page" | "none";

export interface ReverificationTarget {
  finding_id?: string;
  source_url?: string;
  content_hash?: string;
  retrieved_at?: string;
  evidence_excerpt?: string;
  /**
   * A preserved copy of the source as it stood at retrieval time. When present
   * and still matching `preserved_snapshot_hash`, the original evidence is
   * intact even if the live page has since drifted or disappeared.
   */
  preserved_snapshot_url?: string;
  preserved_snapshot_hash?: string;
}

/** What a live fetch observed. Separated from the decision so the rule is testable without a network. */
export interface LiveProbe {
  reachable: boolean;
  http_status?: number;
  redirected?: boolean;
  hash_matches?: boolean;
  excerpt_present?: boolean | null;
  observed_hash?: string;
  /** The transport cause when the fetch failed. Preserved so a failure keeps its reason. */
  error?: string;
}

/** What a preserved-copy check observed. `intact` is null when nothing was checked. */
export interface PreservedProbe {
  checked: boolean;
  intact: boolean | null;
  hash_matches?: boolean;
  error?: string;
}

export interface ReverificationOutcome {
  finding_id: string;
  source_url: string;
  status: ReverificationStatus;
  re_fetched: boolean;
  /** Byte-for-byte hash equality with the digest captured at retrieval time. */
  hash_matches: boolean;
  /** Whether the recorded excerpt is still present in the body. Null when none was recorded. */
  excerpt_present: boolean | null;
  /**
   * The certification-relevant verdict. True when the recorded evidence is
   * confirmed at the live source OR in a preserved original that still matches
   * its own digest.
   */
  evidence_intact: boolean;
  /** What that verdict rests on. */
  integrity_basis: IntegrityBasis;
  /** Whether a preserved copy was checked, and whether it was intact. Null when none exists. */
  preserved_intact: boolean | null;
  /** True when the live page returned something different from what was recorded. */
  live_page_changed: boolean;
  /**
   * True when a human must look. A live page that moved or vanished beneath a
   * sound preserved original is a review item, never a silent failure.
   */
  triggers_review: boolean;
  preservation_note?: string;
  observed_hash?: string;
  http_status?: number;
  redirected?: boolean;
  error?: string;
  checked_at: string;
  verifier_version: string;
}

export async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const SHA256_HEX = /^[a-f0-9]{64}$/i;

function isValidHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.trim().length === 0) return false;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function isReverifiableTarget(target: ReverificationTarget): boolean {
  return (
    typeof target?.finding_id === "string" &&
    target.finding_id.trim().length > 0 &&
    isValidHttpUrl(target?.source_url)
  );
}

/**
 * The decision table, isolated from the network so it can be tested directly and
 * so the rule can be read in one place.
 *
 * Order matters: a live confirmation is the strongest outcome and short-circuits
 * everything else, then a sound preserved original rescues an otherwise failed
 * live check, and only then does the live page get to be the sole basis.
 */
export function decideReverification(
  target: ReverificationTarget,
  live: LiveProbe,
  preserved: PreservedProbe,
  opts?: { checkedAt?: string },
): ReverificationOutcome {
  const checkedAt = opts?.checkedAt || new Date().toISOString();

  const findingId = (target?.finding_id || "").trim();
  const sourceUrl = (target?.source_url || "").trim();
  const preservedIntact = preserved?.checked ? preserved.intact === true : null;

  const base = {
    finding_id: findingId,
    source_url: sourceUrl,
    checked_at: checkedAt,
    verifier_version: REVERIFICATION_VERSION,
  };

  const liveConfirmed = live?.reachable === true && (live.hash_matches === true || live.excerpt_present === true);

  if (liveConfirmed) {
    return {
      ...base,
      status: "re_verified",
      re_fetched: true,
      hash_matches: live.hash_matches === true,
      excerpt_present: live.excerpt_present ?? null,
      evidence_intact: true,
      integrity_basis: preservedIntact === true ? "preserved_snapshot" : "live_page",
      preserved_intact: preservedIntact,
      live_page_changed: false,
      triggers_review: false,
      observed_hash: live.observed_hash,
      http_status: live.http_status,
      redirected: live.redirected === true,
    };
  }

  // The live page did not confirm the evidence. If the original we captured is
  // preserved and still matches its digest, that original stands.
  if (preservedIntact === true) {
    return {
      ...base,
      status: "re_verified_preserved",
      re_fetched: live?.reachable === true,
      hash_matches: live?.hash_matches === true,
      excerpt_present: live?.excerpt_present ?? null,
      evidence_intact: true,
      integrity_basis: "preserved_snapshot",
      preserved_intact: true,
      live_page_changed: live?.reachable === true,
      triggers_review: true,
      preservation_note: live?.reachable === true
        ? "The live page no longer confirms the recorded evidence, but the preserved original is intact. Review the publisher's change; do not discard the evidence."
        : "The live page could not be reached, but the preserved original is intact. Investigate the publisher's availability; do not discard the evidence.",
      observed_hash: live?.observed_hash,
      http_status: live?.http_status,
      redirected: live?.redirected === true,
      error: live?.reachable === true
        ? "Live page no longer confirms the recorded evidence; preserved original intact."
        : "Live page unreachable; preserved original intact.",
    };
  }

  if (!live?.reachable) {
    return {
      ...base,
      status: "unreachable",
      re_fetched: false,
      hash_matches: false,
      excerpt_present: null,
      evidence_intact: false,
      integrity_basis: "none",
      preserved_intact: preservedIntact,
      live_page_changed: false,
      triggers_review: false,
      http_status: live?.http_status,
      redirected: live?.redirected === true,
      error: live?.error
        ? `${live.error}${
            preserved?.checked && preserved.intact === false
              ? " (and the preserved copy did not match its recorded digest either.)"
              : ""
          }`
        : preserved?.checked
          ? "Unreachable, and no intact preserved copy exists."
          : "Unreachable, and no preserved copy was recorded.",
    };
  }

  return {
    ...base,
    status: "source_changed",
    re_fetched: true,
    hash_matches: live.hash_matches === true,
    excerpt_present: live.excerpt_present ?? null,
    evidence_intact: false,
    integrity_basis: "none",
    preserved_intact: preservedIntact,
    live_page_changed: true,
    triggers_review: true,
    observed_hash: live.observed_hash,
    http_status: live.http_status,
    redirected: live.redirected === true,
    error:
      live.excerpt_present === null || live.excerpt_present === undefined
        ? "Re-fetched, but the bytes differ from the recorded digest and no evidence excerpt was recorded to check against."
        : "Re-fetched, but neither the recorded digest nor the recorded evidence excerpt could be confirmed. The source may have changed, or the recorded evidence may not have come from this page.",
  };
}

/** Fetch and hash the preserved copy. Never throws: an unusable copy is a result. */
async function probePreservedSnapshot(
  target: ReverificationTarget,
  timeoutMs: number,
): Promise<PreservedProbe> {
  const url = typeof target?.preserved_snapshot_url === "string" ? target.preserved_snapshot_url.trim() : "";
  const recorded = typeof target?.preserved_snapshot_hash === "string" ? target.preserved_snapshot_hash.trim() : "";

  if (!isValidHttpUrl(url)) return { checked: false, intact: null };
  if (!SHA256_HEX.test(recorded)) {
    // A preserved copy that was never hashed cannot be shown to be intact, so it
    // rescues nothing. Reported rather than assumed.
    return { checked: true, intact: false, error: "A preserved copy was recorded without a valid SHA-256 digest, so its integrity cannot be established." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "CloudBrowser-EvidenceReverification/2.0" },
    });
    if (!response.ok) {
      return { checked: true, intact: false, error: `Preserved copy returned HTTP ${response.status}.` };
    }
    const observed = await sha256Hex((await response.text()).slice(0, MAX_BODY_CHARS));
    const matches = observed.toLowerCase() === recorded.toLowerCase();
    return {
      checked: true,
      intact: matches,
      hash_matches: matches,
      error: matches ? undefined : "The preserved copy does not match its recorded digest.",
    };
  } catch (err: any) {
    const aborted = err?.name === "AbortError";
    return { checked: true, intact: false, error: aborted ? `Preserved copy did not respond within ${timeoutMs}ms` : err?.message || "Preserved copy fetch failed" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Re-fetch one recorded source and report what actually happened.
 * Never throws: an unreachable source is a result, not an exception.
 */
export async function reverifySource(
  target: ReverificationTarget,
  opts?: { timeout_ms?: number },
): Promise<ReverificationOutcome> {
  const checkedAt = new Date().toISOString();
  const timeoutMs = opts?.timeout_ms ?? DEFAULT_TIMEOUT_MS;

  if (!isReverifiableTarget(target)) {
    const reason =
      typeof target?.finding_id !== "string" || !target.finding_id.trim()
        ? "No finding_id, so this record cannot be tied back to a claim."
        : "source_url is absent or is not a valid http(s) URL.";
    return {
      finding_id: (target?.finding_id || "").trim(),
      source_url: (target?.source_url || "").trim(),
      status: "invalid_target",
      re_fetched: false,
      hash_matches: false,
      excerpt_present: null,
      evidence_intact: false,
      integrity_basis: "none",
      preserved_intact: null,
      live_page_changed: false,
      triggers_review: false,
      error: reason,
      checked_at: checkedAt,
      verifier_version: REVERIFICATION_VERSION,
    };
  }

  // Checked first: if the original is intact, a live page that has since drifted
  // is a publishing change rather than a lost source.
  const preserved = await probePreservedSnapshot(target, timeoutMs);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(target.source_url as string, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "CloudBrowser-EvidenceReverification/2.0" },
    });

    if (!response.ok) {
      return decideReverification(
        target,
        { reachable: false, http_status: response.status, redirected: response.redirected === true },
        preserved,
        { checkedAt },
      );
    }

    const body = (await response.text()).slice(0, MAX_BODY_CHARS);
    const observedHash = await sha256Hex(body);

    const recordedHash = typeof target.content_hash === "string" ? target.content_hash.trim() : "";
    const hashMatches = SHA256_HEX.test(recordedHash) && recordedHash.toLowerCase() === observedHash;

    const excerpt =
      typeof target.evidence_excerpt === "string" && target.evidence_excerpt.trim().length > 0
        ? target.evidence_excerpt.trim()
        : null;

    return decideReverification(
      target,
      {
        reachable: true,
        http_status: response.status,
        redirected: response.redirected === true,
        observed_hash: observedHash,
        hash_matches: hashMatches,
        excerpt_present: excerpt === null ? null : normalizedIncludes(body, excerpt),
      },
      preserved,
      { checkedAt },
    );
  } catch (err: any) {
    const aborted = err?.name === "AbortError";
    return decideReverification(
      target,
      {
        reachable: false,
        error: aborted ? `No response within ${timeoutMs}ms` : err?.message || "Fetch failed",
        http_status: undefined,
      },
      preserved,
      { checkedAt },
    );
  } finally {
    clearTimeout(timer);
  }
}

/** Whitespace-insensitive substring test, so re-rendered markup does not cause a false miss. */
function normalizedIncludes(haystack: string, needle: string): boolean {
  const norm = (s: string) => s.replace(/\s+/g, " ").toLowerCase();
  return norm(haystack).includes(norm(needle));
}

export interface ReverificationReport {
  outcomes: ReverificationOutcome[];
  re_verified: number;
  failed: number;
  /** Findings whose live page moved but whose preserved original is intact. */
  needs_review: number;
  counts_by_status: Record<string, number>;
  verifier_version: string;
}

/**
 * Re-verify a batch of recorded findings. Sequential on purpose: a fan-out of
 * parallel fetches at a licensed provider is a good way to get the account
 * rate-limited or blocked, which would then masquerade as unreachable sources.
 */
export async function reverifyAll(
  targets: ReverificationTarget[],
  opts?: { timeout_ms?: number; max?: number },
): Promise<ReverificationReport> {
  const limited = (Array.isArray(targets) ? targets : []).slice(0, opts?.max ?? 200);
  const outcomes: ReverificationOutcome[] = [];

  for (const target of limited) {
    outcomes.push(await reverifySource(target, opts));
  }

  const counts: Record<string, number> = {};
  for (const o of outcomes) counts[o.status] = (counts[o.status] || 0) + 1;

  return {
    outcomes,
    re_verified: outcomes.filter((o) => o.evidence_intact).length,
    failed: outcomes.filter((o) => !o.evidence_intact).length,
    needs_review: outcomes.filter((o) => o.triggers_review).length,
    counts_by_status: counts,
    verifier_version: REVERIFICATION_VERSION,
  };
}

/**
 * Pull candidate evidence records out of a stored case or skip-trace payload.
 * Accepts either a bare array or a `{ evidence_records: [...] }` wrapper, since
 * both shapes exist in stored records.
 */
export function collectEvidenceRecords(source: unknown): ReverificationTarget[] {
  const out: ReverificationTarget[] = [];

  const fromRecord = (node: unknown): ReverificationTarget | null => {
    if (!node || typeof node !== "object" || Array.isArray(node)) return null;
    const rec = node as Record<string, unknown>;
    return {
      finding_id: typeof rec.finding_id === "string" ? rec.finding_id : "",
      source_url: typeof rec.source_url === "string" ? rec.source_url : "",
      content_hash: typeof rec.content_hash === "string" ? rec.content_hash : "",
      retrieved_at: typeof rec.retrieved_at === "string" ? rec.retrieved_at : "",
      evidence_excerpt: typeof rec.evidence_excerpt === "string" ? rec.evidence_excerpt : "",
      preserved_snapshot_url: typeof rec.preserved_snapshot_url === "string" ? rec.preserved_snapshot_url : "",
      preserved_snapshot_hash: typeof rec.preserved_snapshot_hash === "string" ? rec.preserved_snapshot_hash : "",
    };
  };

  /**
   * The stored shapes vary: a bare array of records, an object carrying
   * `evidence_records`, or a case payload carrying `skip_traces` whose own
   * `search_results` carry records. Walking all of them matters — missing one
   * silently removes evidence from the register, and absent evidence must be
   * reported, never dropped on the floor.
   */
  const absorb = (node: unknown, depth = 0): void => {
    // Generous but finite: a case payload nests case -> skip_traces[] -> trace
    // -> search_results -> evidence_records[]. Stopping early would silently
    // drop evidence, which is precisely the failure this guards against.
    if (depth > 8 || node === null || node === undefined) return;
    if (Array.isArray(node)) {
      for (const item of node) {
        const direct = fromRecord(item);
        if (direct && (direct.finding_id || direct.source_url)) out.push(direct);
        else absorb(item, depth + 1);
      }
      return;
    }
    if (typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
    absorb(obj.evidence_records, depth + 1);
    absorb(obj.search_results, depth + 1);
    absorb(obj.skip_traces, depth + 1);
  };

  absorb(source);
  return out;
}