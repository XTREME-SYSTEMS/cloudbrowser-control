import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { invokeLLM } from '../../shared/vercelAiGateway.ts';

/**
 * Heir Search Engine — Deceased Person Heir Identification & Contact Discovery
 *
 * Unlike skip tracing (which finds a known living person), heir search must:
 *   1. Confirm the deceased person's identity via death records (SSDI, obituaries)
 *   2. Build the family tree from genealogy/obituary/probate records
 *   3. Identify all potential heirs and their inheritance priority
 *   4. Find probate court info (executor, attorney, case number)
 *   5. Skip trace each living heir for contact information
 *
 * Data sources exhausted:
 *   - Social Security Death Index (SSDI) / Death Master File
 *   - Obituaries (newspapers, funeral homes, Legacy.com, Tributes.com)
 *   - Find A Grave / Billion Graves
 *   - Probate court records (county clerk, case lookup)
 *   - Genealogy databases (Ancestry, FamilySearch, MyHeritage)
 *   - Vital records (birth, death, marriage certificates)
 *   - People search engines (for living heir contact info)
 *   - Social media (for living heir contact info)
 */

const SEARCH_MODEL = "gemini_3_flash";

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { deceased_name, deceased_dob, deceased_dod, deceased_last_address, deceased_ssn, death_location, case_reference } = body;

    if (!deceased_name) {
      return Response.json({ error: "Deceased person's name is required" }, { status: 400 });
    }

    // Create heir search record
    const heirSearch = await base44.entities.HeirSearch.create({
      deceased_name,
      deceased_dob: deceased_dob || "",
      deceased_dod: deceased_dod || "",
      deceased_last_address: deceased_last_address || "",
      deceased_ssn: deceased_ssn || "",
      death_location: death_location || "",
      case_reference: case_reference || "",
      status: "searching",
      identified_heirs: [],
      sources_checked: [],
      methods_used: [],
    });

    const startTime = Date.now();
    const results: any = {
      deceased_details: {},
      family_tree: {},
      identified_heirs: [],
      probate_info: {},
      sources: [] as string[],
      methods: [] as string[],
      errors: [] as any[],
    };

    // === STEP 1: Death Record Confirmation (SSDI + Obituary) ===
    try {
      const deathRes: any = await invokeLLM({
        model: SEARCH_MODEL,
        add_context_from_internet: true,
        prompt: `You are a forensic genealogist specializing in probate heir research. Search for the death record of:

Name: "${deceased_name}"
${deceased_dob ? `Date of Birth: ${deceased_dob}\n` : ""}
${deceased_dod ? `Date of Death: ${deceased_dod}\n` : ""}
${deceased_last_address ? `Last Known Address: ${deceased_last_address}\n` : ""}
${death_location ? `Death Location: ${death_location}\n` : ""}
${deceased_ssn ? `SSN (last 4): ${deceased_ssn}\n` : ""}

Search these sources:
- Social Security Death Index (SSDI) / Death Master File
- Obituaries (Legacy.com, Tributes.com, newspaper archives, funeral home websites)
- Find A Grave and Billion Graves
- State vital records death indexes

Find and confirm:
- Full legal name at time of death
- Exact birth date and death date
- Last residence (city, county, state)
- SSN state of issue (if found in SSDI)
- Obituary text — especially any surviving family members mentioned (spouse, children, siblings, parents, grandchildren)
- Funeral home name and location
- Burial/cremation details

The obituary is the MOST valuable source because it typically names surviving family members. Extract every name mentioned and their relationship to the deceased.`,
        response_json_schema: {
          type: "object",
          properties: {
            confirmed: { type: "boolean" },
            full_name: { type: "string" },
            birth_date: { type: "string" },
            death_date: { type: "string" },
            last_residence: { type: "string" },
            ssn_state_issued: { type: "string" },
            obituary_url: { type: "string" },
            obituary_text: { type: "string" },
            funeral_home: { type: "string" },
            cause_of_death: { type: "string" },
            spouse_name: { type: "string" },
            parents_names: { type: "array", items: { type: "string" } },
            children_names: { type: "array", items: { type: "string" } },
            siblings_names: { type: "array", items: { type: "string" } },
            grandchildren_names: { type: "array", items: { type: "string" } },
            confidence: { type: "number" },
          },
        },
      });

      results.deceased_details = deathRes;
      results.deceased_confirmed = deathRes?.confirmed || false;
      results.sources.push("ssdi", "obituaries", "find_a_grave", "vital_records", "funeral_homes");
      results.methods.push("death_record_confirmation");
    } catch (err: any) {
      results.errors.push({ step: "death_record_confirmation", error: err.message });
    }

    // Build family tree from obituary + genealogy
    const obitFamily = {
      spouse: results.deceased_details?.spouse_name || "",
      children: results.deceased_details?.children_names || [],
      parents: results.deceased_details?.parents_names || [],
      siblings: results.deceased_details?.siblings_names || [],
      grandchildren: results.deceased_details?.grandchildren_names || [],
    };

    // === STEP 2: Genealogy Deep Search (build family tree) ===
    try {
      const treeRes: any = await invokeLLM({
        model: SEARCH_MODEL,
        add_context_from_internet: true,
        prompt: `You are a forensic genealogist. Build the complete family tree for the deceased person:

Name: "${deceased_name}"
${deceased_dob ? `Born: ${deceased_dob}\n` : ""}
${deceased_dod ? `Died: ${deceased_dod}\n` : ""}
${deceased_last_address ? `Last Address: ${deceased_last_address}\n` : ""}
${results.deceased_details?.spouse_name ? `Known Spouse: ${results.deceased_details.spouse_name}\n` : ""}
${results.deceased_details?.children_names?.length ? `Known Children: ${results.deceased_details.children_names.join(", ")}\n` : ""}
${results.deceased_details?.parents_names?.length ? `Known Parents: ${results.deceased_details.parents_names.join(", ")}\n` : ""}
${results.deceased_details?.siblings_names?.length ? `Known Siblings: ${results.deceased_details.siblings_names.join(", ")}\n` : ""}

Search genealogy databases (Ancestry.com, FamilySearch, MyHeritage, Find A Grave), marriage records, divorce records, birth records, census records, and public family trees.

Build the FULL family tree:
- Current/former spouse(s) — include ex-spouses if found
- All children (legitimate, adopted, step)
- Parents (mother's maiden name important)
- All siblings (full, half, step)
- Grandchildren (named individually if possible)
- Nieces and nephews
- Aunts and uncles
- First cousins
- Any other known relatives

For each person, note if they are likely living or deceased. This determines whether they are an heir or a pre-deceased heir (whose descendants may inherit by representation).`,
        response_json_schema: {
          type: "object",
          properties: {
            spouse: { type: "string" },
            ex_spouses: { type: "array", items: { type: "string" } },
            children: { type: "array", items: { type: "string" } },
            parents: { type: "array", items: { type: "string" } },
            siblings: { type: "array", items: { type: "string" } },
            grandchildren: { type: "array", items: { type: "string" } },
            nieces_nephews: { type: "array", items: { type: "string" } },
            aunts_uncles: { type: "array", items: { type: "string" } },
            cousins: { type: "array", items: { type: "string" } },
            deceased_relatives: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  relationship: { type: "string" },
                  death_date: { type: "string" },
                  has_descendants: { type: "boolean" },
                },
              },
            },
            confidence: { type: "number" },
          },
        },
      });

      results.family_tree = treeRes;
      results.sources.push("ancestry", "familysearch", "myheritage", "find_a_grave", "vital_records", "census_records");
      results.methods.push("genealogy_tree_construction");
    } catch (err: any) {
      results.errors.push({ step: "genealogy_tree_construction", error: err.message });
    }

    // === STEP 3: Probate Court Records Search ===
    try {
      const probateRes: any = await invokeLLM({
        model: SEARCH_MODEL,
        add_context_from_internet: true,
        prompt: `You are a probate researcher. Search for probate court records for the estate of:

Deceased: "${deceased_name}"
${deceased_dod ? `Date of Death: ${deceased_dod}\n` : ""}
${death_location || deceased_last_address ? `Location: ${death_location || deceased_last_address}\n` : ""}

Search county probate court records, county clerk databases, and online case lookup systems.

Find:
- The county where probate was filed (or should be filed)
- Case number if a probate case exists
- Named executor/personal representative
- Estate attorney name and contact
- Filing date
- Whether a will was found (testate vs intestate)
- Estimated estate value if available
- Any published notices to creditors or heirs

If no probate case has been filed yet, note that — it may mean the estate is still being settled or hasn't been opened.`,
        response_json_schema: {
          type: "object",
          properties: {
            court_county: { type: "string" },
            case_number: { type: "string" },
            executor_name: { type: "string" },
            executor_contact: { type: "string" },
            attorney_name: { type: "string" },
            filing_date: { type: "string" },
            estate_value: { type: "string" },
            will_found: { type: "boolean" },
            will_details: { type: "string" },
            confidence: { type: "number" },
          },
        },
      });

      results.probate_info = probateRes;
      results.sources.push("probate_court", "county_clerk", "case_lookup");
      results.methods.push("probate_records_search");
    } catch (err: any) {
      results.errors.push({ step: "probate_records_search", error: err.message });
    }

    // === STEP 4: Identify & Classify Heirs ===
    const tree = results.family_tree || {};
    const allRelatives: { name: string; relationship: string; degree: number; priority: string }[] = [];

    // Primary heirs (degree 1): spouse, children
    if (tree.spouse) allRelatives.push({ name: tree.spouse, relationship: "spouse", degree: 1, priority: "primary" });
    (tree.children || []).forEach((c: string) => allRelatives.push({ name: c, relationship: "child", degree: 1, priority: "primary" }));

    // Secondary heirs (degree 2): parents, siblings
    (tree.parents || []).forEach((p: string) => allRelatives.push({ name: p, relationship: "parent", degree: 2, priority: "secondary" }));
    (tree.siblings || []).forEach((s: string) => allRelatives.push({ name: s, relationship: "sibling", degree: 2, priority: "secondary" }));

    // Distant heirs (degree 3+): grandchildren, nieces/nephews, cousins
    (tree.grandchildren || []).forEach((g: string) => allRelatives.push({ name: g, relationship: "grandchild", degree: 3, priority: "distant" }));
    (tree.nieces_nephews || []).forEach((n: string) => allRelatives.push({ name: n, relationship: "niece/nephew", degree: 3, priority: "distant" }));
    (tree.aunts_uncles || []).forEach((a: string) => allRelatives.push({ name: a, relationship: "aunt/uncle", degree: 3, priority: "distant" }));
    (tree.cousins || []).forEach((c: string) => allRelatives.push({ name: c, relationship: "cousin", degree: 4, priority: "distant" }));

    // Deduplicate by name
    const seenNames = new Set<string>();
    const uniqueHeirs = allRelatives.filter((h) => {
      const key = h.name.toLowerCase().trim();
      if (!key || seenNames.has(key)) return false;
      seenNames.add(key);
      return true;
    });

    // === STEP 5: Skip Trace Each Living Heir ===
    for (const heir of uniqueHeirs) {
      if (!heir.name || heir.name === "unknown") continue;
      try {
        const heirRes: any = await invokeLLM({
          model: SEARCH_MODEL,
          add_context_from_internet: true,
          prompt: `You are a skip tracing specialist. Find current contact information for:

Name: "${heir.name}"
Relationship to deceased "${deceased_name}": ${heir.relationship}
${deceased_last_address ? `The deceased lived at: ${deceased_last_address}\n` : ""}
${death_location ? `Death occurred in: ${death_location}\n` : ""}

Search people search engines (Whitepages, TruePeopleSearch, FastPeopleSearch, Spokeo), social media (Facebook, LinkedIn, Instagram), and public records.

Find:
- Are they living or deceased? (critical — only living persons can be heirs)
- All phone numbers
- All email addresses
- Current address
- Age or date of birth
- Social media profiles
- How confident you are this is the correct person (same family, right age, right location)

If they appear to be deceased, note that — their children may inherit by representation.`,
          response_json_schema: {
            type: "object",
            properties: {
              is_living: { type: "boolean" },
              phone_numbers: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    number: { type: "string" },
                    confidence: { type: "number" },
                    source: { type: "string" },
                  },
                },
              },
              emails: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    email: { type: "string" },
                    confidence: { type: "number" },
                    source: { type: "string" },
                  },
                },
              },
              address: { type: "string" },
              age_or_dob: { type: "string" },
              social_profiles: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    platform: { type: "string" },
                    url: { type: "string" },
                  },
                },
              },
              confidence: { type: "number" },
              notes: { type: "string" },
            },
          },
        });

        results.identified_heirs.push({
          name: heir.name,
          relationship: heir.relationship,
          relationship_degree: heir.degree,
          is_living: heirRes?.is_living !== false,
          phone_numbers: heirRes?.phone_numbers || [],
          emails: heirRes?.emails || [],
          address: heirRes?.address || "",
          age_or_dob: heirRes?.age_or_dob || "",
          social_profiles: heirRes?.social_profiles || [],
          confidence: heirRes?.confidence || 0,
          inheritance_priority: heir.priority,
          notes: heirRes?.notes || "",
        });
        results.sources.push("people_search", "social_media");
      } catch (err: any) {
        results.identified_heirs.push({
          name: heir.name,
          relationship: heir.relationship,
          relationship_degree: heir.degree,
          is_living: true,
          phone_numbers: [],
          emails: [],
          address: "",
          confidence: 0,
          inheritance_priority: heir.priority,
          notes: `Contact tracing failed: ${err.message}`,
        });
        results.errors.push({ step: `heir_trace_${heir.name}`, error: err.message });
      }
    }

    results.methods.push("heir_contact_tracing");

    // === CONFIDENCE SCORING ===
    const deceasedConfidence = results.deceased_details?.confidence || 0;
    const treeConfidence = results.family_tree?.confidence || 0;
    const probateConfidence = results.probate_info?.confidence || 0;
    const heirConfidences = results.identified_heirs.map((h: any) => h.confidence || 0);
    const avgHeirConfidence = heirConfidences.length > 0
      ? Math.round(heirConfidences.reduce((a: number, b: number) => a + b, 0) / heirConfidences.length)
      : 0;

    const overallConfidence = Math.round(
      deceasedConfidence * 0.3 + treeConfidence * 0.3 + avgHeirConfidence * 0.3 + probateConfidence * 0.1
    );

    const livingHeirs = results.identified_heirs.filter((h: any) => h.is_living);
    const status =
      overallConfidence >= 70 && livingHeirs.length > 0
        ? "found"
        : overallConfidence >= 40 || livingHeirs.length > 0
        ? "partial"
        : "failed";

    const duration = Date.now() - startTime;

    await base44.entities.HeirSearch.update(heirSearch.id, {
      status,
      deceased_confirmed: results.deceased_confirmed,
      deceased_details: results.deceased_details,
      family_tree: results.family_tree,
      identified_heirs: results.identified_heirs,
      probate_info: results.probate_info,
      sources_checked: [...new Set(results.sources)],
      methods_used: [...new Set(results.methods)],
      confidence_score: overallConfidence,
      search_duration_ms: duration,
    });

    return Response.json({
      ok: true,
      heir_search_id: heirSearch.id,
      status,
      confidence_score: overallConfidence,
      deceased_confirmed: results.deceased_confirmed,
      deceased_details: results.deceased_details,
      family_tree: results.family_tree,
      probate_info: results.probate_info,
      identified_heirs: results.identified_heirs,
      living_heir_count: livingHeirs.length,
      sources: [...new Set(results.sources)],
      methods: [...new Set(results.methods)],
      duration_ms: duration,
      errors: results.errors.length > 0 ? results.errors : undefined,
    });
  } catch (error: any) {
    console.error("Heir search error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}