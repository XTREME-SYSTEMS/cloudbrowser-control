import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

// ═══════════════════════════════════════════════
// Retention Reaper — deletes expired records based on SystemSettings
// Produces evidence of what was reaped.
// ═══════════════════════════════════════════════

export default async function (req) {
  const base44 = createClientFromRequest(req);
  try {
    const body = await req.json();
    const { entity, date_field, setting_key, default_days, clear_field, filter } = body;

    if (!entity || !date_field) return Response.json({ error: "entity and date_field required" }, { status: 400 });

    // Load retention setting
    const settings = await base44.asServiceRole.entities.SystemSettings.list("-created_date", 1);
    const sys = settings[0] || {};
    const retentionDays = sys[setting_key] || default_days;
    const autoDelete = sys.auto_delete_expired !== false;

    if (!autoDelete) {
      return Response.json({ ok: true, skipped: true, reason: "auto_delete_expired is disabled" });
    }

    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    // Build query filter
    const query = { ...filter };
    query[date_field] = { $lt: cutoff.toISOString() };

    // Fetch matching records
    const entityName = entity;
    const records = await base44.asServiceRole.entities[entityName].filter(query, "-created_date", 10000);

    let deleted = 0;
    let cleared = 0;

    for (const record of records) {
      try {
        if (clear_field) {
          // Don't delete — just clear the field (e.g., video_url)
          await base44.asServiceRole.entities[entityName].update(record.id, { [clear_field]: null });
          cleared++;
        } else {
          await base44.asServiceRole.entities[entityName].delete(record.id);
          deleted++;
        }
      } catch (e) { /* skip individual failures */ }
    }

    return Response.json({
      ok: true,
      entity,
      retention_days: retentionDays,
      cutoff: cutoff.toISOString(),
      deleted,
      cleared,
      total_processed: records.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}