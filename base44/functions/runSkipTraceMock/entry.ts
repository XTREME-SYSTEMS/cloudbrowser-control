import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

/**
 * Isolated test fixture endpoint. Never creates or updates investigative records.
 * Fixture output is intentionally obvious and cannot be mistaken for real PII.
 */
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || (user.role !== "admin" && user.is_admin !== true)) {
      return Response.json({ error: "Forbidden", status: "failed" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    if (body?.test_mode !== true) {
      return Response.json({
        error: "This endpoint is restricted to explicitly requested isolated test fixtures.",
        status: "failed",
      }, { status: 403 });
    }

    return Response.json({
      status: "test_fixture",
      verification_status: "test_fixture",
      evidence_verified: false,
      candidate_data_unverified: false,
      confidence_score: 0,
      found_owner_name: "TEST_FIXTURE_ONLY",
      found_phone_numbers: [],
      found_emails: [],
      found_addresses: [],
      found_social_profiles: [],
      found_relatives: [],
      property_data: {},
      sources_checked: [],
      methods_used: ["isolated_test_fixture"],
      search_duration_ms: 0,
      _mock: true,
      test_fixture: true,
      note: "Synthetic fixture only. Not a real person, property finding, or evidence record.",
    });
  } catch (_error) {
    return Response.json({ error: "Test fixture request failed.", status: "failed" }, { status: 500 });
  }
}
