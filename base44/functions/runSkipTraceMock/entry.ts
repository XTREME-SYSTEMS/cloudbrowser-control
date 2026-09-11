import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

/**
 * Mock Skip Trace Engine
 *
 * Returns synthetic but realistic skip trace results WITHOUT calling InvokeLLM.
 * Use this to test the autonomous swarm loop end-to-end when integration credits
 * are exhausted. Produces varied data based on input so results look real.
 *
 * To switch back to real LLM-powered tracing, update runAutonomousSwarm to call
 * "runSkipTrace" instead of "runSkipTraceMock".
 */

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickFrom(arr: string[], seed: number): string {
  return arr[seed % arr.length];
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const { property_address, owner_name, phone, email, company, batch_id } = body as any;

    const seed = hashString(
      `${property_address || ""}|${owner_name || ""}|${phone || ""}|${email || ""}|${company || ""}`
    );

    const areaCodes = ["305", "404", "713", "602", "702", "214", "832", "615"];
    const domains = ["gmail.com", "yahoo.com", "outlook.com", "icloud.com", "hotmail.com"];
    const socialPlatforms = ["LinkedIn", "Facebook", "Twitter/X", "Instagram"];
    const sources = ["public_records", "whitepages", "truepeoplesearch", "beenverified", "spokeo"];

    const firstNames = ["James", "Robert", "Michael", "David", "William", "Richard", "Thomas", "Charles"];
    const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis"];
    const relTypes = ["Spouse", "Son", "Daughter", "Brother", "Sister", "Associate"];

    const fn = pickFrom(firstNames, seed);
    const ln = pickFrom(lastNames, seed >> 3);
    const resolvedName = owner_name || `${fn} ${ln}`;
    const ac = pickFrom(areaCodes, seed >> 5);
    const dom = pickFrom(domains, seed >> 7);

    const phoneNums = [
      { number: `+1 (${ac}) ${100 + (seed % 900)}-${1000 + (seed % 9000)}`, type: "mobile", confidence: 85 + (seed % 15), source: pickFrom(sources, seed) },
      { number: `+1 (${ac}) ${200 + (seed % 800)}-${2000 + (seed % 8000)}`, type: "landline", confidence: 60 + (seed % 25), source: pickFrom(sources, seed >> 2) },
    ];

    const emails = [
      { email: `${fn.toLowerCase()}.${ln.toLowerCase()}@${dom}`, confidence: 80 + (seed % 20), source: "email_registry", verified: true },
      { email: `${ln.toLowerCase()}${seed % 99}@${dom}`, confidence: 55 + (seed % 30), source: "people_search", verified: false },
    ];

    const addresses = [
      { address: property_address || `${100 + (seed % 900)} Main St, Miami, FL 33101`, type: "property", confidence: 95, source: "county_records" },
      { address: `${500 + (seed % 500)} Oak Ave, ${pickFrom(["Austin", "Phoenix", "Atlanta", "Nashville"], seed >> 4)}, ${pickFrom(["TX", "AZ", "GA", "TN"], seed >> 4)}`, type: "mailing", confidence: 70 + (seed % 20), source: "usps" },
    ];

    const socials = [
      { platform: "LinkedIn", url: `https://linkedin.com/in/${fn.toLowerCase()}-${ln.toLowerCase()}`, bio: `Real estate investor at ${company || "Self-employed"}`, confidence: 75 + (seed % 20) },
      { platform: "Facebook", url: `https://facebook.com/${fn.toLowerCase()}.${ln.toLowerCase()}.${seed % 999}`, bio: "Lives in Miami, Florida", confidence: 60 + (seed % 30) },
    ];

    const relatives = [
      { name: `${pickFrom(firstNames, seed >> 6)} ${ln}`, relationship: pickFrom(relTypes, seed), phone: `+1 (${ac}) ${300 + (seed % 700)}-${3000 + (seed % 7000)}` },
      { name: `${pickFrom(firstNames, seed >> 9)} ${ln}`, relationship: pickFrom(relTypes, seed >> 1), phone: `+1 (${ac}) ${400 + (seed % 600)}-${4000 + (seed % 6000)}` },
    ];

    const methodsUsed = ["property_records", "reverse_phone", "people_search", "social_media", "email_discovery", "relatives", "business"];
    const confidence = 72 + (seed % 23);

    const result = {
      status: "found",
      found_owner_name: resolvedName,
      found_phone_numbers: phoneNums,
      found_emails: emails,
      found_addresses: addresses,
      found_social_profiles: socials,
      found_relatives: relatives,
      property_data: {
        address: property_address || addresses[0].address,
        owner: resolvedName,
        estimated_value: 250000 + (seed % 750000),
        lot_size: `${0.1 + (seed % 50) / 10} acres`,
        year_built: 1960 + (seed % 60),
      },
      sources_checked: sources,
      methods_used: methodsUsed,
      confidence_score: confidence,
      search_duration_ms: 100 + (seed % 500),
      batch_id: batch_id || null,
      _mock: true,
    };

    // Persist to SkipTrace entity if a trace record exists for this
    if (property_address || owner_name) {
      try {
        const existing = await base44.entities.SkipTrace.filter(
          { target_property_address: property_address, status: "searching" },
          "-created_date",
          1
        );
        if (existing.length > 0) {
          await base44.entities.SkipTrace.update(existing[0].id, {
            status: confidence > 80 ? "found" : "partial",
            found_owner_name: resolvedName,
            found_phone_numbers: phoneNums,
            found_emails: emails,
            found_addresses: addresses,
            found_social_profiles: socials,
            found_relatives: relatives,
            property_data: result.property_data,
            sources_checked: sources,
            methods_used: methodsUsed,
            confidence_score: confidence,
            search_duration_ms: result.search_duration_ms,
          });
        }
      } catch (e) {
        // Non-fatal — the mock still returns data
      }
    }

    return Response.json(result);
  } catch (err: any) {
    console.error("runSkipTraceMock error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}