import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { SERVICE_CATALOG, REQUIRED_ASSURANCE_ROLES, missingAssuranceRoles } from '../../shared/serviceCatalog.ts';

/**
 * Serves the service catalogue to any surface that displays it — the admin
 * dashboard, the service pages and the public marketing site.
 *
 * Deliberately public and read-only: the catalogue is marketing copy and
 * pricing, not customer data, and the frontend is not allowed to import from
 * base44/ directly. Serving it here is what keeps the marketing page and the
 * admin console describing the same fourteen services.
 */
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    // No auth gate: public pricing content. The SDK client is created only so
    // the function behaves identically whether or not a user is signed in.
    void base44;

    const services = SERVICE_CATALOG.map((s) => ({
      slug: s.slug,
      name: s.name,
      tagline: s.tagline,
      icon: s.icon,
      group: s.group,
      summary: s.summary,
      buyer: s.buyer,
      workflow: s.workflow,
      agents: s.agents,
      pricing: s.pricing,
      deliverables: s.deliverables,
      initiation: s.initiation,
      monitoring: s.monitoring,
      benchmarks: s.benchmarks,
      sources: s.sources,
    }));

    const integrity = SERVICE_CATALOG.filter((s) => missingAssuranceRoles(s).length > 0).map((s) => ({
      slug: s.slug,
      missing_roles: missingAssuranceRoles(s),
    }));

    return Response.json({
      success: true,
      count: services.length,
      required_assurance_roles: REQUIRED_ASSURANCE_ROLES,
      // Empty means every service carries its QA, guardian and validator.
      integrity_gaps: integrity,
      services,
    });
  } catch (error) {
    console.error('[getServiceCatalog] failed:', error?.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}