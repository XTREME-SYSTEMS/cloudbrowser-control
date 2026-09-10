import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * Skip Trace Engine — Multi-Method Owner & Contact Discovery
 *
 * Exhausts every available source to identify a property owner and find
 * their contact information:
 *   1. Property Records Search (county assessor, tax records, deeds)
 *   2. Reverse Phone Lookup (if no name but phone provided)
 *   3. People Search (whitepages, directories, public records)
 *   4. Social Media Deep Search (Facebook, LinkedIn, Twitter, Instagram, etc.)
 *   5. Email Search (email directories, patterns, verification)
 *   6. Relatives & Associates Search (family members, business partners)
 *   7. Business Records Search (BBB, state filings, corporate registries)
 */

const SEARCH_MODEL = "gemini_3_flash";

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { property_address, owner_name, phone, email, company, batch_id } = body;

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
    };

    // === METHOD 1: Property Records Search ===
    if (property_address) {
      try {
        const propRes: any = await base44.integrations.Core.InvokeLLM({
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
          const phoneRes: any = await base44.integrations.Core.InvokeLLM({
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
        const peopleRes: any = await base44.integrations.Core.InvokeLLM({
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
        const socialRes: any = await base44.integrations.Core.InvokeLLM({
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
        const emailRes: any = await base44.integrations.Core.InvokeLLM({
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
        const relRes: any = await base44.integrations.Core.InvokeLLM({
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
        const bizRes: any = await base44.integrations.Core.InvokeLLM({
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
    const status =
      overallConfidence >= 70
        ? "found"
        : overallConfidence >= 40 || dedupPhones.length > 0 || dedupEmails.length > 0
        ? "partial"
        : "failed";
    const finalStatus = allFailed ? "failed" : status;
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
      confidence_score: overallConfidence,
      search_results: results,
      search_duration_ms: duration,
    });

    if (allFailed) {
      return Response.json(
        {
          error: "All search methods failed. This may be due to exhausted integration credits. Credits reset on 2026-09-12.",
          skip_trace_id: skipTrace.id,
          errors: results.errors,
        },
        { status: 503 }
      );
    }

    return Response.json({
      ok: true,
      skip_trace_id: skipTrace.id,
      status: finalStatus,
      confidence_score: overallConfidence,
      found_owner_name: results.owner_name,
      phone_numbers: dedupPhones,
      emails: dedupEmails,
      addresses: dedupAddresses,
      social_profiles: dedupSocial,
      relatives: dedupRelatives,
      sources: [...new Set(results.sources)],
      methods: [...new Set(results.methods)],
      duration_ms: duration,
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