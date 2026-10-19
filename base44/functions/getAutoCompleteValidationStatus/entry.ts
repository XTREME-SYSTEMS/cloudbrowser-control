import { createClientFromRequest } from "npm:@base44/sdk@0.8.48";

const DIMENSIONS = [
  { dimension: "build", gate: "HARD", weight: 15 },
  { dimension: "lint", gate: "HARD", weight: 5 },
  { dimension: "type", gate: "HARD", weight: 5 },
  { dimension: "security", gate: "HARD", weight: 20 },
  { dimension: "data", gate: "HARD", weight: 10 },
  { dimension: "rls", gate: "HARD", weight: 10 },
  { dimension: "e2e", gate: "HARD", weight: 10 },
  { dimension: "browser", gate: "SOFT", weight: 10 },
  { dimension: "mobile", gate: "SOFT", weight: 5 },
  { dimension: "visual", gate: "SOFT", weight: 5 },
  { dimension: "performance", gate: "SOFT", weight: 5 },
];
const FRESH_MS = 6 * 60 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

function ageMs(ts: any) {
  const t = ts ? new Date(ts).getTime() : 0;
  if (!Number.isFinite(t) || t <= 0) return Number.POSITIVE_INFINITY;
  const delta = Date.now() - t;
  if (delta < -MAX_CLOCK_SKEW_MS) return Number.POSITIVE_INFINITY;
  return Math.max(0, delta);
}

function settingValue(settings: any[], key: string) {
  return settings.find((s: any) => s.setting_key === key)?.effective_value ?? null;
}

export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const manifests = await base44.asServiceRole.entities.SystemManifest.list("-registered_at", 100);
    const manifest = body.system_id
      ? manifests.find((m: any) => m.id === body.system_id)
      : manifests.find((m: any) =>
          m.base44_app_id === (body.base44_app_id || "6a837c8e995cc4824aabf594") ||
          m.canonical_repo === (body.canonical_repo || "XTREME-SYSTEMS/cloudbrowser-control")
        );

    if (!manifest) return Response.json({ ok: false, error: "SystemManifest not found" }, { status: 404 });

    const [benchmarks, repairs, receipts, settings, auditLogs] = await Promise.all([
      base44.asServiceRole.entities.BenchmarkResult.list("-validated_at", 500).catch(() => []),
      base44.asServiceRole.entities.RepairTask.list("-created_date", 500).catch(() => []),
      base44.asServiceRole.entities.EvidenceReceipt.list("-timestamp", 500).catch(() => []),
      base44.asServiceRole.entities.Setting.list("-changed_at", 500).catch(() => []),
      base44.asServiceRole.entities.AuditLog.list("-timestamp", 500).catch(() => []),
    ]);

    const systemBenchmarks = benchmarks.filter((b: any) => b.system_manifest_id === manifest.id);
    const latestByDimension: Record<string, any> = {};
    for (const row of systemBenchmarks) {
      if (!latestByDimension[row.dimension]) latestByDimension[row.dimension] = row;
    }

    let weighted = 0;
    let allPass = true;
    let allFresh = true;
    const matrix = DIMENSIONS.map((c) => {
      const row = latestByDimension[c.dimension] || null;
      const fresh = Boolean(row) && ageMs(row.validated_at) <= FRESH_MS;
      const evidencePresent = Boolean(row?.evidence_artifact);
      const pass = Boolean(row) && row.status === "PASS" && fresh && evidencePresent;
      const score = pass ? Math.max(0, Math.min(100, Number(row.score || 100))) : 0;
      weighted += (c.weight * score) / 100;
      if (!pass) allPass = false;
      if (!fresh) allFresh = false;
      return {
        dimension: c.dimension,
        gate: c.gate,
        weight: c.weight,
        status: row?.status || "UNKNOWN",
        score,
        fresh,
        evidence_present: evidencePresent,
        validated_at: row?.validated_at || null,
        run_id: row?.run_id || null,
        evidence_artifact: row?.evidence_artifact || null,
        failure_fingerprint: row?.failure_fingerprint || null,
        root_cause: row?.root_cause || null,
      };
    });

    const openRepairs = repairs.filter((r: any) =>
      r.system_manifest_id === manifest.id &&
      ["open", "planning", "in_progress", "validating", "blocked"].includes(r.status)
    );

    const independentReceipts = receipts.filter((r: any) => {
      const data = r?.data || {};
      return r.system_id === manifest.id &&
        data.independent_validator === true &&
        data.validation_role === "independent_validator" &&
        data.source_sha === manifest.canonical_sha;
    });

    const cycleLogs = auditLogs.filter((r: any) => r.entity_type === "autocomplete_continuous_cycle");
    const streak = Number(settingValue(settings, `autocomplete.clean_streak.${manifest.id}`) || 0) || 0;
    const evidenceFingerprint = settingValue(settings, `autocomplete.clean_evidence.${manifest.id}`);
    const cleanAt = settingValue(settings, `autocomplete.clean_at.${manifest.id}`);
    const lease = settingValue(settings, "autocomplete.continuous.lease");
    const healingBudget = settingValue(settings, "autocomplete.healing_budget");
    const sourcePinned = Boolean(manifest.canonical_sha);
    const weightedScore = Math.round(weighted);
    const verified100 = sourcePinned && allPass && allFresh && weightedScore === 100 && streak >= 3 && openRepairs.length === 0;

    return Response.json({
      ok: true,
      system: {
        id: manifest.id,
        system_name: manifest.system_name,
        canonical_repo: manifest.canonical_repo,
        canonical_branch: manifest.canonical_branch,
        canonical_sha: manifest.canonical_sha,
        base44_app_id: manifest.base44_app_id,
        protected_gate: manifest.protected_gate,
        autocomplete_mode: manifest.autocomplete_mode,
        manifest_status: manifest.status,
        stored_health_score: manifest.health_score,
        stored_health_state: manifest.health_state,
      },
      constitution: matrix,
      computed: {
        weighted_score: weightedScore,
        source_pinned: sourcePinned,
        all_dimensions_pass_with_fresh_evidence: allPass && allFresh,
        clean_streak: streak,
        clean_evidence_fingerprint_present: Boolean(evidenceFingerprint),
        last_clean_at: cleanAt,
        open_repair_count: openRepairs.length,
        independent_receipt_count_at_current_sha: independentReceipts.length,
        autocomplete_cycle_receipt_count: cycleLogs.length,
        verified_100: verified100,
      },
      open_repairs: openRepairs.map((r: any) => ({
        id: r.id,
        gap_id: r.gap_id,
        priority: r.priority,
        category: r.category,
        finding: r.finding,
        status: r.status,
        approval_required: r.approval_required,
        assigned_lane: r.assigned_lane,
        rollback_pointer: r.rollback_pointer,
      })),
      runtime_controls: {
        lease: lease || null,
        healing_budget: healingBudget || null,
      },
      latest_cycle: cycleLogs[0] ? {
        id: cycleLogs[0].id,
        timestamp: cycleLogs[0].timestamp,
        description: cycleLogs[0].description,
        metadata: cycleLogs[0].metadata,
      } : null,
      checked_at: new Date().toISOString(),
    });
  } catch (error: any) {
    return Response.json({ ok: false, error: error?.message || String(error) }, { status: 500 });
  }
}
