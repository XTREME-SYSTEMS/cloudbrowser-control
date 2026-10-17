import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";

export default async function(req) {
  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { pipeline_id } = body;
    if (!pipeline_id) return Response.json({ error: "pipeline_id required" }, { status: 400 });

    const pipeline = await base44.entities.IntelligencePipeline.get(pipeline_id);
    if (!pipeline) return Response.json({ error: "Pipeline not found" }, { status: 404 });

    const syncResults = { drive: null, sheets: null, errors: [] };

    // Try Google Sheets sync — create a sheet with pipeline data
    try {
      const conn = await base44.asServiceRole.connectors.getConnection("googlesheets");
      if (conn?.accessToken) {
        // Create a new spreadsheet
        const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
          method: "POST",
          headers: { Authorization: `Bearer ${conn.accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            properties: { title: `Intelligence Pipeline — ${pipeline.industry} — ${new Date().toISOString().slice(0, 10)}` },
          }),
          signal: AbortSignal.timeout(15000),
        });
        const sheetData = await createRes.json();
        if (sheetData.spreadsheetId) {
          // Write pipeline data as rows
          const rows = [
            ["Intelligence Pipeline Report"],
            ["Industry", pipeline.industry],
            ["Target Market", pipeline.target_market || ""],
            ["Goals", pipeline.goals || ""],
            ["Generated", new Date().toISOString()],
            [],
            ["STEP", "STATUS", "DATA"],
          ];
          if (pipeline.national_demand_map?.services) {
            rows.push(["National Demand Map", "Complete", `${pipeline.national_demand_map.services.length} services analyzed`]);
          }
          if (pipeline.social_signals?.top_complaints) {
            rows.push(["Social Media Scan", "Complete", `${pipeline.social_signals.top_complaints.length} complaints found`]);
          }
          if (pipeline.brand_options?.length) {
            rows.push(["Brand Options", "Complete", `${pipeline.brand_options.length} options generated`]);
          }
          if (pipeline.sales_assets?.sales_pitches) {
            rows.push(["Sales Assets", "Complete", `${pipeline.sales_assets.sales_pitches.length} pitches generated`]);
          }

          await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetData.spreadsheetId}/values/A1:append?valueInputOption=RAW`, {
            method: "POST",
            headers: { Authorization: `Bearer ${conn.accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ values: rows }),
            signal: AbortSignal.timeout(15000),
          });

          syncResults.sheets = { url: sheetData.spreadsheetUrl, id: sheetData.spreadsheetId };
        }
      } else {
        syncResults.errors.push("Google Sheets connector not connected");
      }
    } catch (e) {
      syncResults.errors.push(`Sheets sync failed: ${e.message}`);
    }

    // Try Google Drive sync — create a summary doc
    try {
      const conn = await base44.asServiceRole.connectors.getConnection("googledrive");
      if (conn?.accessToken) {
        const summary = `Intelligence Pipeline Report\n\nIndustry: ${pipeline.industry}\nTarget: ${pipeline.target_market}\nGoals: ${pipeline.goals}\n\nGenerated: ${new Date().toISOString()}\n\nThis report contains compiled intelligence from the Strategic Minds AI Intelligence Command Center.`;
        const metadata = {
          name: `Intelligence Report — ${pipeline.industry} — ${new Date().toISOString().slice(0, 10)}.txt`,
          mimeType: "text/plain",
        };
        const boundary = "-------314159265358979323846";
        const body_drive = `--${boundary}\nContent-Type: application/json; charset=UTF-8\n\n${JSON.stringify(metadata)}\n--${boundary}\nContent-Type: text/plain\n\n${summary}\n--${boundary}--`;
        const driveRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
          method: "POST",
          headers: { Authorization: `Bearer ${conn.accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` },
          body: body_drive,
          signal: AbortSignal.timeout(15000),
        });
        const driveData = await driveRes.json();
        if (driveData.id) {
          syncResults.drive = { id: driveData.id, name: driveData.name };
        }
      } else {
        syncResults.errors.push("Google Drive connector not connected");
      }
    } catch (e) {
      syncResults.errors.push(`Drive sync failed: ${e.message}`);
    }

    await base44.entities.IntelligencePipeline.update(pipeline_id, { google_sync_status: syncResults });

    return Response.json({ ok: true, data: syncResults });
  } catch (error) {
    console.error("runGoogleIntelSync error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}