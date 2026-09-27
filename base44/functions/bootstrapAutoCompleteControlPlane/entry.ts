import { createClientFromRequest } from "npm:@base44/sdk@0.8.48";

const CONFIRM_PHRASE = "BOOTSTRAP_AUTOCOMPLETE_CONTROL_PLANE";
const APP_ID = "6a837c8e995cc4824aabf594";
const CANONICAL_REPO = "XTREME-SYSTEMS/cloudbrowser-control";

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

async function ensureSetting(db: any, key: string, value: string, category: string) {
  const existing = await db.entities.Setting.filter({ setting_key: key }).catch(() => []);
  const payload = {
    desired_value: value,
    effective_value: value,
    actual_runtime_value: value,
    apply_status: "verified",
    drift_status: "none",
    runtime_target: "control_plane",
    operator_editable: false,
    approval_required: false,
    changed_by: "autocomplete-bootstrap",
    changed_at: new Date().toISOString(),
    change_reason: "Initialize AutoComplete control plane",
    last_verified_at: new Date().toISOString(),
  };
  if (existing?.[0]) {
    await db.entities.Setting.update(existing[0].id, payload);
    return { action: "updated", id: existing[0].id, key };
  }
  const created = await db.entities.Setting.create({
    setting_key: key,
    category,
    scope_type: "platform",
    default_value: value,
    ...payload,
  });
  return { action: "created", id: created.id, key };
}

export default async function (req: Request): Promise<Response> {
  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const action = body.action === "apply" ? "apply" : "plan";
    const sourceSha = isNonEmpty(body.source_sha) ? body.source_sha.trim() : "";
    const canonicalBranch = isNonEmpty(body.canonical_branch) ? body.canonical_branch.trim() : "main";
    const completionSprint = body.autocomplete_mode === "COMPLETION_SPRINT";

    const requiredAdapters = ["SystemManifest", "EvidenceReceipt", "RepairTask", "BenchmarkResult", "AuditLog", "Setting"];
    const materialization: Record<string, boolean> = {};
    const blockers: string[] = [];
    for (const name of requiredAdapters) {
      const adapter = (base44.asServiceRole.entities as any)[name];
      materialization[name] = Boolean(adapter && typeof adapter.list === "function");
      if (!materialization[name]) blockers.push(`missing_entity_adapter:${name}`);
    }

    if (!sourceSha) blockers.push("source_sha_required");
    if (blockers.length) {
      return Response.json({
        ok: false,
        action,
        can_apply: false,
        blockers,
        materialization,
        note: "Entity/function/workflow source must be materialized by Base44 before bootstrap can write control-plane state.",
      }, { status: 409 });
    }

    const db = base44.asServiceRole;
    const manifests = await db.entities.SystemManifest.list("-registered_at", 100).catch(() => []);
    const existing = manifests.find((m: any) => m.base44_app_id === APP_ID || m.canonical_repo === CANONICAL_REPO) || null;
    const manifestPlan = {
      system_name: "CloudBrowser",
      canonical_repo: CANONICAL_REPO,
      canonical_source: CANONICAL_REPO,
      canonical_branch: canonicalBranch,
      canonical_sha: sourceSha,
      base44_app_id: APP_ID,
      runtime: "hybrid",
      data_plane: "Base44 + Railway browser engines",
      owner: "XTREME AutoComplete",
      risk_level: "high",
      protected_gate: true,
      autocomplete_mode: completionSprint ? "COMPLETION_SPRINT" : "READ_ONLY",
      portfolio_status: "keep",
      status: "registered",
      health_state: "unbenchmarked",
      health_score: 0,
      what_is_wrong: "Awaiting independent validator evidence at the pinned source SHA.",
      path_to_100: "Materialize control plane, ingest 11 fresh independent validation dimensions, close all P0/P1 blockers, and prove three clean certification cycles at the same immutable SHA.",
      registered_at: existing?.registered_at || new Date().toISOString(),
    };

    const plan = {
      manifest: {
        action: existing ? "update_existing" : "create",
        existing_id: existing?.id || null,
        values: manifestPlan,
      },
      settings: [
        { key: "autocomplete.continuous.enabled", value: "true", category: "schedules" },
        { key: "autocomplete.healing_budget", value: JSON.stringify({ window_start: new Date().toISOString(), count: 0, limit: 6 }), category: "budgets" },
      ],
      protected_actions: [
        "production deployment",
        "database migrations",
        "secret rotation",
        "billing/payments",
        "customer communications",
        "destructive data actions",
      ],
    };

    if (action === "plan") {
      return Response.json({
        ok: true,
        action: "plan",
        can_apply: true,
        confirmation_required: CONFIRM_PHRASE,
        plan,
      });
    }

    if (body.confirm !== CONFIRM_PHRASE) {
      return Response.json({
        ok: false,
        error: "explicit confirmation phrase required",
        required_confirm: CONFIRM_PHRASE,
        plan,
      }, { status: 428 });
    }

    let manifest: any;
    if (existing) {
      await db.entities.SystemManifest.update(existing.id, manifestPlan);
      manifest = await db.entities.SystemManifest.get(existing.id);
    } else {
      manifest = await db.entities.SystemManifest.create(manifestPlan);
    }

    const settingResults = [];
    settingResults.push(await ensureSetting(db, "autocomplete.continuous.enabled", "true", "schedules"));
    settingResults.push(await ensureSetting(db, "autocomplete.healing_budget", JSON.stringify({
      window_start: new Date().toISOString(),
      count: 0,
      limit: 6,
    }), "budgets"));

    await db.entities.AuditLog.create({
      action: "config",
      entity_type: "autocomplete_bootstrap",
      entity_id: manifest.id,
      description: "AutoComplete control plane bootstrapped with protected gates enabled",
      metadata: {
        canonical_repo: CANONICAL_REPO,
        canonical_branch: canonicalBranch,
        canonical_sha: sourceSha,
        autocomplete_mode: manifestPlan.autocomplete_mode,
        protected_gate: true,
        settings: settingResults,
      },
      timestamp: new Date().toISOString(),
      user_email: user.email || "admin",
    });

    return Response.json({
      ok: true,
      action: "apply",
      manifest: {
        id: manifest.id,
        canonical_repo: manifest.canonical_repo,
        canonical_branch: manifest.canonical_branch,
        canonical_sha: manifest.canonical_sha,
        protected_gate: manifest.protected_gate,
        autocomplete_mode: manifest.autocomplete_mode,
        status: manifest.status,
      },
      settings: settingResults,
      next_action: "run autoCompletePreflight, then submit independent validator receipts; do not claim VERIFIED_100 until three clean certification cycles exist",
    });
  } catch (error: any) {
    return Response.json({ ok: false, error: error?.message || String(error) }, { status: 500 });
  }
}
