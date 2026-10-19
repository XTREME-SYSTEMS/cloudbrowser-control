import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// ═══════════════════════════════════════════════
// INGESTION BATCH STATUS
// Returns progress for an async bulk intelligence ingestion batch.
//
// Input: { batch_id: string }
// Output: { batch_id, status, total_items, processed, succeeded, failed, artifacts_created, duplicates_skipped, ... }
// ═══════════════════════════════════════════════

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    let body = {};
    try { body = await req.json(); } catch (_) {}
    const { batch_id } = body;

    if (!batch_id) {
      // List recent batches
      const recent = await base44.asServiceRole.entities.IntelligenceIngestionBatch.list('-started_at', 20);
      return Response.json({ batches: recent, count: recent.length });
    }

    const batches = await base44.asServiceRole.entities.IntelligenceIngestionBatch.filter({ batch_id });
    if (!batches.length) return Response.json({ error: 'Batch not found' }, { status: 404 });

    return Response.json(batches[0]);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}