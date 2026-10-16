import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * Exports skip trace results to a Google Sheet.
 * Uses the shared Google Sheets connector (platform OAuth).
 *
 * Creates the "Skip Traces" tab if it doesn't exist, adds headers if missing,
 * then appends one row per skip trace result.
 */

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

function extractSpreadsheetId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

const COLUMNS = [
  "Export Date", "Target Address", "Target Owner", "Target Phone", "Target Email",
  "Target Company", "Status", "Found Owner", "Confidence %",
  "Phone Numbers", "Emails", "Addresses", "Social Profiles", "Relatives",
  "Sources Checked", "Methods Used", "Duration (s)",
];

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const {
      spreadsheet_url, sheet_name,
      target_property_address, target_owner_name, target_phone, target_email, target_company,
      status, found_owner_name, confidence_score,
      phone_numbers, emails, addresses, social_profiles, relatives,
      sources_checked, methods_used, search_duration_ms,
    } = body;

    const spreadsheetId = extractSpreadsheetId(spreadsheet_url);
    if (!spreadsheetId) {
      return Response.json({ error: "Could not extract a spreadsheet ID from the provided URL. Paste the full Google Sheets URL or the sheet ID." }, { status: 400 });
    }

    const sheet = sheet_name || "Skip Traces";
    const { accessToken } = await base44.asServiceRole.connectors.getConnection("googlesheets");

    const headers = {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };

    // 1. Check if the sheet tab exists; create if missing
    const metaRes = await fetch(`${SHEETS_API}/${spreadsheetId}`, { headers });
    if (!metaRes.ok) {
      const err = await metaRes.json().catch(() => ({}));
      return Response.json({ error: `Cannot access spreadsheet: ${err.error?.message || metaRes.statusText}. Make sure the sheet is shared with the connected Google account.` }, { status: 502 });
    }
    const metaData = await metaRes.json();
    const sheetExists = (metaData.sheets || []).some((s: any) => s.properties?.title === sheet);

    if (!sheetExists) {
      await fetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
        method: "POST", headers,
        body: JSON.stringify({ requests: [{ addSheet: { properties: { title: sheet } } }] }),
      });
    }

    // 2. Check if headers exist
    const colCount = COLUMNS.length;
    const endCol = String.fromCharCode(65 + colCount - 1); // A=65
    const checkRes = await fetch(`${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(sheet)}!A1:${endCol}1`, { headers });
    const checkData = checkRes.ok ? await checkRes.json().catch(() => ({})) : {};
    const hasHeaders = checkData.values?.[0]?.length > 1;

    // 3. Write headers if missing
    if (!hasHeaders) {
      await fetch(`${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(sheet)}!A1?valueInputOption=RAW`, {
        method: "PUT", headers,
        body: JSON.stringify({ values: [COLUMNS] }),
      });
    }

    // 4. Build the row
    const fmtList = (arr: any[], formatter: (item: any) => string) =>
      (arr || []).map(formatter).join("; ");

    const row = [
      new Date().toISOString(),
      target_property_address || "",
      target_owner_name || "",
      target_phone || "",
      target_email || "",
      target_company || "",
      status || "",
      found_owner_name || "",
      confidence_score || 0,
      fmtList(phone_numbers, (p: any) => `${p.number}${p.confidence ? ` (${p.confidence}%)` : ""}`),
      fmtList(emails, (e: any) => `${e.email}${e.verified ? " ✓" : ""}`),
      fmtList(addresses, (a: any) => a.address),
      fmtList(social_profiles, (s: any) => `${s.platform}: ${s.url}`),
      fmtList(relatives, (r: any) => `${r.name}${r.relationship ? ` (${r.relationship})` : ""}`),
      (sources_checked || []).join(", "),
      (methods_used || []).join(", "),
      ((search_duration_ms || 0) / 1000).toFixed(1),
    ];

    // 5. Append row
    const appendUrl = `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(sheet)}!A:A:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
    const appendRes = await fetch(appendUrl, {
      method: "POST", headers,
      body: JSON.stringify({ values: [row] }),
    });

    if (!appendRes.ok) {
      const err = await appendRes.json().catch(() => ({}));
      return Response.json({ error: `Google Sheets append failed: ${err.error?.message || appendRes.statusText}` }, { status: 502 });
    }

    const appendData = await appendRes.json();

    return Response.json({
      ok: true,
      exported: 1,
      spreadsheet_id: spreadsheetId,
      sheet,
      updated_range: appendData.updates?.updatedRange,
      columns: COLUMNS.length,
    });
  } catch (error: any) {
    console.error("Export skip trace to sheet error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}