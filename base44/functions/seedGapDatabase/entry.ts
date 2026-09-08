import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";
import { getSeedTemplate, extractSeedDataFromContent, type Industry } from "../../shared/gapIntelligence.ts";

/**
 * DEEP Gap Intelligence — Seed Gap Database
 *
 * For a given clone project, scrapes the target site's own public content
 * (JSON-LD, sitemap, visible text, product listings) and generates a complete
 * mock database seed file with realistic data.
 *
 * This eliminates the "database gap" ambiguity — instead of guessing what the
 * backend database looks like, we SEED it from the site's own public data.
 */

export default async function (req: Request) {
  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { clone_project_id, gap_id } = body;
    if (!clone_project_id)
      return Response.json({ error: "clone_project_id is required" }, { status: 400 });

    // Load the clone project
    const project = await base44.entities.CloneProject.get(clone_project_id);
    if (!project) return Response.json({ error: "Clone project not found" }, { status: 404 });

    // Load the DOM asset
    const assets = await base44.entities.CloneAsset.filter({ clone_project_id });
    const domAsset = assets.find((a) => a.asset_type === "dom");

    let htmlContent = "";
    if (domAsset) {
      const domResponse = await fetch(domAsset.file_url);
      htmlContent = await domResponse.text();
    }

    // ═══════════════════════════════════════════
    // 1. EXTRACT REAL DATA FROM SITE CONTENT
    // ═══════════════════════════════════════════
    const extractedData = extractSeedDataFromContent(htmlContent);

    // ═══════════════════════════════════════════
    // 2. DETECT INDUSTRY (if not already set)
    // ═══════════════════════════════════════════
    let industry = (project as any).industry || "generic";

    // If industry not set, use LLM to detect it from the HTML
    if (industry === "generic" && htmlContent.length > 100) {
      const industryResult = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this HTML content and determine the industry of the website. 
Return only one of these exact values: ecommerce, real_estate, job_board, saas, social, news, education, healthcare, finance, directory, generic

HTML content (first 3000 chars):
${htmlContent.substring(0, 3000)}`,
        response_json_schema: {
          type: "object",
          properties: {
            industry: { type: "string" },
            confidence: { type: "number" },
          },
        },
      });
      industry = (industryResult as any).industry || "generic";
    }

    // ═══════════════════════════════════════════
    // 3. GET SEED TEMPLATE + MERGE EXTRACTED DATA
    // ═══════════════════════════════════════════
    const seedTemplate = getSeedTemplate(industry as Industry);
    const seedData: Record<string, any[]> = { ...extractedData };

    for (const collection of seedTemplate.collections) {
      if (!seedData[collection.name] || seedData[collection.name].length === 0) {
        // Generate synthetic records
        seedData[collection.name] = Array.from({ length: collection.recordCount }, (_, i) => {
          const record: any = { id: `seed-${collection.name}-${i}` };
          for (const [field, type] of Object.entries(collection.fields)) {
            if (field === "id") continue;
            record[field] = generateMockValue(field, type as string, i, collection.name);
          }
          return record;
        });
      }
    }

    // ═══════════════════════════════════════════
    // 4. GENERATE SEED SQL + JSON FILES
    // ═══════════════════════════════════════════
    const seedJson = JSON.stringify(seedData, null, 2);
    const seedSql = generateSeedSql(seedData);

    // Upload seed JSON
    const jsonFile = new File([seedJson], `seed-${clone_project_id}.json`, { type: "application/json" });
    const jsonUpload = await base44.integrations.Core.UploadFile({ file: jsonFile });

    // Upload seed SQL
    const sqlFile = new File([seedSql], `seed-${clone_project_id}.sql`, { type: "text/plain" });
    const sqlUpload = await base44.integrations.Core.UploadFile({ file: sqlFile });

    // Store as CloneAsset
    await base44.entities.CloneAsset.create({
      clone_project_id,
      asset_type: "form_schema",
      file_url: jsonUpload.file_url,
      status: "captured",
      viewport: "none",
      metadata: { seed_type: "database_seed", industry, collections: Object.keys(seedData) },
    });

    // ═══════════════════════════════════════════
    // 5. UPDATE GAP IF PROVIDED
    // ═══════════════════════════════════════════
    if (gap_id) {
      await base44.entities.CloneGap.update(gap_id, {
        seed_data: seedData,
        industry_detected: industry,
        status: "resolved",
        resolution_strategy: "seed_data",
        confidence_score: 85,
      });

      // Update resolution if linked
      const gap = await base44.entities.CloneGap.get(gap_id);
      if (gap?.resolution_id) {
        await base44.entities.GapResolution.update(gap.resolution_id, {
          strategy_used: "seed_data",
          seed_data: seedData,
          industry_detected: industry,
          confidence_score: 85,
          status: "resolved",
          resolved_at: new Date().toISOString(),
          resolution_summary: `Seeded ${Object.keys(seedData).length} collections with ${Object.values(seedData).reduce((s, arr) => s + arr.length, 0)} records from ${industry} template + site extraction`,
        });
      }
    }

    return Response.json({
      ok: true,
      clone_project_id,
      gap_id: gap_id || null,
      industry_detected: industry,
      collections: Object.keys(seedData),
      total_records: Object.values(seedData).reduce((s, arr) => s + arr.length, 0),
      extracted_from_site: Object.values(extractedData).reduce((s, arr) => s + arr.length, 0),
      synthetic_generated: Object.values(seedData).reduce((s, arr) => s + arr.length, 0) - Object.values(extractedData).reduce((s, arr) => s + arr.length, 0),
      seed_json_url: jsonUpload.file_url,
      seed_sql_url: sqlUpload.file_url,
      __v: DEPLOYMENT_VERSION,
    });
  } catch (error) {
    console.error("seedGapDatabase error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Generate SQL INSERT statements from seed data.
 */
function generateSeedSql(seedData: Record<string, any[]>): string {
  let sql = "-- Auto-generated mock database seed\n-- Generated by DEEP Gap Intelligence Engine\n\n";

  for (const [collectionName, records] of Object.entries(seedData)) {
    if (records.length === 0) continue;

    // Create table
    const fields = Object.keys(records[0]);
    sql += `CREATE TABLE IF NOT EXISTS ${collectionName} (\n`;
    sql += fields.map((f) => `  "${f}" TEXT`).join(",\n");
    sql += "\n);\n\n";

    // Insert records
    for (const record of records) {
      const values = fields.map((f) => {
        const v = record[f];
        if (v === null || v === undefined) return "NULL";
        if (typeof v === "number") return String(v);
        if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
        return `'${String(v).replace(/'/g, "''")}'`;
      });
      sql += `INSERT INTO ${collectionName} (${fields.map((f) => `"${f}"`).join(", ")}) VALUES (${values.join(", ")});\n`;
    }
    sql += "\n";
  }

  return sql;
}

/**
 * Generate a realistic mock value for a field.
 */
function generateMockValue(fieldName: string, fieldType: string, index: number, collectionName: string): any {
  const name = fieldName.toLowerCase();

  if (fieldType === "number") {
    if (name.includes("price") || name.includes("salary")) return Math.round((19 + Math.random() * 480) * 100) / 100;
    if (name.includes("rating")) return Math.round((3 + Math.random() * 2) * 10) / 10;
    if (name.includes("count")) return Math.floor(Math.random() * 100);
    if (name.includes("sqft")) return Math.floor(800 + Math.random() * 3000);
    if (name.includes("bedroom")) return Math.floor(1 + Math.random() * 5);
    if (name.includes("bathroom")) return Math.floor(1 + Math.random() * 3);
    return Math.floor(Math.random() * 100);
  }

  if (fieldType === "boolean") {
    if (name.includes("stock")) return Math.random() > 0.2;
    if (name.includes("remote")) return Math.random() > 0.5;
    return Math.random() > 0.5;
  }

  if (fieldType === "string") {
    if (name.includes("email")) return `user${index}@example.com`;
    if (name.includes("url") || name.includes("image") || name.includes("avatar") || name.includes("logo"))
      return `https://images.unsplash.com/photo-${1500000000000 + index * 1000000}?w=400`;
    if (name.includes("phone")) return `+1-555-${String(index).padStart(4, "0")}`;
    if (name.includes("address")) return `${100 + index} Main St, City ${index}`;
    if (name.includes("name")) {
      const names = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta"];
      return `${names[index % names.length]} ${collectionName.slice(0, -1)}`;
    }
    if (name.includes("title")) return `${collectionName.slice(0, -1)} ${index + 1}`;
    if (name.includes("description")) return `This is a sample ${collectionName.slice(0, -1)} with description ${index + 1}.`;
    if (name.includes("slug")) return `${collectionName}-${index}`;
    if (name.includes("status")) return ["active", "pending", "completed"][index % 3];
    if (name.includes("category")) return ["Category A", "Category B", "Category C"][index % 3];
    if (name.includes("role")) return ["admin", "user", "editor"][index % 3];
    if (name.includes("type")) return ["standard", "premium", "enterprise"][index % 3];
    if (name.includes("currency")) return "USD";
    return `value-${index}`;
  }

  if (fieldType === "array") return [];

  return null;
}