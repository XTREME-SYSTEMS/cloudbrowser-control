import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

/**
 * Exports identified heirs from an heir search to a Google Sheet.
 * Uses the workspace-registered Google Sheets connector (BYO_SHARED).
 *
 * Creates the "Heirs" tab if it doesn't exist, adds headers if missing,
 * then appends one row per identified heir.
 */

const SHEETS_CONNECTOR_ID = "69db1fad3c50db37ad0ce8dd";
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
  "Case Ref", "Deceased Name", "Heir Name", "Relationship", "Inheritance Priority",
  "Is Living", "Phone Numbers", "Emails", "Address", "Age/DOB",
  "Social Profiles", "Confidence %", "Notes", "Export Date",
];

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const {
      spreadsheet_url, sheet_name, deceased_name, case_reference,
      identified_heirs, probate_info, confidence_score,
    } = body;

    const spreadsheetId = extractSpreadsheetId(spreadsheet_url);
    if (!spreadsheetId) {
      return Response.json({ error: "Could not extract a spreadsheet ID from the provided URL. Paste the full Google Sheets URL." }, { status: 400 });
    }

    const sheet = sheet_name || "Heirs";
    const { accessToken } = await base44.asServiceRole.connectors.getWorkspaceConnection(SHEETS_CONNECTOR_ID);

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
    const checkRes = await fetch(`${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(sheet)}!A1:N1`, { headers });
    const checkData = checkRes.ok ? await checkRes.json().catch(() => ({})) : {};
    const hasHeaders = checkData.values?.[0]?.length > 1;

    // 3. Write headers if missing
    if (!hasHeaders) {
      await fetch(`${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(sheet)}!A1?valueInputOption=RAW`, {
        method: "PUT", headers,
        body: JSON.stringify({ values: [COLUMNS] }),
      });
    }

    // 4. Build rows for each identified heir
    const heirs = identified_heirs || [];
    if (heirs.length === 0) {
      return Response.json({ ok: true, exported: 0, message: "No heirs found to export" });
    }

    const rows = heirs.map((heir: any) => [
      case_reference || "",
      deceased_name || "",
      heir.name || "",
      heir.relationship || "",
      heir.inheritance_priority || "",
      heir.is_living ? "Yes" : "No",
      (heir.phone_numbers || []).map((p: any) => p.number).join("; "),
      (heir.emails || []).map((e: any) => e.email).join("; "),
      heir.address || "",
      heir.age_or_dob || "",
      (heir.social_profiles || []).map((s: any) => `${s.platform}: ${s.url}`).join("; "),
      heir.confidence || 0,
      heir.notes || "",
      new Date().toISOString(),
    ]);

    // 5. Append rows
    const appendUrl = `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(sheet)}!A:A:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
    const appendRes = await fetch(appendUrl, {
      method: "POST", headers,
      body: JSON.stringify({ values: rows }),
    });

    if (!appendRes.ok) {
      const err = await appendRes.json().catch(() => ({}));
      return Response.json({ error: `Google Sheets append failed: ${err.error?.message || appendRes.statusText}` }, { status: 502 });
    }

    const appendData = await appendRes.json();

    return Response.json({
      ok: true,
      exported: rows.length,
      spreadsheet_id: spreadsheetId,
      sheet,
      updated_range: appendData.updates?.updatedRange,
      columns: COLUMNS.length,
    });
  } catch (error: any) {
    console.error("Export heir to sheet error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}