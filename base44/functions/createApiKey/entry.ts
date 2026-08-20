import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const name = body.name || "Default";
    const scopes = body.scopes || ["sessions:read", "sessions:write", "jobs:read", "jobs:write"];
    const projectId = body.project_id || null;
    const teamId = body.team_id || null;
    const expiresAt = body.expires_at || null;

    // Generate random API key
    const keyBytes = new Uint8Array(32);
    crypto.getRandomValues(keyBytes);
    const apiKey = "cb_live_" + Array.from(keyBytes).map((b) => b.toString(16).padStart(2, "0")).join("");

    // Hash with SHA-256
    const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(apiKey));
    const keyHash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");

    const prefix = apiKey.slice(0, 12);

    const created = await base44.entities.ApiKey.create({
      name,
      key_prefix: prefix,
      key_hash: keyHash,
      scopes,
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

    return Response.json({ api_key: apiKey, id: created.id, prefix, name, scopes, expires_at: expiresAt });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}