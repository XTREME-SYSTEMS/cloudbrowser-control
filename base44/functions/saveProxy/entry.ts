import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { encrypt, isEncryptionAvailable } from "../../shared/crypto.ts";
import { logAudit } from "../../shared/auditLogger.ts";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";

// ═══════════════════════════════════════════════
// Save Proxy — encrypts password server-side, never stores plaintext
// ═══════════════════════════════════════════════

export default async function (req) {
  const base44 = createClientFromRequest(req);
  try {
    // V1.1 F-04: admin-only authorization
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== "admin") {
      return Response.json({ error: "Admin role required", __v: DEPLOYMENT_VERSION }, { status: 403 });
    }
    const body = await req.json();
    const { id, name, server, username, password, country, protocol, active, rotation_group } = body;

    if (!name || !server) {
      return Response.json({ error: "name and server required", __v: DEPLOYMENT_VERSION }, { status: 400 });
    }

    // Build the record — password is encrypted, never stored as plaintext
    const record = {
      name, server, username, country,
      protocol: protocol || "http",
      active: active !== false,
      rotation_group: rotation_group || null,
    };

    // If a password is provided, encrypt it
    if (password !== undefined && password !== null && password !== "") {
      if (!isEncryptionAvailable()) {
        return Response.json({ error: "ENCRYPTION_KEY not configured — cannot encrypt proxy password", __v: DEPLOYMENT_VERSION }, { status: 500 });
      }
      record.password_encrypted = await encrypt(password);
      record.has_password = true;
    }

    let result;
    let action;
    if (id) {
      // Update existing
      result = await base44.asServiceRole.entities.Proxy.update(id, record);
      action = "update";
    } else {
      // Create new
      result = await base44.asServiceRole.entities.Proxy.create(record);
      action = "create";
    }

    await logAudit(base44, user || { id: "system", full_name: "System" }, action, "proxy", result.id, `Proxy "${name}" ${action}`);

    // Never return the encrypted password
    const safe = { ...result, password_encrypted: undefined };
    return Response.json({ proxy: safe, __v: DEPLOYMENT_VERSION });
  } catch (error) {
    return Response.json({ error: error.message, __v: DEPLOYMENT_VERSION }, { status: 500 });
  }
}