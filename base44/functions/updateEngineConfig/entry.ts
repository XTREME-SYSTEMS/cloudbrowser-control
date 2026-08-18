import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { secrets } from "base44:runtime";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";

// ═══════════════════════════════════════════════
// Engine Connection — SECURITY HARDENED v4
// NEVER stores ENGINE_API_KEY in any entity.
// Tests candidate keys against AUTHENTICATED /pool endpoint.
// Tests secret-vault key against engine for reconciliation.
// Returns only safe fingerprints — never the key value.
// ═══════════════════════════════════════════════

async function sha256Fingerprint(value) {
  if (!value) return null;
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const hash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return "sha256:" + hash.slice(0, 16);
}

async function testAuth(baseUrl, key) {
  try {
    const res = await fetch(`${baseUrl}/pool`, {
      headers: { "x-api-key": key, "Content-Type": "application/json" },
    });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, status: 0, error: e.message };
  }
}

export default async function (req) {
  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized", __v: DEPLOYMENT_VERSION }, { status: 401 });

    const body = await req.json();
    const { engine_url, candidate_key } = body;

    // ── Current secret-vault key (NEVER stored in DB) ──
    const secretKey = secrets.get("ENGINE_API_KEY");
    const secretUrl = secrets.get("ENGINE_URL");

    // URL override from Setting (URL is not secret)
    let urlOverride = null;
    try {
      const rows = await base44.asServiceRole.entities.Setting.filter({ setting_key: "engine.url" });
      urlOverride = rows[0]?.effective_value;
    } catch (e) {}

    const testUrl = (engine_url || urlOverride || secretUrl || "").replace(/\/$/, "");

    // ── Credential fingerprint (safe, non-reversible) ──
    const credentialReference = await sha256Fingerprint(secretKey);

    if (!testUrl) {
      return Response.json({
        __v: DEPLOYMENT_VERSION,
        secret_vault_configured: !!secretKey,
        secret_vault_valid: false,
        credential_reference: credentialReference,
        reconciliation: "NO_ENGINE_URL",
        action_required: "Set ENGINE_URL in Base44 Secrets or via the Engine URL field below.",
        engine_url: null,
      });
    }

    // ── Test secret-vault key against AUTHENTICATED /pool endpoint ──
    let secretValid = false;
    let secretError = null;
    if (secretKey) {
      const r = await testAuth(testUrl, secretKey);
      secretValid = r.ok;
      if (!r.ok) secretError = r.error || `HTTP ${r.status}`;
    }

    // ── Test candidate key against AUTHENTICATED /pool endpoint ──
    let candidateValid = false;
    let candidateError = null;
    if (candidate_key) {
      const r = await testAuth(testUrl, candidate_key);
      candidateValid = r.ok;
      if (!r.ok) candidateError = r.error || `HTTP ${r.status}`;
    }

    // ── Reconciliation status ──
    let reconciliation = "UNKNOWN";
    let actionRequired = null;

    if (!secretKey) {
      reconciliation = "SECRET_MISSING";
      actionRequired = "ENGINE_API_KEY not set in Base44 Secrets — configure it in Settings → Secrets.";
    } else if (secretValid) {
      reconciliation = "SYNCED";
    } else {
      reconciliation = "MISMATCH";
      if (candidateValid) {
        actionRequired = "SECRET ROTATION REQUIRED — candidate key matches engine but secret vault key does not. Update ENGINE_API_KEY in Base44 Secrets to match the engine's key.";
      } else {
        actionRequired = "ENGINE_API_KEY SECRET RECONCILIATION REQUIRED — neither the secret vault key nor the candidate key matches the engine. Rotate to a NEW strong shared ENGINE_API_KEY and apply it to both Base44 Secrets and Railway.";
      }
    }

    // ── Save URL override only (URL is not secret) ──
    if (engine_url && (secretValid || candidateValid)) {
      const existing = await base44.asServiceRole.entities.Setting.filter({ setting_key: "engine.url" });
      const now = new Date().toISOString();
      if (existing.length > 0) {
        await base44.asServiceRole.entities.Setting.update(existing[0].id, {
          effective_value: testUrl, desired_value: testUrl,
          changed_by: user.id, changed_at: now, apply_status: "applied",
        });
      } else {
        await base44.asServiceRole.entities.Setting.create({
          setting_key: "engine.url", category: "system", scope_type: "platform",
          effective_value: testUrl, desired_value: testUrl,
          apply_status: "applied", operator_editable: true,
          changed_by: user.id, changed_at: now,
        });
      }
    }

    return Response.json({
      __v: DEPLOYMENT_VERSION,
      secret_vault_configured: !!secretKey,
      secret_vault_valid: secretValid,
      secret_vault_error: secretError,
      candidate_valid: candidateValid,
      candidate_error: candidateError,
      credential_reference: credentialReference,
      reconciliation,
      action_required: actionRequired,
      engine_url: testUrl,
    });
  } catch (error) {
    return Response.json({ error: error.message, __v: DEPLOYMENT_VERSION }, { status: 500 });
  }
}