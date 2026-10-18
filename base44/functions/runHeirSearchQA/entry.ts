import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { invokeLLM, setGatewayFallback } from "../../shared/vercelAiGateway.ts";
import { BENCHMARK_METRICS, QA_VALIDATION_CRITERIA } from "../../shared/heirSearchBenchmark.ts";

/**
 * Independent QA Validation for Heir Search
 *
 * This function runs AFTER the search and auto-trace complete.
 * It does NOT conduct searches — it audits the work product.
 *
 * Two-stage validation:
 *   Stage 1: QA Agent — completeness, accuracy, court-readiness, benchmark comparison
 *   Stage 2: Validator Agent — evidence chain, source citations, hallucination detection
 *
 * Produces a QA Certification that is attached to the HeirSearch record.
 * A score ≥90 produces a certification stamp suitable for the final report.
 */
const VALIDATION_MODEL = "gpt_5_4";

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    setGatewayFallback(base44);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { heir_search_id, run_validator = true } = body as any;

    if (!heir_search_id) {
      return Response.json({ error: "heir_search_id required" }, { status: 400 });
    }

    // Load the completed heir search case
    const hs: any = await base44.entities.HeirSearch.get(heir_search_id);
    if (!hs) return Response.json({ error: "Heir search not found" }, { status: 404 });

    // Load associated skip traces
    const skipTraces: any = await base44.entities.SkipTrace.filter(
      { batch_id: heir_search_id },
      { limit: 50 }
    );
    const traces = skipTraces.items || skipTraces || [];

    // ════════════════════════════════════════════════════════════════
    // STAGE 1: QA AGENT — Completeness, Accuracy, Court-Readiness
    // ════════════════════════════════════════════════════════════════
    const qaInput = {
      case_id: hs.id,
      deceased_name: hs.deceased_name,
      deceased_confirmed: hs.deceased_confirmed,
      deceased_details: hs.deceased_details,
      family_tree: hs.family_tree,
      identified_heirs_count: hs.identified_heirs?.length || 0,
      identified_heirs: (hs.identified_heirs || []).slice(0, 20).map((h: any) => ({
        name: h.name,
        relationship: h.relationship,
        confidence: h.confidence,
        has_phone: (h.phone_numbers?.length || 0) > 0,
        has_email: (h.emails?.length || 0) > 0,
        has_address: !!h.address,
        has_social: (h.social_profiles?.length || 0) > 0,
      })),
      sources_checked_count: hs.sources_checked?.length || 0,
      sources_checked: hs.sources_checked,
      methods_used_count: hs.methods_used?.length || 0,
      methods_used: hs.methods_used,
      confidence_score: hs.confidence_score,
      status: hs.status,
      notes: hs.notes,
      skip_traces_count: traces.length,
      skip_trace_sources: traces.reduce((acc: number, t: any) => acc + (t.sources_checked?.length || 0), 0),
      benchmark_metrics: BENCHMARK_METRICS,
      qa_criteria: QA_VALIDATION_CRITERIA,
    };

    const qaResult: any = await invokeLLM({
      model: VALIDATION_MODEL,
      add_context_from_internet: false,
      prompt: `You are the Independent QA Agent for an heir search case. Audit this completed case against the industry benchmark (top 3 heir-search companies: HeirSearch.com, Heir Pros, Ancestry ProGenealogists).

CASE DATA:
${JSON.stringify(qaInput, null, 2)}

Validate across 4 dimensions. For each, score 0-100 and list specific deficiencies:

1. COMPLETENESS (weight 30%):
   - Were 30+ source categories queried? (count sources_checked)
   - Was deceased identity confirmed? (deceased_confirmed flag + deceased_details)
   - Was family tree constructed with 4+ relation types?
   - Were all heirs traced for contact info?
   - Were associates traced (skip_traces_count > 0)?

2. ACCURACY (weight 30%):
   - Does every heir have a confidence score?
   - Are there any heirs with 0 contact info (no phone, email, address, social)?
   - Is the overall confidence_score justified by the evidence?
   - Are there unverified claims?

3. COURT_READINESS (weight 25%):
   - Are sources listed with enough detail for court submission?
   - Is the evidence chain documented?
   - Would this survive cross-examination?

4. BENCHMARK_COMPARISON (weight 15%):
   - Source diversity vs industry best (15-20): is ours ≥22?
   - Verification layers: is this the 2nd layer (QA after search)?
   - Is the confidence_score ≥90 for "found" cases?

Produce a JSON object:
{
  "qa_score": number (0-100, weighted average),
  "completeness_score": number,
  "accuracy_score": number,
  "court_readiness_score": number,
  "benchmark_score": number,
  "deficiencies": [string],
  "recommended_corrections": [string],
  "qa_certified": boolean (true if overall ≥90 AND no critical deficiencies),
  "certification_stamp": string (if certified: "QA Certified by Independent Agent — Score: X/100 — Date: YYYY-MM-DD"),
  "summary": string (2-3 sentence professional assessment)
}`,
      response_json_schema: {
        type: "object",
        properties: {
          qa_score: { type: "number" },
          completeness_score: { type: "number" },
          accuracy_score: { type: "number" },
          court_readiness_score: { type: "number" },
          benchmark_score: { type: "number" },
          deficiencies: { type: "array", items: { type: "string" } },
          recommended_corrections: { type: "array", items: { type: "string" } },
          qa_certified: { type: "boolean" },
          certification_stamp: { type: "string" },
          summary: { type: "string" },
        },
      },
    });

    // ════════════════════════════════════════════════════════════════
    // STAGE 2: VALIDATOR AGENT — Evidence Chain, Hallucination Detection
    // ════════════════════════════════════════════════════════════════
    let validationResult: any = null;
    if (run_validator) {
      const validationInput = {
        case_id: hs.id,
        deceased_name: hs.deceased_name,
        deceased_details: hs.deceased_details,
        identified_heirs: (hs.identified_heirs || []).slice(0, 15).map((h: any) => ({
          name: h.name,
          relationship: h.relationship,
          confidence: h.confidence,
          phone_count: h.phone_numbers?.length || 0,
          email_count: h.emails?.length || 0,
          social_count: h.social_profiles?.length || 0,
          sources: h.phone_numbers?.map((p: any) => p.source).concat(
            h.emails?.map((e: any) => e.source) || []
          ).concat(
            h.social_profiles?.map((s: any) => s.platform) || []
          ) || [],
        })),
        sources_checked: hs.sources_checked,
        methods_used: hs.methods_used,
        qa_score: qaResult?.qa_score,
      };

      validationResult = await invokeLLM({
        model: VALIDATION_MODEL,
        add_context_from_internet: false,
        prompt: `You are the Independent Validator Agent for an heir search case. You are a disinterested third party — your only allegiance is to truth and accuracy. Verify the evidence chain.

CASE DATA:
${JSON.stringify(validationInput, null, 2)}

Validate:

1. EVIDENCE_CHAIN: For each identified heir, is there a clear source → finding chain? Flag any heir with no sources listed.

2. SOURCE_CORROBORATION: For critical findings (heir identity, relationship), are there ≥2 independent sources? Flag any heir backed by only 1 source type.

3. HALLUCINATION_DETECTION: Scan for:
   - Names that seem fabricated (too generic, too perfect)
   - Impossible dates (born after death, etc.)
   - Contradictory relationships (person listed as both parent and child)
   - Confidence scores that seem inflated relative to evidence
   - Data that appears AI-generated without source backing

4. LEGAL_SUFFICIENCY: Would this evidence survive a court challenge? Is the chain defensible?

Produce:
{
  "validation_score": number (0-100),
  "verified_heirs": number,
  "unverified_heirs": number,
  "unverified_details": [string],
  "hallucination_risk": "low" | "medium" | "high",
  "hallucination_flags": [string],
  "legal_sufficiency": "court-ready" | "needs-work" | "insufficient",
  "validator_certified": boolean (true if ≥90 AND hallucination_risk is low AND legal_sufficiency is court-ready),
  "certification_stamp": string (if certified: "Independently Validated — Evidence Chain Verified — Date: YYYY-MM-DD"),
  "summary": string
}`,
        response_json_schema: {
          type: "object",
          properties: {
            validation_score: { type: "number" },
            verified_heirs: { type: "number" },
            unverified_heirs: { type: "number" },
            unverified_details: { type: "array", items: { type: "string" } },
            hallucination_risk: { type: "string" },
            hallucination_flags: { type: "array", items: { type: "string" } },
            legal_sufficiency: { type: "string" },
            validator_certified: { type: "boolean" },
            certification_stamp: { type: "string" },
            summary: { type: "string" },
          },
        },
      });
    }

    // ════════════════════════════════════════════════════════════════
    // COMBINED CERTIFICATION
    // ════════════════════════════════════════════════════════════════
    const overallScore = validationResult
      ? Math.round((qaResult.qa_score * 0.5 + validationResult.validation_score * 0.5))
      : qaResult.qa_score;

    const fullyCertified = qaResult.qa_certified && (!validationResult || validationResult.validator_certified);

    const certification = {
      qa: qaResult,
      validator: validationResult,
      overall_score: overallScore,
      fully_certified: fullyCertified,
      certification_stamp: fullyCertified
        ? `✓ PRODUCTION-GRADE CERTIFIED | QA: ${qaResult.qa_score}/100${validationResult ? ` | Validator: ${validationResult.validation_score}/100` : ""} | ${new Date().toISOString().split("T")[0]}`
        : `⚠ CERTIFICATION PENDING | QA: ${qaResult.qa_score}/100${validationResult ? ` | Validator: ${validationResult.validation_score}/100` : ""} | Deficiencies: ${qaResult.deficiencies?.length || 0}`,
      validated_at: new Date().toISOString(),
    };

    // Persist certification to the HeirSearch record
    await base44.entities.HeirSearch.update(heir_search_id, {
      notes: `${hs.notes || ""}\n\n--- QA CERTIFICATION ---\n${certification.certification_stamp}\nQA Summary: ${qaResult.summary}\n${validationResult ? `Validator Summary: ${validationResult.summary}` : ""}`,
    });

    // Record test results for audit trail
    const runId = `qa-${heir_search_id}-${Date.now()}`;
    const testResults = [
      { suite: "QA", test_name: "completeness", status: qaResult.completeness_score >= 80 ? "pass" : "fail", score_points: qaResult.completeness_score, max_points: 100, run_id: runId },
      { suite: "QA", test_name: "accuracy", status: qaResult.accuracy_score >= 80 ? "pass" : "fail", score_points: qaResult.accuracy_score, max_points: 100, run_id: runId },
      { suite: "QA", test_name: "court_readiness", status: qaResult.court_readiness_score >= 80 ? "pass" : "fail", score_points: qaResult.court_readiness_score, max_points: 100, run_id: runId },
      { suite: "QA", test_name: "benchmark_comparison", status: qaResult.benchmark_score >= 80 ? "pass" : "fail", score_points: qaResult.benchmark_score, max_points: 100, run_id: runId },
    ];
    if (validationResult) {
      testResults.push(
        { suite: "Validator", test_name: "evidence_chain", status: validationResult.validation_score >= 80 ? "pass" : "fail", score_points: validationResult.validation_score, max_points: 100, run_id: runId },
        { suite: "Validator", test_name: "hallucination_detection", status: validationResult.hallucination_risk === "low" ? "pass" : "fail", score_points: validationResult.hallucination_risk === "low" ? 100 : 50, max_points: 100, run_id: runId },
        { suite: "Validator", test_name: "legal_sufficiency", status: validationResult.legal_sufficiency === "court-ready" ? "pass" : "fail", score_points: validationResult.legal_sufficiency === "court-ready" ? 100 : 50, max_points: 100, run_id: runId },
      );
    }
    await base44.entities.TestResult.bulkCreate(testResults);

    return Response.json({
      ok: true,
      heir_search_id,
      certification,
      qa_score: qaResult.qa_score,
      validation_score: validationResult?.validation_score || null,
      overall_score: overallScore,
      fully_certified: fullyCertified,
      certification_stamp: certification.certification_stamp,
      qa_deficiencies: qaResult.deficiencies,
      qa_corrections: qaResult.recommended_corrections,
      validator_flags: validationResult?.hallucination_flags || [],
      legal_sufficiency: validationResult?.legal_sufficiency || null,
    });
  } catch (error: any) {
    console.error("runHeirSearchQA error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}