import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const name = body.name || "Default";
    const description = body.description || "";
    const role = body.role || "user";
    const externalLabel = body.external_label || "";
    const scopes = body.scopes || ["sessions:read", "sessions:write"];
    const allowedFunctions = body.allowed_functions || [];
    const projectId = body.project_id || null;
    const teamId = body.team_id || null;
    const expiresInDays = body.expires_in_days || body.expiresInDays || null;
    let expiresAt = body.expires_at || null;
    if (expiresInDays && !expiresAt) {
      expiresAt = new Date(Date.now() + expiresInDays * 86400000).toISOString();
    }

    // Role-based key prefix
    const prefixMap: Record<string, string> = {
      admin: "cb_admin_",
      user: "cb_user_",
      service: "cb_svc_",
      vision_cortex: "cb_vc_",
    };
    const keyPrefix = prefixMap[role] || "cb_user_";

    // Generate random API key
    const keyBytes = new Uint8Array(32);
    crypto.getRandomValues(keyBytes);
    const apiKey = keyPrefix + Array.from(keyBytes).map((b) => b.toString(16).padStart(2, "0")).join("");

    // Hash with SHA-256
    const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(apiKey));
    const keyHash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");

    const displayPrefix = apiKey.slice(0, 16);

    const created = await base44.entities.ApiKey.create({
      name,
      description,
      role,
      external_label: externalLabel,
      key_prefix: displayPrefix,
      key_hash: keyHash,
      scopes,
      allowed_functions: allowedFunctions,
      active: true,
      project_id: projectId,
      team_id: teamId,
      expires_at: expiresAt,
      created_by: user.id,
    });

    // Link to project if provided
    if (projectId) {
      await base44.entities.Project.update(projectId, { api_key_id: created.id }).catch(() => {});
    }

    return Response.json({
      api_key: apiKey,
      id: created.id,
      prefix: displayPrefix,
      name,
      role,
      external_label: externalLabel,
      scopes,
      allowed_functions: allowedFunctions,
      expires_at: expiresAt,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}