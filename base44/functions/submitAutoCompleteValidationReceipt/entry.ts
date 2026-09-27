import { createClientFromRequest } from "npm:@base44/sdk@0.8.48";

const CONTRACT_VERSION = "autocomplete-validator-v1";
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const MAX_EVIDENCE_AGE_MS = 6 * 60 * 60 * 1000;
const DIMENSIONS = new Set([
  "build", "lint", "type", "security", "data", "rls", "e2e",
  "browser", "mobile", "visual", "performance",
]);
const STATUSES = new Set(["pass", "fail", "blocked", "unknown"]);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeStatus(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function normalizeRoot(value: any) {
  return String(value || "unknown")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[0-9a-f]{7,64}/gi, "<sha>")
    .slice(0, 1000);
}

function ageMs(ts: unknown) {
  const parsed = isNonEmptyString(ts) ? new Date(ts).getTime() : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return Number.POSITIVE_INFINITY;
  const delta = Date.now() - parsed;
  if (delta < -MAX_CLOCK_SKEW_MS) return Number.POSITIVE_INFINITY;
  return Math.max(0, delta);
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function compactEvidence(body: any) {
  return {
    command: isNonEmptyString(body.command) ? body.command.trim() : "",
    exit_code: Number.isFinite(Number(body.exit_code)) ? Number(body.exit_code) : null,
    output_digest: isNonEmptyString(body.output_digest) ? body.output_digest.trim() : "",
    output_excerpt: isNonEmptyString(body.output_excerpt) ? body.output_excerpt.slice(0, 4000) : "",
    assertion_count: Number.isFinite(Number(body.assertion_count)) ? Number(body.assertion_count) : null,
    artifact_urls: Array.isArray(body.artifact_urls) ? body.artifact_urls.filter(isNonEmptyString).slice(0, 50) : [],
    screenshot_url: isNonEmptyString(body.screenshot_url) ? body.screenshot_url.trim() : "",
  };
}

async function repairFingerprint(manifest: any, repair: any) {
  return sha256Hex([
    manifest.id,
    repair.category || "unknown",
    repair.gap_id || repair.id,
    normalizeRoot(repair.root_cause || repair.finding),
  ].join("|"));
}

export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const systemId = isNonEmptyString(body.system_id) ? body.system_id.trim() : "";
    const dimension = isNonEmptyString(body.dimension) ? body.dimension.trim().toLowerCase() : "";
    const status = normalizeStatus(body.status);
    const sourceSha = isNonEmptyString(body.source_sha) ? body.source_sha.trim() : "";
    const validationRunId = isNonEmptyString(body.validation_run_id) ? body.validation_run_id.trim() : "";
    const validatorAgentId = isNonEmptyString(body.validator_agent_id) ? body.validator_agent_id.trim() : "";
    const implementationAgentId = isNonEmptyString(body.implementation_agent_id) ? body.implementation_agent_id.trim() : "";
    const repairTaskId = isNonEmptyString(body.repair_task_id) ? body.repair_task_id.trim() : "";
    const observedAt = isNonEmptyString(body.observed_at) ? body.observed_at.trim() : "";
    const evidence = compactEvidence(body);

    const errors: string[] = [];
    if (!systemId) errors.push("system_id is required");
    if (!DIMENSIONS.has(dimension)) errors.push(`unsupported dimension: ${dimension || "<blank>"}`);
    if (!STATUSES.has(status)) errors.push(`unsupported status: ${status || "<blank>"}`);
    if (!sourceSha) errors.push("source_sha is required");
    if (!validationRunId) errors.push("validation_run_id is required");
    if (!validatorAgentId) errors.push("validator_agent_id is required");
    if (!observedAt) errors.push("observed_at is required");
    if (implementationAgentId && implementationAgentId === validatorAgentId) errors.push("validator_agent_id must differ from implementation_agent_id");
    if (observedAt && ageMs(observedAt) > MAX_EVIDENCE_AGE_MS) errors.push("observed_at is stale, invalid, or future-dated beyond allowed clock skew");

    const hasEvidence = Boolean(
      evidence.command || evidence.output_digest || evidence.output_excerpt ||
      evidence.screenshot_url || evidence.artifact_urls.length > 0
    );
    if (!hasEvidence) errors.push("at least one concrete evidence field is required");
    if (errors.length) return Response.json({ ok: false, contract: CONTRACT_VERSION, errors }, { status: 400 });

    const manifest = await base44.asServiceRole.entities.SystemManifest.get(systemId);
    if (!manifest) return Response.json({ ok: false, error: "SystemManifest not found", system_id: systemId }, { status: 404 });
    if (!isNonEmptyString(manifest.canonical_sha)) {
      return Response.json({ ok: false, error: "SystemManifest canonical_sha is not pinned", system_id: systemId }, { status: 409 });
    }
    if (manifest.canonical_sha !== sourceSha) {
      return Response.json({
        ok: false,
        error: "source_sha does not match SystemManifest canonical_sha",
        expected_sha: manifest.canonical_sha,
        received_sha: sourceSha,
      }, { status: 409 });
    }

    let failureFingerprint = isNonEmptyString(body.failure_fingerprint) ? body.failure_fingerprint.trim() : "";
    let repair: any = null;
    if (repairTaskId) {
      repair = await base44.asServiceRole.entities.RepairTask.get(repairTaskId).catch(() => null);
      if (!repair) return Response.json({ ok: false, error: "RepairTask not found", repair_task_id: repairTaskId }, { status: 404 });
      if (repair.system_manifest_id !== systemId) {
        return Response.json({ ok: false, error: "RepairTask does not belong to submitted system_id" }, { status: 409 });
      }
      if (DIMENSIONS.has(repair.category) && repair.category !== dimension) {
        return Response.json({ ok: false, error: "RepairTask category does not match validation dimension", repair_category: repair.category, dimension }, { status: 409 });
      }
      const canonicalFingerprint = repair.failure_fingerprint || await repairFingerprint(manifest, repair);
      if (failureFingerprint && failureFingerprint !== canonicalFingerprint) {
        return Response.json({ ok: false, error: "failure_fingerprint does not match RepairTask fingerprint" }, { status: 409 });
      }
      failureFingerprint = canonicalFingerprint;
      if (!repair.failure_fingerprint || !repair.opened_source_sha) {
        await base44.asServiceRole.entities.RepairTask.update(repair.id, {
          failure_fingerprint: canonicalFingerprint,
          opened_source_sha: repair.opened_source_sha || sourceSha,
        });
      }
    }

    const authenticatedIdentity = user.email || user.id || "authenticated-admin";
    const rawEvidence = JSON.stringify({
      contract: CONTRACT_VERSION,
      system_id: systemId,
      dimension,
      status,
      source_sha: sourceSha,
      validation_run_id: validationRunId,
      validator_agent_id: validatorAgentId,
      validator_identity: authenticatedIdentity,
      implementation_agent_id: implementationAgentId || null,
      repair_task_id: repairTaskId || null,
      observed_at: observedAt,
      evidence,
      expected_result: body.expected_result || "",
      actual_result: body.actual_result || "",
      failure_fingerprint: failureFingerprint,
      root_cause: body.root_cause || "",
      exact_repair: body.exact_repair || "",
      score: body.score,
    });
    const evidenceHash = await sha256Hex(rawEvidence);
    const idempotencyKey = `${systemId}|${dimension}|${sourceSha}|${validationRunId}`;
    const receiptId = `acv_${(await sha256Hex(`${idempotencyKey}|${evidenceHash}`)).slice(0, 40)}`;

    const recent = await base44.asServiceRole.entities.EvidenceReceipt.list("-timestamp", 1000).catch(() => []);
    const duplicateReceiptId = recent.find((r: any) => r.receipt_id === receiptId);
    if (duplicateReceiptId) {
      const data = duplicateReceiptId?.data || {};
      if (data.evidence_hash === evidenceHash && duplicateReceiptId.status === status) {
        return Response.json({
          ok: true,
          idempotent: true,
          receipt_id: duplicateReceiptId.receipt_id,
          validation_run_id: validationRunId,
          dimension,
          source_sha: sourceSha,
        });
      }
      return Response.json({ ok: false, error: "receipt_id collision with conflicting evidence", receipt_id: receiptId }, { status: 409 });
    }

    const existingSameRun = recent.find((r: any) => {
      const data = r?.data || {};
      return r.system_id === systemId &&
        data.contract_version === CONTRACT_VERSION &&
        data.dimension === dimension &&
        data.source_sha === sourceSha &&
        data.validation_run_id === validationRunId;
    });
    if (existingSameRun) {
      const existingHash = existingSameRun?.data?.evidence_hash || "";
      if (existingHash === evidenceHash && existingSameRun.status === status) {
        return Response.json({
          ok: true,
          idempotent: true,
          receipt_id: existingSameRun.receipt_id,
          validation_run_id: validationRunId,
          dimension,
          source_sha: sourceSha,
        });
      }
      return Response.json({
        ok: false,
        error: "conflicting receipt already exists for this validation_run_id + dimension + source_sha",
        existing_receipt_id: existingSameRun.receipt_id,
      }, { status: 409 });
    }

    const numericScore = status === "pass"
      ? Math.max(0, Math.min(100, Number.isFinite(Number(body.score)) ? Number(body.score) : 100))
      : 0;

    const created = await base44.asServiceRole.entities.EvidenceReceipt.create({
      receipt_id: receiptId,
      system_id: systemId,
      tool: "submitAutoCompleteValidationReceipt",
      action: "independent_validation",
      target: `${manifest.canonical_repo || manifest.canonical_source || manifest.system_name || systemId}@${sourceSha}`,
      expected_result: isNonEmptyString(body.expected_result) ? body.expected_result.slice(0, 4000) : "dimension validation should satisfy the AutoComplete constitution",
      actual_result: isNonEmptyString(body.actual_result) ? body.actual_result.slice(0, 12000) : JSON.stringify(evidence),
      status,
      evidence_type: isNonEmptyString(body.evidence_type) ? body.evidence_type : "test",
      screenshot_url: evidence.screenshot_url,
      artifact_urls: evidence.artifact_urls,
      data: {
        contract_version: CONTRACT_VERSION,
        dimension,
        source_sha: sourceSha,
        validation_run_id: validationRunId,
        validator_identity: authenticatedIdentity,
        validator_agent_id: validatorAgentId,
        implementation_agent_id: implementationAgentId || null,
        repair_task_id: repairTaskId || null,
        independent_validator: true,
        validation_role: "independent_validator",
        observed_at: observedAt,
        evidence_hash: evidenceHash,
        score: numericScore,
        failure_fingerprint: failureFingerprint,
        root_cause: isNonEmptyString(body.root_cause) ? body.root_cause : "",
        exact_repair: isNonEmptyString(body.exact_repair) ? body.exact_repair : "",
        command: evidence.command,
        exit_code: evidence.exit_code,
        output_digest: evidence.output_digest,
        assertion_count: evidence.assertion_count,
      },
      errors: Array.isArray(body.errors) ? body.errors.map(String).slice(0, 50) : [],
      approval_state: "not_required",
      rollback_reference: isNonEmptyString(body.rollback_reference) ? body.rollback_reference : "",
      operator: authenticatedIdentity,
      timestamp: new Date().toISOString(),
    });

    return Response.json({
      ok: true,
      contract: CONTRACT_VERSION,
      receipt_id: created.receipt_id || receiptId,
      system_id: systemId,
      dimension,
      status,
      score: numericScore,
      source_sha: sourceSha,
      validation_run_id: validationRunId,
      repair_task_id: repairTaskId || null,
      failure_fingerprint: failureFingerprint || null,
      evidence_hash: evidenceHash,
      validator_identity: authenticatedIdentity,
      validator_agent_id: validatorAgentId,
    });
  } catch (error: any) {
    return Response.json({ ok: false, error: error?.message || String(error), contract: CONTRACT_VERSION }, { status: 500 });
  }
}
