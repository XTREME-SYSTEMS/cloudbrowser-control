export async function refreshFactoryBatch(base44, batchId) {
  if (!batchId) return;
  const db = base44.asServiceRole.entities;
  const [batch, grouped, built] = await Promise.all([
    db.BatchOperation.get(batchId),
    db.SystemBuild.aggregate({ query: { batch_id: batchId }, groupBy: 'status' }),
    db.SystemBuild.count({ batch_id: batchId, artifact_uri: { $exists: true, $ne: '' } })
  ]);
  const counts = Object.fromEntries(grouped.rows.map(r => [r.status, r.count]));
  const delivered = counts.delivered || 0;
  const failed = counts.failed || 0;
  const settled = delivered + failed >= batch.batch_size;
  await db.BatchOperation.update(batchId, {
    sites_built: built, sites_deployed: delivered, sites_failed: failed,
    progress: Math.floor(delivered / batch.batch_size * 100),
    status: settled ? (failed ? 'failed' : batch.blockers ? 'blocked' : 'complete') : 'running'
  });
}