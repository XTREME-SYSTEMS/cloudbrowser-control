import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { invokeLLM } from '../../shared/vercelAiGateway.ts';
import { HEIR_SEARCH_CATALOG } from '../../shared/searchSourceCatalog.ts';

/**
 * Heir Search Engine — Deceased Person Heir Identification & Contact Discovery
 *
 * DEEP MODE exhausts every available data source across 12 search categories:
 *   1. Death Record Confirmation (SSDI, obituaries, Find A Grave, vital records, SS-5)
 *   2. Genealogy & Family Tree (Ancestry, FamilySearch, MyHeritage, church records)
 *   3. DNA / Genetic Genealogy (GEDmatch, FamilyTreeDNA — for unknown heirs)
 *   4. Historical Records (census, city directories, draft cards, immigration, ship manifests)
 *   5. Probate & Legal (wills, estate filings, divorce, bankruptcy, court records)
 *   6. Vital Records (birth, death, marriage, divorce certificates, church records)
 *   7. Property & Financial (tax records, deeds, SEC, business registrations)
 *   8. People Search Aggregators (Whitepages, Spokeo, BeenVerified, Intelius, Pipl)
 *   9. Social & Professional (Facebook, LinkedIn, professional licenses, FINRA)
 *  10. Government Records (voter, DMV, FAA, military, inmate, sex offender)
 *  11. Email & Phone Discovery (Hunter.io, reverse phone, email verification)
 *  12. International Records (for heirs who may have emigrated)
 *
 * STANDARD MODE runs the core 5 passes (death, tree, probate, heir ID, contact trace).
 */

const SEARCH_MODEL = "gemini_3_flash";

function sourcesList(categoryId: string): string {
  const cat = HEIR_SEARCH_CATALOG.find(c => c.id === categoryId);
  return cat ? cat.sources.join(", ") : "";
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const {
      deceased_name, deceased_dob, deceased_dod, deceased_last_address,
      deceased_ssn, death_location, case_reference, deep_search,
    } = body;

    if (!deceased_name) {
      return Response.json({ error: "Deceased person's name is required" }, { status: 400 });
    }

    const deep = deep_search !== false; // default to deep

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
    const R: any = {
      deceased_details: {}, family_tree: {}, identified_heirs: [],
      probate_info: {}, historical: {}, vital: {}, property_financial: {},
      dna: {}, international: {},
      sources: [] as string[], methods: [] as string[], errors: [] as any[],
    };

    const ctx = `Name: "${deceased_name}"
${deceased_dob ? `Born: ${deceased_dob}\n` : ""}${deceased_dod ? `Died: ${deceased_dod}\n` : ""}${deceased_last_address ? `Last Address: ${deceased_last_address}\n` : ""}${death_location ? `Death Location: ${death_location}\n` : ""}${deceased_ssn ? `SSN (last 4): ${deceased_ssn}\n` : ""}`;

    // === PHASE 1: Death Record Confirmation (sequential — needed for tree) ===
    try {
      const deathRes: any = await invokeLLM({
        model: SEARCH_MODEL, add_context_from_internet: true,
        prompt: `You are a forensic genealogist specializing in probate heir research. Confirm the death record of:\n${ctx}\n\nSearch these sources:\n${sourcesList("death_confirmation")}\n\nFind and confirm:\n- Full legal name at death\n- Exact birth and death dates\n- Last residence (city, county, state)\n- SSN state of issue\n- Obituary text — especially surviving family members (spouse, children, siblings, parents, grandchildren)\n- Funeral home name and location\n- Burial/cremation details\n\nThe obituary is the MOST valuable source — extract every name and relationship.`,
        response_json_schema: {
          type: "object",
          properties: {
            confirmed: { type: "boolean" }, full_name: { type: "string" },
            birth_date: { type: "string" }, death_date: { type: "string" },
            last_residence: { type: "string" }, ssn_state_issued: { type: "string" },
            obituary_url: { type: "string" }, obituary_text: { type: "string" },
            funeral_home: { type: "string" }, cause_of_death: { type: "string" },
            spouse_name: { type: "string" },
            parents_names: { type: "array", items: { type: "string" } },
            children_names: { type: "array", items: { type: "string" } },
            siblings_names: { type: "array", items: { type: "string" } },
            grandchildren_names: { type: "array", items: { type: "string" } },
            confidence: { type: "number" },
          },
        },
      });
      R.deceased_details = deathRes;
      R.sources.push("ssdi", "obituaries", "find_a_grave", "vital_records", "funeral_homes");
      R.methods.push("death_record_confirmation");
    } catch (err: any) { R.errors.push({ step: "death_record_confirmation", error: err.message }); }

    // === PHASE 2: Parallel deep search passes ===
    const phase2Passes: Promise<any>[] = [];

    // Genealogy tree (always run)
    phase2Passes.push(
      invokeLLM({
        model: SEARCH_MODEL, add_context_from_internet: true,
        prompt: `You are a forensic genealogist. Build the complete family tree for:\n${ctx}\nKnown family from obituary: spouse=${R.deceased_details?.spouse_name || ""}, children=${(R.deceased_details?.children_names || []).join(", ")}, parents=${(R.deceased_details?.parents_names || []).join(", ")}, siblings=${(R.deceased_details?.siblings_names || []).join(", ")}\n\nSearch: ${sourcesList("genealogy_tree")}\n\nBuild the FULL tree: current/former spouse(s), all children, parents (mother's maiden name), all siblings, grandchildren, nieces/nephews, aunts/uncles, first cousins. For each, note if likely living or deceased.`,
        response_json_schema: {
          type: "object",
          properties: {
            spouse: { type: "string" }, ex_spouses: { type: "array", items: { type: "string" } },
            children: { type: "array", items: { type: "string" } },
            parents: { type: "array", items: { type: "string" } },
            siblings: { type: "array", items: { type: "string" } },
            grandchildren: { type: "array", items: { type: "string" } },
            nieces_nephews: { type: "array", items: { type: "string" } },
            aunts_uncles: { type: "array", items: { type: "string" } },
            cousins: { type: "array", items: { type: "string" } },
            deceased_relatives: { type: "array", items: { type: "object", properties: { name: { type: "string" }, relationship: { type: "string" }, death_date: { type: "string" }, has_descendants: { type: "boolean" } } } },
            confidence: { type: "number" },
          },
        },
      }).then(r => { R.family_tree = r; R.sources.push("ancestry", "familysearch", "myheritage", "find_a_grave", "church_records"); R.methods.push("genealogy_tree_construction"); })
        .catch(e => R.errors.push({ step: "genealogy_tree", error: e.message }))
    );

    if (deep) {
      // Historical records
      phase2Passes.push(
        invokeLLM({
          model: SEARCH_MODEL, add_context_from_internet: true,
          prompt: `You are a forensic genealogist. Search historical records for:\n${ctx}\n\nSearch: ${sourcesList("historical_records")}\n\nFind any historical documents that reveal family connections: census records showing household members, city directory listings, draft registration cards (show next of kin), immigration/passenger records, naturalization papers, land patents. Extract all family member names and relationships found.`,
          response_json_schema: {
            type: "object",
            properties: {
              census_household_members: { type: "array", items: { type: "object", properties: { name: { type: "string" }, relationship: { type: "string" }, year: { type: "number" } } } },
              city_directory_listings: { type: "array", items: { type: "object", properties: { year: { type: "string" }, address: { type: "string" }, household: { type: "array", items: { type: "string" } } } } },
              draft_cards: { type: "array", items: { type: "object", properties: { name: { type: "string" }, next_of_kin: { type: "string" }, address: { type: "string" } } } },
              immigration_records: { type: "array", items: { type: "object", properties: { name: { type: "string" }, arrival_date: { type: "string" }, port: { type: "string" }, traveling_with: { type: "array", items: { type: "string" } } } } },
              additional_relatives_found: { type: "array", items: { type: "object", properties: { name: { type: "string" }, relationship: { type: "string" }, source: { type: "string" } } } },
              confidence: { type: "number" },
            },
          },
        }).then(r => { R.historical = r; R.sources.push("census_records", "city_directories", "draft_cards", "immigration_records", "newspaper_archives"); R.methods.push("historical_records_search"); })
          .catch(e => R.errors.push({ step: "historical_records", error: e.message }))
      );

      // Vital records
      phase2Passes.push(
        invokeLLM({
          model: SEARCH_MODEL, add_context_from_internet: true,
          prompt: `You are a vital records researcher. Search for vital records of:\n${ctx}\n\nSearch: ${sourcesList("vital_records")}\n\nFind: birth certificate details (parents' names, mother's maiden name), marriage certificates (spouse name, witnesses), divorce records (ex-spouse, settlement), church records (baptism sponsors/godparents who may be relatives). Extract all family names found.`,
          response_json_schema: {
            type: "object",
            properties: {
              birth_record: { type: "object", properties: { date: { type: "string" }, parents: { type: "array", items: { type: "string" } }, mothers_maiden_name: { type: "string" } } },
              marriage_records: { type: "array", items: { type: "object", properties: { spouse: { type: "string" }, date: { type: "string" }, witnesses: { type: "array", items: { type: "string" } } } } },
              divorce_records: { type: "array", items: { type: "object", properties: { ex_spouse: { type: "string" }, date: { type: "string" } } } },
              church_records: { type: "array", items: { type: "object", properties: { type: { type: "string" }, date: { type: "string" }, sponsors: { type: "array", items: { type: "string" } } } } },
              additional_relatives: { type: "array", items: { type: "string" } },
              confidence: { type: "number" },
            },
          },
        }).then(r => { R.vital = r; R.sources.push("birth_certificates", "marriage_certificates", "divorce_records", "church_records"); R.methods.push("vital_records_search"); })
          .catch(e => R.errors.push({ step: "vital_records", error: e.message }))
      );

      // DNA / genetic genealogy (for unknown heirs)
      phase2Passes.push(
        invokeLLM({
          model: SEARCH_MODEL, add_context_from_internet: true,
          prompt: `You are a genetic genealogist. For the estate of:\n${ctx}\n\nSearch: ${sourcesList("dna_genealogy")}\n\nIf there may be unknown or missing heirs (no known spouse/children, estranged family, adoption), identify whether DNA databases could help. Note any public GEDmatch or FamilyTreeDNA kits that match this family line. This is for cases where traditional genealogy hits a dead end and unknown heirs must be identified through genetic matches.`,
          response_json_schema: {
            type: "object",
            properties: {
              unknown_heirs_likely: { type: "boolean" },
              dna_matches_found: { type: "array", items: { type: "object", properties: { match_name: { type: "string" }, relationship_estimate: { type: "string" }, shared_cm: { type: "number" } } } },
              recommended_dna_strategy: { type: "string" },
              confidence: { type: "number" },
            },
          },
        }).then(r => { R.dna = r; R.sources.push("gedmatch", "familytreedna", "ancestry_dna", "myheritage_dna"); R.methods.push("dna_genealogy_search"); })
          .catch(e => R.errors.push({ step: "dna_genealogy", error: e.message }))
      );

      // Property & financial
      phase2Passes.push(
        invokeLLM({
          model: SEARCH_MODEL, add_context_from_internet: true,
          prompt: `You are a property and financial records researcher. For the estate of:\n${ctx}\n\nSearch: ${sourcesList("property_financial")}\n\nFind: property owned by the deceased (county assessor), property tax records, deed records, business ownership (SEC, SOS, D&B), tax liens. This helps determine estate value and locate assets.`,
          response_json_schema: {
            type: "object",
            properties: {
              properties_owned: { type: "array", items: { type: "object", properties: { address: { type: "string" }, value: { type: "string" }, ownership_type: { type: "string" } } } },
              business_ownership: { type: "array", items: { type: "object", properties: { business_name: { type: "string" }, role: { type: "string" }, state: { type: "string" } } } },
              tax_liens: { type: "array", items: { type: "string" } },
              estimated_estate_value: { type: "string" },
              confidence: { type: "number" },
            },
          },
        }).then(r => { R.property_financial = r; R.sources.push("county_assessor", "property_tax", "deed_records", "sec_filings", "business_registrations"); R.methods.push("property_financial_search"); })
          .catch(e => R.errors.push({ step: "property_financial", error: e.message }))
      );

      // International
      phase2Passes.push(
        invokeLLM({
          model: SEARCH_MODEL, add_context_from_internet: true,
          prompt: `You are an international records researcher. For the estate of:\n${ctx}\n\nSearch: ${sourcesList("international")}\n\nDetermine if any heirs may have emigrated or live abroad. Check immigration/emigration records, international phone directories, foreign genealogy databases. This is important when the deceased had immigrant origins or family spread across countries.`,
          response_json_schema: {
            type: "object",
            properties: {
              international_heirs_found: { type: "array", items: { type: "object", properties: { name: { type: "string" }, country: { type: "string" }, relationship: { type: "string" } } } },
              emigration_records: { type: "array", items: { type: "string" } },
              confidence: { type: "number" },
            },
          },
        }).then(r => { R.international = r; R.sources.push("international_records", "emigration_records"); R.methods.push("international_search"); })
          .catch(e => R.errors.push({ step: "international", error: e.message }))
      );
    }

    // Probate (always run)
    phase2Passes.push(
      invokeLLM({
        model: SEARCH_MODEL, add_context_from_internet: true,
        prompt: `You are a probate researcher. Search for probate court records for:\n${ctx}\n\nSearch: ${sourcesList("probate_legal")}\n\nFind: county where probate filed, case number, executor/personal representative, estate attorney, filing date, will status (testate/intestate), estate value, published notices to creditors/heirs.`,
        response_json_schema: {
          type: "object",
          properties: {
            court_county: { type: "string" }, case_number: { type: "string" },
            executor_name: { type: "string" }, executor_contact: { type: "string" },
            attorney_name: { type: "string" }, filing_date: { type: "string" },
            estate_value: { type: "string" }, will_found: { type: "boolean" },
            will_details: { type: "string" }, confidence: { type: "number" },
          },
        },
      }).then(r => { R.probate_info = r; R.sources.push("probate_court", "county_clerk", "case_lookup"); R.methods.push("probate_records_search"); })
        .catch(e => R.errors.push({ step: "probate_records", error: e.message }))
    );

    await Promise.all(phase2Passes);

    // === PHASE 3: Identify & classify heirs from family tree + historical + vital ===
    const tree = R.family_tree || {};
    const allRelatives: { name: string; relationship: string; degree: number; priority: string }[] = [];
    if (tree.spouse) allRelatives.push({ name: tree.spouse, relationship: "spouse", degree: 1, priority: "primary" });
    (tree.children || []).forEach((c: string) => allRelatives.push({ name: c, relationship: "child", degree: 1, priority: "primary" }));
    (tree.parents || []).forEach((p: string) => allRelatives.push({ name: p, relationship: "parent", degree: 2, priority: "secondary" }));
    (tree.siblings || []).forEach((s: string) => allRelatives.push({ name: s, relationship: "sibling", degree: 2, priority: "secondary" }));
    (tree.grandchildren || []).forEach((g: string) => allRelatives.push({ name: g, relationship: "grandchild", degree: 3, priority: "distant" }));
    (tree.nieces_nephews || []).forEach((n: string) => allRelatives.push({ name: n, relationship: "niece/nephew", degree: 3, priority: "distant" }));
    (tree.aunts_uncles || []).forEach((a: string) => allRelatives.push({ name: a, relationship: "aunt/uncle", degree: 3, priority: "distant" }));
    (tree.cousins || []).forEach((c: string) => allRelatives.push({ name: c, relationship: "cousin", degree: 4, priority: "distant" }));

    // Add from historical/vital if deep
    if (deep) {
      (R.historical?.additional_relatives_found || []).forEach((r: any) => {
        if (r.name && !allRelatives.find(x => x.name.toLowerCase() === r.name.toLowerCase()))
          allRelatives.push({ name: r.name, relationship: r.relationship || "relative", degree: 4, priority: "distant" });
      });
      (R.vital?.additional_relatives || []).forEach((n: string) => {
        if (n && !allRelatives.find(x => x.name.toLowerCase() === n.toLowerCase()))
          allRelatives.push({ name: n, relationship: "relative", degree: 4, priority: "distant" });
      });
      (R.international?.international_heirs_found || []).forEach((r: any) => {
        if (r.name && !allRelatives.find(x => x.name.toLowerCase() === r.name.toLowerCase()))
          allRelatives.push({ name: r.name, relationship: r.relationship || "international heir", degree: 4, priority: "distant" });
      });
    }

    const seen = new Set<string>();
    const uniqueHeirs = allRelatives.filter(h => {
      const k = h.name?.toLowerCase().trim();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    // === PHASE 4: Skip trace each living heir (parallel passes per heir) ===
    for (const heir of uniqueHeirs) {
      if (!heir.name || heir.name === "unknown") continue;

      const heirCtx = `Name: "${heir.name}"\nRelationship to deceased "${deceased_name}": ${heir.relationship}\n${deceased_last_address ? `Deceased lived at: ${deceased_last_address}\n` : ""}${death_location ? `Death occurred in: ${death_location}\n` : ""}`;

      const heirPasses: Promise<any>[] = [];

      // People search (always)
      heirPasses.push(
        invokeLLM({
          model: SEARCH_MODEL, add_context_from_internet: true,
          prompt: `You are a skip tracing specialist. Find contact info for:\n${heirCtx}\n\nSearch: ${sourcesList("people_search")}\n\nFind: living/deceased status, all phone numbers, emails, current address, age/DOB, known relatives. Rate confidence this is the correct person.`,
          response_json_schema: {
            type: "object",
            properties: {
              is_living: { type: "boolean" },
              phone_numbers: { type: "array", items: { type: "object", properties: { number: { type: "string" }, confidence: { type: "number" }, source: { type: "string" } } } },
              emails: { type: "array", items: { type: "object", properties: { email: { type: "string" }, confidence: { type: "number" }, source: { type: "string" } } } },
              address: { type: "string" }, age_or_dob: { type: "string" },
              confidence: { type: "number" }, notes: { type: "string" },
            },
          },
        }).catch(e => { R.errors.push({ step: `heir_people_${heir.name}`, error: e.message }); return null; })
      );

      if (deep) {
        // Social & professional
        heirPasses.push(
          invokeLLM({
            model: SEARCH_MODEL, add_context_from_internet: true,
            prompt: `Search for "${heir.name}" on social and professional networks.\n${heirCtx}\n\nSearch: ${sourcesList("social_professional")}\n\nFind profiles, bios, visible contact info, professional license info.`,
            response_json_schema: {
              type: "object",
              properties: {
                profiles: { type: "array", items: { type: "object", properties: { platform: { type: "string" }, url: { type: "string" }, bio: { type: "string" } } } },
                additional_emails: { type: "array", items: { type: "string" } },
                additional_phones: { type: "array", items: { type: "string" } },
                professional_license: { type: "string" },
              },
            },
          }).catch(() => null)
        );

        // Government records
        heirPasses.push(
          invokeLLM({
            model: SEARCH_MODEL, add_context_from_internet: true,
            prompt: `Search government records for "${heir.name}".\n${heirCtx}\n\nSearch: ${sourcesList("government_records")}\n\nFind: voter registration (address, party), professional licenses, FAA records, inmate records, military/VA, sex offender registry. Any government record that confirms identity or location.`,
            response_json_schema: {
              type: "object",
              properties: {
                voter_registration: { type: "object", properties: { address: { type: "string" }, party: { type: "string" } } },
                licenses: { type: "array", items: { type: "string" } },
                government_records: { type: "array", items: { type: "object", properties: { type: { type: "string" }, details: { type: "string" } } } },
                address_confirmed: { type: "string" },
              },
            },
          }).catch(() => null)
        );

        // Email & phone deep
        heirPasses.push(
          invokeLLM({
            model: SEARCH_MODEL, add_context_from_internet: true,
            prompt: `Find all emails and phone numbers for "${heir.name}".\n${heirCtx}\n\nSearch: ${sourcesList("email_phone")}\n\nFind: email addresses (Hunter.io patterns, breach verification, email directories), reverse phone, carrier info. Generate likely email patterns from name.`,
            response_json_schema: {
              type: "object",
              properties: {
                emails: { type: "array", items: { type: "object", properties: { email: { type: "string" }, confidence: { type: "number" }, source: { type: "string" } } } },
                phone_numbers: { type: "array", items: { type: "object", properties: { number: { type: "string" }, type: { type: "string" }, confidence: { type: "number" } } } },
                email_patterns: { type: "array", items: { type: "string" } },
              },
            },
          }).catch(() => null)
        );
      }

      const passResults = await Promise.all(heirPasses);
      const peopleRes = passResults[0] || {};
      const socialRes = deep ? passResults[1] : null;
      const govRes = deep ? passResults[2] : null;
      const emailRes = deep ? passResults[3] : null;

      // Merge all contact info
      const phones = [...(peopleRes?.phone_numbers || [])];
      const emails = [...(peopleRes?.emails || [])];
      const socials: any[] = [];

      if (socialRes) {
        (socialRes.profiles || []).forEach((p: any) => socials.push(p));
        (socialRes.additional_emails || []).forEach((e: string) => emails.push({ email: e, confidence: 60, source: "social_media" }));
        (socialRes.additional_phones || []).forEach((p: string) => phones.push({ number: p, confidence: 60, source: "social_media" }));
      }
      if (emailRes) {
        (emailRes.emails || []).forEach((e: any) => emails.push(e));
        (emailRes.phone_numbers || []).forEach((p: any) => phones.push(p));
      }

      R.identified_heirs.push({
        name: heir.name,
        relationship: heir.relationship,
        relationship_degree: heir.degree,
        is_living: peopleRes?.is_living !== false,
        phone_numbers: phones,
        emails: emails,
        address: peopleRes?.address || govRes?.address_confirmed || "",
        age_or_dob: peopleRes?.age_or_dob || "",
        social_profiles: socials,
        confidence: peopleRes?.confidence || 0,
        inheritance_priority: heir.priority,
        notes: peopleRes?.notes || (govRes?.government_records?.length ? `Gov records: ${govRes.government_records.length} found` : ""),
      });
    }

    R.methods.push("heir_contact_tracing");
    if (deep) R.methods.push("deep_heir_contact_tracing");

    // === CONFIDENCE SCORING ===
    const dConf = R.deceased_details?.confidence || 0;
    const tConf = R.family_tree?.confidence || 0;
    const pConf = R.probate_info?.confidence || 0;
    const hConfs = R.identified_heirs.map((h: any) => h.confidence || 0);
    const avgH = hConfs.length > 0 ? Math.round(hConfs.reduce((a: number, b: number) => a + b, 0) / hConfs.length) : 0;
    const overall = Math.round(dConf * 0.3 + tConf * 0.3 + avgH * 0.3 + pConf * 0.1);

    const livingHeirs = R.identified_heirs.filter((h: any) => h.is_living);
    const status = overall >= 70 && livingHeirs.length > 0 ? "found" : overall >= 40 || livingHeirs.length > 0 ? "partial" : "failed";
    const duration = Date.now() - startTime;

    await base44.entities.HeirSearch.update(heirSearch.id, {
      status, deceased_confirmed: R.deceased_details?.confirmed || false,
      deceased_details: R.deceased_details, family_tree: R.family_tree,
      identified_heirs: R.identified_heirs, probate_info: R.probate_info,
      sources_checked: [...new Set(R.sources)], methods_used: [...new Set(R.methods)],
      confidence_score: overall, search_duration_ms: duration,
    });

    return Response.json({
      ok: true, heir_search_id: heirSearch.id, status, confidence_score: overall,
      deceased_confirmed: R.deceased_details?.confirmed || false,
      deceased_details: R.deceased_details, family_tree: R.family_tree,
      probate_info: R.probate_info,
      historical: deep ? R.historical : undefined,
      vital: deep ? R.vital : undefined,
      dna: deep ? R.dna : undefined,
      property_financial: deep ? R.property_financial : undefined,
      international: deep ? R.international : undefined,
      identified_heirs: R.identified_heirs, living_heir_count: livingHeirs.length,
      sources: [...new Set(R.sources)], methods: [...new Set(R.methods)],
      deep_mode: deep, duration_ms: duration,
      errors: R.errors.length > 0 ? R.errors : undefined,
    });
  } catch (error: any) {
    console.error("Heir search error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}