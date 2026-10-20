import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { SERVICE_CATALOG } from '../../shared/serviceCatalog.ts';

/**
 * Writes the competitor workflows behind each service into the benchmark
 * system, so the standard the platform measures itself against lives in the
 * app rather than in somebody's memory.
 *
 * Vendor marketing is recorded as vendor_claim_unverified. That label is the
 * point: a competitor's published number is a claim until it is measured here.
 * Idempotent — a benchmark already recorded under the same title is left alone.
 */
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const existing = await base44.asServiceRole.entities.IndustryBenchmark.list('-created_date', 500);
    const existingTitles = new Set((existing || []).map((r) => r.title));

    const toCreate = [];
    let order = 0;

    for (const service of SERVICE_CATALOG) {
      for (const b of service.benchmarks) {
        order += 1;
        const title = `${service.name} — ${b.company}`;
        if (existingTitles.has(title)) continue;
        toCreate.push({
          category: 'competitor_benchmark',
          title,
          authority: b.company,
          citation: 'Competitor public pricing and capability pages, read while building the service catalogue.',
          source_url: service.sources?.[0] || '',
          requirement: b.how_they_run,
          our_target: `Run the same ${service.workflow.length}-step spine for "${service.name}", with the QA, guardian and independent validation gates in place before anything is delivered.`,
          our_gap:
            'The workflow, the named agents, the price band and the monitoring are defined and runnable. What is not yet evidenced is completed delivery to a third-party client on this service.',
          verification_status: b.verification,
          priority: b.verification === 'vendor_claim_unverified' ? 'P2' : 'P1',
          display_order: order,
        });
      }
    }

    if (toCreate.length === 0) {
      return Response.json({
        success: true,
        created: 0,
        already_recorded: existingTitles.size,
        message: 'Every service benchmark is already recorded.',
      });
    }

    const created = await base44.asServiceRole.entities.IndustryBenchmark.bulkCreate(toCreate);

    return Response.json({
      success: true,
      created: created.length,
      benchmarks_already_in_the_system: existingTitles.size,
      services_covered: SERVICE_CATALOG.length,
      note: 'Competitor entries are stored with their verification status so a vendor claim is never read as a measurement.',
    });
  } catch (error) {
    console.error('[seedServiceBenchmarks] failed:', error?.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}