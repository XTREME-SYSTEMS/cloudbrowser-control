import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const rawText: string = (body?.raw_text || '').trim();
    if (!rawText) return Response.json({ error: 'No text provided' }, { status: 400 });

    // Normalize the pasted text into structured deceased-person records using LLM
    const llmRes = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a data normalizer for a probate heir-search system. The user has pasted free-form text containing one or more deceased person records. Parse each distinct deceased person into a structured record.

For each person extract:
- deceased_name (full name, required)
- deceased_dob (date of birth if mentioned, ISO format YYYY-MM-DD, else empty string)
- deceased_dod (date of death if mentioned, ISO format YYYY-MM-DD, else empty string)
- deceased_last_address (last known address if mentioned, else empty string)
- death_location (city, county, state where death occurred if mentioned, else empty string)
- deceased_ssn (last 4 of SSN if mentioned, else empty string)
- case_reference (any account/case/reference number if mentioned, else empty string)

Handle any format: one per line, comma-separated, tab-separated, multi-line blocks, or mixed. Infer sensibly. Return a JSON object with an array "records". If only partial info is available for a person, still include them with whatever fields could be parsed (deceased_name is required — skip entries with no name).

Text to normalize:
"""
${rawText}
"""`,
      response_json_schema: {
        type: 'object',
        properties: {
          records: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                deceased_name: { type: 'string' },
                deceased_dob: { type: 'string' },
                deceased_dod: { type: 'string' },
                deceased_last_address: { type: 'string' },
                death_location: { type: 'string' },
                deceased_ssn: { type: 'string' },
                case_reference: { type: 'string' },
              },
            },
          },
        },
      },
    });

    const records: any[] = (llmRes as any)?.records || [];
    if (!records.length) {
      return Response.json({ error: 'Could not parse any deceased person records from the text', created: [], count: 0 }, { status: 422 });
    }

    // Create HeirSearch records (pending) — deep search is the standard
    const toCreate = records
      .filter((r) => r.deceased_name && r.deceased_name.trim())
      .map((r) => ({
        deceased_name: r.deceased_name.trim(),
        deceased_dob: r.deceased_dob || undefined,
        deceased_dod: r.deceased_dod || undefined,
        deceased_last_address: r.deceased_last_address || undefined,
        death_location: r.death_location || undefined,
        deceased_ssn: r.deceased_ssn || undefined,
        case_reference: r.case_reference || undefined,
        status: 'pending',
      }));

    if (!toCreate.length) {
      return Response.json({ error: 'No valid records with a deceased name found', created: [], count: 0 }, { status: 422 });
    }

    const created = await base44.entities.HeirSearch.bulkCreate(toCreate);

    return Response.json({
      created: Array.isArray(created) ? created : (created as any)?.records || [],
      count: Array.isArray(created) ? created.length : (created as any)?.records?.length || 0,
      parsed: records.length,
    });
  } catch (error) {
    console.error('bulkHeirSearchImport error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}