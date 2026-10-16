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
      spreadsheet_url, sheet_name,
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
      // Deeper tier (categories 13-20)
      unclaimed: {}, cemetery_mortuary: {}, immigration_nat: {},
      patent_whois: {}, intl_genealogy: {}, missing_persons: {},
      professional_assoc: {}, breach_verification: {},
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

      // === DEEPER TIER (categories 13-20) ===

      // 13. Unclaimed Property & Estate Assets
      phase2Passes.push(
        invokeLLM({
          model: SEARCH_MODEL, add_context_from_internet: true,
          prompt: `You are an estate asset researcher. For the estate of:\n${ctx}\n\nSearch: ${sourcesList("unclaimed_property")}\n\nFind any unclaimed property, unclaimed funds, unclaimed life insurance, unclaimed pensions, or escheatment records belonging to the deceased or their estate. This helps locate assets and identify heirs entitled to them.`,
          response_json_schema: {
            type: "object",
            properties: {
              unclaimed_assets: { type: "array", items: { type: "object", properties: { source: { type: "string" }, type: { type: "string" }, value: { type: "string" }, state: { type: "string" } } } },
              total_unclaimed_value: { type: "string" },
              heirs_entitled: { type: "array", items: { type: "string" } },
              confidence: { type: "number" },
            },
          },
        }).then(r => { R.unclaimed = r; R.sources.push("unclaimed_property", "missingmoney", "state_treasurer", "escheatment"); R.methods.push("unclaimed_property_search"); })
          .catch(e => R.errors.push({ step: "unclaimed_property", error: e.message }))
      );

      // 14. Cemetery, Mortuary & Coroner Records
      phase2Passes.push(
        invokeLLM({
          model: SEARCH_MODEL, add_context_from_internet: true,
          prompt: `You are a cemetery and mortuary records researcher. For:\n${ctx}\n\nSearch: ${sourcesList("cemetery_mortuary")}\n\nFind: burial location (cemetery name, plot), funeral home that handled arrangements, cremation records, coroner/medical examiner records if death was unusual. Burial records sometimes list next of kin and family plot members who may be heirs.`,
          response_json_schema: {
            type: "object",
            properties: {
              burial_location: { type: "string" },
              cemetery_name: { type: "string" },
              plot_info: { type: "string" },
              funeral_home: { type: "string" },
              cremation: { type: "boolean" },
              family_plot_members: { type: "array", items: { type: "string" } },
              coroner_records: { type: "string" },
              next_of_kin_from_records: { type: "string" },
              confidence: { type: "number" },
            },
          },
        }).then(r => { R.cemetery_mortuary = r; R.sources.push("cemetery_records", "funeral_home_archives", "coroner_records", "burial_records"); R.methods.push("cemetery_mortuary_search"); })
          .catch(e => R.errors.push({ step: "cemetery_mortuary", error: e.message }))
      );

      // 15. Immigration & Naturalization (Detailed)
      phase2Passes.push(
        invokeLLM({
          model: SEARCH_MODEL, add_context_from_internet: true,
          prompt: `You are an immigration records researcher. For:\n${ctx}\n\nSearch: ${sourcesList("immigration_naturalization")}\n\nFind: passport applications (show birthplace, parents), naturalization certificates (show birth name, arrival date), alien registration files (A-Files), detailed ship manifests (show traveling companions who may be family), declaration of intention records. These reveal original names, birthplaces, and family members who traveled together.`,
          response_json_schema: {
            type: "object",
            properties: {
              passport_records: { type: "array", items: { type: "object", properties: { date: { type: "string" }, birthplace: { type: "string" }, parents: { type: "array", items: { type: "string" } } } } },
              naturalization_records: { type: "array", items: { type: "object", properties: { date: { type: "string" }, court: { type: "string" }, birth_name: { type: "string" }, arrival_date: { type: "string" } } } },
              ship_manifests: { type: "array", items: { type: "object", properties: { arrival_date: { type: "string" }, ship: { type: "string" }, traveling_with: { type: "array", items: { type: "string" } } } } },
              family_from_immigration: { type: "array", items: { type: "string" } },
              confidence: { type: "number" },
            },
          },
        }).then(r => { R.immigration_nat = r; R.sources.push("uscis_genealogy", "passport_records", "naturalization", "ship_manifests", "alien_registration"); R.methods.push("immigration_naturalization_search"); })
          .catch(e => R.errors.push({ step: "immigration_naturalization", error: e.message }))
      );

      // 16. Patent, Trademark & Domain WHOIS
      phase2Passes.push(
        invokeLLM({
          model: SEARCH_MODEL, add_context_from_internet: true,
          prompt: `You are an intellectual property and domain records researcher. For:\n${ctx}\n\nSearch: ${sourcesList("patent_trademark_whois")}\n\nFind: any patents filed (shows inventor name and address), trademarks registered, copyright registrations, or domain names registered by the deceased or their business. WHOIS records show registrant name and address. These can reveal business connections and contact info for heirs who inherited IP.`,
          response_json_schema: {
            type: "object",
            properties: {
              patents: { type: "array", items: { type: "object", properties: { number: { type: "string" }, title: { type: "string" }, assignee: { type: "string" } } } },
              trademarks: { type: "array", items: { type: "object", properties: { name: { type: "string" }, owner: { type: "string" } } } },
              domain_registrations: { type: "array", items: { type: "object", properties: { domain: { type: "string" }, registrant: { type: "string" }, registrant_address: { type: "string" } } } },
              ip_heirs: { type: "array", items: { type: "string" } },
              confidence: { type: "number" },
            },
          },
        }).then(r => { R.patent_whois = r; R.sources.push("uspto_patents", "uspto_trademarks", "whois", "domain_registrations"); R.methods.push("patent_trademark_whois_search"); })
          .catch(e => R.errors.push({ step: "patent_trademark_whois", error: e.message }))
      );

      // 17. International Genealogy (Country-Specific)
      phase2Passes.push(
        invokeLLM({
          model: SEARCH_MODEL, add_context_from_internet: true,
          prompt: `You are an international genealogy researcher. For:\n${ctx}\n\nSearch: ${sourcesList("international_genealogy")}\n\nIf the deceased had immigrant origins, search country-specific vital records and genealogy databases: UK GRO, Canada LAC, Australia BDM, Ireland GRO, Scotland GRO, German/Italian/Polish genealogy, Mexico civil registration. Find ancestors, siblings, and collateral lines that may lead to unknown heirs in the country of origin.`,
          response_json_schema: {
            type: "object",
            properties: {
              country_of_origin: { type: "string" },
              international_relatives: { type: "array", items: { type: "object", properties: { name: { type: "string" }, relationship: { type: "string" }, country: { type: "string" } } } },
              origin_family: { type: "array", items: { type: "string" } },
              international_heir_leads: { type: "array", items: { type: "string" } },
              confidence: { type: "number" },
            },
          },
        }).then(r => { R.intl_genealogy = r; R.sources.push("uk_gro", "canada_lac", "australia_bdm", "ireland_gro", "scotland_gro", "international_genealogy"); R.methods.push("international_genealogy_search"); })
          .catch(e => R.errors.push({ step: "international_genealogy", error: e.message }))
      );

      // 18. Missing Persons & Unknown Heir Databases
      phase2Passes.push(
        invokeLLM({
          model: SEARCH_MODEL, add_context_from_internet: true,
          prompt: `You are a missing persons and unknown heir researcher. For the estate of:\n${ctx}\n\nSearch: ${sourcesList("missing_persons")}\n\nCheck if any known relatives are listed as missing persons (NamUs, NCMEC, Doe Network). Check for unclaimed persons at medical examiners' offices. Check the full Social Security Death Master File for relatives who may have died. Check if any potential heirs are disqualified (FBI most wanted). This is critical for intestate estates where heirs must be exhaustively identified.`,
          response_json_schema: {
            type: "object",
            properties: {
              missing_relatives: { type: "array", items: { type: "object", properties: { name: { type: "string" }, database: { type: "string" }, status: { type: "string" } } } },
              unclaimed_persons: { type: "array", items: { type: "string" } },
              deceased_relatives_confirmed: { type: "array", items: { type: "object", properties: { name: { type: "string" }, death_date: { type: "string" } } } },
              disqualified_heirs: { type: "array", items: { type: "string" } },
              confidence: { type: "number" },
            },
          },
        }).then(r => { R.missing_persons = r; R.sources.push("namus", "ncmec", "doe_network", "unclaimed_persons", "ssdmf_full"); R.methods.push("missing_persons_search"); })
          .catch(e => R.errors.push({ step: "missing_persons", error: e.message }))
      );

      // 19. Professional & Trade Associations
      phase2Passes.push(
        invokeLLM({
          model: SEARCH_MODEL, add_context_from_internet: true,
          prompt: `You are a professional association researcher. For the family of:\n${ctx}\n\nSearch: ${sourcesList("professional_associations")}\n\nFind: any family members in professional association directories (ABA, AMA, engineering societies, realtor associations), trade union membership records, guild records (one-name studies), academic alumni associations, fraternal organization records (Masons, Elks). These directories often show current address and contact info for professional heirs.`,
          response_json_schema: {
            type: "object",
            properties: {
              association_members: { type: "array", items: { type: "object", properties: { name: { type: "string" }, association: { type: "string" }, address: { type: "string" }, member_since: { type: "string" } } } },
              fraternal_members: { type: "array", items: { type: "string" } },
              guild_connections: { type: "array", items: { type: "string" } },
              confidence: { type: "number" },
            },
          },
        }).then(r => { R.professional_assoc = r; R.sources.push("professional_associations", "trade_unions", "fraternal_organizations", "guild_records"); R.methods.push("professional_associations_search"); })
          .catch(e => R.errors.push({ step: "professional_associations", error: e.message }))
      );

      // 20. Dark Web & Breach Verification
      phase2Passes.push(
        invokeLLM({
          model: SEARCH_MODEL, add_context_from_internet: true,
          prompt: `You are a digital footprint and breach verification researcher. For the family of:\n${ctx}\n\nSearch: ${sourcesList("darkweb_breach")}\n\nVerify contact information found through other methods using breach databases (HaveIBeenPwned confirms email exists), data broker aggregators, and public records data brokers. Cross-reference phone numbers and emails found by other passes. Do NOT expose passwords or sensitive breach data — only verify that contact info exists and is associated with the person.`,
          response_json_schema: {
            type: "object",
            properties: {
              verified_emails: { type: "array", items: { type: "object", properties: { email: { type: "string" }, verified: { type: "boolean" }, sources: { type: "array", items: { type: "string" } } } } },
              verified_phones: { type: "array", items: { type: "object", properties: { number: { type: "string" }, verified: { type: "boolean" } } } },
              additional_contacts: { type: "array", items: { type: "object", properties: { type: { type: "string" }, value: { type: "string" }, source: { type: "string" } } } },
              confidence: { type: "number" },
            },
          },
        }).then(r => { R.breach_verification = r; R.sources.push("haveibeenpwned", "dehashed", "breach_verification", "data_brokers"); R.methods.push("breach_verification_search"); })
          .catch(e => R.errors.push({ step: "darkweb_breach", error: e.message }))
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
      // Deeper tier relatives
      (R.cemetery_mortuary?.family_plot_members || []).forEach((n: string) => {
        if (n && !allRelatives.find(x => x.name.toLowerCase() === n.toLowerCase()))
          allRelatives.push({ name: n, relationship: "family_plot_member", degree: 4, priority: "distant" });
      });
      if (R.cemetery_mortuary?.next_of_kin_from_records && !allRelatives.find(x => x.name.toLowerCase() === R.cemetery_mortuary.next_of_kin_from_records.toLowerCase()))
        allRelatives.push({ name: R.cemetery_mortuary.next_of_kin_from_records, relationship: "next_of_kin", degree: 2, priority: "secondary" });
      (R.immigration_nat?.family_from_immigration || []).forEach((n: string) => {
        if (n && !allRelatives.find(x => x.name.toLowerCase() === n.toLowerCase()))
          allRelatives.push({ name: n, relationship: "immigration_relative", degree: 4, priority: "distant" });
      });
      (R.intl_genealogy?.international_relatives || []).forEach((r: any) => {
        if (r.name && !allRelatives.find(x => x.name.toLowerCase() === r.name.toLowerCase()))
          allRelatives.push({ name: r.name, relationship: r.relationship || "international_relative", degree: 4, priority: "distant" });
      });
      (R.professional_assoc?.association_members || []).forEach((m: any) => {
        if (m.name && !allRelatives.find(x => x.name.toLowerCase() === m.name.toLowerCase()))
          allRelatives.push({ name: m.name, relationship: "association_member", degree: 5, priority: "distant" });
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

    // === AUTO-EXPORT TO GOOGLE SHEETS ===
    let sheet_export: any = null;
    if (spreadsheet_url && R.identified_heirs.length > 0) {
      try {
        const exportRes: any = await base44.functions.invoke("exportHeirToSheet", {
          spreadsheet_url,
          sheet_name: sheet_name || "Heirs",
          deceased_name,
          case_reference: case_reference || "",
          identified_heirs: R.identified_heirs,
          probate_info: R.probate_info,
          confidence_score: overall,
        });
        sheet_export = exportRes?.data || exportRes;
        if (sheet_export?.error) {
          R.errors.push({ step: "google_sheets_export", error: sheet_export.error });
          sheet_export = null;
        }
      } catch (expErr: any) {
        R.errors.push({ step: "google_sheets_export", error: expErr.message });
      }
    }

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
      // Deeper tier
      unclaimed: deep ? R.unclaimed : undefined,
      cemetery_mortuary: deep ? R.cemetery_mortuary : undefined,
      immigration_nat: deep ? R.immigration_nat : undefined,
      patent_whois: deep ? R.patent_whois : undefined,
      intl_genealogy: deep ? R.intl_genealogy : undefined,
      missing_persons: deep ? R.missing_persons : undefined,
      professional_assoc: deep ? R.professional_assoc : undefined,
      breach_verification: deep ? R.breach_verification : undefined,
      identified_heirs: R.identified_heirs, living_heir_count: livingHeirs.length,
      sources: [...new Set(R.sources)], methods: [...new Set(R.methods)],
      deep_mode: deep, duration_ms: duration,
      sheet_export: sheet_export || undefined,
      errors: R.errors.length > 0 ? R.errors : undefined,
    });
  } catch (error: any) {
    console.error("Heir search error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}