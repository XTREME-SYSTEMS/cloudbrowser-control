import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * Auto-search pipeline — runs after an heir search completes.
 * For each identified heir:
 *   1. Skip traces the heir (finds phone, email, address, social profiles)
 *   2. Searches all public information sources for additional data
 * Then syncs the tracking sheet with the updated results.
 *
 * Triggered by the HeirSearchAutoSearch workflow when a HeirSearch
 * record transitions to found/partial status.
 */

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const heirSearchId = body.heir_search_id;
    if (!heirSearchId) {
      return Response.json({ error: "heir_search_id is required" }, { status: 400 });
    }

    const record: any = await base44.entities.HeirSearch.get(heirSearchId);
    if (!record) {
      return Response.json({ error: "Heir search record not found" }, { status: 404 });
    }

    const heirs: any[] = record.identified_heirs || [];
    if (heirs.length === 0) {
      return Response.json({ ok: true, message: "No heirs to trace", traced: 0 });
    }

    const deceasedName = record.deceased_name || "";
    const updatedHeirs: any[] = [];
    let totalContactsFound = 0;

    for (let i = 0; i < heirs.length; i++) {
      const heir = heirs[i];
      if (!heir.name) {
        updatedHeirs.push(heir);
        continue;
      }

      // Skip trace + public source search for this heir
      try {
        const traceRes: any = await base44.integrations.Core.InvokeLLM({
          prompt: `You are an expert skip tracer and open-source intelligence analyst. Search all public information sources for this person and return their contact details.

Person: ${heir.name}
Relationship to deceased: ${heir.relationship || "unknown"}
Deceased: ${deceasedName}
Last known address: ${heir.address || "unknown"}
Age/DOB: ${heir.age_or_dob || "unknown"}

Search ALL public sources: people search sites, social media (Facebook, LinkedIn, Twitter/X, Instagram, TikTok), public records, phone directories, email databases, property records, court records, voter registration, professional licensing, business affiliations, news articles, obituaries, school alumni records, and any other open source.

Return a JSON object with every contact detail you can find. Be thorough — check multiple sources for each data point. Only include verified or high-confidence results.`,
          add_context_from_internet: true,
          response_json_schema: {
            type: "object",
            properties: {
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
              employer: { type: "string" },
              occupation: { type: "string" },
              education: { type: "string" },
              relatives: {
                type: "array",
                items: { type: "string" },
              },
              notes: { type: "string" },
              overall_confidence: { type: "number" },
            },
          },
        });

        const trace = traceRes || {};
        const newPhones = (trace.phone_numbers || []).map((p: any) => ({
          number: p.number,
          confidence: p.confidence || 70,
          source: p.source || "public_source_search",
        }));
        const newEmails = (trace.emails || []).map((e: any) => ({
          email: e.email,
          confidence: e.confidence || 70,
          source: e.source || "public_source_search",
        }));

        // Merge with existing contact info (dedup by value)
        const existingPhones = heir.phone_numbers || [];
        const existingEmails = heir.emails || [];
        const phoneSet = new Set(existingPhones.map((p: any) => p.number));
        const emailSet = new Set(existingEmails.map((e: any) => e.email));

        const mergedPhones = [
          ...existingPhones,
          ...newPhones.filter((p: any) => !phoneSet.has(p.number)),
        ];
        const mergedEmails = [
          ...existingEmails,
          ...newEmails.filter((e: any) => !emailSet.has(e.email)),
        ];

        const mergedSocials = [
          ...(heir.social_profiles || []),
          ...(trace.social_profiles || []),
        ];

        totalContactsFound += newPhones.length + newEmails.length;

        updatedHeirs.push({
          ...heir,
          phone_numbers: mergedPhones,
          emails: mergedEmails,
          address: trace.address || heir.address || "",
          age_or_dob: trace.age_or_dob || heir.age_or_dob || "",
          social_profiles: mergedSocials,
          confidence: Math.max(heir.confidence || 0, trace.overall_confidence || 0),
          notes: [heir.notes, trace.notes].filter(Boolean).join("; "),
        });
      } catch (traceErr: any) {
        console.error(`Trace failed for ${heir.name}:`, traceErr.message);
        updatedHeirs.push(heir);
      }
    }

    // Update the record with enhanced contact info
    await base44.entities.HeirSearch.update(heirSearchId, {
      identified_heirs: updatedHeirs,
    });

    // Sync the tracking sheet (removes failed searches, writes updated contacts)
    let sheetSync: any = null;
    try {
      const syncRes: any = await base44.functions.invoke("syncHeirSheet", {});
      sheetSync = syncRes?.data || syncRes;
    } catch (syncErr: any) {
      console.error("Sheet sync failed:", syncErr.message);
    }

    return Response.json({
      ok: true,
      heir_search_id: heirSearchId,
      heirs_traced: updatedHeirs.length,
      new_contacts_found: totalContactsFound,
      sheet_sync: sheetSync,
    });
  } catch (error: any) {
    console.error("Auto search heir results error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}