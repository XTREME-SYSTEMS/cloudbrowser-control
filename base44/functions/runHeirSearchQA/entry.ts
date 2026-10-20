import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { invokeLLM, setGatewayFallback } from "../../shared/vercelAiGateway.ts";
import { BENCHMARK_METRICS, QA_VALIDATION_CRITERIA } from "../../shared/heirSearchBenchmark.ts";
import {
  QA_MODEL,
  VALIDATOR_MODEL,
  SEARCH_PATH_MODEL,
  CERTIFIER_VERSION,
  CERTIFICATION_THRESHOLDS,
  evaluateCertification,
  refusalReason,
} from "../../shared/independentCertification.ts";
import { reverifyAll, collectEvidenceRecords } from "../../shared/sourceReverification.ts";
import { SOURCE_ADAPTERS, reportSourceReadiness, blockedSourcesDisclosure } from "../../shared/sourceAdapters.ts";

/**
 * INDEPENDENT QA AND VALIDATION
 * ==========================================================================
 * Runs AFTER the search and auto-trace complete. It conducts no searches — it
 * audits the work product.
 *
 * Independence is structural, not asserted:
 *   - The producer runs on SEARCH_PATH_MODEL. QA runs on QA_MODEL and the
 *     Validator on VALIDATOR_MODEL. Three distinct models, recorded on the
 *     certificate so the separation can be audited after the fact.
 *   - QA never sees the search agent's confidence_score, its notes, or any
 *     self-assessment. It sees raw findings and forms its own view.
 *   - The Validator never sees the QA score. No anchoring.
 *   - Source integrity is established by MECHANICAL re-fetch, not by either
 *     model's assurance. Both reviewers are told what the machine found.
 *
 * Certification is refused by a single failing rule. Scores cannot outvote one.
 */

function readEnv(keys: string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const key of keys) {
    try {
      out[key] = (process as any)?.env?.[key];
    } catch {
      out[key] = undefined;
    }
  }
  return out;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Corroboration is counted mechanically from the evidence register: for each
 * finding, how many DISTINCT hosts independently carry it. Two rows from the
 * same register are one source, not two.
 */
function buildCorroboration(records: any[]) {
  const map = new Map<string, Set<string>>();
  for (const record of records) {
    const findingId = typeof record?.finding_id === "string" ? record.finding_id.trim() : "";
    const host = hostOf(typeof record?.source_url === "string" ? record.source_url : "");
    if (!findingId || !host) continue;
    if (!map.has(findingId)) map.set(findingId, new Set());
    map.get(findingId)!.add(host);
  }
  return Array.from(map.entries()).map(([finding_id, hosts]) => ({
    finding_id,
    independent_sources: hosts.size,
  }));
}

/** Blocking violations already recorded on the case or its traces, passed through untouched. */
function collectBlockingViolations(hs: any, traces: any[]) {
  const out: any[] = [];
  const pull = (verdict: any) => {
    const violations = Array.isArray(verdict?.violations) ? verdict.violations : [];
    for (const v of violations) if (v?.severity === "blocking") out.push(v);
  };
  pull(hs?.validation);
  for (const trace of traces) pull(trace?.validation);
  return out;
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    setGatewayFallback(base44);
    const operator = await base44.auth.me().catch(() => null);
    if (!operator) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { heir_search_id, run_validator = true } = body as any;

    if (!heir_search_id) {
      return Response.json({ error: "heir_search_id required" }, { status: 400 });
    }

    const hs: any = await base44.entities.HeirSearch.get(heir_search_id);
    if (!hs) return Response.json({ error: "Heir search not found" }, { status: 404 });

    const traceRes: any = await base44.entities.SkipTrace.filter(
      { batch_id: heir_search_id },
      { limit: 50 },
    );
    const traces: any[] = traceRes?.items || [];

    // ── Source readiness: a blocked source is disclosed, never skipped ────────
    const env = readEnv(SOURCE_ADAPTERS.flatMap((a) => a.credential_env));
    const readiness = reportSourceReadiness(env);
    const disclosure = blockedSourcesDisclosure(readiness);

    // ── Mechanical re-verification of every recorded source ──────────────────
    let evidenceRecords: any[] = collectEvidenceRecords(hs.search_results);
    for (const trace of traces) {
      evidenceRecords = evidenceRecords.concat(collectEvidenceRecords(trace.search_results));
    }
    const reverification = evidenceRecords.length > 0
      ? await reverifyAll(evidenceRecords, { max: 100 })
      : { outcomes: [], re_verified: 0, failed: 0, counts_by_status: {}, verifier_version: "" };

    const corroboration = buildCorroboration(evidenceRecords);
    const blockingViolations = collectBlockingViolations(hs, traces);

    // ════════════════════════════════════════════════════════════════════════
    // STAGE 1 — QA: completeness and court-readiness.
    // Sees raw findings only. Deliberately NOT given confidence_score or notes,
    // because a reviewer that starts from the producer's own assessment is not
    // reviewing anything.
    // ════════════════════════════════════════════════════════════════════════
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
        has_phone: (h.phone_numbers?.length || 0) > 0,
        has_email: (h.emails?.length || 0) > 0,
        has_address: !!h.address,
        has_social: (h.social_profiles?.length || 0) > 0,
      })),
      sources_checked_count: hs.sources_checked?.length || 0,
      sources_checked: hs.sources_checked,
      methods_used_count: hs.methods_used?.length || 0,
      methods_used: hs.methods_used,
      status: hs.status,
      skip_traces_count: traces.length,
      skip_trace_sources: traces.reduce((acc: number, t: any) => acc + (t.sources_checked?.length || 0), 0),
      recorded_source_evidence_count: evidenceRecords.length,
      blocked_sources: readiness.blocked.map((b: any) => ({ label: b.label, missing_credentials: b.missing_credentials })),
      benchmark_metrics: BENCHMARK_METRICS,
      qa_criteria: QA_VALIDATION_CRITERIA,
    };

    const qaResult: any = await invokeLLM({
      model: QA_MODEL,
      add_context_from_internet: false,
      prompt: `You are the INDEPENDENT QA AGENT auditing a completed heir-search case. You did not perform this research and you have no stake in it. You audit the work product only.

You have NOT been given the research agent's confidence figure or its own summary. That is deliberate: form your assessment from the findings themselves. If the findings do not justify confidence, say so.

CASE DATA:
${JSON.stringify(qaInput, null, 2)}

Score four dimensions 0-100 and name specific deficiencies:

1. COMPLETENESS (weight 30%)
   - How many source categories were queried, and does that meet the benchmark?
   - Was the deceased identity confirmed, and by what?
   - Was a family tree constructed, and across how many relation types?
   - Were heirs traced for contact information?
   - Count the sources named under blocked_sources as NOT SEARCHED. Coverage claims must exclude them.

2. ACCURACY (weight 30%)
   - Does every relied-upon finding have recorded source evidence?
   - Are there heirs with no contact information at all?
   - Are there unverified claims presented as established fact?

3. COURT_READINESS (weight 25%)
   - Are sources listed with enough detail to be produced as exhibits?
   - Is the evidence chain documented end to end?
   - Would this survive cross-examination by opposing counsel?

4. BENCHMARK_COMPARISON (weight 15%)
   - Source diversity against the industry benchmarks supplied.
   - Is this the second of three verification layers?

Return JSON:
{
  "qa_score": number,
  "completeness_score": number,
  "accuracy_score": number,
  "court_readiness_score": number,
  "benchmark_score": number,
  "deficiencies": [string],
  "recommended_corrections": [string],
  "summary": string
}

Do NOT return a certification flag. Certification is decided by deterministic rules downstream, not by you.`,
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
          summary: { type: "string" },
        },
      },
    });

    const qaScore = typeof qaResult?.qa_score === "number" ? qaResult.qa_score : null;

    // ════════════════════════════════════════════════════════════════════════
    // STAGE 2 — VALIDATOR: is each claim actually true?
    // Receives the REAL evidence records and the MECHANICAL re-verification
    // results. It is NOT given the QA score, so its verdict is not anchored.
    // ════════════════════════════════════════════════════════════════════════
    let validationResult: any = null;
    if (run_validator) {
      const validatorInput = {
        case_id: hs.id,
        deceased_name: hs.deceased_name,
        deceased_details: hs.deceased_details,
        family_tree: hs.family_tree,
        identified_heirs: (hs.identified_heirs || []).slice(0, 15).map((h: any) => ({
          name: h.name,
          relationship: h.relationship,
          address: h.address || null,
          phone_count: h.phone_numbers?.length || 0,
          email_count: h.emails?.length || 0,
          social_count: h.social_profiles?.length || 0,
        })),
        sources_checked: hs.sources_checked,
        methods_used: hs.methods_used,
        // The real register, not a summary of counts.
        evidence_records: evidenceRecords,
        // What the machine actually found when it re-fetched. Authoritative on
        // reachability — do not contradict it from memory.
        mechanical_reverification: {
          verifier_version: reverification.verifier_version,
          re_verified: reverification.re_verified,
          failed: reverification.failed,
          outcomes: reverification.outcomes,
        },
        corroboration_by_finding: corroboration,
        blocked_sources: readiness.blocked.map((b: any) => b.label),
      };

      validationResult = await invokeLLM({
        model: VALIDATOR_MODEL,
        add_context_from_internet: false,
        prompt: `You are the INDEPENDENT VALIDATOR. You are a disinterested third party with no stake in whether this research succeeded. Your only allegiance is to what the evidence supports. You would rather fail a report than certify a false finding.

You have NOT been given the QA agent's score. Reach your own conclusion independently.

CASE DATA:
${JSON.stringify(validatorInput, null, 2)}

The 'mechanical_reverification' block is the result of an automated re-fetch of every recorded source. It is AUTHORITATIVE on reachability. Do not assert that a source is accessible if the machine recorded it as unreachable, and do not assert a source is sound if the machine recorded the evidence as no longer present.

Validate:

1. EVIDENCE_CHAIN — For every finding relied upon, is there a traceable chain from source to claim? Flag any finding with no recorded source.

2. SOURCE_CORROBORATION — Independent corroboration is counted in corroboration_by_finding by DISTINCT host. Flag any finding relied upon that rests on a single host.

3. HALLUCINATION_DETECTION — Scan for fabricated names, impossible dates, contradictory relationships, and findings with no recorded source. Any finding not present in the evidence register is a flag.

4. LEGAL_SUFFICIENCY — Would this survive a court challenge? State plainly where it would not.

5. COVERAGE_HONESTY — Are the blocked sources excluded from any coverage claim? A statement that implies a source was searched when it was blocked is a false statement and must be flagged.

Return JSON:
{
  "validation_score": number,
  "verified_findings": number,
  "unverified_findings": number,
  "unverified_details": [string],
  "hallucination_risk": "low" | "medium" | "high",
  "hallucination_flags": [string],
  "coverage_flags": [string],
  "legal_sufficiency": "court-ready" | "needs-work" | "insufficient",
  "summary": string
}

Do NOT return a certification flag. Certification is decided by deterministic rules downstream, not by you.`,
        response_json_schema: {
          type: "object",
          properties: {
            validation_score: { type: "number" },
            verified_findings: { type: "number" },
            unverified_findings: { type: "number" },
            unverified_details: { type: "array", items: { type: "string" } },
            hallucination_risk: { type: "string" },
            hallucination_flags: { type: "array", items: { type: "string" } },
            coverage_flags: { type: "array", items: { type: "string" } },
            legal_sufficiency: { type: "string" },
            summary: { type: "string" },
          },
        },
      });
    }

    // ════════════════════════════════════════════════════════════════════════
    // DETERMINISTIC CERTIFICATION
    // ════════════════════════════════════════════════════════════════════════
    const hallucinationFlags = [
      ...(Array.isArray(validationResult?.hallucination_flags) ? validationResult.hallucination_flags : []),
      ...(Array.isArray(validationResult?.coverage_flags) ? validationResult.coverage_flags : []),
    ];

    const verdict = evaluateCertification({
      search_model: SEARCH_PATH_MODEL,
      qa_model: QA_MODEL,
      validator_model: run_validator ? VALIDATOR_MODEL : "",
      qa_score: qaScore,
      validator_score: typeof validationResult?.validation_score === "number" ? validationResult.validation_score : null,
      blocking_violations: blockingViolations,
      corroboration,
      reverification: reverification.outcomes.map((o: any) => ({
        finding_id: o.finding_id,
        evidence_intact: o.evidence_intact,
        re_fetched: o.re_fetched,
        retrieval_status: o.status,
        error: o.error,
      })),
      hallucination_flags: hallucinationFlags,
      sources_actually_queried: hs.sources_checked,
    });

    const stamp = verdict.certified
      ? `CERTIFIED | QA ${verdict.qa_score}/100 (${verdict.qa_model}) | Validator ${verdict.validator_score}/100 (${verdict.validator_model}) | ${verdict.certified_at.slice(0, 10)} | ${CERTIFIER_VERSION}`
      : `CERTIFICATION REFUSED | ${verdict.failed_rules.join(", ")} | QA ${verdict.qa_score ?? "none"}/100 | Validator ${verdict.validator_score ?? "none"}/100`;

    const certification = {
      certified: verdict.certified,
      qa_score: verdict.qa_score,
      qa_model: verdict.qa_model,
      validator_score: verdict.validator_score,
      validator_model: verdict.validator_model,
      search_model: verdict.search_model,
      model_separation_ok: verdict.model_separation_ok,
      overall_score: verdict.overall_score,
      failed_rules: verdict.failed_rules,
      reasons: verdict.reasons,
      verified_finding_ids: verdict.verified_finding_ids,
      unverified_finding_ids: verdict.unverified_finding_ids,
      stamp,
      certifier_version: verdict.certifier_version,
      certified_at: verdict.certified_at,
    };

    // Structured fields only. Certification text is no longer appended to notes,
    // which grew without bound and could not be read back as data.
    await base44.entities.HeirSearch.update(heir_search_id, {
      certification,
      blocked_sources: {
        summary: readiness.summary,
        blocked: readiness.blocked,
        available: readiness.available,
        disclosure,
        checked_at: readiness.checked_at,
      },
    });

    // Audit trail: every run recorded, with the models that produced it.
    const runId = `qa-${heir_search_id}-${Date.now()}`;
    const testResults: any[] = [
      {
        suite: "Independent Certification",
        test_name: "model_separation",
        status: verdict.model_separation_ok ? "pass" : "fail",
        score_points: verdict.model_separation_ok ? 1 : 0,
        max_points: 1,
        run_id: runId,
        error_message: verdict.model_separation_ok
          ? undefined
          : `QA ${QA_MODEL} / Validator ${VALIDATOR_MODEL} / Producer ${SEARCH_PATH_MODEL}`,
      },
      {
        suite: "Independent Certification",
        test_name: "mechanical_reverification",
        status: reverification.failed === 0 && reverification.re_verified > 0 ? "pass" : "fail",
        score_points: reverification.re_verified,
        max_points: Math.max(1, evidenceRecords.length),
        run_id: runId,
        error_message:
          reverification.failed > 0
            ? `${reverification.failed} of ${evidenceRecords.length} recorded source(s) could not be re-verified.`
            : undefined,
      },
      {
        suite: "Independent Certification",
        test_name: "certified",
        status: verdict.certified ? "pass" : "fail",
        score_points: verdict.certified ? 1 : 0,
        max_points: 1,
        run_id: runId,
        error_message: verdict.certified ? undefined : verdict.failed_rules.join(", "),
      },
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

    // Audit trail. A certified report must be traceable to the exact evidence,
    // models and rule versions that certified it.
    await base44.entities.AuditLog.create({
      user_id: operator.id,
      user_email: operator.email,
      action: "run",
      entity_type: "HeirSearch",
      entity_id: heir_search_id,
      description: stamp,
      metadata: {
        certified: verdict.certified,
        failed_rules: verdict.failed_rules,
        qa_model: verdict.qa_model,
        validator_model: verdict.validator_model,
        search_model: verdict.search_model,
        model_separation_ok: verdict.model_separation_ok,
        evidence_records: evidenceRecords.length,
        re_verified: reverification.re_verified,
        reverification_failed: reverification.failed,
        blocked_sources: readiness.blocked.map((b: any) => b.id),
        rule_versions: {
          certifier: CERTIFIER_VERSION,
          reverifier: reverification.verifier_version,
          reverifier_timeout_ms: 20000,
        },
      },
      timestamp: new Date().toISOString(),
    });

    // Delivery gate: a refusal is a refusal, stated plainly.
    if (!verdict.certified) {
      // Returned as a normal response with an explicit refusal rather than an
      // HTTP error: the recursive QA loop must be able to READ the scores in
      // order to improve them. The hard gate lives on the delivery paths
      // (uploadCourtReadyPDF and the report generator), which refuse outright.
      return Response.json(
        {
          ok: false,
          certified: false,
          heir_search_id,
          blocked_from_delivery: true,
          qa_score: verdict.qa_score,
          validation_score: verdict.validator_score,
          overall_score: verdict.overall_score,
          qa_model: verdict.qa_model,
          validator_model: verdict.validator_model,
          search_model: verdict.search_model,
          model_separation_ok: verdict.model_separation_ok,
          reason: refusalReason(verdict),
          failed_rules: verdict.failed_rules,
          reasons: verdict.reasons,
          certification,
          threshold: CERTIFICATION_THRESHOLDS,
          qa_deficiencies: qaResult.deficiencies,
          qa_corrections: qaResult.recommended_corrections,
          validator_flags: validationResult?.hallucination_flags || [],
          coverage_flags: validationResult?.coverage_flags || [],
          legal_sufficiency: validationResult?.legal_sufficiency || null,
          sources: {
            available: readiness.available.length,
            blocked: readiness.blocked.length,
            disclosure,
          },
          reverification: {
            recorded_sources: evidenceRecords.length,
            re_verified: reverification.re_verified,
            failed: reverification.failed,
            counts_by_status: reverification.counts_by_status,
          },
        },
        { status: 200 },
      );
    }

    return Response.json({
      ok: true,
      certified: true,
      heir_search_id,
      certification,
      qa_score: verdict.qa_score,
      validation_score: verdict.validator_score,
      overall_score: verdict.overall_score,
      qa_model: verdict.qa_model,
      validator_model: verdict.validator_model,
      search_model: verdict.search_model,
      model_separation_ok: verdict.model_separation_ok,
      qa_deficiencies: qaResult.deficiencies,
      qa_corrections: qaResult.recommended_corrections,
      validator_flags: validationResult?.hallucination_flags || [],
      legal_sufficiency: validationResult?.legal_sufficiency || null,
      reverification: {
        recorded_sources: evidenceRecords.length,
        re_verified: reverification.re_verified,
        failed: reverification.failed,
        counts_by_status: reverification.counts_by_status,
      },
      sources: {
        available: readiness.available.length,
        blocked: readiness.blocked.length,
        disclosure,
      },
    });
  } catch (error: any) {
    console.error("runHeirSearchQA error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}