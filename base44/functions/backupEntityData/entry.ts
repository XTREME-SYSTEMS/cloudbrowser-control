import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// Entities to back up — user-created business data.
const BACKUP_ENTITIES = [
  "Session", "Job", "UserAgent", "Sandbox", "Subscription", "ApiKey",
  "PromoCode", "Project", "CloneProject", "CloneAsset", "CloneGap",
  "OnboardingProfile", "McpConfig", "Proxy", "Template", "Schedule",
  "IntelligenceSeed", "IntelligenceArtifact", "MoneyTrail", "OutreachCampaign",
  "Prospect", "OutreachMessage", "DataAsset", "VisionCortexConnection",
  "SystemEnhancement", "Setting", "AutoHealLog", "EngineHealthLog",
  "BrainSyncLog", "BrainCommand", "CaptchaSolveLog", "TestResult",
  "Base44Purchase",
];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const svc = base44.asServiceRole;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const results = [];

    for (const entityName of BACKUP_ENTITIES) {
      try {
        // Paginate — fetch up to 500 records per entity (covers most cases).
        const records = await svc.entities[entityName].list('-created_date', 500);
        const payload = {
          entity: entityName,
          exported_at: new Date().toISOString(),
          record_count: records.length,
          records,
        };
        const jsonStr = JSON.stringify(payload, null, 2);
        const file = new File([jsonStr], `backup-${entityName}-${timestamp}.json`, {
          type: 'application/json',
        });

        const uploadRes = await svc.integrations.Core.UploadFile({ file });
        results.push({
          entity: entityName,
          count: records.length,
          file_url: uploadRes.file_url,
          status: 'ok',
        });
      } catch (e) {
        // Some entities may not exist or may be restricted — log and continue.
        results.push({ entity: entityName, status: 'error', error: e.message });
      }
    }

    // Create a manifest file for this backup run.
    const manifest = {
      backup_at: new Date().toISOString(),
      triggered_by: user.email,
      entity_count: BACKUP_ENTITIES.length,
      results,
    };
    const manifestStr = JSON.stringify(manifest, null, 2);
    const manifestFile = new File([manifestStr], `backup-manifest-${timestamp}.json`, {
      type: 'application/json',
    });
    const manifestRes = await svc.integrations.Core.UploadFile({ file: manifestFile });

    return Response.json({
      status: 'success',
      timestamp,
      entities_backed_up: results.filter(r => r.status === 'ok').length,
      entities_failed: results.filter(r => r.status === 'error').length,
      manifest_url: manifestRes.file_url,
      results,
    });
  } catch (error) {
    console.error('Backup failed:', error);
    return Response.json({ error: error.message, status: 'failed' }, { status: 500 });
  }
}