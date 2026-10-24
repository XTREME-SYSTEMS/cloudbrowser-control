import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { observeFleet, observeMachine, diagnose } from '../../shared/openClawDiagnose.ts';

/**
 * OpenClaw's full-system diagnostic probe.
 *
 * It only reads. It repairs nothing, decides nothing and proposes nothing it does
 * not report: the engine fleet, the Railway project and the paired machine are
 * read through the same observation path the autonomy cycle uses, the readings are
 * turned into problems, and the whole report is preserved in the archive ledger so
 * an hour of the system's life can be read back later.
 *
 * Run by the "OpenClaw Diagnostic Probe" workflow, hourly. Admin-only, because it
 * reaches the operator's machine and appends to the ledger.
 */

const PAYLOAD_LIMIT = 90000;

/** Which build each engine is running, so a drifted fleet is visible as drift. */
function parityOf(engines) {
  const versions = [...new Set(engines.map((engine) => engine.version).filter(Boolean))];
  const regions = [...new Set(engines.map((engine) => engine.region).filter((region) => region && region !== 'unknown'))];

  return {
    same_build: versions.length <= 1,
    versions,
    regions,
    region_uniform: regions.length <= 1,
    note: versions.length > 1
      ? `The fleet is not all on one build (${versions.join(', ')}). Build drift is what produces an engine that answers probes but cannot launch a browser.`
      : null,
  };
}

function verdictOf({ engines, problems, unreadable }) {
  if (unreadable.length > 0 && engines.length === 0) return 'unreadable';
  if ((problems || []).some((problem) => problem.severity === 'high')) return 'attention';
  if ((problems || []).length > 0) return 'degraded';
  return 'clean';
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    let body = {};
    try {
      body = await req.json();
    } catch {
      // A scheduled call may carry no body at all.
    }

    const startedAt = new Date().toISOString();
    const startedMs = Date.now();
    const triggeredBy = body?.triggered_by === 'schedule' ? 'schedule' : body?.triggered_by || 'operator';
    const probeId = `probe_${startedMs}`;

    // A leg that cannot be read is recorded as unreadable, never guessed at: the
    // probe still reports everything else rather than failing whole.
    const unreadable = [];

    let fleet = { engines: [], railway: { ok: false, services: 0, failed: [], error: null }, engine_key_configured: false };
    try {
      fleet = await observeFleet(base44);
    } catch (error) {
      unreadable.push({ leg: 'engine_fleet', error: error.message });
    }

    let machine = { connected: false, paired: false, status: 'unknown', problems: null };
    try {
      machine = await observeMachine(base44);
    } catch (error) {
      unreadable.push({ leg: 'paired_machine', error: error.message });
      machine = { connected: false, paired: true, status: 'error', problems: null };
    }

    const engines = fleet.engines || [];
    const { problems, proposals } = diagnose({ fleet, machine });

    const report = {
      probe_id: probeId,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - startedMs,
      triggered_by: triggeredBy,
      requested_by_email: user.email || null,
      fleet: {
        engine_key_configured: Boolean(fleet.engine_key_configured),
        engines,
        railway: fleet.railway,
      },
      machine,
      parity: parityOf(engines),
      problems,
      proposals,
      unreadable,
    };

    const verdict = verdictOf({ engines, problems, unreadable });
    const serving = engines.filter((engine) => engine.serving).length;
    const summary = [
      `Full diagnostic: ${verdict}`,
      `${serving}/${engines.length} engines serving browser work`,
      `${(problems || []).length} problem(s)`,
      machine.connected ? 'paired machine read' : 'paired machine not read',
      unreadable.length ? `${unreadable.length} leg(s) unreadable` : null,
    ].filter(Boolean).join(' · ');

    // Preserved whole, and disclosed when it could not be. A truncated payload is
    // never presented as a complete report.
    const payload = JSON.stringify(report);
    const truncated = payload.length > PAYLOAD_LIMIT;

    const archived = await base44.asServiceRole.entities.SystemArchive.create({
      batch_id: `probe_${startedMs}`,
      entity: 'SystemProbe',
      entity_label: 'Full-system diagnostic probes',
      source_id: probeId,
      source_created_date: startedAt,
      archived_at: new Date().toISOString(),
      archived_by_email: user.email || null,
      reason: `OpenClaw diagnostic probe (${triggeredBy})`,
      payload: truncated ? payload.slice(0, PAYLOAD_LIMIT) : payload,
      payload_bytes: Math.min(payload.length, PAYLOAD_LIMIT),
      payload_truncated: truncated,
      summary,
    });

    return Response.json({
      ok: true,
      probe_id: probeId,
      verdict,
      summary,
      serving_engines: `${serving}/${engines.length}`,
      problems,
      proposals,
      parity: report.parity,
      machine_connected: Boolean(machine.connected),
      railway_ok: Boolean(fleet.railway?.ok),
      unreadable,
      archived_id: archived?.id || null,
      duration_ms: report.duration_ms,
    });
  } catch (error) {
    console.error('runDiagnosticProbe failed:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}