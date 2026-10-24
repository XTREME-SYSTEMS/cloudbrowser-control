import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

// ═══════════════════════════════════════════════
// Retention Reaper — deletes expired records based on SystemSettings
// Produces evidence of what was reaped.
//
// Workflow-only, and it deletes records, so it carries the guard every
// workflow-called function must: a signed-in admin, nothing less. It previously
// carried none, which left a public endpoint that would delete whatever an
// arbitrary caller named — any entity, any age, any filter. Only the Retention
// Reaper workflow and the admin-only autonomy agent call it.
// ═══════════════════════════════════════════════

// Clearing cannot be paged by query alone: the cleared field is not part of the
// query, so a second pass would match the same rows forever. One batch per run.
const BATCH_LIMIT = 500;

export default async function (req) {
  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

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

    // Batch, never one call per record. The previous loop issued up to 10,000
    // sequential API calls in a single run — which is why reaper runs took two
    // minutes and why engine telemetry was never brought under retention at all.
    // Both paths below are two calls regardless of how much expired.
    const scope = base44.asServiceRole.entities[entity];

    let deleted = 0;
    let cleared = 0;
    let remaining = 0;

    if (clear_field) {
      const page = await scope.filter(query, { sort: "-created_date", limit: BATCH_LIMIT });
      const batch = page.items || [];
      if (batch.length) {
        await scope.updateMany(
          { id: { $in: batch.map((record) => record.id) } },
          { $set: { [clear_field]: null } },
        );
        cleared = batch.length;
      }
      remaining = page.has_more ? await scope.count(query) : 0;
    } else {
      deleted = await scope.count(query);
      if (deleted) await scope.deleteMany(query);
    }

    return Response.json({
      ok: true,
      entity,
      retention_days: retentionDays,
      cutoff: cutoff.toISOString(),
      deleted,
      cleared,
      remaining,
      total_processed: deleted + cleared,
      reaped_by: user.email,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}