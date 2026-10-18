import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";

/**
 * Auto-Trace Heirs & Everyone They Know — MAX MODE
 *
 * After an heir search completes, this function:
 *  1. Collects every identified heir + every family-tree member + deceased-details relatives
 *  2. MAX skip-traces each person (runMaxSkipTrace — all 30 source categories) in batches of 5
 *  3. Enriches each heir's contact info (normalized phones, emails, address, social)
 *  4. "Everyone they know" — collects relatives/associates found in each trace,
 *     dedupes, and traces those new people too (TWO expansion levels for deeper network)
 *  5. Adds contacted associates as distant-priority heirs
 *  6. Updates the HeirSearch record with enriched, normalized data
 *  7. Optionally syncs the enriched results to Google Sheets
 */
const TRACE_FUNCTION = "runMaxSkipTrace";
const BATCH_SIZE = 5;
const PRIMARY_CAP = 30;
const ASSOCIATE_CAP = 15;
const EXPANSION_LEVELS = 2;

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { heir_search_id, spreadsheet_url } = body as any;
    if (!heir_search_id) return Response.json({ error: "heir_search_id required" }, { status: 400 });

    const hs: any = await base44.entities.HeirSearch.get(heir_search_id);
    if (!hs) return Response.json({ error: "Heir search not found" }, { status: 404 });

    // --- 1. Build the list of people to trace ---
    const people: { name: string; source: string; relationship?: string }[] = [];
    const seen = new Set<string>();
    const addPerson = (name: any, source: string, relationship?: string) => {
      if (!name || typeof name !== "string") return;
      const key = name.toLowerCase().trim();
      if (!key || seen.has(key)) return;
      seen.add(key);
      people.push({ name: name.trim(), source, relationship });
    };

    (hs.identified_heirs || []).forEach((h: any) => addPerson(h.name, "heir", h.relationship));
    const ft = hs.family_tree || {};
    addPerson(ft.spouse, "family_tree", "spouse");
    (ft.ex_spouses || []).forEach((n: any) => addPerson(n, "family_tree", "ex_spouse"));
    (ft.children || []).forEach((n: any) => addPerson(n, "family_tree", "child"));
    (ft.parents || []).forEach((n: any) => addPerson(n, "family_tree", "parent"));
    (ft.siblings || []).forEach((n: any) => addPerson(n, "family_tree", "sibling"));
    (ft.grandchildren || []).forEach((n: any) => addPerson(n, "family_tree", "grandchild"));
    (ft.nieces_nephews || []).forEach((n: any) => addPerson(n, "family_tree", "niece_nephew"));
    (ft.cousins || []).forEach((n: any) => addPerson(n, "family_tree", "cousin"));
    (ft.aunts_uncles || []).forEach((n: any) => addPerson(n, "family_tree", "aunt_uncle"));

    const dd = hs.deceased_details || {};
    addPerson(dd.spouse_name, "deceased_details", "spouse");
    (dd.parents_names || []).forEach((n: any) => addPerson(n, "deceased_details", "parent"));
    (dd.children_names || []).forEach((n: any) => addPerson(n, "deceased_details", "child"));
    (dd.siblings_names || []).forEach((n: any) => addPerson(n, "deceased_details", "sibling"));

    if (people.length === 0) {
      return Response.json({ ok: true, message: "No people found to trace.", traced: 0, associates_traced: 0, total_heirs: hs.identified_heirs?.length || 0 });
    }

    const toTrace = people.slice(0, PRIMARY_CAP);

    // --- 2. MAX skip-trace each person in batches ---
    const traceOne = async (p: { name: string; relationship?: string }) => {
      try {
        const res = await base44.functions.invoke(TRACE_FUNCTION, {
          owner_name: p.name,
          generate_report: false, // skip per-person report for speed; aggregate later
        });
        const data = res?.data ?? res;
        return { name: p.name, relationship: p.relationship, data: data && !data.error ? data : null };
      } catch {
        return { name: p.name, relationship: p.relationship, data: null };
      }
    };

    const runBatched = async (list: { name: string; relationship?: string }[]) => {
      const results: { name: string; relationship?: string; data: any }[] = [];
      for (let i = 0; i < list.length; i += BATCH_SIZE) {
        const batch = list.slice(i, i + BATCH_SIZE);
        const settled = await Promise.allSettled(batch.map(traceOne));
        for (const s of settled) if (s.status === "fulfilled") results.push(s.value);
      }
      return results;
    };

    const traceResults = await runBatched(toTrace);

    // --- 3. Enrich identified heirs with trace data ---
    const enrichedHeirs = [...(hs.identified_heirs || [])];
    for (const tr of traceResults) {
      if (!tr.data) continue;
      const idx = enrichedHeirs.findIndex((h: any) => h.name && h.name.toLowerCase().trim() === tr.name.toLowerCase());
      if (idx >= 0) {
        const heir = enrichedHeirs[idx];
        enrichedHeirs[idx] = {
          ...heir,
          phone_numbers: tr.data.phone_numbers?.length ? tr.data.phone_numbers : heir.phone_numbers,
          emails: tr.data.emails?.length ? tr.data.emails : heir.emails,
          address: tr.data.addresses?.[0]?.address || heir.address,
          social_profiles: tr.data.social_profiles?.length ? tr.data.social_profiles : heir.social_profiles,
          confidence: Math.max(heir.confidence || 0, tr.data.confidence_score || 0),
          notes: (heir.notes || "") + (tr.data.enrichment?.network_summary ? ` | Network: ${tr.data.enrichment.network_summary}` : ""),
        };
      }
    }

    // --- 4. "Everyone they know" — multi-level expansion ---
    const knownNames = new Set(toTrace.map((p) => p.name.toLowerCase()));
    let currentAssociates: { name: string; relationship: string }[] = [];
    const allAssociateResults: { name: string; relationship?: string; data: any }[] = [];
    let level = 0;
    let totalAssociatesTraced = 0;

    // Collect initial associates from primary traces
    for (const tr of traceResults) {
      if (!tr.data) continue;
      const relatives = tr.data.relatives || tr.data.found_relatives || [];
      for (const rel of relatives) {
        const rName = typeof rel === "string" ? rel : (rel.name || rel.relative_name);
        if (!rName) continue;
        const key = rName.toLowerCase().trim();
        if (!key || knownNames.has(key)) continue;
        knownNames.add(key);
        const relType = typeof rel === "object" ? (rel.relationship || "associate") : "associate";
        currentAssociates.push({ name: rName.trim(), relationship: relType });
      }
    }

    // Expand through levels
    while (level < EXPANSION_LEVELS && currentAssociates.length > 0) {
      const assocToTrace = currentAssociates.slice(0, ASSOCIATE_CAP);
      const associateResults = await runBatched(assocToTrace);
      allAssociateResults.push(...associateResults);
      totalAssociatesTraced += assocToTrace.length;

      // Collect next-level associates
      const nextAssociates: { name: string; relationship: string }[] = [];
      for (const ar of associateResults) {
        if (!ar.data) continue;
        const relatives = ar.data.relatives || ar.data.found_relatives || [];
        for (const rel of relatives) {
          const rName = typeof rel === "string" ? rel : (rel.name || rel.relative_name);
          if (!rName) continue;
          const key = rName.toLowerCase().trim();
          if (!key || knownNames.has(key)) continue;
          knownNames.add(key);
          const relType = typeof rel === "object" ? (rel.relationship || "associate") : "associate";
          nextAssociates.push({ name: rName.trim(), relationship: `${relType}_L${level + 1}` });
        }
      }
      currentAssociates = nextAssociates;
      level++;
    }

    // Add all contacted associates with contact info as distant-priority heirs
    for (const ar of allAssociateResults) {
      if (!ar.data) continue;
      const hasContact =
        (ar.data.phone_numbers?.length || 0) > 0 ||
        (ar.data.emails?.length || 0) > 0 ||
        ar.data.addresses?.[0]?.address;
      if (!hasContact) continue;
      enrichedHeirs.push({
        name: ar.name,
        relationship: ar.relationship || "associate",
        is_living: true,
        phone_numbers: ar.data.phone_numbers || [],
        emails: ar.data.emails || [],
        address: ar.data.addresses?.[0]?.address || "",
        social_profiles: ar.data.social_profiles || [],
        confidence: ar.data.confidence_score || 30,
        inheritance_priority: "distant",
        notes: `Found as associate/relative during auto-trace (expansion level). Sources: ${(ar.data.sources || []).slice(0, 5).join(", ")}`,
      });
    }

    // --- 5. Update the record ---
    const methodsUsed = [...new Set([...(hs.methods_used || []), "max_skip_trace", "auto_trace_heirs", `auto_trace_expansion_L${EXPANSION_LEVELS}`])];
    const sourcesChecked = Array.from(new Set([
      ...(hs.sources_checked || []),
      "max_skip_trace_30_categories",
    ]));
    await base44.entities.HeirSearch.update(heir_search_id, {
      identified_heirs: enrichedHeirs,
      methods_used: methodsUsed,
      sources_checked: sourcesChecked,
      status: enrichedHeirs.length > 0 ? "found" : hs.status,
    });

    // --- 6. Sync to Google Sheets if requested ---
    let sheetResult: any = null;
    if (spreadsheet_url) {
      try {
        const sheetRes = await base44.functions.invoke("exportHeirToSheet", {
          heir_search_id,
          spreadsheet_url,
        });
        sheetResult = sheetRes?.data ?? sheetRes;
      } catch (e: any) {
        sheetResult = { error: e.message };
      }
    }

    return Response.json({
      ok: true,
      traced: toTrace.length,
      associates_traced: totalAssociatesTraced,
      expansion_levels: EXPANSION_LEVELS,
      total_heirs: enrichedHeirs.length,
      contacts_found: traceResults.filter((t) => t.data).length + allAssociateResults.filter((a) => a.data).length,
      sheet_export: sheetResult,
    });
  } catch (err: any) {
    console.error("autoTraceHeirs error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}