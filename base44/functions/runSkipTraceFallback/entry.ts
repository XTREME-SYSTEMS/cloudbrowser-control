import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

/**
 * Evidence-gated skip-trace adapter.
 *
 * A provider response or a plausible-looking candidate is not verified evidence.
 * This adapter deliberately has no synthetic-data or unapproved scraping fallback.
 */
import { authorizeSearch } from "../../shared/searchValidation.ts";

export default async function (req: Request): Promise<Response> {
  const tiersAttempted = ["llm"];
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { property_address, owner_name, phone, email, company, batch_id, deep_search, spreadsheet_url, authorization, heir_search_id } = body as any;

    if (![property_address, owner_name, phone, email, company].some((value) => typeof value === "string" && value.trim())) {
      return Response.json({
        status: "failed",
        verification_status: "no_verified_results",
        evidence_verified: false,
        error: "At least one search input is required.",
      }, { status: 400 });
    }

    // ===== AUTHORIZATION GATE =====
    // The permissible purpose is what authorises the access, so it is checked
    // before any source is contacted — never reconstructed afterwards.
    const operator = await base44.auth.me().catch(() => null);

    // Case-level inheritance: a case is authorised once at intake and every
    // search serving it inherits that authority. Without this each heir trace
    // must restate the purpose, and the natural shortcut is to stop asking —
    // which is how a recorded purpose rots into a checkbox.
    let auth = authorization || {};
    const hasInlineAuth = ["permissible_purpose", "legal_matter", "case_reference"].every(
      (key) => typeof (auth as any)[key] === "string" && (auth as any)[key].trim(),
    );
    if (!hasInlineAuth && heir_search_id) {
      const parentCase: any = await base44.entities.HeirSearch.get(heir_search_id).catch(() => null);
      const inherited = parentCase?.authorization || {};
      auth = {
        permissible_purpose: inherited.permissible_purpose,
        legal_matter: inherited.legal_matter,
        case_reference: inherited.case_reference,
        data_categories: Array.isArray(inherited.data_categories) ? inherited.data_categories : [],
      };
    }
    const verdict = authorizeSearch({
      permissible_purpose: auth.permissible_purpose,
      legal_matter: auth.legal_matter,
      case_reference: auth.case_reference,
      data_categories: Array.isArray(auth.data_categories) ? auth.data_categories : [],
      subject_name: owner_name || property_address,
      requested_by_id: operator?.id,
      requested_by_email: operator?.email,
    });

    if (!verdict.ok) {
      console.warn("runSkipTraceFallback refused by authorization gate:", verdict.summary);
      return Response.json({
        status: "rejected",
        verification_status: "unauthorized",
        evidence_verified: false,
        error:
          "Search refused by the authorization gate. A permissible purpose, the specific legal matter and a case reference must all be recorded before any source is contacted.",
        authorization_verdict: verdict,
      }, { status: 403 });
    }

    try {
      const raw = await base44.functions.invoke("runSkipTrace", {
        property_address, owner_name, phone, email, company,
        // Link the trace to its parent case so the QA pipeline can find it.
        batch_id: batch_id || heir_search_id,
        deep_search, spreadsheet_url,
      });
      const result: any = raw?.data ?? raw;

      if (!result || result.error) {
        return Response.json({
          status: "source_unavailable",
          verification_status: "no_verified_results",
          evidence_verified: false,
          error: "The primary research provider did not return a usable result. No synthetic fallback was used.",
          provider_error: typeof result?.error === "string" ? result.error.slice(0, 300) : undefined,
          tiers_attempted: tiersAttempted,
        }, { status: 503 });
      }

      const evidenceVerified = hasVerifiableEvidence(result);
      const hasCandidates = hasCandidateData(result);
      const status = evidenceVerified && result.status === "found"
        ? "found"
        : hasCandidates
          ? "partial"
          : result.status === "failed"
            ? "failed"
            : "no_verified_results";

      const safeResult = {
        ...result,
        status,
        verification_status: evidenceVerified ? "verified" : hasCandidates ? "needs_review" : "no_verified_results",
        evidence_verified: evidenceVerified,
        candidate_data_unverified: !evidenceVerified && hasCandidates,
        confidence_score: evidenceVerified ? Number(result.confidence_score) || 0 : 0,
        candidate_confidence_score: Number(result.candidate_confidence_score ?? result.confidence_score) || 0,
      };

      return Response.json(withUiAliases(safeResult, "llm", tiersAttempted));
    } catch (_providerError) {
      return Response.json({
        status: "source_unavailable",
        verification_status: "no_verified_results",
        evidence_verified: false,
        error: "The primary research provider is unavailable. No synthetic fallback was used.",
        tiers_attempted: tiersAttempted,
      }, { status: 503 });
    }
  } catch (_error) {
    return Response.json({
      status: "failed",
      verification_status: "no_verified_results",
      evidence_verified: false,
      error: "The request could not be processed.",
      tiers_attempted: tiersAttempted,
    }, { status: 500 });
  }
}

function hasVerifiableEvidence(result: any): boolean {
  if (result?.evidence_verified !== true || result?.verification_status !== "verified" || !Array.isArray(result?.evidence_records)) {
    return false;
  }
  return result.evidence_records.some((record: any) => {
    if (!record || record.status !== "verified" || typeof record.finding_id !== "string" || !record.finding_id.trim()) return false;
    if (typeof record.retrieved_at !== "string" || !Number.isFinite(Date.parse(record.retrieved_at))) return false;
    if (typeof record.content_hash !== "string" || !/^[a-f0-9]{64}$/i.test(record.content_hash)) return false;
    try {
      const url = new URL(record.source_url);
      return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname);
    } catch {
      return false;
    }
  });
}

function hasCandidateData(result: any): boolean {
  const arrays = [
    result?.phone_numbers, result?.found_phone_numbers, result?.emails, result?.found_emails,
    result?.addresses, result?.found_addresses, result?.social_profiles, result?.found_social_profiles,
    result?.relatives, result?.found_relatives,
  ];
  const targetName = String(result?.target_owner_name || "").trim().toLocaleLowerCase();
  const foundName = String(result?.found_owner_name || result?.owner_name || "").trim();
  const hasNewName = Boolean(foundName) && foundName.toLocaleLowerCase() !== targetName;
  const property = result?.property_data && typeof result.property_data === "object" ? result.property_data : {};
  const propertyFields = ["owner_name", "mailing_address", "co_owners", "purchase_date", "property_value", "lot_size"];
  const hasPropertyCandidate = propertyFields.some((key) => {
    const value = property[key];
    return Array.isArray(value) ? value.length > 0 : typeof value === "string" ? value.trim().length > 0 : value !== null && value !== undefined;
  });
  return arrays.some((items) => Array.isArray(items) && items.length > 0) || hasNewName || hasPropertyCandidate;
}

function withUiAliases(result: any, tier: string, tiersAttempted: string[]): any {
  return {
    ...result,
    phone_numbers: result.phone_numbers || result.found_phone_numbers || [],
    emails: result.emails || result.found_emails || [],
    addresses: result.addresses || result.found_addresses || [],
    social_profiles: result.social_profiles || result.found_social_profiles || [],
    relatives: result.relatives || result.found_relatives || [],
    sources: result.sources || result.sources_checked || [],
    methods: result.methods || result.methods_used || [],
    duration_ms: result.duration_ms || result.search_duration_ms || 0,
    tier_used: tier,
    tiers_attempted: tiersAttempted,
  };
}