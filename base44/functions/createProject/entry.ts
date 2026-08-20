import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const name = body.name;
    if (!name) return Response.json({ error: "Project name is required" }, { status: 400 });

    const description = body.description || "";
    const color = body.color || "blue";
    const defaultSessionConfig = body.default_session_config || {};
    const generateKey = body.generate_key !== false;

    // Create the project
    const project = await base44.entities.Project.create({
      name,
      description,
      color,
      status: "active",
      default_session_config: defaultSessionConfig,
    });

    let apiKeyInfo = null;
    if (generateKey) {
      // Generate API key for this project
      const keyBytes = new Uint8Array(32);
      crypto.getRandomValues(keyBytes);
      const apiKey = "cb_live_" + Array.from(keyBytes).map((b) => b.toString(16).padStart(2, "0")).join("");

      const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(apiKey));
      const keyHash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");

      const prefix = apiKey.slice(0, 12);
      const keyRecord = await base44.entities.ApiKey.create({
        name: `${name} key`,
        key_prefix: prefix,
        key_hash: keyHash,
        scopes: ["sessions:read", "sessions:write", "jobs:read", "jobs:write"],
        active: true,
      });

      // Link key to project
      await base44.entities.Project.update(project.id, { api_key_id: keyRecord.id });
      apiKeyInfo = { api_key: apiKey, id: keyRecord.id, prefix };
    }

    return Response.json({ project, api_key: apiKeyInfo });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}