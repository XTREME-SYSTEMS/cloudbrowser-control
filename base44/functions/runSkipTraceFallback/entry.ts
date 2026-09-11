import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

/**
 * Multi-Tier Skip Trace Fallback Engine
 *
 * This is the "fallback technology" that works when the original LLM-based
 * search fails (e.g. integration credits exhausted).
 *
 * Tier 1: LLM-based web search (runSkipTrace) — requires integration credits
 * Tier 2: Direct HTTP scraping with regex pattern extraction — NO credits needed
 * Tier 3: Mock synthetic data (runSkipTraceMock) — always works, for testing
 *
 * The engine tries each tier in order and returns the first successful result,
 * along with which tier was used so the system knows what happened.
 */

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { property_address, owner_name, phone, email, company, batch_id } = body as any;

    const tiersAttempted: string[] = [];
    let result: any = null;

    // Tier 1: Try LLM-based skip trace (requires credits)
    tiersAttempted.push("llm");
    try {
      const llmRaw = await base44.functions.invoke("runSkipTrace", {
        property_address, owner_name, phone, email, company, batch_id,
      });
      result = llmRaw?.data ?? llmRaw;
      if (result && !result.error) {
        return Response.json({
          ...result,
          tier_used: "llm",
          tiers_attempted: tiersAttempted,
        });
      }
    } catch (llmErr: any) {
      // LLM failed — likely credit exhaustion. Fall through to Tier 2.
      console.log("Tier 1 (LLM) failed, falling back to Tier 2:", llmErr.message);
    }

    // Tier 2: Direct HTTP scraping with pattern extraction (NO credits needed)
    tiersAttempted.push("direct_scrape");
    try {
      result = await directScrapeSkipTrace({ property_address, owner_name, phone, email, company });
      if (result) {
        await persistTraceResult(base44, property_address, result);
        return Response.json({
          ...result,
          tier_used: "direct_scrape",
          tiers_attempted: tiersAttempted,
        });
      }
    } catch (scrapeErr: any) {
      console.log("Tier 2 (Direct Scrape) failed, falling back to Tier 3:", scrapeErr.message);
    }

    // Tier 3: Mock synthetic data (always works)
    tiersAttempted.push("mock");
    const mockRaw = await base44.functions.invoke("runSkipTraceMock", {
      property_address, owner_name, phone, email, company, batch_id,
    });
    result = mockRaw?.data ?? mockRaw;
    return Response.json({
      ...result,
      tier_used: "mock",
      tiers_attempted: tiersAttempted,
    });
  } catch (err: any) {
    console.error("runSkipTraceFallback error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

/**
 * Direct HTTP scraping — extracts public data from free people-search
 * directories using fetch + regex pattern matching. No LLM credits needed.
 */
async function directScrapeSkipTrace(params: any): Promise<any | null> {
  const { property_address, owner_name, phone, email, company } = params;

  const sources: string[] = [];
  const phoneNumbers: any[] = [];
  const emails: any[] = [];
  const addresses: any[] = [];

  const query = [owner_name, property_address, phone, email, company]
    .filter(Boolean).join(" ");
  if (!query) return null;

  // Public directory URLs to try
  const directories = [
    `https://www.truepeoplesearch.com/results?q=${encodeURIComponent(query)}`,
    `https://www.fastpeoplesearch.com/name/${encodeURIComponent(owner_name || query)}`,
    `https://www.whitepages.com/name/${encodeURIComponent(owner_name || query)}`,
  ];

  for (const url of directories) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) continue;
      const html = await response.text();
      sources.push(url);

      // Extract phone numbers
      const phoneMatches = html.match(/\(?\b\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g) || [];
      for (const pn of [...new Set(phoneMatches)].slice(0, 3)) {
        phoneNumbers.push({
          number: pn.startsWith("+") ? pn : `+1 ${pn}`,
          type: "unknown",
          confidence: 50,
          source: url.split("/")[2],
        });
      }

      // Extract emails
      const emailMatches = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
      for (const em of [...new Set(emailMatches)].slice(0, 3)) {
        if (!em.includes("sentry") && !em.includes("noreply") && !em.includes("example.com")) {
          emails.push({
            email: em,
            confidence: 45,
            source: url.split("/")[2],
            verified: false,
          });
        }
      }

      // Extract addresses
      const addrMatches = html.match(/\b\d+\s+[A-Z][a-zA-Z]+\s+(?:St|Ave|Blvd|Dr|Rd|Ln|Way|Ct|Cir|Pl)\.?\b[^<,]{0,60}/g) || [];
      for (const addr of [...new Set(addrMatches)].slice(0, 2)) {
        addresses.push({
          address: addr.trim(),
          type: "mailing",
          confidence: 40,
          source: url.split("/")[2],
        });
      }
    } catch (e) {
      // Skip failed sources
    }
  }

  if (phoneNumbers.length > 0 || emails.length > 0 || addresses.length > 0) {
    return {
      status: "partial",
      found_owner_name: owner_name || "",
      found_phone_numbers: phoneNumbers,
      found_emails: emails,
      found_addresses: addresses,
      found_social_profiles: [],
      found_relatives: [],
      property_data: { address: property_address || "" },
      sources_checked: sources,
      methods_used: ["direct_scrape"],
      confidence_score: 45,
      search_duration_ms: 0,
      _fallback_tier: "direct_scrape",
    };
  }

  return null;
}

async function persistTraceResult(base44: any, property_address: string, result: any) {
  if (!property_address) return;
  try {
    const existing = await base44.entities.SkipTrace.filter(
      { target_property_address: property_address, status: "searching" },
      "-created_date", 1
    );
    if (existing.length > 0) {
      await base44.entities.SkipTrace.update(existing[0].id, {
        status: result.confidence_score > 80 ? "found" : "partial",
        found_owner_name: result.found_owner_name,
        found_phone_numbers: result.found_phone_numbers,
        found_emails: result.found_emails,
        found_addresses: result.found_addresses,
        sources_checked: result.sources_checked,
        methods_used: result.methods_used,
        confidence_score: result.confidence_score,
      });
    }
  } catch (e) {
    // Non-fatal
  }
}