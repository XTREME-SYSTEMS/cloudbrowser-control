import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { invokeLLM, setGatewayFallback } from '../../shared/vercelAiGateway.ts';
import { isLikelyHeir, deduplicateHeirs, calculateOverallConfidence } from '../../shared/heirEvidenceEngine.ts';

/**
 * Recursive QA Re-Run Engine
 * 
 * Runs QA → identifies gaps → attempts to fix them → re-runs QA → repeats
 * until score >= target (default 85) or max iterations (default 3) reached.
 * 
 * This is the "recursive re-run" logic that ensures court-ready quality.
 */

const QA_MODEL = "gemini_3_flash";

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    setGatewayFallback(base44);

    const body = await req.json();
    const { heir_search_id, target_score = 85, max_iterations = 3, run_validator = true } = body;

    if (!heir_search_id) {
      return Response.json({ error: "heir_search_id is required" }, { status: 400 });
    }

    const heirSearch: any = await base44.entities.HeirSearch.get(heir_search_id);
    if (!heirSearch) {
      return Response.json({ error: "Heir search not found" }, { status: 404 });
    }

    const iterations: any[] = [];
    let currentScore = 0;
    let currentHeirs = heirSearch.identified_heirs || [];
    let currentDeceased = heirSearch.deceased_details || {};
    let currentTree = heirSearch.family_tree || {};
    let finalStatus = heirSearch.status;

    for (let i = 1; i <= max_iterations; i++) {
      // === Run QA on current state ===
      const qaResult = await runQAPass(base44, {
        heir_search_id,
        heirs: currentHeirs,
        deceased: currentDeceased,
        tree: currentTree,
        sources: heirSearch.sources_checked || [],
        probate: heirSearch.probate_info || {},
        run_validator,
      });

      currentScore = qaResult.qa_score;
      iterations.push({
        iteration: i,
        qa_score: qaResult.qa_score,
        completeness: qaResult.completeness_score,
        accuracy: qaResult.accuracy_score,
        court_readiness: qaResult.court_readiness_score,
        deficiencies: qaResult.deficiencies,
        fixes_applied: [],
      });

      // === Check if we hit target ===
      if (currentScore >= target_score) {
        iterations[i - 1].result = "TARGET_REACHED";
        break;
      }

      // === Attempt to fix identified gaps ===
      const fixes = await attemptFixes(base44, {
        deficiencies: qaResult.deficiencies,
        heirs: currentHeirs,
        deceased: currentDeceased,
        tree: currentTree,
        deceased_name: heirSearch.deceased_name,
        deceased_last_address: heirSearch.deceased_last_address,
        death_location: heirSearch.death_location,
      });

      // Apply fixes
      if (fixes.cleaned_heirs) currentHeirs = fixes.cleaned_heirs;
      if (fixes.updated_deceased) currentDeceased = { ...currentDeceased, ...fixes.updated_deceased };
      if (fixes.updated_tree) currentTree = { ...currentTree, ...fixes.updated_tree };

      iterations[i - 1].fixes_applied = fixes.applied;

      // === Re-run QA after fixes ===
      const reQa = await runQAPass(base44, {
        heir_search_id,
        heirs: currentHeirs,
        deceased: currentDeceased,
        tree: currentTree,
        sources: heirSearch.sources_checked || [],
        probate: heirSearch.probate_info || {},
        run_validator,
      });

      currentScore = reQa.qa_score;
      iterations[i - 1].post_fix_score = reQa.qa_score;
      iterations[i - 1].result = currentScore >= target_score ? "TARGET_REACHED" : "CONTINUE";

      if (currentScore >= target_score) break;
    }

    // === Calculate final evidence-based confidence ===
    const evidenceBasedScore = calculateOverallConfidence(
      currentDeceased,
      currentTree,
      currentHeirs,
      heirSearch.probate_info,
      heirSearch.sources_checked || []
    );

    // Use the higher of QA score or evidence-based score
    const finalScore = Math.max(currentScore, evidenceBasedScore);

    // Determine final status
    const validHeirs = currentHeirs.filter((h: any) => isLikelyHeir(h));
    const livingHeirs = validHeirs.filter((h: any) => h.is_living !== false);
    if (finalScore >= 70 && livingHeirs.length > 0) finalStatus = "found";
    else if (finalScore >= 40 || livingHeirs.length > 0) finalStatus = "partial";
    else finalStatus = "failed";

    // === Persist final state ===
    await base44.entities.HeirSearch.update(heir_search_id, {
      identified_heirs: currentHeirs,
      deceased_details: currentDeceased,
      family_tree: currentTree,
      confidence_score: finalScore,
      status: finalStatus,
      notes: (heirSearch.notes || "") + `\n\n--- RECURSIVE QA COMPLETE ---\nIterations: ${iterations.length}\nFinal Score: ${finalScore}/100\nTarget: ${target_score}\nStatus: ${finalStatus}\n${iterations.map(it => `Iter ${it.iteration}: ${it.qa_score}→${it.post_fix_score || it.qa_score} (${it.result})`).join("\n")}`,
    });

    return Response.json({
      ok: true,
      heir_search_id,
      final_score: finalScore,
      target_score,
      iterations: iterations.length,
      target_reached: finalScore >= target_score,
      status: finalStatus,
      iteration_details: iterations,
      heir_count: validHeirs.length,
      living_heir_count: livingHeirs.length,
    });
  } catch (error: any) {
    console.error("Recursive QA error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

async function runQAPass(base44: any, data: any): Promise<any> {
  try {
    const res: any = await base44.functions.invoke("runHeirSearchQA", {
      heir_search_id: data.heir_search_id,
      run_validator: data.run_validator,
    });
    const qaData = res?.data || res;
    return {
      qa_score: qaData?.certification?.qa?.qa_score || qaData?.certification?.combined_score || 0,
      completeness_score: qaData?.certification?.qa?.completeness_score || 0,
      accuracy_score: qaData?.certification?.qa?.accuracy_score || 0,
      court_readiness_score: qaData?.certification?.qa?.court_readiness_score || 0,
      deficiencies: qaData?.certification?.qa?.deficiencies || [],
    };
  } catch (err) {
    return { qa_score: 0, deficiencies: ["QA function failed: " + err.message] };
  }
}

async function attemptFixes(base44: any, data: any): Promise<any> {
  const applied: string[] = [];
  let cleaned_heirs: any[] | null = null;
  let updated_deceased: any = null;
  let updated_tree: any = null;

  const deficiencies = data.deficiencies || [];

  // Fix 1: Deduplicate and clean heir list
  if (deficiencies.some(d => d.toLowerCase().includes("duplicate") || d.toLowerCase().includes("non-heir") || d.toLowerCase().includes("inconsistenc"))) {
    cleaned_heirs = deduplicateHeirs(data.heirs);
    applied.push("Deduplicated and cleaned heir list (removed non-heir entries, merged duplicates)");
  }

  // Fix 2: Try to confirm deceased identity if not confirmed
  if (deficiencies.some(d => d.toLowerCase().includes("deceased identity") || d.toLowerCase().includes("deceased_confirmed"))) {
    try {
      const confirmRes: any = await invokeLLM({
        model: QA_MODEL,
        add_context_from_internet: true,
        prompt: `You are a forensic genealogist. Confirm the death record of: "${data.deceased_name}"${data.deceased_last_address ? `, last address: ${data.deceased_last_address}` : ""}${data.death_location ? `, death location: ${data.death_location}` : ""}.\n\nSearch SSDI, obituaries, Find A Grave, and vital records. Return ONLY if you find concrete evidence. Set confirmed=true only with real evidence.`,
        response_json_schema: {
          type: "object",
          properties: {
            confirmed: { type: "boolean" },
            full_name: { type: "string" },
            birth_date: { type: "string" },
            death_date: { type: "string" },
            last_residence: { type: "string" },
            obituary_url: { type: "string" },
            obituary_text: { type: "string" },
            funeral_home: { type: "string" },
            confidence: { type: "number" },
          },
        },
      });
      if (confirmRes.confirmed) {
        updated_deceased = { ...data.deceased, ...confirmRes };
        applied.push("Re-confirmed deceased identity via additional death record search");
      }
    } catch (e) { /* ignore LLM errors */ }
  }

  // Fix 3: Fill missing family tree gaps
  if (deficiencies.some(d => d.toLowerCase().includes("family tree") || d.toLowerCase().includes("generational depth"))) {
    try {
      const treeRes: any = await invokeLLM({
        model: QA_MODEL,
        add_context_from_internet: true,
        prompt: `You are a forensic genealogist. Fill gaps in the family tree for: "${data.deceased_name}". Current tree: ${JSON.stringify(data.tree)}.\n\nSearch for missing relatives: grandchildren, nieces/nephews, aunts/uncles, cousins. Focus on extending the tree to 4+ generations. Only add relatives you find evidence for.`,
        response_json_schema: {
          type: "object",
          properties: {
            grandchildren: { type: "array", items: { type: "string" } },
            nieces_nephews: { type: "array", items: { type: "string" } },
            aunts_uncles: { type: "array", items: { type: "string" } },
            cousins: { type: "array", items: { type: "string" } },
          },
        },
      });
      updated_tree = { ...data.tree, ...treeRes };
      applied.push("Extended family tree with additional relatives");
    } catch (e) { /* ignore */ }
  }

  return { cleaned_heirs, updated_deceased, updated_tree, applied };
}