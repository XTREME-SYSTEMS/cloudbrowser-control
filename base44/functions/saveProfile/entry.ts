import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { encrypt, decrypt, isEncryptionAvailable } from "../../shared/crypto.ts";
import { logAudit } from "../../shared/auditLogger.ts";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";

// ═══════════════════════════════════════════════
// Save Profile — encrypts cookies/storage_state server-side
// ═══════════════════════════════════════════════

export default async function (req) {
  const base44 = createClientFromRequest(req);
  try {
    const body = await req.json();
    const { id, name, description, user_data_dir, cookies, storage_state } = body;

    if (!name) {
      return Response.json({ error: "name required", __v: DEPLOYMENT_VERSION }, { status: 400 });
    }

    const record = {
      name,
      description: description || "",
      user_data_dir: user_data_dir || null,
    };

    // Encrypt cookies if provided
    if (cookies !== undefined && cookies !== null) {
      if (!isEncryptionAvailable()) {
        return Response.json({ error: "ENCRYPTION_KEY not configured", __v: DEPLOYMENT_VERSION }, { status: 500 });
      }
      record.cookies_encrypted = await encrypt(JSON.stringify(cookies));
      record.has_cookies = true;
    }

    // Encrypt storage_state if provided
    if (storage_state !== undefined && storage_state !== null) {
      if (!isEncryptionAvailable()) {
        return Response.json({ error: "ENCRYPTION_KEY not configured", __v: DEPLOYMENT_VERSION }, { status: 500 });
      }
      record.storage_state_encrypted = await encrypt(JSON.stringify(storage_state));
      record.has_storage_state = true;
    }

    let result;
    let action;
    if (id) {
      result = await base44.asServiceRole.entities.Profile.update(id, record);
      action = "update";
    } else {
      result = await base44.asServiceRole.entities.Profile.create(record);
      action = "create";
    }

    const user = await base44.auth.me().catch(() => null);
    await logAudit(base44, user || { id: "system", full_name: "System" }, action, "profile", result.id, `Profile "${name}" ${action}`);

    const safe = { ...result, cookies_encrypted: undefined, storage_state_encrypted: undefined };
    return Response.json({ profile: safe, __v: DEPLOYMENT_VERSION });
  } catch (error) {
    return Response.json({ error: error.message, __v: DEPLOYMENT_VERSION }, { status: 500 });
  }
}

// Helper for other functions to decrypt profile state
export async function decryptProfileState(profile) {
  let cookies = null, storageState = null;
  if (profile?.cookies_encrypted) {
    const decrypted = await decrypt(profile.cookies_encrypted);
    if (decrypted) cookies = JSON.parse(decrypted);
  }
  if (profile?.storage_state_encrypted) {
    const decrypted = await decrypt(profile.storage_state_encrypted);
    if (decrypted) storageState = JSON.parse(decrypted);
  }
  return { cookies, storageState };
}