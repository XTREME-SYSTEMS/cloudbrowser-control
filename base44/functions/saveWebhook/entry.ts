import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { encrypt, isEncryptionAvailable } from "../../shared/crypto.ts";
import { logAudit } from "../../shared/auditLogger.ts";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";

// ═══════════════════════════════════════════════
// Save Webhook — encrypts signing secret server-side, never stores plaintext
// ═══════════════════════════════════════════════

export default async function (req) {
  const base44 = createClientFromRequest(req);
  try {
    const body = await req.json();
    const { id, name, url, events, secret, active, provider } = body;

    if (!name || !url) {
      return Response.json({ error: "name and url required", __v: DEPLOYMENT_VERSION }, { status: 400 });
    }

    const record = {
      name, url,
      events: events || [],
      active: active !== false,
      provider: provider || "generic",
    };

    // If a secret is provided, encrypt it
    if (secret !== undefined && secret !== null && secret !== "") {
      if (!isEncryptionAvailable()) {
        return Response.json({ error: "ENCRYPTION_KEY not configured — cannot encrypt webhook secret", __v: DEPLOYMENT_VERSION }, { status: 500 });
      }
      record.secret_encrypted = await encrypt(secret);
      record.has_secret = true;
    }

    let result;
    let action;
    if (id) {
      result = await base44.asServiceRole.entities.Webhook.update(id, record);
      action = "update";
    } else {
      result = await base44.asServiceRole.entities.Webhook.create(record);
      action = "create";
    }

    const user = await base44.auth.me().catch(() => null);
    await logAudit(base44, user || { id: "system", full_name: "System" }, action, "webhook", result.id, `Webhook "${name}" ${action}`);

    // Never return the encrypted secret
    const safe = { ...result, secret_encrypted: undefined };
    return Response.json({ webhook: safe, __v: DEPLOYMENT_VERSION });
  } catch (error) {
    return Response.json({ error: error.message, __v: DEPLOYMENT_VERSION }, { status: 500 });
  }
}