import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { invokeLLM, setGatewayFallback } from '../../shared/vercelAiGateway.ts';
import { SKIP_TRACE_DEEP_CATALOG } from '../../shared/searchSourceCatalog.ts';

/**
 * Skip Trace Engine — Multi-Method Owner & Contact Discovery
 *
 * STANDARD MODE (7 methods):
 *   1. Property Records Search (county assessor, tax records, deeds)
 *   2. Reverse Phone Lookup (if no name but phone provided)
 *   3. People Search (whitepages, directories, public records)
 *   4. Social Media Deep Search (Facebook, LinkedIn, Twitter, Instagram, etc.)
 *   5. Email Search (email directories, patterns, verification)
 *   6. Relatives & Associates Search (family members, business partners)
 *   7. Business Records Search (BBB, state filings, corporate registries)
 *
 * DEEP MODE adds 11 more methods (8-18):
 *   8. Death Confirmation (SSDI, obituaries — is the target deceased?)
 *   9. Voter Registration Records (address, party affiliation)
 *  10. Court Records (criminal, civil, bankruptcy, divorce)
 *  11. Professional Licenses (bar, medical, real estate, contractor)
 *  12. Vehicle & DMV Records (registrations, driver records)
 *  13. Military Records (VA, National Archives, DD214)
 *  14. Tax & Financial (tax liens, SEC EDGAR, D&B, corporate filings)
 *  15. Government Registries (FAA, FINRA, inmate, sex offender, hunting/fishing)
 *  16. Church & Religious Records (parish, congregation)
 *  17. School & Alumni Records (university directories, yearbooks)
 *  18. Newspaper Archives (historical mentions, legal notices, announcements)
 */

const SEARCH_MODEL = "gemini_3_flash";

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    setGatewayFallback(base44); // enable Base44 Core InvokeLLM fallback when Vercel gateway is exhausted
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { property_address, owner_name, phone, email, company, batch_id, deep_search, spreadsheet_url } = body;
    const deep = deep_search === true;

    if (!property_address && !owner_name && !phone && !email) {
      return Response.json(
        { error: "At least one search input is required (address, name, phone, or email)" },
        { status: 400 }
      );
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
      found_phone_numbers: [],
      found_emails: [],
      found_addresses: [],
      found_social_profiles: [],
      found_relatives: [],
      sources_checked: [],
      methods_used: [],
      search_results: {},
    });

    const startTime = Date.now();
    const results: any = {
      phone_numbers: [],
      emails: [],
      addresses: [],
      social_profiles: [],
      relatives: [],
      owner_name: owner_name || "",
      sources: [] as string[],
      methods: [] as string[],
      errors: [] as any[],
      evidence_records: [] as any[],
    };

    // === METHOD 1: Property Records Search ===
    if (property_address) {
      try {
        const propRes: any = await invokeLLM({
          model: SEARCH_MODEL,
          add_context_from_internet: true,
          prompt: `You are an expert skip tracer. Search public property records for this property address: "${property_address}".

Find from county assessor, property appraiser, tax records, and deed records:
- Current owner's full name
- Owner's mailing address (may differ from property address)
- Purchase date and price
- Property value and lot size
- Any co-owners or LLC names

Return ONLY data found in actual public records. If you cannot find records for this exact address, say so.`,
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
          results.owner_name = propRes.owner_name;
          results.addresses.push({
            address: propRes.mailing_address || property_address,
            type: "mailing",
            confidence: propRes.confidence || 75,
            source: "property_records",
          });
          if (propRes.co_owners) {
            propRes.co_owners.forEach((co: string) =>
              results.relatives.push({ name: co, relationship: "co-owner", phone: "" })
            );
          }
        }
        results.sources.push("county_assessor", "property_appraiser", "tax_records", "deed_records");
        results.methods.push("property_records_search");
        results.property_data = propRes;
      } catch (err: any) {
        results.errors.push({ method: "property_records", error: err.message });
      }
    }

    let searchName = results.owner_name || owner_name || "";

    // === METHOD 2: Reverse Phone Lookup (if no name yet but phone provided) ===
    if (!searchName && (phone || results.phone_numbers.length > 0)) {
      const phoneToSearch = phone || results.phone_numbers[0]?.number;
      if (phoneToSearch) {
        try {
          const phoneRes: any = await invokeLLM({
            model: SEARCH_MODEL,
            add_context_from_internet: true,
            prompt: `You are a skip tracing specialist. Perform a reverse phone lookup for: "${phoneToSearch}".

Search reverse phone directories, caller ID databases, and public records to find:
- The subscriber's name
- Their address
- Carrier information
- Line type (mobile, landline, VoIP)`,
            response_json_schema: {
              type: "object",
              properties: {
                owner_name: { type: "string" },
                address: { type: "string" },
                carrier: { type: "string" },
                line_type: { type: "string" },
                confidence: { type: "number" },
              },
            },
          });

          if (phoneRes?.owner_name) {
            searchName = phoneRes.owner_name;
            results.owner_name = phoneRes.owner_name;
          }
          if (phoneRes?.address) {
            results.addresses.push({
              address: phoneRes.address,
              type: "phone_lookup",
              confidence: phoneRes.confidence || 60,
              source: "reverse_phone",
            });
          }
          results.sources.push("reverse_phone_directory", "caller_id");
          results.methods.push("reverse_phone_lookup");
          results.phone_lookup = phoneRes;
        } catch (err: any) {
          results.errors.push({ method: "reverse_phone_lookup", error: err.message });
        }
      }
    }

    // === METHOD 3: People Search ===
    if (searchName) {
      try {
        const peopleRes: any = await invokeLLM({
          model: SEARCH_MODEL,
          add_context_from_internet: true,
          prompt: `You are a skip tracing specialist. Find ALL contact information for "${searchName}"${property_address ? ` associated with address: "${property_address}"` : ""}.

Search people search engines (Whitepages, Spokeo, BeenVerified, TruePeopleSearch, FastPeopleSearch, 411.com), public directories, and aggregator sites.

Find:
- All phone numbers (mobile, landline, VoIP)
- All email addresses
- Current address and previous addresses
- Age or date of birth
- Known relatives and associates

Return ONLY data that appears in public directories or people search results. Include the source for each piece of data.`,
          response_json_schema: {
            type: "object",
            properties: {
              phone_numbers: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    number: { type: "string" },
                    type: { type: "string" },
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
                    verified: { type: "boolean" },
                  },
                },
              },
              current_address: { type: "string" },
              previous_addresses: { type: "array", items: { type: "string" } },
              relatives: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    relationship: { type: "string" },
                    phone: { type: "string" },
                  },
                },
              },
              age: { type: "number" },
              overall_confidence: { type: "number" },
            },
          },
        });

        if (peopleRes?.phone_numbers) results.phone_numbers.push(...peopleRes.phone_numbers);
        if (peopleRes?.emails) results.emails.push(...peopleRes.emails);
        if (peopleRes?.current_address)
          results.addresses.push({
            address: peopleRes.current_address,
            type: "current",
            confidence: peopleRes.overall_confidence || 70,
            source: "people_search",
          });
        if (peopleRes?.previous_addresses)
          peopleRes.previous_addresses.forEach((a: string) =>
            results.addresses.push({ address: a, type: "previous", confidence: 50, source: "people_search" })
          );
        if (peopleRes?.relatives) results.relatives.push(...peopleRes.relatives);
        results.sources.push("whitepages", "people_search", "public_directories", "truepeoplesearch", "fastpeoplesearch");
        results.methods.push("people_search");
        results.people_data = peopleRes;
      } catch (err: any) {
        results.errors.push({ method: "people_search", error: err.message });
      }
    }

    // === METHOD 4: Social Media Deep Search ===
    if (searchName) {
      try {
        const socialRes: any = await invokeLLM({
          model: SEARCH_MODEL,
          add_context_from_internet: true,
          prompt: `Search for "${searchName}"${property_address ? ` in ${property_address}` : ""} on ALL social media platforms.

Check Facebook, LinkedIn, Twitter/X, Instagram, TikTok, YouTube, Pinterest, and any other platforms.

For each profile found:
- The full profile URL
- Their bio/description
- Any visible contact info (phone, email in bio)
- Follower count if visible
- How confident you are this is the right person

Also look for any additional emails or phone numbers visible on their profiles.`,
          response_json_schema: {
            type: "object",
            properties: {
              profiles: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    platform: { type: "string" },
                    url: { type: "string" },
                    bio: { type: "string" },
                    followers: { type: "number" },
                    confidence: { type: "number" },
                  },
                },
              },
              additional_emails: { type: "array", items: { type: "string" } },
              additional_phones: { type: "array", items: { type: "string" } },
            },
          },
        });

        if (socialRes?.profiles) results.social_profiles.push(...socialRes.profiles);
        if (socialRes?.additional_emails)
          socialRes.additional_emails.forEach((e: string) =>
            results.emails.push({ email: e, confidence: 60, source: "social_media", verified: false })
          );
        if (socialRes?.additional_phones)
          socialRes.additional_phones.forEach((p: string) =>
            results.phone_numbers.push({ number: p, type: "unknown", confidence: 60, source: "social_media" })
          );
        results.sources.push("facebook", "linkedin", "twitter", "instagram", "tiktok", "youtube");
        results.methods.push("social_media_search");
        results.social_data = socialRes;
      } catch (err: any) {
        results.errors.push({ method: "social_media_search", error: err.message });
      }
    }

    // === METHOD 5: Email Search ===
    if (searchName) {
      try {
        const emailRes: any = await invokeLLM({
          model: SEARCH_MODEL,
          add_context_from_internet: true,
          prompt: `Find ALL email addresses associated with "${searchName}"${property_address ? ` at "${property_address}"` : ""}.

Search:
- Email directories and public records
- Social media profiles (emails visible in bios)
- Company websites (if they own a business)
- Public posts and forums
- Data breach databases (for verification only — confirm the email exists, do NOT expose passwords)

Also generate likely email patterns based on the person's name and common email providers (gmail, outlook, yahoo, icloud).

For each email, rate your confidence and note the source.`,
          response_json_schema: {
            type: "object",
            properties: {
              emails: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    email: { type: "string" },
                    confidence: { type: "number" },
                    source: { type: "string" },
                    verified: { type: "boolean" },
                  },
                },
              },
              patterns: { type: "array", items: { type: "string" } },
            },
          },
        });

        if (emailRes?.emails) results.emails.push(...emailRes.emails);
        results.sources.push("email_directories", "email_patterns", "breach_verification");
        results.methods.push("email_search");
        results.email_data = emailRes;
      } catch (err: any) {
        results.errors.push({ method: "email_search", error: err.message });
      }
    }

    // === METHOD 6: Relatives & Associates Deep Search ===
    if (searchName) {
      try {
        const relRes: any = await invokeLLM({
          model: SEARCH_MODEL,
          add_context_from_internet: true,
          prompt: `Find all known relatives, associates, and business partners of "${searchName}"${property_address ? ` from "${property_address}"` : ""}.

Search public records, family tree sites, business filings, and social media connections.

For each relative/associate found:
- Their full name
- Their relationship (spouse, parent, child, sibling, business partner, etc.)
- Their phone number if publicly available
- Their address if publicly available

These contacts can be used to reach the target person through alternative channels.`,
          response_json_schema: {
            type: "object",
            properties: {
              relatives: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    relationship: { type: "string" },
                    phone: { type: "string" },
                    address: { type: "string" },
                    confidence: { type: "number" },
                  },
                },
              },
            },
          },
        });

        if (relRes?.relatives) {
          relRes.relatives.forEach((r: any) => {
            results.relatives.push({
              name: r.name,
              relationship: r.relationship,
              phone: r.phone || "",
            });
            if (r.phone)
              results.phone_numbers.push({
                number: r.phone,
                type: "relative",
                confidence: r.confidence || 40,
                source: "relative_lookup",
              });
          });
        }
        results.sources.push("family_records", "business_filings", "associate_network");
        results.methods.push("relatives_search");
        results.relatives_data = relRes;
      } catch (err: any) {
        results.errors.push({ method: "relatives_search", error: err.message });
      }
    }

    // === METHOD 7: Business Records Search ===
    const bizName = company || (results.owner_name && /LLC|Inc|Corp|LLP|Ltd/i.test(results.owner_name) ? results.owner_name : "");
    if (bizName) {
      try {
        const bizRes: any = await invokeLLM({
          model: SEARCH_MODEL,
          add_context_from_internet: true,
          prompt: `Search business records for "${bizName}"${property_address ? ` associated with "${property_address}"` : ""}.

Check:
- Better Business Bureau (BBB)
- State corporate filings and Secretary of State records
- Business license databases
- Company websites and contact pages
- LinkedIn company pages

Find:
- Registered agent name and contact
- Business owner/principal names
- Business phone and email
- Business address
- Rating and reviews`,
          response_json_schema: {
            type: "object",
            properties: {
              business_name: { type: "string" },
              owners: { type: "array", items: { type: "string" } },
              registered_agent: { type: "string" },
              phone: { type: "string" },
              email: { type: "string" },
              address: { type: "string" },
              bbb_rating: { type: "string" },
              website: { type: "string" },
              confidence: { type: "number" },
            },
          },
        });

        if (bizRes?.phone)
          results.phone_numbers.push({
            number: bizRes.phone,
            type: "business",
            confidence: bizRes.confidence || 65,
            source: "business_records",
          });
        if (bizRes?.email)
          results.emails.push({
            email: bizRes.email,
            confidence: bizRes.confidence || 65,
            source: "business_records",
            verified: false,
          });
        if (bizRes?.address)
          results.addresses.push({
            address: bizRes.address,
            type: "business",
            confidence: bizRes.confidence || 60,
            source: "business_records",
          });
        if (bizRes?.website)
          results.social_profiles.push({
            platform: "website",
            url: bizRes.website,
            bio: bizRes.business_name || "",
            confidence: 80,
          });
        results.sources.push("bbb", "state_filings", "business_license", "corporate_registry");
        results.methods.push("business_records_search");
        results.business_data = bizRes;
      } catch (err: any) {
        results.errors.push({ method: "business_records", error: err.message });
      }
    }

    // === DEEP SEARCH METHODS (8-18) ===
    if (deep && searchName) {
      const deepCtx = `"${searchName}"${property_address ? ` associated with "${property_address}"` : ""}`;
      const deepPasses: Promise<any>[] = [];

      // Method 8: Death Confirmation
      deepPasses.push(
        invokeLLM({
          model: SEARCH_MODEL, add_context_from_internet: true,
          prompt: `Check if ${deepCtx} is deceased. Search: ${SKIP_TRACE_DEEP_CATALOG.find(c => c.id === "death_confirmation_st")?.sources.join(", ")}. If deceased, note death date and last residence. If living, confirm no death record found.`,
          response_json_schema: { type: "object", properties: { is_deceased: { type: "boolean" }, death_date: { type: "string" }, last_residence: { type: "string" }, confidence: { type: "number" } } },
        }).then(r => { results.death_check = r; results.sources.push("ssdi", "obituaries", "find_a_grave"); results.methods.push("death_confirmation"); })
          .catch(e => results.errors.push({ method: "death_confirmation", error: e.message }))
      );

      // Method 9: Voter Registration
      deepPasses.push(
        invokeLLM({
          model: SEARCH_MODEL, add_context_from_internet: true,
          prompt: `Search voter registration records for ${deepCtx}. Search: ${SKIP_TRACE_DEEP_CATALOG.find(c => c.id === "voter_records")?.sources.join(", ")}. Find registered address, party affiliation, registration date.`,
          response_json_schema: { type: "object", properties: { registered_address: { type: "string" }, party: { type: "string" }, registration_date: { type: "string" }, confidence: { type: "number" } } },
        }).then(r => { if (r?.registered_address) results.addresses.push({ address: r.registered_address, type: "voter", confidence: r.confidence || 70, source: "voter_registration" }); results.sources.push("voter_registration"); results.methods.push("voter_records_search"); })
          .catch(e => results.errors.push({ method: "voter_records", error: e.message }))
      );

      // Method 10: Court Records
      deepPasses.push(
        invokeLLM({
          model: SEARCH_MODEL, add_context_from_internet: true,
          prompt: `Search court records for ${deepCtx}. Search: ${SKIP_TRACE_DEEP_CATALOG.find(c => c.id === "court_records")?.sources.join(", ")}. Find any criminal, civil, bankruptcy, or divorce filings. Court filings often show current address and sometimes phone/email.`,
          response_json_schema: { type: "object", properties: { cases: { type: "array", items: { type: "object", properties: { case_type: { type: "string" }, court: { type: "string" }, date: { type: "string" }, address_listed: { type: "string" } } } }, address_from_court: { type: "string" }, confidence: { type: "number" } } },
        }).then(r => { if (r?.address_from_court) results.addresses.push({ address: r.address_from_court, type: "court_record", confidence: r.confidence || 65, source: "court_records" }); results.sources.push("pacer", "state_court", "bankruptcy", "divorce_records"); results.methods.push("court_records_search"); })
          .catch(e => results.errors.push({ method: "court_records", error: e.message }))
      );

      // Method 11: Professional Licenses
      deepPasses.push(
        invokeLLM({
          model: SEARCH_MODEL, add_context_from_internet: true,
          prompt: `Search professional license databases for ${deepCtx}. Search: ${SKIP_TRACE_DEEP_CATALOG.find(c => c.id === "professional_licenses")?.sources.join(", ")}. Find any professional licenses (attorney, doctor, real estate, contractor, CPA, insurance). License records show business address and sometimes phone.`,
          response_json_schema: { type: "object", properties: { licenses: { type: "array", items: { type: "object", properties: { type: { type: "string" }, license_number: { type: "string" }, business_address: { type: "string" }, phone: { type: "string" } } } }, confidence: { type: "number" } } },
        }).then(r => { (r?.licenses || []).forEach((l: any) => { if (l.business_address) results.addresses.push({ address: l.business_address, type: "professional", confidence: 70, source: "professional_license" }); if (l.phone) results.phone_numbers.push({ number: l.phone, type: "business", confidence: 70, source: "professional_license" }); }); results.sources.push("professional_licenses", "state_bar", "medical_board"); results.methods.push("professional_license_search"); })
          .catch(e => results.errors.push({ method: "professional_licenses", error: e.message }))
      );

      // Method 12: Vehicle & DMV
      deepPasses.push(
        invokeLLM({
          model: SEARCH_MODEL, add_context_from_internet: true,
          prompt: `Search vehicle and DMV records for ${deepCtx}. Search: ${SKIP_TRACE_DEEP_CATALOG.find(c => c.id === "vehicle_dmv")?.sources.join(", ")}. Find vehicle registrations, boat registrations, aircraft registrations (FAA). These show registered address.`,
          response_json_schema: { type: "object", properties: { vehicles: { type: "array", items: { type: "object", properties: { type: { type: "string" }, registered_address: { type: "string" } } } }, confidence: { type: "number" } } },
        }).then(r => { (r?.vehicles || []).forEach((v: any) => { if (v.registered_address) results.addresses.push({ address: v.registered_address, type: "vehicle_registration", confidence: 65, source: "dmv_records" }); }); results.sources.push("dmv", "vehicle_registration", "faa_aircraft"); results.methods.push("vehicle_dmv_search"); })
          .catch(e => results.errors.push({ method: "vehicle_dmv", error: e.message }))
      );

      // Method 13: Military Records
      deepPasses.push(
        invokeLLM({
          model: SEARCH_MODEL, add_context_from_internet: true,
          prompt: `Search military records for ${deepCtx}. Search: ${SKIP_TRACE_DEEP_CATALOG.find(c => c.id === "military_records")?.sources.join(", ")}. Find VA records, National Archives service records, military burial records, VA home loan records. Military records can show address and next of kin.`,
          response_json_schema: { type: "object", properties: { military_service: { type: "string" }, va_address: { type: "string" }, next_of_kin: { type: "string" }, confidence: { type: "number" } } },
        }).then(r => { if (r?.va_address) results.addresses.push({ address: r.va_address, type: "va", confidence: 60, source: "military_records" }); if (r?.next_of_kin) results.relatives.push({ name: r.next_of_kin, relationship: "next_of_kin", phone: "" }); results.sources.push("va_records", "national_archives", "military_service"); results.methods.push("military_records_search"); })
          .catch(e => results.errors.push({ method: "military_records", error: e.message }))
      );

      // Method 14: Tax & Financial
      deepPasses.push(
        invokeLLM({
          model: SEARCH_MODEL, add_context_from_internet: true,
          prompt: `Search tax and financial records for ${deepCtx}. Search: ${SKIP_TRACE_DEEP_CATALOG.find(c => c.id === "tax_financial")?.sources.join(", ")}. Find property tax records, tax liens, SEC EDGAR filings, Dun & Bradstreet, corporate filings (Secretary of State). These show address and financial connections.`,
          response_json_schema: { type: "object", properties: { tax_liens: { type: "array", items: { type: "string" } }, sec_filings: { type: "array", items: { type: "string" } }, corporate_filings: { type: "array", items: { type: "object", properties: { business_name: { type: "string" }, registered_address: { type: "string" } } } }, address_from_tax: { type: "string" }, confidence: { type: "number" } } },
        }).then(r => { if (r?.address_from_tax) results.addresses.push({ address: r.address_from_tax, type: "tax_record", confidence: 65, source: "tax_records" }); (r?.corporate_filings || []).forEach((c: any) => { if (c.registered_address) results.addresses.push({ address: c.registered_address, type: "corporate", confidence: 60, source: "corporate_filing" }); }); results.sources.push("tax_liens", "sec_edgar", "dun_bradstreet", "corporate_filings"); results.methods.push("tax_financial_search"); })
          .catch(e => results.errors.push({ method: "tax_financial", error: e.message }))
      );

      // Method 15: Government Registries
      deepPasses.push(
        invokeLLM({
          model: SEARCH_MODEL, add_context_from_internet: true,
          prompt: `Search government registries for ${deepCtx}. Search: ${SKIP_TRACE_DEEP_CATALOG.find(c => c.id === "government_registries")?.sources.join(", ")}. Check FAA pilot registry, FINRA BrokerCheck, inmate locators (state/federal), sex offender registry, hunting/fishing licenses, building permits. Any government record that confirms location.`,
          response_json_schema: { type: "object", properties: { records: { type: "array", items: { type: "object", properties: { type: { type: "string" }, address: { type: "string" }, details: { type: "string" } } } }, confidence: { type: "number" } } },
        }).then(r => { (r?.records || []).forEach((rec: any) => { if (rec.address) results.addresses.push({ address: rec.address, type: rec.type, confidence: 60, source: "government_registry" }); }); results.sources.push("faa_pilot", "finra_brokercheck", "inmate_locator", "sex_offender_registry", "hunting_fishing"); results.methods.push("government_registries_search"); })
          .catch(e => results.errors.push({ method: "government_registries", error: e.message }))
      );

      // Method 16: Church & Religious Records
      deepPasses.push(
        invokeLLM({
          model: SEARCH_MODEL, add_context_from_internet: true,
          prompt: `Search church and religious records for ${deepCtx}. Search: ${SKIP_TRACE_DEEP_CATALOG.find(c => c.id === "church_religious")?.sources.join(", ")}. Find parish records, congregation membership, religious directories. These can show address and family connections.`,
          response_json_schema: { type: "object", properties: { church_affiliations: { type: "array", items: { type: "object", properties: { church: { type: "string" }, address: { type: "string" } } } }, confidence: { type: "number" } } },
        }).then(r => { (r?.church_affiliations || []).forEach((c: any) => { if (c.address) results.addresses.push({ address: c.address, type: "church", confidence: 50, source: "church_records" }); }); results.sources.push("church_records", "parish_records"); results.methods.push("church_records_search"); })
          .catch(e => results.errors.push({ method: "church_records", error: e.message }))
      );

      // Method 17: School & Alumni Records
      deepPasses.push(
        invokeLLM({
          model: SEARCH_MODEL, add_context_from_internet: true,
          prompt: `Search school and alumni records for ${deepCtx}. Search: ${SKIP_TRACE_DEEP_CATALOG.find(c => c.id === "school_alumni")?.sources.join(", ")}. Find university alumni directories, high school yearbooks, Classmates.com, alumni associations. These can show current city/state and contact info.`,
          response_json_schema: { type: "object", properties: { alumni_records: { type: "array", items: { type: "object", properties: { school: { type: "string" }, year: { type: "string" }, current_location: { type: "string" } } } }, confidence: { type: "number" } } },
        }).then(r => { (r?.alumni_records || []).forEach((a: any) => { if (a.current_location) results.addresses.push({ address: a.current_location, type: "alumni", confidence: 50, source: "alumni_records" }); }); results.sources.push("alumni_directories", "yearbooks", "classmates"); results.methods.push("school_alumni_search"); })
          .catch(e => results.errors.push({ method: "school_alumni", error: e.message }))
      );

      // Method 18: Newspaper Archives
      deepPasses.push(
        invokeLLM({
          model: SEARCH_MODEL, add_context_from_internet: true,
          prompt: `Search newspaper archives for ${deepCtx}. Search: ${SKIP_TRACE_DEEP_CATALOG.find(c => c.id === "newspaper_archives")?.sources.join(", ")}. Find any newspaper mentions: legal notices, marriage/birth announcements, business news, obituaries, court notices. These can reveal address, relatives, and contact info.`,
          response_json_schema: { type: "object", properties: { mentions: { type: "array", items: { type: "object", properties: { date: { type: "string" }, headline: { type: "string" }, address_mentioned: { type: "string" }, relatives_mentioned: { type: "array", items: { type: "string" } } } } }, confidence: { type: "number" } } },
        }).then(r => { (r?.mentions || []).forEach((m: any) => { if (m.address_mentioned) results.addresses.push({ address: m.address_mentioned, type: "newspaper", confidence: 45, source: "newspaper_archive" }); (m.relatives_mentioned || []).forEach((rel: string) => { if (!results.relatives.find(x => x.name === rel)) results.relatives.push({ name: rel, relationship: "from_newspaper", phone: "" }); }); }); results.sources.push("newspapers", "genealogybank", "chronicling_america"); results.methods.push("newspaper_archive_search"); })
          .catch(e => results.errors.push({ method: "newspaper_archives", error: e.message }))
      );

      await Promise.all(deepPasses);
    }

    // === DEDUPLICATION ===
    const dedupPhones = dedupByKey(results.phone_numbers, (p: any) => (p.number || "").replace(/\D/g, ""), "confidence");
    const dedupEmails = dedupByKey(results.emails, (e: any) => (e.email || "").toLowerCase().trim(), "confidence");
    const dedupAddresses = dedupByKey(results.addresses, (a: any) => (a.address || "").toLowerCase().trim(), "confidence");
    const dedupSocial = dedupByKey(results.social_profiles, (s: any) => (s.url || "").toLowerCase().trim(), "confidence");
    const dedupRelatives = dedupByKey(results.relatives, (r: any) => (r.name || "").toLowerCase().trim(), "");

    // === CONFIDENCE SCORING ===
    const phoneConfidence = dedupPhones.length > 0 ? Math.max(...dedupPhones.map((p: any) => p.confidence || 0)) : 0;
    const emailConfidence = dedupEmails.length > 0 ? Math.max(...dedupEmails.map((e: any) => e.confidence || 0)) : 0;
    const addressConfidence = dedupAddresses.length > 0 ? Math.max(...dedupAddresses.map((a: any) => a.confidence || 0)) : 0;
    const socialConfidence = dedupSocial.length > 0 ? Math.max(...dedupSocial.map((s: any) => s.confidence || 0)) : 0;

    const overallConfidence = Math.round(
      phoneConfidence * 0.35 + emailConfidence * 0.25 + addressConfidence * 0.2 + socialConfidence * 0.1 + (results.owner_name ? 10 : 0)
    );

    const allFailed = results.methods.length === 0 && results.errors.length > 0;
    const hasVerifiedEvidence = Array.isArray(results.evidence_records) && results.evidence_records.some(isVerifiedEvidenceRecord);
    const propertyData = results.property_data && typeof results.property_data === "object" ? results.property_data : {};
    const propertyCandidateKeys = ["owner_name", "mailing_address", "co_owners", "purchase_date", "property_value", "lot_size"];
    const hasPropertyCandidate = propertyCandidateKeys.some((key) => {
      const value = propertyData[key];
      return Array.isArray(value) ? value.length > 0 : typeof value === "string" ? value.trim().length > 0 : value !== null && value !== undefined;
    });
    const hasNewOwnerName = Boolean(results.owner_name && String(results.owner_name).trim()
      && String(results.owner_name).trim().toLocaleLowerCase() !== String(owner_name || "").trim().toLocaleLowerCase());
    const hasCandidateData = dedupPhones.length > 0 || dedupEmails.length > 0 || dedupAddresses.length > 0
      || dedupSocial.length > 0 || dedupRelatives.length > 0 || hasPropertyCandidate || hasNewOwnerName;
    const finalStatus = allFailed ? "failed"
      : hasVerifiedEvidence && overallConfidence >= 70 ? "found"
      : hasCandidateData ? "partial"
      : "failed";
    results.candidate_confidence_score = overallConfidence;
    results.evidence_verified = hasVerifiedEvidence;
    results.verification_status = hasVerifiedEvidence ? "verified" : hasCandidateData ? "needs_review" : "no_verified_results";
    const duration = Date.now() - startTime;

    await base44.entities.SkipTrace.update(skipTrace.id, {
      status: finalStatus,
      found_owner_name: results.owner_name || "",
      found_phone_numbers: dedupPhones,
      found_emails: dedupEmails,
      found_addresses: dedupAddresses,
      found_social_profiles: dedupSocial,
      found_relatives: dedupRelatives,
      property_data: results.property_data || {},
      sources_checked: [...new Set(results.sources)],
      methods_used: [...new Set(results.methods)],
      confidence_score: hasVerifiedEvidence ? overallConfidence : 0,
      search_results: results,
      search_duration_ms: duration,
      notes: hasVerifiedEvidence ? "" : "Candidate results are unverified. Source evidence and independent review are required before treating them as findings.",
    });

    // === AUTO-EXPORT TO GOOGLE SHEETS ===
    let sheet_export: any = null;
    if (spreadsheet_url && hasVerifiedEvidence) {
      try {
        const exportRes: any = await base44.functions.invoke("exportSkipTraceToSheet", {
          spreadsheet_url,
          target_property_address: property_address || "",
          target_owner_name: owner_name || "",
          target_phone: phone || "",
          target_email: email || "",
          target_company: company || "",
          status: finalStatus,
          found_owner_name: results.owner_name || "",
          confidence_score: overallConfidence,
          phone_numbers: dedupPhones,
          emails: dedupEmails,
          addresses: dedupAddresses,
          social_profiles: dedupSocial,
          relatives: dedupRelatives,
          sources_checked: [...new Set(results.sources)],
          methods_used: [...new Set(results.methods)],
          search_duration_ms: duration,
        });
        sheet_export = exportRes?.data || exportRes;
        if (sheet_export?.error) {
          results.errors.push({ method: "google_sheets_export", error: sheet_export.error });
          sheet_export = null;
        }
      } catch (expErr: any) {
        results.errors.push({ method: "google_sheets_export", error: expErr.message });
      }
    }

    if (allFailed) {
      return Response.json(
        {
          error: "All search methods failed or no usable research result was returned.",
          skip_trace_id: skipTrace.id,
          status: "failed",
          evidence_verified: false,
          verification_status: "no_verified_results",
          errors: results.errors,
        },
        { status: 503 }
      );
    }

    return Response.json({
      ok: true,
      skip_trace_id: skipTrace.id,
      status: finalStatus,
      target_owner_name: owner_name || "",
      confidence_score: hasVerifiedEvidence ? overallConfidence : 0,
      candidate_confidence_score: overallConfidence,
      evidence_verified: hasVerifiedEvidence,
      verification_status: hasVerifiedEvidence ? "verified" : hasCandidateData ? "needs_review" : "no_verified_results",
      evidence_records: results.evidence_records,
      found_owner_name: results.owner_name,
      phone_numbers: dedupPhones,
      emails: dedupEmails,
      addresses: dedupAddresses,
      social_profiles: dedupSocial,
      relatives: dedupRelatives,
      sources: [...new Set(results.sources)],
      methods: [...new Set(results.methods)],
      duration_ms: duration,
      sheet_export: sheet_export || undefined,
      errors: results.errors.length > 0 ? results.errors : undefined,
    });
  } catch (error: any) {
    console.error("Skip trace error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

function dedupByKey(arr: any[], keyFn: (item: any) => string, confField: string): any[] {
  const map = new Map<string, any>();
  for (const item of arr) {
    const key = keyFn(item);
    if (!key) continue;
    if (!map.has(key)) {
      map.set(key, item);
    } else if (confField) {
      const existing = map.get(key);
      if ((item[confField] || 0) > (existing[confField] || 0)) {
        map.set(key, item);
      }
    }
  }
  return Array.from(map.values());
}

function isVerifiedEvidenceRecord(record: any): boolean {
  if (!record || record.status !== "verified" || typeof record.finding_id !== "string" || !record.finding_id.trim()) return false;
  if (typeof record.retrieved_at !== "string" || !Number.isFinite(Date.parse(record.retrieved_at))) return false;
  if (typeof record.content_hash !== "string" || !/^[a-f0-9]{64}$/i.test(record.content_hash)) return false;
  try {
    const url = new URL(record.source_url);
    return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}
