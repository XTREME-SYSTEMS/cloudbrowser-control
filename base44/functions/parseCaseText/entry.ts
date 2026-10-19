import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";

/**
 * Paste & Organize — AI intake for heir searches.
 * Takes raw pasted text (obituary, court filing, attorney email, case notes)
 * and extracts structured heir-search fields + every named family member.
 */
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { text } = body as any;
    if (!text || String(text).trim().length < 3) {
      return Response.json({ error: "Please paste some case text to organize." }, { status: 400 });
    }

    const cleanText = String(text).slice(0, 12000);

    const prompt = `You are a forensic genealogy intake assistant for a probate heir-search firm. Parse the following raw case text into structured fields.

The text may be an obituary, probate court filing, attorney email, family notes, or a mix. Extract every detail you can identify:
- The deceased person's full name, birth date, death date, last address, death location, SSN (last 4 if mentioned)
- Any case/account reference and client/attorney email
- EVERY named person and their relationship to the deceased (spouse, ex-spouse, child, parent, sibling, grandchild, niece, nephew, cousin, aunt, uncle, etc.)

If a field is not present, use null. Dates should be ISO format (YYYY-MM-DD) when parseable, otherwise the raw string. Addresses should be full strings.

RAW CASE TEXT:
"""
${cleanText}
"""`;

    const schema = {
      type: "object",
      properties: {
        deceased_name: { type: "string", description: "Full name of the deceased" },
        deceased_dob: { type: "string", description: "Date of birth ISO or null" },
        deceased_dod: { type: "string", description: "Date of death ISO or null" },
        deceased_last_address: { type: "string", description: "Last known address or null" },
        death_location: { type: "string", description: "City, county, state of death or null" },
        deceased_ssn: { type: "string", description: "Last 4 of SSN if mentioned or null" },
        case_reference: { type: "string", description: "Case/account reference or null" },
        client_email: { type: "string", description: "Client/attorney email if mentioned or null" },
        family_members: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              relationship: { type: "string", description: "Relationship to deceased" },
            },
          },
        },
        notes: { type: "string", description: "Any additional relevant context" },
      },
    };

    const llmRes: any = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: schema,
    });

    const parsed = llmRes || {};
    // Normalize empty strings to null for date fields
    for (const f of ["deceased_dob", "deceased_dod", "deceased_ssn", "case_reference", "client_email", "deceased_last_address", "death_location"]) {
      if (parsed[f] === "") parsed[f] = null;
    }
    if (!Array.isArray(parsed.family_members)) parsed.family_members = [];

    return Response.json({ ok: true, parsed });
  } catch (err: any) {
    console.error("parseCaseText error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}