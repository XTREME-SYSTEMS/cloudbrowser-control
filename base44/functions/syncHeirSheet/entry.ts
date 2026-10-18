import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';

/**
 * Syncs the heir tracking Google Sheet with the current database state.
 * Rewrites the sheet so failed searches are removed — only found/partial
 * records and their identified heirs are written.
 *
 * Called after each heir search completes, and on-demand from the dashboard.
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
  "Case Ref", "Deceased Name", "Status", "Confidence %",
  "Heir Name", "Relationship", "Inheritance Priority",
  "Is Living", "Phone Numbers", "Emails", "Address", "Age/DOB",
  "Social Profiles", "Heir Confidence %", "Notes", "Sync Date",
];

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const spreadsheetUrl = body.spreadsheet_url || '';
    const sheetName = body.sheet_name || 'Heirs';

    const trackingUrl = spreadsheetUrl || secrets.get('HEIR_TRACKING_SHEET_URL') || '';
    const spreadsheetId = extractSpreadsheetId(trackingUrl);
    if (!spreadsheetId) {
      return Response.json({ error: "No tracking sheet URL configured. Set HEIR_TRACKING_SHEET_URL in secrets or pass spreadsheet_url." }, { status: 400 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection("googlesheets");
    const headers = {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };

    // 1. Ensure sheet tab exists
    const metaRes = await fetch(`${SHEETS_API}/${spreadsheetId}`, { headers });
    if (!metaRes.ok) {
      const err = await metaRes.json().catch(() => ({}));
      return Response.json({ error: `Cannot access spreadsheet: ${err.error?.message || metaRes.statusText}` }, { status: 502 });
    }
    const metaData = await metaRes.json();
    const sheetExists = (metaData.sheets || []).some((s: any) => s.properties?.title === sheetName);
    if (!sheetExists) {
      await fetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
        method: "POST", headers,
        body: JSON.stringify({ requests: [{ addSheet: { properties: { title: sheetName } } }] }),
      });
    }

    // 2. Load all non-failed heir searches (found + partial only — removes failed from sheet)
    const found = await base44.entities.HeirSearch.filter(
      { status: { $in: ["found", "partial"] } },
      { sort: "-created_date", limit: 500, fields: [
        "deceased_name", "case_reference", "status", "confidence_score",
        "identified_heirs",
      ] }
    );
    const records = found.items || found || [];

    // 3. Build all rows — one per identified heir
    const rows: any[][] = [];
    const syncDate = new Date().toISOString();
    for (const rec of records) {
      const heirs = rec.identified_heirs || [];
      if (heirs.length === 0) {
        // Still write a row for the case even if no heirs found yet
        rows.push([
          rec.case_reference || "",
          rec.deceased_name || "",
          rec.status || "",
          rec.confidence_score || 0,
          "", "", "", "", "", "", "", "", "", "", "", syncDate,
        ]);
      } else {
        for (const heir of heirs) {
          rows.push([
            rec.case_reference || "",
            rec.deceased_name || "",
            rec.status || "",
            rec.confidence_score || 0,
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
            syncDate,
          ]);
        }
      }
    }

    // 4. Clear existing sheet content (all rows below row 1)
    const clearRes = await fetch(
      `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A2:Z`,
      { method: "DELETE", headers }
    );
    if (!clearRes.ok && clearRes.status !== 404) {
      // Non-fatal — continue, we'll overwrite
      console.error("Sheet clear failed:", clearRes.status);
    }

    // 5. Write headers to row 1
    await fetch(`${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A1?valueInputOption=RAW`, {
      method: "PUT", headers,
      body: JSON.stringify({ values: [COLUMNS] }),
    });

    // 6. Write all data rows starting at A2
    let written = 0;
    if (rows.length > 0) {
      const writeRes = await fetch(
        `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A2?valueInputOption=RAW`,
        {
          method: "PUT", headers,
          body: JSON.stringify({ values: rows }),
        }
      );
      if (!writeRes.ok) {
        const err = await writeRes.json().catch(() => ({}));
        return Response.json({ error: `Sheet write failed: ${err.error?.message || writeRes.statusText}` }, { status: 502 });
      }
      written = rows.length;
    }

    return Response.json({
      ok: true,
      synced: true,
      records_synced: records.length,
      rows_written: written,
      failed_excluded: true,
      spreadsheet_id: spreadsheetId,
      sheet: sheetName,
    });
  } catch (error: any) {
    console.error("Sync heir sheet error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}