/**
 * SOURCE ADAPTER READINESS
 * ==========================================================================
 * A licensed data source that is not configured must be reported as BLOCKED,
 * with the exact credential that is missing. It must NEVER be silently skipped
 * and it must never be quietly replaced by a model's recollection.
 *
 * The distinction this module exists to preserve:
 *
 *   SKIPPED   - the source was not tried, and the report does not say so.
 *               The reader assumes coverage that does not exist. This is the
 *               failure mode that turns an unsearched source into apparent
 *               diligence, and it is forbidden.
 *   BLOCKED   - the source was not available, and the report says exactly which
 *               credential is missing, so a reader can see the real coverage.
 *
 * This module reports readiness and nothing else. It does not contain provider
 * endpoints or field mappings, because no license is held in this workspace and
 * inventing an endpoint would be worse than reporting the gap. When credentials
 * are added, that is where the retrieval implementation belongs.
 */

export type AdapterCategory =
  | "licensed_data_provider"
  | "public_record"
  | "genealogy"
  | "people_search";

export interface SourceAdapter {
  id: string;
  label: string;
  category: AdapterCategory;
  /** Every env var that must be present before this adapter may be called. */
  credential_env: string[];
  /** Why this source is legitimate to query, and under what authority. */
  authority: string;
  /** What the licence actually unlocks. Stated conservatively. */
  scope: string;
}

/**
 * The licensed and public sources this system is designed to use. Every one of
 * these requires credentials that are NOT present in this workspace, which is
 * why every adapter below resolves to BLOCKED. Naming them here is what makes
 * the gap auditable instead of invisible.
 */
export const SOURCE_ADAPTERS: SourceAdapter[] = [
  {
    id: "tloxp",
    label: "TLOxp (TransUnion)",
    category: "licensed_data_provider",
    credential_env: ["TLOXP_API_KEY", "TLOXP_SUBSCRIBER_ID"],
    authority: "Subscriber agreement carrying an explicit permissible-use clause; FCRA §604 governs what may be furnished.",
    scope: "Person, address, phone and asset location. Access is granted only for a declared permissible purpose.",
  },
  {
    id: "lexisnexis_risk",
    label: "LexisNexis Risk Solutions",
    category: "licensed_data_provider",
    credential_env: ["LEXISNEXIS_API_KEY", "LEXISNEXIS_CLIENT_ID"],
    authority: "GLBA-regulated non-public personal information; contract restricts use to the declared purpose.",
    scope: "Identity verification and due diligence, including financial and public-record linkage.",
  },
  {
    id: "tracers",
    label: "Tracers",
    category: "licensed_data_provider",
    credential_env: ["TRACERS_API_KEY"],
    authority: "Investigator-led research platform; terms restrict use to legitimate investigative purpose.",
    scope: "Skip trace, vehicle, business and asset research.",
  },
  {
    id: "ssdi",
    label: "Social Security Death Index",
    category: "public_record",
    credential_env: ["SSDI_ACCESS_TOKEN"],
    authority: "Public death records; no FCRA consumer-report restrictions, but identity must still be corroborated.",
    scope: "Death confirmation. Never sufficient on its own to establish a death.",
  },
  {
    id: "county_assessor",
    label: "County assessor and recorder records",
    category: "public_record",
    credential_env: ["COUNTY_RECORDS_API_KEY"],
    authority: "Public property and deed records, accessed jurisdiction by jurisdiction.",
    scope: "Ownership, deed chain and assessed value. Coverage is per-county and is not uniform.",
  },
  {
    id: "obituaries",
    label: "Obituary and funeral-home archives",
    category: "public_record",
    credential_env: ["OBITUARY_ARCHIVE_API_KEY"],
    authority: "Published obituaries; used for family structure, always checked against a second source.",
    scope: "Surviving family as named in a published notice. A notice is not a legal determination.",
  },
  {
    id: "familysearch",
    label: "FamilySearch",
    category: "genealogy",
    credential_env: ["FAMILYSEARCH_API_KEY"],
    authority: "Genealogical archive; records are indexed transcriptions whose accuracy varies by record.",
    scope: "Historical vital, census and migration records.",
  },
  {
    id: "ancestry",
    label: "Ancestry",
    category: "genealogy",
    credential_env: ["ANCESTRY_API_KEY"],
    authority: "Genealogical archive; user-contributed trees are unverified and are never treated as records.",
    scope: "Indexed historical records. Trees are leads only.",
  },
];

export interface AdapterReadiness {
  id: string;
  label: string;
  category: AdapterCategory;
  status: "available" | "blocked";
  missing_credentials: string[];
  authority: string;
  scope: string;
}

export interface SourceReadinessReport {
  available: AdapterReadiness[];
  blocked: AdapterReadiness[];
  summary: string;
  checked_at: string;
}

function envValue(env: Record<string, string | undefined>, key: string): string | undefined {
  const v = env[key];
  return typeof v === "string" && v.trim().length > 0 ? v : undefined;
}

export function adapterReadiness(
  env: Record<string, string | undefined>,
  adapter: SourceAdapter,
): AdapterReadiness {
  const missing = adapter.credential_env.filter((key) => !envValue(env, key));
  return {
    id: adapter.id,
    label: adapter.label,
    category: adapter.category,
    status: missing.length === 0 ? "available" : "blocked",
    missing_credentials: missing,
    authority: adapter.authority,
    scope: adapter.scope,
  };
}

/**
 * Readiness across every adapter. `env` is passed in rather than read from
 * global state so the report stays testable and so nothing is read by accident.
 */
export function reportSourceReadiness(
  env: Record<string, string | undefined>,
): SourceReadinessReport {
  const rows = SOURCE_ADAPTERS.map((a) => adapterReadiness(env, a));
  const available = rows.filter((r) => r.status === "available");
  const blocked = rows.filter((r) => r.status === "blocked");

  return {
    available,
    blocked,
    summary:
      available.length === 0
        ? `0 of ${rows.length} licensed and public sources are configured. Every one is BLOCKED. Coverage is limited to open web research, and the report must say so.`
        : `${available.length} of ${rows.length} sources available; ${blocked.length} BLOCKED. Blocked sources are reported as unavailable, never as searched.`,
    checked_at: new Date().toISOString(),
  };
}

/**
 * The line a report must carry when sources were unavailable. Returned as text
 * so every consumer states it the same way.
 */
export function blockedSourcesDisclosure(report: SourceReadinessReport): string {
  if (report.blocked.length === 0) return "";
  const named = report.blocked.map((b) => `${b.label} (missing: ${b.missing_credentials.join(", ")})`);
  return `Sources unavailable for this research and therefore NOT searched: ${named.join("; ")}. Any statement of coverage excludes these sources.`;
}