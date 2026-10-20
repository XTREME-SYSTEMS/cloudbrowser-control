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
 * DOCUMENTED LIMITATION, stated plainly rather than papered over: a live web
 * page changes. New adverts, a changed timestamp or a re-rendered template will
 * break a byte-for-byte hash comparison even though the underlying record is
 * unchanged. That is why a byte mismatch alone is reported as `source_changed`,
 * which routes to human review — it is NOT silently treated as verified, and it
 * is NOT silently treated as false. The substantive check is whether the
 * recorded excerpt is still present.
 *
 * A source that cannot be reached, and an excerpt that is no longer present,
 * both resolve to `evidence_intact: false`. A failure is an error, never a
 * negative finding.
 */

export const REVERIFICATION_VERSION = "reverify-1.0.0";

const DEFAULT_TIMEOUT_MS = 20000;
const MAX_BODY_CHARS = 2_000_000;

export type ReverificationStatus =
  | "re_verified"
  | "source_changed"
  | "unreachable"
  | "invalid_target";

export interface ReverificationTarget {
  finding_id?: string;
  source_url?: string;
  content_hash?: string;
  retrieved_at?: string;
  evidence_excerpt?: string;
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
   * The certification-relevant verdict: the source was re-fetched and the
   * recorded evidence is still there (hash match or excerpt present).
   */
  evidence_intact: boolean;
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

function baseOutcome(target: ReverificationTarget): Omit<ReverificationOutcome, "status" | "re_fetched" | "hash_matches" | "excerpt_present" | "evidence_intact" | "checked_at" | "verifier_version"> {
  return {
    finding_id: (target?.finding_id || "").trim(),
    source_url: (target?.source_url || "").trim(),
  };
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
  const base = baseOutcome(target);

  const finish = (
    status: ReverificationStatus,
    extra: Partial<ReverificationOutcome>,
  ): ReverificationOutcome => ({
    ...base,
    status,
    re_fetched: false,
    hash_matches: false,
    excerpt_present: null,
    evidence_intact: false,
    checked_at: checkedAt,
    verifier_version: REVERIFICATION_VERSION,
    ...extra,
  });

  if (!isReverifiableTarget(target)) {
    const reason =
      typeof target?.finding_id !== "string" || !target.finding_id.trim()
        ? "No finding_id, so this record cannot be tied back to a claim."
        : "source_url is absent or is not a valid http(s) URL.";
    return finish("invalid_target", { error: reason });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts?.timeout_ms ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(target.source_url as string, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "CloudBrowser-EvidenceReverification/1.0" },
    });

    if (!response.ok) {
      return finish("unreachable", {
        http_status: response.status,
        redirected: response.redirected === true,
        error: `HTTP ${response.status}`,
      });
    }

    const body = (await response.text()).slice(0, MAX_BODY_CHARS);
    const observedHash = await sha256Hex(body);

    const recordedHash = typeof target.content_hash === "string" ? target.content_hash.trim() : "";
    const hashMatches = SHA256_HEX.test(recordedHash) && recordedHash.toLowerCase() === observedHash;

    const excerpt =
      typeof target.evidence_excerpt === "string" && target.evidence_excerpt.trim().length > 0
        ? target.evidence_excerpt.trim()
        : null;
    const excerptPresent = excerpt === null ? null : normalizedIncludes(body, excerpt);

    const evidenceIntact = hashMatches || excerptPresent === true;
    const status: ReverificationStatus = evidenceIntact ? "re_verified" : "source_changed";

    return {
      ...base,
      status,
      re_fetched: true,
      hash_matches: hashMatches,
      excerpt_present: excerptPresent,
      evidence_intact: evidenceIntact,
      observed_hash: observedHash,
      http_status: response.status,
      redirected: response.redirected === true,
      error: evidenceIntact
        ? undefined
        : excerpt === null
          ? "Re-fetched, but the bytes differ from the recorded digest and no evidence excerpt was recorded to check against."
          : "Re-fetched, but neither the recorded digest nor the recorded evidence excerpt could be confirmed. The source may have changed, or the recorded evidence may not have come from this page.",
      checked_at: checkedAt,
      verifier_version: REVERIFICATION_VERSION,
    };
  } catch (err: any) {
    const aborted = err?.name === "AbortError";
    return finish("unreachable", {
      error: aborted
        ? `No response within ${opts?.timeout_ms ?? DEFAULT_TIMEOUT_MS}ms`
        : err?.message || "Fetch failed",
    });
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