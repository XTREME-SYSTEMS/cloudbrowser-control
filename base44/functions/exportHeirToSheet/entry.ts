import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import {
  EXPORT_VERIFICATION_COLUMNS,
  columnLetter,
  findColumnConflict,
  resolveCaseVerificationForExport,
} from '../../shared/exportVerification.ts';

/**
 * Exports identified heirs from an heir search to a Google Sheet.
 * Uses the workspace-registered Google Sheets connector (BYO_SHARED).
 *
 * Creates the "Heirs" tab if it doesn't exist, adds headers if missing,
 * then appends one row per identified heir.
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
  "Case Ref", "Deceased Name", "Heir Name", "Relationship", "Inheritance Priority",
  "Is Living", "Phone Numbers", "Emails", "Address", "Age/DOB",
  "Social Profiles", "Confidence %", "Notes", "Export Date",
  ...EXPORT_VERIFICATION_COLUMNS,
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

    // 2. Check that the header row is present AND wide enough for every column we
    // now export. A sheet exported before the verification columns existed has a
    // shorter header row, and writing only when the row is entirely absent would
    // leave the new values sitting under blank headers. Existing columns keep
    // their positions — the new ones are appended — so anything reading A..N or
    // matching on header names is unaffected.
    const headerEnd = columnLetter(COLUMNS.length);
    const checkRes = await fetch(`${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(sheet)}!A1:${headerEnd}1`, { headers });
    const checkData = checkRes.ok ? await checkRes.json().catch(() => ({})) : {};
    const existingHeader: string[] = (checkData.values?.[0] || []).map((h: any) => String(h ?? ""));
    const hasHeaders = existingHeader.length >= COLUMNS.length;

    // A tab can already hold another writer's layout — the heir tracking sync
    // writes a different column set to this same "Heirs" tab. Appending under its
    // headers would put a person's name under "Status" and a phone number under
    // "Confidence %", silently and permanently. Refuse rather than misalign, and
    // name the column that disagrees so the caller can pick another tab.
    const conflict = hasHeaders ? findColumnConflict(COLUMNS, existingHeader) : null;
    if (conflict) {
      return Response.json({
        error: `The "${sheet}" tab holds a different column layout: position ${conflict.index + 1} is "${conflict.existing || "blank"}", but this export writes "${conflict.expected}". Rows cannot be aligned to it, so nothing was written. Export to a different tab name.`,
        column_conflict: true,
        conflicting_column: conflict.expected,
        existing_column: conflict.existing,
      }, { status: 409 });
    }

    // 3. Write headers if missing or narrower than the columns we write
    if (!hasHeaders) {
      await fetch(`${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(sheet)}!A1?valueInputOption=RAW`, {
        method: "PUT", headers,
        body: JSON.stringify({ values: [COLUMNS] }),
      });
    }

    // 4. Resolve verification from the case record itself, never from the
    // payload, so an uncertified result cannot be exported as a verified one.
    const verification = await resolveCaseVerificationForExport(base44, {
      heir_search_id: body.heir_search_id,
      case_reference,
    });

    // 5. Build rows for each identified heir
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
      ...verification.row,
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

    // Write Extreme Deep Findings summary to a second tab if provided
    let deepTabExported = 0;
    if (body.extreme_deep_findings) {
      const deepSheet = "Deep Findings";
      const deepSheetExists = (metaData.sheets || []).some((s: any) => s.properties?.title === deepSheet);
      if (!deepSheetExists) {
        await fetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
          method: "POST", headers,
          body: JSON.stringify({ requests: [{ addSheet: { properties: { title: deepSheet } } }] }),
        });
      }

      const DEEP_COLUMNS = [
        "Case Ref", "Deceased Name", "Confidence %", "Sources", "Methods",
        "UCC Filings", "SEC Litigation", "FEC Contributions", "Username Profiles",
        "Historical WHOIS", "Archived Pages", "Verified Emails", "Verified Phones",
        "Crypto Wallets", "ENS Domains", "Deed Transfers", "Related Owners",
        "Permits", "Violations", "Social Graph Nodes", "Hidden Connections",
        "Central Figures", "Business Entities", "Unclaimed Assets",
        "Cemetery Family Plot", "Immigration Family", "Intl Relatives",
        "Missing Relatives", "Professional Members", "Breach Verified Emails",
        "Export Date",
        ...EXPORT_VERIFICATION_COLUMNS,
      ];

      const deepHeaderEnd = columnLetter(DEEP_COLUMNS.length);
      const deepCheckRes = await fetch(`${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(deepSheet)}!A1:${deepHeaderEnd}1`, { headers });
      const deepCheckData = deepCheckRes.ok ? await deepCheckRes.json().catch(() => ({})) : {};
      const deepHasHeaders = (deepCheckData.values?.[0]?.length || 0) >= DEEP_COLUMNS.length;
      if (!deepHasHeaders) {
        await fetch(`${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(deepSheet)}!A1?valueInputOption=RAW`, {
          method: "PUT", headers,
          body: JSON.stringify({ values: [DEEP_COLUMNS] }),
        });
      }

      const f = body.extreme_deep_findings;
      const deepRow = [
        case_reference || "",
        deceased_name || "",
        body.confidence_score || 0,
        body.sources_count || 0,
        body.methods_count || 0,
        f.ucc_sec_filings || 0,
        f.sec_litigation || 0,
        f.fec_contributions || 0,
        f.username_profiles || 0,
        f.historical_whois || 0,
        f.archived_pages || 0,
        f.verified_emails || 0,
        f.verified_phones || 0,
        f.crypto_wallets || 0,
        f.ens_domains || 0,
        f.deed_transfers || 0,
        f.related_owners || 0,
        f.permits || 0,
        f.violations || 0,
        f.social_graph_nodes || 0,
        f.hidden_connections || 0,
        f.central_figures || 0,
        f.business_entities || 0,
        f.unclaimed_assets || 0,
        f.cemetery_family_plot || 0,
        f.immigration_family || 0,
        f.intl_relatives || 0,
        f.missing_relatives || 0,
        f.professional_members || 0,
        f.breach_verified_emails || 0,
        new Date().toISOString(),
        ...verification.row,
      ];

      const deepAppendUrl = `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(deepSheet)}!A:A:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
      const deepAppendRes = await fetch(deepAppendUrl, {
        method: "POST", headers,
        body: JSON.stringify({ values: [deepRow] }),
      });
      if (deepAppendRes.ok) deepTabExported = 1;
    }

    return Response.json({
      ok: true,
      exported: rows.length,
      deep_findings_exported: deepTabExported,
      spreadsheet_id: spreadsheetId,
      sheet,
      updated_range: appendData.updates?.updatedRange,
      columns: COLUMNS.length,
      // An uncertified case still exports — a working sheet of leads is
      // legitimate — but it exports labelled as draft, not as findings.
      export_mode: verification.exportable_as_certified ? "certified" : "draft",
      certification_status: verification.certification_status,
      evidence_status: verification.evidence_status,
      investigator_approval: verification.investigator_approval,
      case_found: verification.case_found,
      failed_rules: verification.failed_rules,
    });
  } catch (error: any) {
    console.error("Export heir to sheet error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}