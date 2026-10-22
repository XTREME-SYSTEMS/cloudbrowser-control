import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

/**
 * Archive old results, then clear them, so the next cycle starts from a clean
 * ledger without losing anything.
 *
 * reapExpired DELETES expired records. That is retention, not archiving: the
 * record is gone and cannot be produced again. This function preserves the
 * whole record as JSON in SystemArchive FIRST, and only deletes the live copy
 * once that write has landed. If a record cannot be archived it is left alone.
 *
 * Only entities on the allowlist can be touched, so a caller cannot point this
 * at User, a client's case, or any other live record type. Unresolved healing
 * flags are never in scope — an open problem is not history.
 */

const TARGETS: Record<string, { date_field: string; label: string }> = {
  ServiceRun: { date_field: 'created_date', label: 'Service results' },
  TestResult: { date_field: 'created_date', label: 'QA and test results' },
  AutoHealLog: { date_field: 'healed_at', label: 'Heal actions' },
  EngineHealthLog: { date_field: 'created_date', label: 'Engine health logs' },
  HealingFlag: { date_field: 'flagged_at', label: 'Healing flags' },
  LogEntry: { date_field: 'timestamp', label: 'Run logs' },
  ErrorPattern: { date_field: 'created_date', label: 'Error patterns' },
  ScoreRecord: { date_field: 'created_date', label: 'Score records' },
  BenchmarkResult: { date_field: 'created_date', label: 'Benchmark results' },
  Screenshot: { date_field: 'taken_at', label: 'Screenshots' },
};

// What "start fresh" means: finished work only.
const PRESET_RESULTS = [
  { entity: 'ServiceRun', filter: {} },
  { entity: 'TestResult', filter: {} },
  { entity: 'AutoHealLog', filter: {} },
  { entity: 'HealingFlag', filter: { status: 'resolved' } },
];

const MAX_PER_TARGET = 500;
const PAYLOAD_LIMIT = 90000;

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden — admin access required to archive results' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dry_run === true;
    const days = Number.isFinite(body?.older_than_days) ? Number(body.older_than_days) : 30;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const reason = body?.reason || `Retired before a clean start (older than ${days} days)`;

    const requested = body?.preset === 'results'
      ? PRESET_RESULTS
      : body?.entity
        ? [{ entity: body.entity, filter: body.filter || {} }]
        : [];

    if (requested.length === 0) {
      return Response.json(
        { error: 'Nothing to archive. Pass preset "results", or a single entity to archive.' },
        { status: 400 }
      );
    }

    const rejected = requested.filter((t: any) => !TARGETS[t.entity]);
    if (rejected.length > 0) {
      return Response.json(
        {
          error: `Not archivable: ${rejected.map((t: any) => t.entity).join(', ')}. Archivable types: ${Object.keys(TARGETS).join(', ')}.`,
        },
        { status: 400 }
      );
    }

    const batchId = `archive_${Date.now()}`;
    const targets: any[] = [];

    for (const target of requested) {
      const spec = TARGETS[target.entity];
      const query: Record<string, any> = { ...(target.filter || {}) };
      query[spec.date_field] = { $lt: cutoff };

      let records: any[] = [];
      try {
        records = await base44.asServiceRole.entities[target.entity].filter(query, '-created_date', MAX_PER_TARGET);
      } catch (readErr: any) {
        targets.push({
          entity: target.entity,
          label: spec.label,
          matched: 0,
          archived: 0,
          deleted: 0,
          truncated: 0,
          failed: 0,
          error: `Could not read ${target.entity}: ${readErr.message}`,
        });
        continue;
      }

      const ids: string[] = [];
      let archived = 0;
      let truncated = 0;
      let failed = 0;
      const failureReasons: string[] = [];

      for (const record of records || []) {
        let payload = '';
        let wasTruncated = false;
        try {
          payload = JSON.stringify(record);
        } catch {
          payload = '{"note":"record could not be serialised at archive time"}';
          wasTruncated = true;
        }
        if (payload.length > PAYLOAD_LIMIT) {
          payload = payload.slice(0, PAYLOAD_LIMIT);
          wasTruncated = true;
        }

        if (dryRun) {
          archived++;
          if (wasTruncated) truncated++;
          ids.push(record.id);
          continue;
        }

        try {
          await base44.asServiceRole.entities.SystemArchive.create({
            batch_id: batchId,
            entity: target.entity,
            entity_label: spec.label,
            source_id: record.id,
            source_created_date: record[spec.date_field] || record.created_date || null,
            archived_at: new Date().toISOString(),
            archived_by_email: user.email || null,
            reason,
            payload,
            payload_bytes: payload.length,
            payload_truncated: wasTruncated,
            summary: summarise(target.entity, record),
          });
          if (wasTruncated) truncated++;
          archived++;
          ids.push(record.id);
        } catch (writeErr: any) {
          failed++;
          if (failureReasons.length < 3) failureReasons.push(writeErr.message);
        }
      }

      // Only records whose archive write succeeded are cleared. A failed archive
      // leaves its live record untouched, so nothing is lost to a partial run.
      let deleted = 0;
      if (!dryRun && ids.length > 0) {
        try {
          await base44.asServiceRole.entities[target.entity].deleteMany({ id: { $in: ids } });
          deleted = ids.length;
        } catch (delErr: any) {
          failureReasons.push(`Archive landed but clear failed: ${delErr.message}`);
        }
      }

      targets.push({
        entity: target.entity,
        label: spec.label,
        matched: (records || []).length,
        archived,
        deleted,
        truncated,
        failed,
        more_waiting: (records || []).length === MAX_PER_TARGET,
        error: failureReasons.length > 0 ? failureReasons.join(' | ') : undefined,
      });
    }

    const totalArchived = targets.reduce((sum, t) => sum + t.archived, 0);
    const totalDeleted = targets.reduce((sum, t) => sum + t.deleted, 0);
    const totalTruncated = targets.reduce((sum, t) => sum + t.truncated, 0);
    const totalFailed = targets.reduce((sum, t) => sum + t.failed, 0);

    let message: string;
    if (dryRun) {
      message = `Dry run: ${totalArchived} record(s) are old enough to retire. Nothing was written and nothing was cleared.`;
    } else if (totalArchived === 0) {
      message = `Nothing is older than ${days} days, so nothing was retired. The live system was left untouched.`;
    } else {
      message = `Preserved ${totalArchived} record(s) in the archive ledger and cleared ${totalDeleted} from the live system.`;
    }
    if (totalTruncated > 0) message += ` ${totalTruncated} record(s) were too large to preserve whole.`;
    if (totalFailed > 0) message += ` ${totalFailed} record(s) could not be archived and were deliberately left in place.`;

    return Response.json({
      ok: totalFailed === 0,
      batch_id: batchId,
      dry_run: dryRun,
      cutoff,
      older_than_days: days,
      reason,
      targets,
      archived: totalArchived,
      deleted: totalDeleted,
      truncated: totalTruncated,
      failed: totalFailed,
      message,
    });
  } catch (error: any) {
    console.error('archiveResults error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/** One readable line, so the ledger can be read without opening the payload. */
function summarise(entity: string, record: any): string {
  switch (entity) {
    case 'ServiceRun':
      return `${record.service_name || record.service_slug || 'Run'} — ${record.verdict || record.status || 'unknown'}, score ${record.overall_score ?? 0}/100`;
    case 'TestResult':
      return `${record.suite || 'suite'} / ${record.test_name || 'test'} — ${record.status || 'unknown'}`;
    case 'HealingFlag':
      return `${record.flag_type || 'flag'}: ${record.source_title || record.source_id || 'unnamed source'} — ${record.status || 'unknown'}`;
    case 'AutoHealLog':
      return `${record.target_name || record.target_id || 'target'} — ${record.issue_detected || 'issue'} to ${record.action_taken || 'action'} (${record.action_result || 'unknown'})`;
    default:
      return `${entity} ${record.id}`;
  }
}