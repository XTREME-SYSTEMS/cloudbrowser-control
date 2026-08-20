import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { secrets } from "base44:runtime";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";

async function sha256Fingerprint(value) {
  if (!value) return null;
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const hash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return "sha256:" + hash.slice(0, 16);
}

function normalizeEngineUrl(value) {
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error("Invalid engine URL"); }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error("Engine URL must use http/https");
  if (parsed.username || parsed.password) throw new Error("Engine URL userinfo is prohibited");
  parsed.pathname = "";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

function allowedEngineOrigins(secretUrl) {
  const origins = new Set();
  if (secretUrl) {
    try { origins.add(new URL(secretUrl).origin); } catch {}
  }
  const configured = (Deno.env.get("ENGINE_HOST_ALLOWLIST") || "").split(",").map((value) => value.trim()).filter(Boolean);
  for (const value of configured) {
    try { origins.add(new URL(value.includes("://") ? value : `https://${value}`).origin); } catch {}
  }
  return origins;
}

function validateEngineDestination(value, secretUrl) {
  const normalized = normalizeEngineUrl(value);
  const allowed = allowedEngineOrigins(secretUrl);
  if (allowed.size === 0) throw new Error("Engine destination allowlist is empty; refusing URL override");
  const origin = new URL(normalized).origin;
  if (!allowed.has(origin)) throw new Error(`Engine destination is not allowlisted: ${origin}`);
  return normalized;
}

async function testAuth(baseUrl, key) {
  try {
    const response = await fetch(`${baseUrl}/pool`, {
      headers: { "x-api-key": key, "Content-Type": "application/json" },
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
    });
    if (response.status >= 300 && response.status < 400) return { ok: false, status: response.status, error: "Engine endpoint redirected unexpectedly" };
    return { ok: response.ok, status: response.status };
  } catch (error) { return { ok: false, status: 0, error: error.message }; }
}

export default async function (req) {
  const base44 = createClientFromRequest(req);
  try {
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized", __v: DEPLOYMENT_VERSION }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Admin role required", __v: DEPLOYMENT_VERSION }, { status: 403 });

    const body = await req.json();
    const { engine_url, candidate_key } = body || {};
    const secretKey = secrets.get("ENGINE_API_KEY");
    const secretUrl = secrets.get("ENGINE_URL");

    let urlOverride = null;
    try {
      const rows = await base44.asServiceRole.entities.Setting.filter({ setting_key: "engine.url" });
      urlOverride = rows[0]?.effective_value;
    } catch {}

    let testUrl = null;
    try {
      const raw = engine_url || urlOverride || secretUrl;
      if (raw) testUrl = validateEngineDestination(raw, secretUrl);
    } catch (error) {
      return Response.json({ error: error.message, __v: DEPLOYMENT_VERSION }, { status: 400 });
    }

    const credentialReference = await sha256Fingerprint(secretKey);
    if (!testUrl) {
      return Response.json({ __v: DEPLOYMENT_VERSION, secret_vault_configured: !!secretKey, secret_vault_valid: false, credential_reference: credentialReference, reconciliation: "NO_ENGINE_URL", engine_url: null });
    }

    let secretValid = false;
    let secretError = null;
    if (secretKey) {
      const result = await testAuth(testUrl, secretKey);
      secretValid = result.ok;
      if (!result.ok) secretError = result.error || `HTTP ${result.status}`;
    }

    let candidateValid = false;
    let candidateError = null;
    if (candidate_key) {
      const result = await testAuth(testUrl, candidate_key);
      candidateValid = result.ok;
      if (!result.ok) candidateError = result.error || `HTTP ${result.status}`;
    }

    let reconciliation = "UNKNOWN";
    let actionRequired = null;
    if (!secretKey) {
      reconciliation = "SECRET_MISSING";
      actionRequired = "ENGINE_API_KEY is not configured in Base44 Secrets.";
    } else if (secretValid) reconciliation = "SYNCED";
    else {
      reconciliation = "MISMATCH";
      actionRequired = candidateValid
        ? "Candidate key matches the allowlisted engine. Rotate Base44 ENGINE_API_KEY through the protected secret-change workflow."
        : "Engine credential reconciliation required through the protected rotation workflow.";
    }

    if (engine_url && (secretValid || candidateValid)) {
      const existing = await base44.asServiceRole.entities.Setting.filter({ setting_key: "engine.url" });
      const now = new Date().toISOString();
      if (existing.length) {
        await base44.asServiceRole.entities.Setting.update(existing[0].id, { effective_value: testUrl, desired_value: testUrl, changed_by: user.id, changed_at: now, apply_status: "applied" });
      } else {
        await base44.asServiceRole.entities.Setting.create({ setting_key: "engine.url", category: "system", scope_type: "platform", effective_value: testUrl, desired_value: testUrl, apply_status: "applied", operator_editable: true, changed_by: user.id, changed_at: now });
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
