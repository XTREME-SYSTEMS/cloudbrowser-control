import { createClientFromRequest } from "npm:@base44/sdk@0.8.48";

const CONTRACT_VERSION = "autocomplete-validator-v1";
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const FRESH_MS = 6 * 60 * 60 * 1000;
const CONSTITUTION_DIMENSIONS = new Set([
  "build", "lint", "type", "security", "data", "rls", "e2e",
  "browser", "mobile", "visual", "performance",
]);

function nowIso() { return new Date().toISOString(); }

function ageMs(ts: any) {
  const t = ts ? new Date(ts).getTime() : 0;
  if (!Number.isFinite(t) || t <= 0) return Number.POSITIVE_INFINITY;
  const delta = Date.now() - t;
  if (delta < -MAX_CLOCK_SKEW_MS) return Number.POSITIVE_INFINITY;
  return Math.max(0, delta);
}

function normalizeRoot(value: any) {
  return String(value || "unknown")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[0-9a-f]{7,64}/gi, "<sha>")
    .slice(0, 1000);
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function fingerprintRepair(manifest: any, repair: any) {
  return sha256Hex([
    manifest.id,
    repair.category || "unknown",
    repair.gap_id || repair.id,
    normalizeRoot(repair.root_cause || repair.finding),
  ].join("|"));
}

function isIndependentReceiptForRepair(receipt: any, manifest: any, repair: any, fingerprint: string) {
  const data = receipt?.data || {};
  if (receipt.status !== "pass") return false;
  if (receipt.system_id !== manifest.id) return false;
  if (data.contract_version !== CONTRACT_VERSION) return false;
  if (data.independent_validator !== true || data.validation_role !== "independent_validator") return false;
  if (!data.validator_identity || !data.validator_agent_id || !data.validation_run_id || !data.evidence_hash) return false;
  if (data.source_sha !== manifest.canonical_sha) return false;
  if (ageMs(receipt.timestamp) > FRESH_MS) return false;
  if (repair.category && CONSTITUTION_DIMENSIONS.has(repair.category) && data.dimension !== repair.category) return false;

  const boundByTask = data.repair_task_id && data.repair_task_id === repair.id;
  const boundByFingerprint = data.failure_fingerprint && data.failure_fingerprint === fingerprint;
  return Boolean(boundByTask || boundByFingerprint);
}

export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const db = base44.asServiceRole;
  const runId = `repair_integrity_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const [manifests, repairs, receipts, benchmarks] = await Promise.all([
      db.entities.SystemManifest.list("-registered_at", 100).catch(() => []),
      db.entities.RepairTask.list("-created_date", 1000).catch(() => []),
      db.entities.EvidenceReceipt.list("-timestamp", 1000).catch(() => []),
      db.entities.BenchmarkResult.list("-validated_at", 1000).catch(() => []),
    ]);

    const manifestById = new Map(manifests.map((m: any) => [m.id, m]));
    let normalized = 0;
    let confirmedResolved = 0;
    let reopenedMissingEvidence = 0;
    let reopenedRegression = 0;
    const actions: any[] = [];

    for (const repair of repairs) {
      const manifest: any = manifestById.get(repair.system_manifest_id);
      if (!manifest?.canonical_sha) continue;

      const fingerprint = repair.failure_fingerprint || await fingerprintRepair(manifest, repair);
      if (!repair.failure_fingerprint || !repair.opened_source_sha) {
        await db.entities.RepairTask.update(repair.id, {
          failure_fingerprint: fingerprint,
          opened_source_sha: repair.opened_source_sha || manifest.canonical_sha,
        });
        repair.failure_fingerprint = fingerprint;
        repair.opened_source_sha = repair.opened_source_sha || manifest.canonical_sha;
        normalized++;
      }

      if (repair.status !== "resolved") continue;

      const matching = receipts
        .filter((r: any) => isIndependentReceiptForRepair(r, manifest, repair, fingerprint))
        .sort((a: any, b: any) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
      const closure = matching[0] || null;

      if (!closure) {
        await db.entities.RepairTask.update(repair.id, {
          status: "validating",
          resolved_at: null,
          resolution_receipt_id: "",
          resolved_source_sha: "",
          evidence: "Resolution revoked: no fresh independent closure receipt bound to this repair/fingerprint at the current canonical SHA.",
        });
        reopenedMissingEvidence++;
        actions.push({ repair_id: repair.id, action: "reopened_missing_independent_evidence", fingerprint });
        continue;
      }

      const latestBenchmark = benchmarks
        .filter((b: any) => b.system_manifest_id === manifest.id && b.dimension === repair.category)
        .sort((a: any, b: any) => new Date(b.validated_at || 0).getTime() - new Date(a.validated_at || 0).getTime())[0];
      const closureMs = new Date(closure.timestamp || 0).getTime();
      const benchmarkMs = latestBenchmark ? new Date(latestBenchmark.validated_at || 0).getTime() : 0;
      const regressed = Boolean(
        latestBenchmark &&
        benchmarkMs > closureMs &&
        (latestBenchmark.status !== "PASS" || ageMs(latestBenchmark.validated_at) > FRESH_MS)
      );

      if (regressed) {
        await db.entities.RepairTask.update(repair.id, {
          status: "open",
          resolved_at: null,
          resolution_receipt_id: "",
          resolved_source_sha: "",
          last_regressed_at: nowIso(),
          evidence: `Regression reopened repair after independent receipt ${closure.receipt_id}. Latest ${repair.category} benchmark is ${latestBenchmark.status}.`,
        });
        reopenedRegression++;
        actions.push({ repair_id: repair.id, action: "reopened_regression", receipt_id: closure.receipt_id, benchmark_id: latestBenchmark.id });
        continue;
      }

      await db.entities.RepairTask.update(repair.id, {
        failure_fingerprint: fingerprint,
        resolution_receipt_id: closure.receipt_id,
        resolved_source_sha: manifest.canonical_sha,
        evidence: `Independently resolved by ${closure.receipt_id} at ${manifest.canonical_sha}`,
      });
      confirmedResolved++;
    }

    const openByManifest = new Map<string, number>();
    const currentRepairs = await db.entities.RepairTask.list("-created_date", 1000).catch(() => []);
    for (const repair of currentRepairs) {
      if (["open", "planning", "in_progress", "validating", "blocked"].includes(repair.status)) {
        openByManifest.set(repair.system_manifest_id, (openByManifest.get(repair.system_manifest_id) || 0) + 1);
      }
    }

    let manifestsDowngraded = 0;
    for (const manifest of manifests) {
      const openCount = openByManifest.get(manifest.id) || 0;
      if (manifest.status === "verified_100" && openCount > 0) {
        await db.entities.SystemManifest.update(manifest.id, {
          status: "baselined",
          health_state: manifest.health_score >= 85 ? "healthy" : manifest.health_score >= 50 ? "degraded" : "blocked",
          what_is_wrong: `${openCount} open repair(s) prevent VERIFIED_100 after independent repair-integrity enforcement.`,
          path_to_100: "Close every repair with fresh independent evidence at the exact canonical SHA, rerun regression, then rebuild the three-clean-cycle proof.",
        });
        manifestsDowngraded++;
      }
    }

    const summary = {
      run_id: runId,
      normalized,
      confirmed_resolved: confirmedResolved,
      reopened_missing_evidence: reopenedMissingEvidence,
      reopened_regression: reopenedRegression,
      manifests_downgraded: manifestsDowngraded,
      actions: actions.slice(0, 100),
      checked_at: nowIso(),
    };

    await db.entities.AuditLog.create({
      action: "validate",
      entity_type: "autocomplete_repair_integrity",
      entity_id: runId,
      description: "Enforced independent repair closure and regression reopening",
      metadata: summary,
      timestamp: nowIso(),
      user_email: "system@autocomplete.local",
    }).catch(() => {});

    return Response.json({ ok: true, ...summary });
  } catch (error: any) {
    return Response.json({ ok: false, run_id: runId, error: error?.message || String(error) }, { status: 500 });
  }
}
