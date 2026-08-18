import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

export default async function (req) {
  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { job_id, format = "json" } = body;
    if (!job_id) return Response.json({ error: "job_id required" }, { status: 400 });

    const results = await base44.entities.Result.filter({ job_id });
    if (!results.length) return Response.json({ error: "No results found" }, { status: 404 });

    let output;
    let contentType;
    let filename = `results_${job_id}`;

    if (format === "json") {
      output = JSON.stringify(results, null, 2);
      contentType = "application/json";
      filename += ".json";
    } else if (format === "csv") {
      // Flatten results to CSV
      const rows = results.map((r) => {
        const flat = { job_id: r.job_id, step_id: r.step_id, data_type: r.data_type, extracted_at: r.extracted_at };
        if (r.data && typeof r.data === "object") Object.assign(flat, r.data);
        return flat;
      });
      const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
      output = [headers.join(",")];
      for (const row of rows) output.push(headers.map((h) => JSON.stringify(row[h] || "")).join(","));
      output = output.join("\n");
      contentType = "text/csv";
      filename += ".csv";
    } else {
      return Response.json({ error: "Unsupported format. Use json or csv." }, { status: 400 });
    }

    // Upload as file
    const file = new File([output], filename, { type: contentType });
    const uploadResult = await base44.integrations.Core.UploadFile({ file });

    return Response.json({ file_url: uploadResult.file_url, filename, format, count: results.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}