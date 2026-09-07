import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { parseRelativePath, deriveJSONSchema } from "../../shared/cloneTemplates.ts";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";

/**
 * DEEP Phase 2a: siteAudit — Protocol Trace Analysis
 *
 * Analyzes the captured network trace (HAR) and DOM snapshot to:
 * - Extract all XHR/Fetch API endpoints with request/response schemas
 * - Map form payload schemas from the DOM
 * - Identify unclonable gaps (DOM interactions without matching endpoints)
 *
 * Creates CloneGap records for each identified gap.
 */

export default async function (req) {
  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { clone_project_id } = body;
    if (!clone_project_id) return Response.json({ error: "clone_project_id is required" }, { status: 400 });

    // Load the CloneProject
    const project = await base44.entities.CloneProject.get(clone_project_id);
    if (!project) return Response.json({ error: "Clone project not found" }, { status: 404 });

    // Load all assets for this project
    const assets = await base44.entities.CloneAsset.filter({ clone_project_id });
    const harAsset = assets.find((a) => a.asset_type === "har");
    const domAsset = assets.find((a) => a.asset_type === "dom");
    const manifestAsset = assets.find((a) => a.asset_type === "form_schema");

    if (!harAsset) {
      return Response.json({ error: "No network trace found — run cloneFullSite first" }, { status: 400 });
    }

    // Fetch and parse the network trace
    const harResponse = await fetch(harAsset.file_url);
    const harData = await harResponse.json();

    // Fetch and parse the asset manifest (contains forms, links, etc.)
    let manifest = {};
    if (manifestAsset) {
      const manifestResponse = await fetch(manifestAsset.file_url);
      manifest = await manifestResponse.json();
    }

    // ═══════════════════════════════════════════
    // 1. EXTRACT API ENDPOINTS from network trace
    // ═══════════════════════════════════════════
    const apiEntries = (harData.entries || []).filter(
      (e) => e.type === "xhr" || e.type === "fetch" || (e.url && !e.url.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|ico)(\?|$)/i))
    );

    const endpoints = [];
    const seenEndpoints = new Set();

    for (const entry of apiEntries) {
      const relativePath = parseRelativePath(entry.url);
      const key = `${entry.method}:${relativePath}`;
      if (seenEndpoints.has(key)) continue;
      seenEndpoints.add(key);

      endpoints.push({
        endpoint: relativePath,
        method: entry.method || "GET",
        url: entry.url,
        status: entry.status,
        type: entry.type,
      });
    }

    // ═══════════════════════════════════════════
    // 2. EXTRACT FORM SCHEMAS from DOM manifest
    // ═══════════════════════════════════════════
    const forms = manifest.forms || [];
    const formSchemas = forms.map((f, i) => ({
      form_index: i,
      action: f.action,
      method: f.method,
      fields: (f.fields || []).map((field) => ({
        name: field.name,
        type: field.type,
        required: field.required,
        placeholder: field.placeholder,
        pattern: field.pattern,
        options: field.options,
      })),
    }));

    // ═══════════════════════════════════════════
    // 3. IDENTIFY GAPS — forms/interactions without matching API endpoints
    // ═══════════════════════════════════════════
    const endpointPaths = new Set(endpoints.map((e) => e.endpoint));
    const gapsCreated = [];

    for (const form of formSchemas) {
      if (!form.action) continue;
      const formPath = parseRelativePath(form.action);
      if (endpointPaths.has(formPath)) continue; // Already captured

      // This form has no matching network endpoint — it's a gap
      const gap = await base44.entities.CloneGap.create({
        clone_project_id,
        gap_type: "server_logic",
        description: `Form submitting to ${formPath} has no captured network response — backend logic is unclonable`,
        interaction_pattern: `form:${form.method}:${formPath}:${form.fields.map((f) => f.name).join(",")}`,
        inferred_endpoint: formPath,
        inferred_method: form.method,
        status: "identified",
        request_schema: deriveJSONSchema(
          Object.fromEntries((form.fields || []).map((f) => [f.name, f.type === "number" ? 0 : "string"]))
        ),
      });
      gapsCreated.push(gap.id);
    }

    // Identify gaps from links that look like API calls but weren't captured
    const links = manifest.links || [];
    for (const link of links) {
      if (!link.href) continue;
      try {
        const linkUrl = new URL(link.href);
        const linkPath = linkUrl.pathname;
        // Check if it looks like an API endpoint but wasn't captured
        if (linkPath.match(/\/api\/|\/auth\/|\/search|\/submit|\/upload/i) && !endpointPaths.has(linkPath)) {
          const gap = await base44.entities.CloneGap.create({
            clone_project_id,
            gap_type: "server_logic",
            description: `Link to ${linkPath} ("${link.text}") appears to be an API endpoint with no captured response`,
            interaction_pattern: `link:${linkPath}:${link.text}`,
            inferred_endpoint: linkPath,
            inferred_method: "GET",
            status: "identified",
          });
          gapsCreated.push(gap.id);
        }
      } catch {}
    }

    // Identify database/websocket gaps from scripts
    const scripts = manifest.scripts || [];
    const hasWebSocket = scripts.some((s) => s && s.match && s.match(/ws:|wss:|websocket|socket\.io/i));
    if (hasWebSocket) {
      const gap = await base44.entities.CloneGap.create({
        clone_project_id,
        gap_type: "websocket",
        description: "WebSocket connection detected in scripts — realtime state is unclonable",
        interaction_pattern: "websocket:detected_from_scripts",
        inferred_endpoint: "/ws",
        inferred_method: "WS",
        status: "identified",
      });
      gapsCreated.push(gap.id);
    }

    // Check for OAuth/auth patterns
    const hasOAuth = (manifest.meta || []).some((m) => m.name && m.name.match(/oauth|client.id|google.client/i));
    if (hasOAuth) {
      const gap = await base44.entities.CloneGap.create({
        clone_project_id,
        gap_type: "oauth",
        description: "OAuth client configuration detected — third-party authentication handshakes are unclonable",
        interaction_pattern: "oauth:detected_from_meta",
        inferred_endpoint: "/api/auth/oauth",
        inferred_method: "GET",
        status: "identified",
      });
      gapsCreated.push(gap.id);
    }

    // Store the route map as a CloneAsset
    const routeMap = {
      clone_project_id,
      analyzed_at: new Date().toISOString(),
      endpoints,
      form_schemas: formSchemas,
      total_endpoints: endpoints.length,
      total_forms: formSchemas.length,
      total_gaps: gapsCreated.length,
    };
    const blob = new Blob([JSON.stringify(routeMap, null, 2)], { type: "application/json" });
    const routeMapUpload = await base44.integrations.Core.UploadFile({ file: blob });
    await base44.entities.CloneAsset.create({
      clone_project_id,
      asset_type: "route_map",
      file_url: routeMapUpload.file_url,
      status: "captured",
      viewport: "none",
    });

    // Update CloneProject
    await base44.entities.CloneProject.update(clone_project_id, {
      endpoint_count: endpoints.length,
      gap_count: gapsCreated.length,
    });

    return Response.json({
      ok: true,
      clone_project_id,
      endpoints_discovered: endpoints.length,
      forms_extracted: formSchemas.length,
      gaps_identified: gapsCreated.length,
      gap_ids: gapsCreated,
      route_map_url: routeMapUpload.file_url,
      __v: DEPLOYMENT_VERSION,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}