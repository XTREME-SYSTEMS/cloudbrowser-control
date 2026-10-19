import { createClientFromRequest } from "npm:@base44/sdk@0.8.48";

const REQUIRED_ENTITIES = [
  "SystemManifest",
  "EvidenceReceipt",
  "RepairTask",
  "BenchmarkResult",
  "AuditLog",
  "Setting",
];

export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

    const checks: Record<string, any> = {};
    for (const entityName of REQUIRED_ENTITIES) {
      try {
        const entity = (base44.asServiceRole.entities as any)[entityName];
        if (!entity || typeof entity.list !== "function") {
          checks[entityName] = { available: false, error: "entity adapter missing" };
          continue;
        }
        const rows = await entity.list("-created_date", 1).catch(async () => entity.list(undefined, 1));
        checks[entityName] = { available: true, readable: true, sample_count: Array.isArray(rows) ? rows.length : 0 };
      } catch (error: any) {
        checks[entityName] = { available: false, readable: false, error: error?.message || String(error) };
      }
    }

    const missing = REQUIRED_ENTITIES.filter((name) => !checks[name]?.available);
    let manifest: any = null;
    if (checks.SystemManifest?.available) {
      const manifests = await base44.asServiceRole.entities.SystemManifest.list("-registered_at", 100).catch(() => []);
      manifest = manifests.find((m: any) =>
        m.base44_app_id === "6a837c8e995cc4824aabf594" ||
        m.canonical_repo === "XTREME-SYSTEMS/cloudbrowser-control"
      ) || null;
    }

    const blockers: string[] = [];
    if (missing.length) blockers.push(`missing_control_plane_entities:${missing.join(",")}`);
    if (!manifest) blockers.push("cloudbrowser_system_manifest_missing");
    if (manifest && !manifest.canonical_sha) blockers.push("canonical_sha_not_pinned");
    if (manifest && manifest.protected_gate !== true) blockers.push("protected_gate_not_enabled");

    let autocompleteSettings: any[] = [];
    if (checks.Setting?.available) {
      const settings = await base44.asServiceRole.entities.Setting.list("-changed_at", 500).catch(() => []);
      autocompleteSettings = settings.filter((s: any) => String(s.setting_key || "").startsWith("autocomplete."));
    }

    let receipts = 0;
    if (checks.AuditLog?.available) {
      const logs = await base44.asServiceRole.entities.AuditLog.list("-timestamp", 200).catch(() => []);
      receipts = logs.filter((r: any) => r.entity_type === "autocomplete_continuous_cycle").length;
    }

    return Response.json({
      ok: blockers.length === 0,
      control_plane_materialized: missing.length === 0,
      required_entities: checks,
      manifest: manifest ? {
        id: manifest.id,
        system_name: manifest.system_name,
        canonical_repo: manifest.canonical_repo,
        canonical_branch: manifest.canonical_branch,
        canonical_sha: manifest.canonical_sha,
        base44_app_id: manifest.base44_app_id,
        protected_gate: manifest.protected_gate,
        autocomplete_mode: manifest.autocomplete_mode,
        status: manifest.status,
        health_state: manifest.health_state,
        health_score: manifest.health_score,
      } : null,
      autocomplete_settings_count: autocompleteSettings.length,
      autocomplete_cycle_receipts_found: receipts,
      blockers,
      next_required_action: missing.length
        ? "materialize Base44 entity/function/workflow source before running AutoComplete"
        : !manifest
          ? "bootstrap the CloudBrowser SystemManifest"
          : !manifest.canonical_sha
            ? "pin SystemManifest.canonical_sha to the exact deployed revision"
            : "run a validator smoke cycle and inspect durable receipts",
      checked_at: new Date().toISOString(),
    });
  } catch (error: any) {
    return Response.json({ ok: false, error: error?.message || String(error) }, { status: 500 });
  }
}
