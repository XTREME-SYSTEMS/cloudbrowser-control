import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { reverifyAll, collectEvidenceRecords } from "../../shared/sourceReverification.ts";

/**
 * EVIDENCE RE-VERIFICATION
 *
 * Re-fetches every recorded source for a case and reports, mechanically, whether
 * the recorded evidence is still present. This is the step that lets the
 * Validator make a truthful statement about source integrity: the answer comes
 * from an HTTP fetch, not from a model's assurance.
 *
 * A source that cannot be reached, or whose recorded evidence is no longer
 * present, is reported as needing review. It is never reported as diligence.
 */
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const operator = await base44.auth.me().catch(() => null);
    if (!operator) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { heir_search_id, targets, timeout_ms } = body as any;

    if (!heir_search_id && !Array.isArray(targets)) {
      return Response.json(
        { error: "Provide heir_search_id or an explicit targets array." },
        { status: 400 },
      );
    }

    let collected = Array.isArray(targets) ? targets : [];

    if (collected.length === 0) {
      const hs: any = await base44.entities.HeirSearch.get(heir_search_id);
      if (!hs) return Response.json({ error: "Heir search not found" }, { status: 404 });

      collected = collectEvidenceRecords(hs.search_results);

      const traces: any = await base44.entities.SkipTrace.filter(
        { batch_id: heir_search_id },
        { limit: 50, fields: ["search_results"] },
      );
      for (const trace of traces?.items || []) {
        collected = collected.concat(collectEvidenceRecords(trace.search_results));
      }
    }

    if (collected.length === 0) {
      return Response.json({
        ok: true,
        heir_search_id: heir_search_id || null,
        recorded_sources: 0,
        message:
          "No source evidence is recorded for this case, so there is nothing to re-verify. Absence of recorded evidence is not verification.",
        outcomes: [],
      });
    }

    const report = await reverifyAll(collected, { timeout_ms });

    return Response.json({
      ok: true,
      heir_search_id: heir_search_id || null,
      recorded_sources: collected.length,
      re_verified: report.re_verified,
      failed: report.failed,
      counts_by_status: report.counts_by_status,
      verifier_version: report.verifier_version,
      outcomes: report.outcomes,
    });
  } catch (error: any) {
    console.error("reverifyEvidence error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}