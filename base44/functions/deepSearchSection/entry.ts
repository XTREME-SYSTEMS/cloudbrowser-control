import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * Runs a targeted deep search on a single section of an heir search.
 * Uses internet-enabled LLM to find more information for the requested topic,
 * then updates the HeirSearch record with the enhanced data.
 *
 * section: one of deceased_details, family_tree, probate_info, historical,
 *          vital, dna, property_financial, international, unclaimed,
 *          cemetery_mortuary, immigration_nat, patent_whois, intl_genealogy,
 *          missing_persons, professional_assoc, breach_verification,
 *          ucc_sec, fec_lobby, username_correlation, domain_archive,
 *          contact_verification, crypto_assets, deed_chain, permits_regulatory,
 *          social_graph, business_network
 */

const SECTION_PROMPTS: Record<string, { prompt: (d: any) => string; schema: any }> = {
  deceased_details: {
    prompt: (d) => `Search all public death records, SSDI, obituaries, funeral home announcements, and death certificates for ${d.deceased_name}. Born ${d.deceased_dob || "unknown"}, died ${d.deceased_dod || "unknown"}, last address ${d.deceased_last_address || "unknown"}, death location ${d.death_location || "unknown"}. Return full name, birth date, death date, last residence, SSN state issued, obituary URL and text, funeral home, cause of death, spouse name, parents names, children names, siblings names, and confidence 0-100.`,
    schema: {
      type: "object",
      properties: {
        full_name: { type: "string" }, birth_date: { type: "string" }, death_date: { type: "string" },
        last_residence: { type: "string" }, ssn_state_issued: { type: "string" },
        obituary_url: { type: "string" }, obituary_text: { type: "string" },
        funeral_home: { type: "string" }, cause_of_death: { type: "string" },
        spouse_name: { type: "string" },
        parents_names: { type: "array", items: { type: "string" } },
        children_names: { type: "array", items: { type: "string" } },
        siblings_names: { type: "array", items: { type: "string" } },
        confidence: { type: "number" }, confirmed: { type: "boolean" },
      },
    },
  },
  family_tree: {
    prompt: (d) => `Search genealogy databases, family tree sites, obituaries, and public records to build the complete family tree for ${d.deceased_name}. Born ${d.deceased_dob || "unknown"}, died ${d.deceased_dod || "unknown"}, last address ${d.deceased_last_address || "unknown"}. Find spouse, ex-spouses, children, parents, siblings, grandchildren, nieces/nephews, cousins, aunts/uncles. Return all names found.`,
    schema: {
      type: "object",
      properties: {
        spouse: { type: "string" },
        ex_spouses: { type: "array", items: { type: "string" } },
        children: { type: "array", items: { type: "string" } },
        parents: { type: "array", items: { type: "string" } },
        siblings: { type: "array", items: { type: "string" } },
        grandchildren: { type: "array", items: { type: "string" } },
        nieces_nephews: { type: "array", items: { type: "string" } },
        cousins: { type: "array", items: { type: "string" } },
        aunts_uncles: { type: "array", items: { type: "string" } },
        confidence: { type: "number" },
      },
    },
  },
  probate_info: {
    prompt: (d) => `Search probate court records, county clerk databases, and public legal filings for the estate of ${d.deceased_name}. Died ${d.deceased_dod || "unknown"}, death location ${d.death_location || "unknown"}. Find the probate court county, case number, executor name and contact, attorney name, filing date, estate value, whether a will was found, and will details.`,
    schema: {
      type: "object",
      properties: {
        court_county: { type: "string" }, case_number: { type: "string" },
        executor_name: { type: "string" }, executor_contact: { type: "string" },
        attorney_name: { type: "string" }, filing_date: { type: "string" },
        estate_value: { type: "string" }, will_found: { type: "boolean" },
        will_details: { type: "string" }, confidence: { type: "number" },
      },
    },
  },
  historical: {
    prompt: (d) => `Search historical records, census records, draft registration cards, immigration/passenger lists, and old city directories for ${d.deceased_name}. Born ${d.deceased_dob || "unknown"}. Find census household members, draft cards with next of kin, immigration records, and additional relatives.`,
    schema: {
      type: "object",
      properties: {
        census_household_members: { type: "array", items: { type: "object", properties: { name: {type:"string"}, relationship: {type:"string"}, year: {type:"string"} } } },
        draft_cards: { type: "array", items: { type: "object", properties: { name: {type:"string"}, next_of_kin: {type:"string"} } } },
        immigration_records: { type: "array", items: { type: "object", properties: { name: {type:"string"}, arrival_date: {type:"string"}, port: {type:"string"} } } },
        additional_relatives_found: { type: "array", items: { type: "object", properties: { name: {type:"string"}, relationship: {type:"string"} } } },
      },
    },
  },
  vital: {
    prompt: (d) => `Search vital records — birth certificates, marriage licenses, divorce decrees — for ${d.deceased_name}. Born ${d.deceased_dob || "unknown"}, last address ${d.deceased_last_address || "unknown"}. Find birth record parents and mother's maiden name, marriage records with spouses and dates, divorce records, and additional relatives from vital records.`,
    schema: {
      type: "object",
      properties: {
        birth_record: { type: "object", properties: { parents: { type: "array", items: { type: "string" } }, mothers_maiden_name: { type: "string" } } },
        marriage_records: { type: "array", items: { type: "object", properties: { spouse: {type:"string"}, date: {type:"string"} } } },
        divorce_records: { type: "array", items: { type: "object", properties: { ex_spouse: {type:"string"}, date: {type:"string"} } } },
        additional_relatives: { type: "array", items: { type: "string" } },
      },
    },
  },
  dna: {
    prompt: (d) => `Search genetic genealogy databases, DNA matching sites, and genealogy forums for information about ${d.deceased_name} and potential unknown heirs. Born ${d.deceased_dob || "unknown"}. Identify if unknown heirs are likely, any DNA matches found, and recommended DNA testing strategy.`,
    schema: {
      type: "object",
      properties: {
        unknown_heirs_likely: { type: "boolean" },
        dna_matches_found: { type: "array", items: { type: "object", properties: { match_name: {type:"string"}, relationship_estimate: {type:"string"}, shared_cm: {type:"number"} } } },
        recommended_dna_strategy: { type: "string" },
      },
    },
  },
  property_financial: {
    prompt: (d) => `Search property records, county assessor databases, business registries, and financial filings for ${d.deceased_name}. Last address ${d.deceased_last_address || "unknown"}. Find properties owned, business ownership, and estimated estate value.`,
    schema: {
      type: "object",
      properties: {
        properties_owned: { type: "array", items: { type: "object", properties: { address: {type:"string"}, value: {type:"string"} } } },
        business_ownership: { type: "array", items: { type: "object", properties: { business_name: {type:"string"}, role: {type:"string"} } } },
        estimated_estate_value: { type: "string" },
      },
    },
  },
  international: {
    prompt: (d) => `Search international records, emigration/immigration databases, and foreign genealogy sites for ${d.deceased_name}. Born ${d.deceased_dob || "unknown"}. Find international heirs, emigration records, and country of origin connections.`,
    schema: {
      type: "object",
      properties: {
        international_heirs_found: { type: "array", items: { type: "object", properties: { name: {type:"string"}, relationship: {type:"string"}, country: {type:"string"} } } },
        emigration_records: { type: "array", items: { type: "string" } },
      },
    },
  },
  unclaimed: {
    prompt: (d) => `Search unclaimed property databases (state treasurers, MissingMoney.com, NAUPA) for ${d.deceased_name} and their estate. Last address ${d.deceased_last_address || "unknown"}. Find unclaimed assets, their source, and total value.`,
    schema: {
      type: "object",
      properties: {
        unclaimed_assets: { type: "array", items: { type: "object", properties: { type: {type:"string"}, source: {type:"string"} } } },
        total_unclaimed_value: { type: "string" },
      },
    },
  },
  cemetery_mortuary: {
    prompt: (d) => `Search cemetery records, mortuary databases, coroner reports, and funeral home websites for ${d.deceased_name}. Died ${d.deceased_dod || "unknown"}, death location ${d.death_location || "unknown"}. Find cemetery name, family plot members, and next of kin from records.`,
    schema: {
      type: "object",
      properties: {
        cemetery_name: { type: "string" },
        family_plot_members: { type: "array", items: { type: "string" } },
        next_of_kin_from_records: { type: "string" },
      },
    },
  },
  immigration_nat: {
    prompt: (d) => `Search immigration and naturalization records (USCIS, Ellis Island, NARA) for ${d.deceased_name} and their family. Born ${d.deceased_dob || "unknown"}. Find family members from immigration records and naturalization records.`,
    schema: {
      type: "object",
      properties: {
        family_from_immigration: { type: "array", items: { type: "string" } },
        naturalization_records: { type: "array", items: { type: "object", properties: { date: {type:"string"}, court: {type:"string"} } } },
      },
    },
  },
  patent_whois: {
    prompt: (d) => `Search USPTO patent records, trademark databases, and domain WHOIS records for ${d.deceased_name}. Find patents, trademarks, and domain registrations associated with them.`,
    schema: {
      type: "object",
      properties: {
        patents: { type: "array", items: { type: "object", properties: { title: {type:"string"} } } },
        domain_registrations: { type: "array", items: { type: "object", properties: { domain: {type:"string"} } } },
      },
    },
  },
  intl_genealogy: {
    prompt: (d) => `Search international genealogy databases for ${d.deceased_name}. Born ${d.deceased_dob || "unknown"}. Find country of origin and international relatives.`,
    schema: {
      type: "object",
      properties: {
        country_of_origin: { type: "string" },
        international_relatives: { type: "array", items: { type: "object", properties: { name: {type:"string"}, country: {type:"string"} } } },
      },
    },
  },
  missing_persons: {
    prompt: (d) => `Search missing persons databases, NamUs, and unknown heir databases for relatives of ${d.deceased_name}. Find missing relatives and confirmed deceased relatives.`,
    schema: {
      type: "object",
      properties: {
        missing_relatives: { type: "array", items: { type: "object", properties: { name: {type:"string"}, database: {type:"string"} } } },
        deceased_relatives_confirmed: { type: "array", items: { type: "object", properties: { name: {type:"string"} } } },
      },
    },
  },
  professional_assoc: {
    prompt: (d) => `Search professional association directories, trade organization member lists, and licensing boards for ${d.deceased_name} and their family members. Find association members.`,
    schema: {
      type: "object",
      properties: {
        association_members: { type: "array", items: { type: "object", properties: { name: {type:"string"}, association: {type:"string"} } } },
      },
    },
  },
  breach_verification: {
    prompt: (d) => `Search data breach databases (HaveIBeenPwned, breach compilations) to verify email addresses associated with ${d.deceased_name} and their heirs. Find verified emails from breach data.`,
    schema: {
      type: "object",
      properties: {
        verified_emails: { type: "array", items: { type: "object", properties: { email: {type:"string"}, verified: {type:"boolean"} } } },
      },
    },
  },
  ucc_sec: {
    prompt: (d) => `Search UCC filing databases, SEC litigation records, and financial enforcement actions for ${d.deceased_name}. Find UCC filings and SEC litigation.`,
    schema: {
      type: "object",
      properties: {
        ucc_filings: { type: "array", items: { type: "object", properties: { filer: {type:"string"} } } },
        sec_litigation: { type: "array", items: { type: "string" } },
      },
    },
  },
  fec_lobby: {
    prompt: (d) => `Search FEC campaign contribution records and lobbyist registration databases for ${d.deceased_name} and family. Find political contributions and lobbyist registrations.`,
    schema: {
      type: "object",
      properties: {
        contributions: { type: "array", items: { type: "object", properties: { name: {type:"string"}, employer: {type:"string"} } } },
      },
    },
  },
  username_correlation: {
    prompt: (d) => `Search for usernames and online profiles associated with ${d.deceased_name} and their heirs across forums, gaming platforms, and social media. Find correlated profiles.`,
    schema: {
      type: "object",
      properties: {
        profiles: { type: "array", items: { type: "object", properties: { platform: {type:"string"}, username: {type:"string"} } } },
      },
    },
  },
  domain_archive: {
    prompt: (d) => `Search historical WHOIS records and the Wayback Machine/web archive for domains associated with ${d.deceased_name}. Find historical WHOIS and archived pages.`,
    schema: {
      type: "object",
      properties: {
        historical_whois: { type: "array", items: { type: "object", properties: { domain: {type:"string"}, date: {type:"string"} } } },
        archived_pages: { type: "array", items: { type: "string" } },
      },
    },
  },
  contact_verification: {
    prompt: (d) => `Search for and verify contact information (email SMTP checks, phone line type) for heirs of ${d.deceased_name}. Find verified emails and phones.`,
    schema: {
      type: "object",
      properties: {
        verified_emails: { type: "array", items: { type: "object", properties: { email: {type:"string"}, exists: {type:"boolean"} } } },
        verified_phones: { type: "array", items: { type: "object", properties: { number: {type:"string"}, line_type: {type:"string"} } } },
      },
    },
  },
  crypto_assets: {
    prompt: (d) => `Search blockchain explorers, ENS records, and crypto databases for wallets associated with ${d.deceased_name} and their heirs. Find crypto wallets and ENS domains.`,
    schema: {
      type: "object",
      properties: {
        wallets: { type: "array", items: { type: "object", properties: { currency: {type:"string"}, address: {type:"string"} } } },
        ens_domains: { type: "array", items: { type: "string" } },
      },
    },
  },
  deed_chain: {
    prompt: (d) => `Search county recorder and property deed databases for the chain of title on properties owned by ${d.deceased_name}. Last address ${d.deceased_last_address || "unknown"}. Find deed transfers and related owners.`,
    schema: {
      type: "object",
      properties: {
        deed_chain: { type: "array", items: { type: "object", properties: { date: {type:"string"}, grantor: {type:"string"}, grantee: {type:"string"} } } },
        related_owners: { type: "array", items: { type: "string" } },
      },
    },
  },
  permits_regulatory: {
    prompt: (d) => `Search regulatory permit databases and violation records for ${d.deceased_name} and their properties. Find permits and violations.`,
    schema: {
      type: "object",
      properties: {
        permits: { type: "array", items: { type: "object", properties: { type: {type:"string"}, holder: {type:"string"} } } },
        violations: { type: "array", items: { type: "object", properties: { type: {type:"string"} } } },
      },
    },
  },
  social_graph: {
    prompt: (d) => `Analyze social connections and network relationships for ${d.deceased_name} and their family. Find central figures, hidden connections, and network nodes.`,
    schema: {
      type: "object",
      properties: {
        central_figures: { type: "array", items: { type: "string" } },
        hidden_connections: { type: "array", items: { type: "object", properties: { person_a: {type:"string"}, person_b: {type:"string"}, connection: {type:"string"} } } },
        network_nodes: { type: "array", items: { type: "string" } },
      },
    },
  },
  business_network: {
    prompt: (d) => `Search business entity databases (state Secretary of State filings) for business affiliations of ${d.deceased_name} and their heirs. Find business entities and roles.`,
    schema: {
      type: "object",
      properties: {
        business_entities: { type: "array", items: { type: "object", properties: { business_name: {type:"string"}, role: {type:"string"}, state: {type:"string"} } } },
      },
    },
  },
};

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { heir_search_id, section } = body;
    if (!heir_search_id || !section) {
      return Response.json({ error: "heir_search_id and section are required" }, { status: 400 });
    }

    const config = SECTION_PROMPTS[section];
    if (!config) {
      return Response.json({ error: `Unknown section: ${section}` }, { status: 400 });
    }

    const record: any = await base44.entities.HeirSearch.get(heir_search_id);
    if (!record) {
      return Response.json({ error: "Record not found" }, { status: 404 });
    }

    const searchResult: any = await base44.integrations.Core.InvokeLLM({
      prompt: config.prompt(record),
      add_context_from_internet: true,
      response_json_schema: config.schema,
    });

    // Update the record with the new section data
    const updateData: any = { [section]: searchResult };
    await base44.entities.HeirSearch.update(heir_search_id, updateData);

    return Response.json({
      ok: true,
      section,
      data: searchResult,
    });
  } catch (error: any) {
    console.error("Deep search section error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}