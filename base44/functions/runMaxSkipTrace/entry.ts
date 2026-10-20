import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { invokeLLM, setGatewayFallback } from "../../shared/vercelAiGateway.ts";
import { HEIR_SEARCH_CATALOG, SKIP_TRACE_DEEP_CATALOG } from "../../shared/searchSourceCatalog.ts";
import {
  normalizeAllResults,
  normalizePhone,
  normalizeEmail,
  normalizeName,
} from "../../shared/skipTraceNormalizer.ts";

/**
 * MAX Skip Trace — Deepest Technologically Possible
 *
 * Runs ALL 30+ source categories from the catalog in parallel batches:
 *   Phase 1: Identity resolution (property records, reverse phone, business)
 *   Phase 2: Core people search + social + email + relatives (parallel)
 *   Phase 3: All 11 deep categories (voter, court, licenses, DMV, military, tax,
 *            government, church, school, newspaper, death)
 *   Phase 4: All 10 EXTREME deep categories (UCC/SEC, FEC, username correlation,
 *            WHOIS history, contact verification, crypto, deed chain, permits,
 *            social graph, business network)
 *   Phase 5: Normalization + dedup + cross-source correlation
 *   Phase 6: AI cross-correlation enrichment (unified profile)
 *   Phase 7: AI executive summary + full structured report
 *
 * Output: normalized, enriched, summarized, with full evidence chain.
 */
const SEARCH_MODEL = "gemini_3_flash";
const SUMMARY_MODEL = "gemini_3_flash";

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    setGatewayFallback(base44); // enable Base44 Core InvokeLLM fallback when Vercel gateway is exhausted
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const {
      property_address, owner_name, phone, email, company,
      batch_id, spreadsheet_url, generate_report = true,
    } = body as any;

    if (!property_address && !owner_name && !phone && !email && !company) {
      return Response.json({ error: "At least one search input required" }, { status: 400 });
    }

    // Create skip trace record
    const skipTrace = await base44.entities.SkipTrace.create({
      target_property_address: property_address || "",
      target_owner_name: owner_name || "",
      target_phone: phone || "",
      target_email: email || "",
      target_company: company || "",
      status: "searching",
      batch_id: batch_id || "",
      found_phone_numbers: [], found_emails: [], found_addresses: [],
      found_social_profiles: [], found_relatives: [],
      sources_checked: [], methods_used: [], search_results: {},
    });

    const startTime = Date.now();
    const raw: any = {
      phone_numbers: [], emails: [], addresses: [],
      social_profiles: [], relatives: [],
      owner_name: owner_name || "",
      sources: [] as string[], methods: [] as string[],
      errors: [] as any[], raw_findings: {} as any, evidence_records: [] as any[],
    };

    // ============ PHASE 1: IDENTITY RESOLUTION ============
    let searchName = owner_name || "";

    // 1a. Property records (if address given)
    if (property_address) {
      try {
        const propRes: any = await invokeLLM({
          model: SEARCH_MODEL, add_context_from_internet: true,
          prompt: `You are an expert skip tracer. Search public property records for: "${property_address}".
Find from county assessor, property appraiser, tax records, and deed records:
- Current owner's full legal name
- Owner's mailing address (may differ from property address)
- Purchase date and price, property value, lot size
- All co-owners or LLC names on the deed
Return ONLY data found in actual public records.`,
          response_json_schema: {
            type: "object",
            properties: {
              owner_name: { type: "string" },
              mailing_address: { type: "string" },
              co_owners: { type: "array", items: { type: "string" } },
              purchase_date: { type: "string" },
              property_value: { type: "string" },
              lot_size: { type: "string" },
              sources_found: { type: "array", items: { type: "string" } },
              confidence: { type: "number" },
            },
          },
        });
        if (propRes?.owner_name) {
          searchName = propRes.owner_name;
          raw.owner_name = propRes.owner_name;
          raw.addresses.push({ address: propRes.mailing_address || property_address, type: "mailing", confidence: propRes.confidence || 75, source: "property_records" });
          (propRes.co_owners || []).forEach((co: string) => raw.relatives.push({ name: co, relationship: "co_owner", confidence: 70 }));
        }
        raw.sources.push("county_assessor", "property_appraiser", "tax_records", "deed_records");
        raw.methods.push("property_records_search");
        raw.raw_findings.property = propRes;
      } catch (e: any) { raw.errors.push({ method: "property_records", error: e.message }); }
    }

    // 1b. Reverse phone lookup (if no name but phone given)
    if (!searchName && phone) {
      try {
        const phoneRes: any = await invokeLLM({
          model: SEARCH_MODEL, add_context_from_internet: true,
          prompt: `Reverse phone lookup for "${phone}". Find subscriber name, address, carrier, line type.`,
          response_json_schema: {
            type: "object",
            properties: {
              owner_name: { type: "string" }, address: { type: "string" },
              carrier: { type: "string" }, line_type: { type: "string" }, confidence: { type: "number" },
            },
          },
        });
        if (phoneRes?.owner_name) { searchName = phoneRes.owner_name; raw.owner_name = phoneRes.owner_name; }
        if (phoneRes?.address) raw.addresses.push({ address: phoneRes.address, type: "phone_lookup", confidence: phoneRes.confidence || 60, source: "reverse_phone" });
        raw.sources.push("reverse_phone_directory", "caller_id");
        raw.methods.push("reverse_phone_lookup");
        raw.raw_findings.phone_lookup = phoneRes;
      } catch (e: any) { raw.errors.push({ method: "reverse_phone_lookup", error: e.message }); }
    }

    if (!searchName && !property_address) {
      // Can't proceed without a name or address
      await base44.entities.SkipTrace.update(skipTrace.id, { status: "failed", search_duration_ms: Date.now() - startTime });
      return Response.json({ error: "Could not resolve a target identity to search" }, { status: 400 });
    }

    const ctx = `"${searchName}"${property_address ? ` associated with "${property_address}"` : ""}${company ? ` (company: ${company})` : ""}`;

    // ============ PHASE 2: CORE SEARCHES (parallel) ============
    const corePasses: Promise<any>[] = [];

    // People search
    corePasses.push(invokeLLM({
      model: SEARCH_MODEL, add_context_from_internet: true,
      prompt: `Find ALL contact information for ${ctx}. Search people search engines (Whitepages, Spokeo, BeenVerified, TruePeopleSearch, FastPeopleSearch, 411.com, Radaris, ThatsThem, Intelius, PeopleFinder, US Search, MyLife, Pipl). Find: all phone numbers, all emails, current + previous addresses, age/DOB, known relatives and associates. Return ONLY public directory data with sources.`,
      response_json_schema: {
        type: "object",
        properties: {
          phone_numbers: { type: "array", items: { type: "object", properties: { number: { type: "string" }, type: { type: "string" }, confidence: { type: "number" }, source: { type: "string" } } } },
          emails: { type: "array", items: { type: "object", properties: { email: { type: "string" }, confidence: { type: "number" }, source: { type: "string" }, verified: { type: "boolean" } } } },
          current_address: { type: "string" }, previous_addresses: { type: "array", items: { type: "string" } },
          relatives: { type: "array", items: { type: "object", properties: { name: { type: "string" }, relationship: { type: "string" }, phone: { type: "string" }, address: { type: "string" }, confidence: { type: "number" } } } },
          age: { type: "number" }, dob: { type: "string" }, overall_confidence: { type: "number" },
        },
      },
    }).then(r => {
      if (r?.phone_numbers) raw.phone_numbers.push(...r.phone_numbers);
      if (r?.emails) raw.emails.push(...r.emails);
      if (r?.current_address) raw.addresses.push({ address: r.current_address, type: "current", confidence: r.overall_confidence || 70, source: "people_search" });
      (r?.previous_addresses || []).forEach((a: string) => raw.addresses.push({ address: a, type: "previous", confidence: 50, source: "people_search" }));
      if (r?.relatives) raw.relatives.push(...r.relatives);
      if (r?.age) raw.age = r.age;
      if (r?.dob) raw.dob = r.dob;
      raw.sources.push("whitepages", "truepeoplesearch", "fastpeoplesearch", "411", "spokeo", "beenverified", "radaris", "thatsthem", "intelius");
      raw.methods.push("people_search");
      raw.raw_findings.people = r;
    }).catch(e => raw.errors.push({ method: "people_search", error: e.message })));

    // Social media deep search
    corePasses.push(invokeLLM({
      model: SEARCH_MODEL, add_context_from_internet: true,
      prompt: `Search for ${ctx} on ALL social media platforms: Facebook, LinkedIn, Twitter/X, Instagram, TikTok, YouTube, Pinterest, Nextdoor, Reddit, Threads, Bluesky, Mastodon. For each profile: full URL, bio, visible contact info (phone/email in bio), follower count, confidence. Also find any additional emails/phones visible on profiles.`,
      response_json_schema: {
        type: "object",
        properties: {
          profiles: { type: "array", items: { type: "object", properties: { platform: { type: "string" }, url: { type: "string" }, bio: { type: "string" }, followers: { type: "number" }, confidence: { type: "number" } } } },
          additional_emails: { type: "array", items: { type: "string" } },
          additional_phones: { type: "array", items: { type: "string" } },
        },
      },
    }).then(r => {
      if (r?.profiles) raw.social_profiles.push(...r.profiles);
      (r?.additional_emails || []).forEach((e: string) => raw.emails.push({ email: e, confidence: 60, source: "social_media", verified: false }));
      (r?.additional_phones || []).forEach((p: string) => raw.phone_numbers.push({ number: p, type: "unknown", confidence: 60, source: "social_media" }));
      raw.sources.push("facebook", "linkedin", "twitter", "instagram", "tiktok", "youtube", "pinterest", "nextdoor", "reddit");
      raw.methods.push("social_media_search");
      raw.raw_findings.social = r;
    }).catch(e => raw.errors.push({ method: "social_media_search", error: e.message })));

    // Email search
    corePasses.push(invokeLLM({
      model: SEARCH_MODEL, add_context_from_internet: true,
      prompt: `Find ALL email addresses for ${ctx}. Search email directories, social media profiles, company websites, public posts/forums, data breach databases (verification only — confirm exists, no passwords). Also generate likely email patterns from name + common providers (gmail, outlook, yahoo, icloud). For each: confidence, source, verified.`,
      response_json_schema: {
        type: "object",
        properties: {
          emails: { type: "array", items: { type: "object", properties: { email: { type: "string" }, confidence: { type: "number" }, source: { type: "string" }, verified: { type: "boolean" } } } },
          patterns: { type: "array", items: { type: "string" } },
        },
      },
    }).then(r => {
      if (r?.emails) raw.emails.push(...r.emails);
      raw.sources.push("email_directories", "email_patterns", "breach_verification", "hunter_io");
      raw.methods.push("email_search");
      raw.raw_findings.email = r;
    }).catch(e => raw.errors.push({ method: "email_search", error: e.message })));

    // Relatives & associates deep search
    corePasses.push(invokeLLM({
      model: SEARCH_MODEL, add_context_from_internet: true,
      prompt: `Find ALL known relatives, associates, and business partners of ${ctx}. Search public records, family tree sites (Ancestry, FamilySearch, MyHeritage, WikiTree, Geni), business filings, social media connections. For each: full name, relationship (spouse/parent/child/sibling/business partner/associate), phone, address, confidence.`,
      response_json_schema: {
        type: "object",
        properties: {
          relatives: { type: "array", items: { type: "object", properties: { name: { type: "string" }, relationship: { type: "string" }, phone: { type: "string" }, address: { type: "string" }, confidence: { type: "number" } } } },
        },
      },
    }).then(r => {
      if (r?.relatives) {
        r.relatives.forEach((rel: any) => {
          raw.relatives.push(rel);
          if (rel.phone) raw.phone_numbers.push({ number: rel.phone, type: "relative", confidence: rel.confidence || 40, source: "relative_lookup" });
        });
      }
      raw.sources.push("family_records", "business_filings", "associate_network", "ancestry", "familysearch");
      raw.methods.push("relatives_search");
      raw.raw_findings.relatives = r;
    }).catch(e => raw.errors.push({ method: "relatives_search", error: e.message })));

    // Business records
    const bizName = company || (raw.owner_name && /LLC|Inc|Corp|LLP|Ltd/i.test(raw.owner_name) ? raw.owner_name : "");
    if (bizName) {
      corePasses.push(invokeLLM({
        model: SEARCH_MODEL, add_context_from_internet: true,
        prompt: `Search business records for "${bizName}"${property_address ? ` at "${property_address}"` : ""}. Check BBB, state corporate filings (Secretary of State), business licenses, company websites, LinkedIn company pages. Find: registered agent name + contact, owners/principals, business phone/email/address, BBB rating, website.`,
        response_json_schema: {
          type: "object",
          properties: {
            business_name: { type: "string" }, owners: { type: "array", items: { type: "string" } },
            registered_agent: { type: "string" }, phone: { type: "string" }, email: { type: "string" },
            address: { type: "string" }, bbb_rating: { type: "string" }, website: { type: "string" }, confidence: { type: "number" },
          },
        },
      }).then(r => {
        if (r?.phone) raw.phone_numbers.push({ number: r.phone, type: "business", confidence: r.confidence || 65, source: "business_records" });
        if (r?.email) raw.emails.push({ email: r.email, confidence: r.confidence || 65, source: "business_records", verified: false });
        if (r?.address) raw.addresses.push({ address: r.address, type: "business", confidence: r.confidence || 60, source: "business_records" });
        if (r?.website) raw.social_profiles.push({ platform: "website", url: r.website, bio: r.business_name || "", confidence: 80 });
        if (r?.registered_agent) raw.relatives.push({ name: r.registered_agent, relationship: "registered_agent", confidence: 70 });
        (r?.owners || []).forEach((o: string) => raw.relatives.push({ name: o, relationship: "business_owner", confidence: 70 }));
        raw.sources.push("bbb", "state_filings", "business_license", "corporate_registry");
        raw.methods.push("business_records_search");
        raw.raw_findings.business = r;
      }).catch(e => raw.errors.push({ method: "business_records", error: e.message })));
    }

    await Promise.all(corePasses);

    // ============ PHASE 3 + 4: ALL 21 DEEP CATEGORIES (parallel batches of 6) ============
    const deepCategories = [
      ...SKIP_TRACE_DEEP_CATALOG,
      ...HEIR_SEARCH_CATALOG.filter(c => [
        "unclaimed_property", "cemetery_mortuary", "immigration_naturalization",
        "patent_trademark_whois", "international_genealogy", "missing_persons",
        "professional_associations", "darkweb_breach",
        "ucc_sec_litigation", "fec_lobbyist", "username_correlation",
        "domain_web_archive", "contact_verification", "crypto_assets",
        "deed_chain_title", "permits_regulatory", "social_graph", "business_network",
      ].includes(c.id)),
    ];

    const buildDeepPrompt = (cat: any, ctx: string) => {
      const sourcesList = cat.sources.join(", ");
      const base = `Search ${cat.name} for ${ctx}. Sources: ${sourcesList}. ${cat.description}. `;
      switch (cat.id) {
        case "death_confirmation_st":
          return base + `If deceased, note death date + last residence. If living, confirm no death record found.`;
        case "voter_records":
          return base + `Find registered address, party affiliation, registration date.`;
        case "court_records":
          return base + `Find criminal/civil/bankruptcy/divorce filings. Court filings often show current address + sometimes phone/email.`;
        case "professional_licenses":
          return base + `Find any professional licenses (attorney, doctor, real estate, contractor, CPA). License records show business address + sometimes phone.`;
        case "vehicle_dmv":
          return base + `Find vehicle/boat/aircraft registrations. These show registered address.`;
        case "military_records":
          return base + `Find VA records, National Archives service records, military burial records, VA home loan records. Can show address + next of kin.`;
        case "tax_financial":
          return base + `Find property tax records, tax liens, SEC EDGAR filings, D&B, corporate filings. Show address + financial connections.`;
        case "government_registries":
          return base + `Check FAA pilot registry, FINRA BrokerCheck, inmate locators, sex offender registry, hunting/fishing licenses, building permits.`;
        case "church_religious":
          return base + `Find parish records, congregation membership, religious directories. Show address + family connections.`;
        case "school_alumni":
          return base + `Find university alumni directories, high school yearbooks, Classmates.com, alumni associations. Show current city/state + contact.`;
        case "newspaper_archives":
          return base + `Find newspaper mentions: legal notices, marriage/birth announcements, business news, obituaries, court notices. Reveal address, relatives, contact.`;
        case "unclaimed_property":
          return base + `Find state unclaimed property, MissingMoney.com, NAUPA, FDIC, SEC, PBGC, HUD unclaimed assets. Show address + SSN hints.`;
        case "cemetery_mortuary":
          return base + `Find cemetery transcriptions, funeral home archives, coroner records, cremation records, veterans cemetery records.`;
        case "immigration_naturalization":
          return base + `Find passport applications, naturalization certificates, alien registration (A-Files), ship manifests, Ellis Island, border crossings.`;
        case "patent_trademark_whois":
          return base + `Find USPTO patents/trademarks (inventor/assignee), WHOIS domain registrations, copyright registrations. Reveal name + address.`;
        case "international_genealogy":
          return base + `Find country-specific vital records: UK GRO, Canada, Australia, Ireland, Scotland, Germany, Italy, Poland, Mexico, JewishGen.`;
        case "missing_persons":
          return base + `Check NamUs, NCMEC, Doe Network, unclaimed persons, state medical examiner unclaimed, FBI most wanted (disqualifier).`;
        case "professional_associations":
          return base + `Find ABA, AMA, engineering societies, realtor associations, trade unions, guild records, fraternal organizations (Masons, Elks).`;
        case "darkweb_breach":
          return base + `Verify emails via HaveIBeenPwned, DeHashed, breach compilations (verification only), Pastebin archives, data broker opt-out registries.`;
        case "ucc_sec_litigation":
          return base + `Find UCC filings (state SOS), SEC enforcement, FTC complaints, OSHA inspections, EPA violations (ECHO), CFPB complaints, IRS Form 990, FEC reports.`;
        case "fec_lobbyist":
          return base + `Find FEC individual contributions, OpenSecrets, Lobbying Disclosure Act (LD-2), Congressional lobbying, state lobbying, FARA. Reveal employer + address.`;
        case "username_correlation":
          return base + `Find Xbox/Steam/PSN profiles, Reddit history, Stack Overflow/GitHub, forum accounts, dating/classified ads, review site profiles, blog authorship.`;
        case "domain_web_archive":
          return base + `Find DomainTools WHOIS history, Wayback Machine, WHOISXML API, cached Google pages, Archive.today, DNS history. Reveal past addresses + contacts.`;
        case "contact_verification":
          return base + `Verify email via SMTP RCPT, deliverability (Kickbox/ZeroBounce), phone port history (NPAC/LNP), carrier ID (Twilio Lookup), line type, catch-all, disposable detection.`;
        case "crypto_assets":
          return base + `Find Bitcoin/Ethereum wallet analysis (Blockchain.com, Etherscan, BSCScan), ENS domain ownership, NFT profiles (OpenSea), blockchain transactions.`;
        case "deed_chain_title":
          return base + `Find county recorder deed history, title chain-of-title, quitclaim deeds, mortgage satisfactions, lien releases. Show all past owners + addresses.`;
        case "permits_regulatory":
          return base + `Find concealed carry permits, DEA registrations, FCC licenses, code violations, utility connections, building permits, zoning violations, health inspections.`;
        case "social_graph":
          return base + `Map connections: social media graph, business affiliation (D&B linkage), co-ownership network, associate cross-referencing, court co-defendant network, property co-owner network.`;
        case "business_network":
          return base + `Find ALL business entities: SOS officer/director roles, registered agent listings, DBA/fictitious names, corporate subsidiaries, LLC members, partnerships, business licenses, D&B linkage.`;
        default:
          return base;
      }
    };

    const buildSchema = (cat: any) => {
      const baseProps: any = { confidence: { type: "number" } };
      switch (cat.id) {
        case "death_confirmation_st":
          return { type: "object", properties: { is_deceased: { type: "boolean" }, death_date: { type: "string" }, last_residence: { type: "string" }, confidence: { type: "number" } } };
        case "voter_records":
          return { type: "object", properties: { registered_address: { type: "string" }, party: { type: "string" }, registration_date: { type: "string" }, confidence: { type: "number" } } };
        case "court_records":
          return { type: "object", properties: { cases: { type: "array", items: { type: "object", properties: { case_type: { type: "string" }, court: { type: "string" }, date: { type: "string" }, address_listed: { type: "string" } } } }, address_from_court: { type: "string" }, confidence: { type: "number" } } };
        case "professional_licenses":
          return { type: "object", properties: { licenses: { type: "array", items: { type: "object", properties: { type: { type: "string" }, license_number: { type: "string" }, business_address: { type: "string" }, phone: { type: "string" } } } }, confidence: { type: "number" } } };
        case "vehicle_dmv":
          return { type: "object", properties: { vehicles: { type: "array", items: { type: "object", properties: { type: { type: "string" }, registered_address: { type: "string" } } } }, confidence: { type: "number" } } };
        case "military_records":
          return { type: "object", properties: { military_service: { type: "string" }, va_address: { type: "string" }, next_of_kin: { type: "string" }, confidence: { type: "number" } } };
        case "tax_financial":
          return { type: "object", properties: { tax_liens: { type: "array", items: { type: "string" } }, sec_filings: { type: "array", items: { type: "string" } }, corporate_filings: { type: "array", items: { type: "object", properties: { business_name: { type: "string" }, registered_address: { type: "string" } } } }, address_from_tax: { type: "string" }, confidence: { type: "number" } } };
        case "government_registries":
          return { type: "object", properties: { records: { type: "array", items: { type: "object", properties: { type: { type: "string" }, address: { type: "string" }, details: { type: "string" } } } }, confidence: { type: "number" } } };
        case "church_religious":
          return { type: "object", properties: { church_affiliations: { type: "array", items: { type: "object", properties: { church: { type: "string" }, address: { type: "string" } } } }, confidence: { type: "number" } } };
        case "school_alumni":
          return { type: "object", properties: { alumni_records: { type: "array", items: { type: "object", properties: { school: { type: "string" }, year: { type: "string" }, current_location: { type: "string" } } } }, confidence: { type: "number" } } };
        case "newspaper_archives":
          return { type: "object", properties: { mentions: { type: "array", items: { type: "object", properties: { date: { type: "string" }, headline: { type: "string" }, address_mentioned: { type: "string" }, relatives_mentioned: { type: "array", items: { type: "string" } } } } }, confidence: { type: "number" } } };
        case "unclaimed_property":
          return { type: "object", properties: { claims: { type: "array", items: { type: "object", properties: { holder: { type: "string" }, amount: { type: "string" }, address: { type: "string" } } } }, confidence: { type: "number" } } };
        case "cemetery_mortuary":
          return { type: "object", properties: { records: { type: "array", items: { type: "object", properties: { cemetery: { type: "string" }, burial_date: { type: "string" }, address: { type: "string" } } } }, confidence: { type: "number" } } };
        case "immigration_naturalization":
          return { type: "object", properties: { records: { type: "array", items: { type: "object", properties: { type: { type: "string" }, date: { type: "string" }, address: { type: "string" }, port_of_entry: { type: "string" } } } }, confidence: { type: "number" } } };
        case "patent_trademark_whois":
          return { type: "object", properties: { filings: { type: "array", items: { type: "object", properties: { type: { type: "string" }, title: { type: "string" }, address: { type: "string" }, date: { type: "string" } } } }, confidence: { type: "number" } } };
        case "international_genealogy":
          return { type: "object", properties: { records: { type: "array", items: { type: "object", properties: { country: { type: "string" }, record_type: { type: "string" }, address: { type: "string" }, date: { type: "string" } } } }, confidence: { type: "number" } } };
        case "missing_persons":
          return { type: "object", properties: { matches: { type: "array", items: { type: "object", properties: { database: { type: "string" }, status: { type: "string" }, details: { type: "string" } } } }, confidence: { type: "number" } } };
        case "professional_associations":
          return { type: "object", properties: { memberships: { type: "array", items: { type: "object", properties: { organization: { type: "string" }, role: { type: "string" }, address: { type: "string" } } } }, confidence: { type: "number" } } };
        case "darkweb_breach":
          return { type: "object", properties: { verified_emails: { type: "array", items: { type: "string" } }, breach_count: { type: "number" }, confidence: { type: "number" } } };
        case "ucc_sec_litigation":
          return { type: "object", properties: { filings: { type: "array", items: { type: "object", properties: { type: { type: "string" }, details: { type: "string" }, address: { type: "string" } } } }, confidence: { type: "number" } } };
        case "fec_lobbyist":
          return { type: "object", properties: { contributions: { type: "array", items: { type: "object", properties: { recipient: { type: "string" }, amount: { type: "string" }, date: { type: "string" }, employer: { type: "string" }, address: { type: "string" } } } }, confidence: { type: "number" } } };
        case "username_correlation":
          return { type: "object", properties: { profiles: { type: "array", items: { type: "object", properties: { platform: { type: "string" }, username: { type: "string" }, url: { type: "string" }, address: { type: "string" } } } }, confidence: { type: "number" } } };
        case "domain_web_archive":
          return { type: "object", properties: { domains: { type: "array", items: { type: "object", properties: { domain: { type: "string" }, registrant: { type: "string" }, address: { type: "string" }, date: { type: "string" } } } }, confidence: { type: "number" } } };
        case "contact_verification":
          return { type: "object", properties: { email_valid: { type: "array", items: { type: "string" } }, phone_carriers: { type: "array", items: { type: "object", properties: { number: { type: "string" }, carrier: { type: "string" }, line_type: { type: "string" } } } }, confidence: { type: "number" } } };
        case "crypto_assets":
          return { type: "object", properties: { wallets: { type: "array", items: { type: "object", properties: { chain: { type: "string" }, address: { type: "string" }, balance: { type: "string" } } } }, confidence: { type: "number" } } };
        case "deed_chain_title":
          return { type: "object", properties: { transfers: { type: "array", items: { type: "object", properties: { date: { type: "string" }, grantor: { type: "string" }, grantee: { type: "string" }, address: { type: "string" } } } }, confidence: { type: "number" } } };
        case "permits_regulatory":
          return { type: "object", properties: { permits: { type: "array", items: { type: "object", properties: { type: { type: "string" }, address: { type: "string" }, date: { type: "string" } } } }, confidence: { type: "number" } } };
        case "social_graph":
          return { type: "object", properties: { connections: { type: "array", items: { type: "object", properties: { name: { type: "string" }, relationship: { type: "string" }, strength: { type: "string" } } } }, confidence: { type: "number" } } };
        case "business_network":
          return { type: "object", properties: { businesses: { type: "array", items: { type: "object", properties: { name: { type: "string" }, role: { type: "string" }, address: { type: "string" } } } }, confidence: { type: "number" } } };
        default:
          return { type: "object", properties: baseProps };
      }
    };

    const runDeepCategory = async (cat: any) => {
      try {
        const r: any = await invokeLLM({
          model: SEARCH_MODEL, add_context_from_internet: true,
          prompt: buildDeepPrompt(cat, ctx),
          response_json_schema: buildSchema(cat),
        });
        raw.raw_findings[cat.id] = r;
        raw.sources.push(...cat.sources.map((s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_")));
        raw.methods.push(`${cat.id}_search`);

        // Extract addresses/phones/emails/relatives from category results
        const extractFromResult = (r: any, cat: any) => {
          const find = (obj: any, keys: string[]) => {
            for (const k of keys) {
              if (obj[k] && typeof obj[k] === "string") return obj[k];
              if (Array.isArray(obj[k])) {
                for (const item of obj[k]) {
                  if (typeof item === "object") {
                    for (const ik of ["address", "registered_address", "business_address", "address_from_court", "address_from_tax", "address_mentioned", "current_location", "mailing_address", "va_address"]) {
                      if (item[ik]) return item[ik];
                    }
                  }
                }
              }
            }
            return null;
          };
          const addr = find(r, ["registered_address", "address_from_court", "address_from_tax", "va_address", "current_address"]);
          if (addr) raw.addresses.push({ address: addr, type: cat.id, confidence: r.confidence || 60, source: cat.id });

          // Phones
          if (r.licenses) (r.licenses as any[]).forEach((l: any) => { if (l.phone) raw.phone_numbers.push({ number: l.phone, type: "business", confidence: 70, source: cat.id }); });
          if (r.phone_carriers) (r.phone_carriers as any[]).forEach((p: any) => { raw.phone_numbers.push({ number: p.number, type: p.line_type || "unknown", confidence: 75, source: cat.id }); });

          // Emails
          if (r.verified_emails) (r.verified_emails as string[]).forEach((e: string) => raw.emails.push({ email: e, confidence: 80, source: cat.id, verified: true }));

          // Relatives
          if (r.next_of_kin) raw.relatives.push({ name: r.next_of_kin, relationship: "next_of_kin", confidence: 60 });
          if (r.connections) (r.connections as any[]).forEach((c: any) => raw.relatives.push({ name: c.name, relationship: c.relationship || "connection", confidence: 55 }));
          if (r.mentions) (r.mentions as any[]).forEach((m: any) => (m.relatives_mentioned || []).forEach((rel: string) => raw.relatives.push({ name: rel, relationship: "from_newspaper", confidence: 45 })));
          if (r.transfers) (r.transfers as any[]).forEach((t: any) => { if (t.grantor && t.grantor !== searchName) raw.relatives.push({ name: t.grantor, relationship: "prior_owner", confidence: 50 }); });

          // Addresses from arrays
          if (r.records) (r.records as any[]).forEach((rec: any) => { if (rec.address) raw.addresses.push({ address: rec.address, type: cat.id, confidence: 60, source: cat.id }); });
          if (r.cases) (r.cases as any[]).forEach((c: any) => { if (c.address_listed) raw.addresses.push({ address: c.address_listed, type: "court_record", confidence: 65, source: cat.id }); });
          if (r.vehicles) (r.vehicles as any[]).forEach((v: any) => { if (v.registered_address) raw.addresses.push({ address: v.registered_address, type: "vehicle_registration", confidence: 65, source: cat.id }); });
          if (r.corporate_filings) (r.corporate_filings as any[]).forEach((c: any) => { if (c.registered_address) raw.addresses.push({ address: c.registered_address, type: "corporate", confidence: 60, source: cat.id }); });
          if (r.church_affiliations) (r.church_affiliations as any[]).forEach((c: any) => { if (c.address) raw.addresses.push({ address: c.address, type: "church", confidence: 50, source: cat.id }); });
          if (r.alumni_records) (r.alumni_records as any[]).forEach((a: any) => { if (a.current_location) raw.addresses.push({ address: a.current_location, type: "alumni", confidence: 50, source: cat.id }); });
          if (r.mentions) (r.mentions as any[]).forEach((m: any) => { if (m.address_mentioned) raw.addresses.push({ address: m.address_mentioned, type: "newspaper", confidence: 45, source: cat.id }); });
          if (r.claims) (r.claims as any[]).forEach((c: any) => { if (c.address) raw.addresses.push({ address: c.address, type: "unclaimed_property", confidence: 55, source: cat.id }); });
          if (r.records) (r.records as any[]).forEach((rec: any) => { if (rec.address) raw.addresses.push({ address: rec.address, type: cat.id, confidence: 55, source: cat.id }); });
          if (r.filings) (r.filings as any[]).forEach((f: any) => { if (f.address) raw.addresses.push({ address: f.address, type: cat.id, confidence: 55, source: cat.id }); });
          if (r.contributions) (r.contributions as any[]).forEach((c: any) => { if (c.address) raw.addresses.push({ address: c.address, type: "fec_donation", confidence: 60, source: cat.id }); });
          if (r.profiles) (r.profiles as any[]).forEach((p: any) => { if (p.url) raw.social_profiles.push({ platform: p.platform || cat.id, url: p.url, bio: p.username || "", confidence: 55 }); if (p.address) raw.addresses.push({ address: p.address, type: cat.id, confidence: 50, source: cat.id }); });
          if (r.domains) (r.domains as any[]).forEach((d: any) => { if (d.address) raw.addresses.push({ address: d.address, type: "whois_history", confidence: 50, source: cat.id }); });
          if (r.permits) (r.permits as any[]).forEach((p: any) => { if (p.address) raw.addresses.push({ address: p.address, type: "permit", confidence: 55, source: cat.id }); });
          if (r.businesses) (r.businesses as any[]).forEach((b: any) => { if (b.address) raw.addresses.push({ address: b.address, type: "business_network", confidence: 60, source: cat.id }); if (b.name && b.name !== searchName) raw.relatives.push({ name: b.name, relationship: b.role || "business_affiliate", confidence: 55 }); });
          if (r.memberships) (r.memberships as any[]).forEach((m: any) => { if (m.address) raw.addresses.push({ address: m.address, type: "professional_association", confidence: 50, source: cat.id }); });
          if (r.wallets) (r.wallets as any[]).forEach((w: any) => { raw.social_profiles.push({ platform: `crypto_${w.chain}`, url: w.address, bio: `Balance: ${w.balance || "unknown"}`, confidence: 60 }); });
        };
        extractFromResult(r, cat);
      } catch (e: any) {
        raw.errors.push({ method: cat.id, error: e.message });
      }
    };

    // Run deep categories in batches of 6 (parallel within batch, sequential across batches)
    for (let i = 0; i < deepCategories.length; i += 6) {
      const batch = deepCategories.slice(i, i + 6);
      await Promise.all(batch.map(runDeepCategory));
    }

    // ============ PHASE 5: NORMALIZATION + DEDUP + CORRELATION ============
    const normalized = normalizeAllResults(raw);

    // ============ PHASE 6: AI CROSS-CORRELATION ENRICHMENT ============
    let enrichment: any = null;
    try {
      enrichment = await invokeLLM({
        model: SUMMARY_MODEL, add_context_from_internet: false,
        prompt: `You are a forensic skip-trace analyst. Cross-correlate these findings for ${ctx} and build a unified profile.

FINDINGS (normalized):
- Phones: ${JSON.stringify(normalized.phone_numbers.slice(0, 10))}
- Emails: ${JSON.stringify(normalized.emails.slice(0, 10))}
- Addresses: ${JSON.stringify(normalized.addresses.slice(0, 10))}
- Social: ${JSON.stringify(normalized.social_profiles.slice(0, 10))}
- Relatives: ${JSON.stringify(normalized.relatives.slice(0, 15))}

Produce:
1. unified_profile: best-guess current name, age, primary phone, primary email, primary address
2. identity_confidence: 0-100 based on cross-source verification
3. risk_flags: any concerning patterns (deceased, incarcerated, fraud, etc.)
4. contact_strategy: ranked best-to-contact methods (phone > email > mail > social > relative)
5. network_summary: key relationships and how they connect`,
        response_json_schema: {
          type: "object",
          properties: {
            unified_profile: {
              type: "object",
              properties: {
                full_name: { type: "string" }, age: { type: "number" },
                primary_phone: { type: "string" }, primary_email: { type: "string" },
                primary_address: { type: "string" },
              },
            },
            identity_confidence: { type: "number" },
            risk_flags: { type: "array", items: { type: "string" } },
            contact_strategy: { type: "array", items: { type: "object", properties: { method: { type: "string" }, value: { type: "string" }, priority: { type: "number" } } } },
            network_summary: { type: "string" },
          },
        },
      });
    } catch (e: any) {
      raw.errors.push({ method: "enrichment", error: e.message });
    }

    // ============ PHASE 7: EXECUTIVE SUMMARY + FULL REPORT ============
    let executiveSummary = "";
    let fullReport: any = null;
    if (generate_report) {
      try {
        const summaryInput = {
          target: ctx,
          owner_name: normalized.owner_name,
          phones_found: normalized.phone_numbers.length,
          emails_found: normalized.emails.length,
          addresses_found: normalized.addresses.length,
          social_found: normalized.social_profiles.length,
          relatives_found: normalized.relatives.length,
          sources_attempted_count: normalized.sources.length,
          methods_attempted_count: normalized.methods.length,
          top_phones: normalized.phone_numbers.slice(0, 5),
          top_emails: normalized.emails.slice(0, 5),
          top_addresses: normalized.addresses.slice(0, 5),
          enrichment,
        };
        const reportRes: any = await invokeLLM({
          model: SUMMARY_MODEL, add_context_from_internet: false,
          prompt: `You are a careful research assistant. The supplied data consists of unverified candidate leads generated from search prompts; it does not prove that any listed website or database was actually queried.

${JSON.stringify(summaryInput, null, 2)}

Rules:
- Never claim a source was searched, queried, or confirmed unless the input includes a source URL and verifiable evidence record for that specific finding.
- Do not invent citations, source URLs, identity matches, contact verification, or legal conclusions.
- Describe all supplied contact and identity data as unverified candidate leads requiring human review.
- Do not imply cross-source verification merely because multiple candidate fields exist.
- If no verifiable evidence is supplied, state that no source-backed finding has been established.

Produce:
1. executive_summary: concise summary of candidate leads and explicit verification limitations
2. key_findings: candidate leads only, clearly labeled unverified
3. evidence_chain: list only evidence actually supplied; otherwise state that no verifiable evidence records were supplied
4. recommended_actions: lawful, consent-respecting next steps to verify relevant public-record facts
5. data_quality_assessment: missing evidence, conflicts, and verification gaps`,
          response_json_schema: {
            type: "object",
            properties: {
              executive_summary: { type: "string" },
              key_findings: { type: "array", items: { type: "string" } },
              evidence_chain: { type: "array", items: { type: "string" } },
              recommended_actions: { type: "array", items: { type: "string" } },
              data_quality_assessment: { type: "string" },
            },
          },
        });
        executiveSummary = reportRes?.executive_summary || "";
        fullReport = reportRes;
      } catch (e: any) {
        raw.errors.push({ method: "report_generation", error: e.message });
      }
    }

    // ============ EVIDENCE-GATED STATUS ============
    // Prompted source categories are attempts, not proof that a source was queried.
    // Keep model-derived scores as candidate-ranking metadata only until a source
    // adapter supplies verifiable evidence records for specific findings.
    const phoneConf = normalized.phone_numbers.length > 0 ? Math.max(...normalized.phone_numbers.map((p: any) => p.confidence || 0)) : 0;
    const emailConf = normalized.emails.length > 0 ? Math.max(...normalized.emails.map((e: any) => e.confidence || 0)) : 0;
    const addrConf = normalized.addresses.length > 0 ? Math.max(...normalized.addresses.map((a: any) => a.confidence || 0)) : 0;
    const socialConf = normalized.social_profiles.length > 0 ? Math.max(...normalized.social_profiles.map((s: any) => s.confidence || 0)) : 0;
    const candidateConfidence = Math.round(
      phoneConf * 0.30 + emailConf * 0.20 + addrConf * 0.20 + socialConf * 0.10 +
      (normalized.owner_name ? 10 : 0)
    );
    const hasCandidateData = Boolean(normalized.owner_name) || normalized.phone_numbers.length > 0 ||
      normalized.emails.length > 0 || normalized.addresses.length > 0 ||
      normalized.social_profiles.length > 0 || normalized.relatives.length > 0;
    const evidenceRecords = (Array.isArray(raw.evidence_records) ? raw.evidence_records : []).filter((record: any) =>
      record?.status === "verified" &&
      typeof record?.source_url === "string" &&
      /^https?:\/\//i.test(record.source_url) &&
      typeof record?.finding_id === "string" && record.finding_id.trim() &&
      typeof record?.retrieved_at === "string" && Number.isFinite(Date.parse(record.retrieved_at)) &&
      typeof record?.content_hash === "string" && /^[a-f0-9]{64}$/i.test(record.content_hash)
    );
    const hasVerifiedEvidence = evidenceRecords.length > 0;
    const status = hasVerifiedEvidence && candidateConfidence >= 70 ? "found" : hasCandidateData ? "partial" : "failed";
    const verificationStatus = hasVerifiedEvidence ? "verified" : hasCandidateData ? "needs_review" : "no_verified_results";
    const duration = Date.now() - startTime;

    // ============ PERSIST ============
    await base44.entities.SkipTrace.update(skipTrace.id, {
      status,
      found_owner_name: normalized.owner_name,
      found_phone_numbers: normalized.phone_numbers,
      found_emails: normalized.emails,
      found_addresses: normalized.addresses,
      found_social_profiles: normalized.social_profiles,
      found_relatives: normalized.relatives,
      // Do not populate sources_checked from prompted categories; those are only attempts.
      sources_checked: [],
      methods_used: normalized.methods,
      confidence_score: hasVerifiedEvidence ? Math.min(99, candidateConfidence) : 0,
      search_results: {
        raw_findings: raw.raw_findings,
        sources_attempted: normalized.sources,
        sources_checked: [],
        evidence_records: evidenceRecords,
        evidence_verified: hasVerifiedEvidence,
        verification_status: verificationStatus,
        candidate_confidence_score: candidateConfidence,
        enrichment,
        executive_summary: executiveSummary,
        full_report: fullReport,
        errors: raw.errors,
        stats: {
          sources_attempted_count: normalized.sources.length,
          methods_attempted_count: normalized.methods.length,
          phones_found: normalized.phone_numbers.length,
          emails_found: normalized.emails.length,
          addresses_found: normalized.addresses.length,
          social_found: normalized.social_profiles.length,
          relatives_found: normalized.relatives.length,
        },
      },
      search_duration_ms: duration,
    });

    // ============ OPTIONAL SHEET EXPORT ============
    let sheetExport: any = null;
    if (spreadsheet_url && hasVerifiedEvidence) {
      try {
        const exportRes: any = await base44.functions.invoke("exportSkipTraceToSheet", {
          spreadsheet_url,
          target_property_address: property_address || "",
          target_owner_name: owner_name || "",
          status, found_owner_name: normalized.owner_name,
          confidence_score: candidateConfidence,
          phone_numbers: normalized.phone_numbers, emails: normalized.emails,
          addresses: normalized.addresses, social_profiles: normalized.social_profiles,
          relatives: normalized.relatives,
          sources_checked: [],
          methods_used: normalized.methods,
          search_duration_ms: duration,
        });
        sheetExport = exportRes?.data || exportRes;
      } catch (e: any) { raw.errors.push({ method: "google_sheets_export", error: e.message }); }
    }

    return Response.json({
      ok: true,
      skip_trace_id: skipTrace.id,
      status,
      confidence_score: hasVerifiedEvidence ? Math.min(99, candidateConfidence) : 0,
      candidate_confidence_score: candidateConfidence,
      evidence_verified: hasVerifiedEvidence,
      verification_status: verificationStatus,
      candidate_data_unverified: !hasVerifiedEvidence && hasCandidateData,
      found_owner_name: normalized.owner_name,
      phone_numbers: normalized.phone_numbers,
      emails: normalized.emails,
      addresses: normalized.addresses,
      social_profiles: normalized.social_profiles,
      relatives: normalized.relatives,
      sources: [],
      sources_attempted: normalized.sources,
      methods: normalized.methods,
      enrichment,
      executive_summary: executiveSummary,
      full_report: fullReport,
      stats: {
        sources_count: normalized.sources.length,
        methods_count: normalized.methods.length,
        phones_found: normalized.phone_numbers.length,
        emails_found: normalized.emails.length,
        addresses_found: normalized.addresses.length,
        social_found: normalized.social_profiles.length,
        relatives_found: normalized.relatives.length,
      },
      duration_ms: duration,
      sheet_export: sheetExport || undefined,
      errors: raw.errors.length > 0 ? raw.errors : undefined,
    });
  } catch (error: any) {
    console.error("runMaxSkipTrace error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}