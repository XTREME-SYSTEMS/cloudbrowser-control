import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import {
  deduceInfrastructureStack,
  findClosestFunctionalMatch,
  deriveJSONSchema,
  generateStatefulMockLogic,
  parseRelativePath,
} from "../../shared/cloneTemplates.ts";
import { DEPLOYMENT_VERSION } from "../../shared/deploymentVersion.ts";

/**
 * DEEP Phase 2b: reconstructBackend — Architecture Deduction & Backend Synthesis
 *
 * Non-LLM backend reconstruction engine:
 * 1. Fingerprints the infrastructure stack from response headers
 * 2. Generates route schemas from the XHR/fetch log
 * 3. Matches identified gaps against the template catalog
 * 4. Generates mock backend code for each gap
 *
 * Updates CloneGap records with inferred solutions.
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

    // Load assets
    const assets = await base44.entities.CloneAsset.filter({ clone_project_id });
    const harAsset = assets.find((a) => a.asset_type === "har");
    const routeMapAsset = assets.find((a) => a.asset_type === "route_map");

    if (!harAsset) {
      return Response.json({ error: "No network trace found — run cloneFullSite first" }, { status: 400 });
    }

    // Fetch network trace
    const harResponse = await fetch(harAsset.file_url);
    const harData = await harResponse.json();

    // Fetch route map if available
    let routeMap = { endpoints: [], form_schemas: [] };
    if (routeMapAsset) {
      const routeMapResponse = await fetch(routeMapAsset.file_url);
      routeMap = await routeMapResponse.json();
    }

    // ═══════════════════════════════════════════
    // 1. FINGERPRINT: Infrastructure Stack
    // ═══════════════════════════════════════════
    const xhrLog = (harData.entries || []).map((e) => ({
      url: e.url,
      method: e.method,
      responseHeaders: e.responseHeaders || {},
    }));

    const stackType = deduceInfrastructureStack(xhrLog);

    // ═══════════════════════════════════════════
    // 2. GENERATE: Route Schemas from captured endpoints
    // ═══════════════════════════════════════════
    const routes = [];
    for (const endpoint of routeMap.endpoints || []) {
      routes.push({
        endpoint: endpoint.endpoint,
        method: endpoint.method,
        requestSchema: deriveJSONSchema({ url: endpoint.url }),
        responseSchema: { type: "object", properties: { status: { type: "number" } } },
        mockLogic: generateStatefulMockLogic({ status: endpoint.status || 200, endpoint: endpoint.endpoint }),
        source: "captured",
      });
    }

    // ═══════════════════════════════════════════
    // 3. RESOLVE: Gaps via Template Matching
    // ═══════════════════════════════════════════
    const gaps = await base44.entities.CloneGap.filter({
      clone_project_id,
      status: "identified",
    });

    let resolvedCount = 0;
    for (const gap of gaps) {
      // Match the gap's interaction pattern against the template catalog
      const template = findClosestFunctionalMatch(gap.interaction_pattern || gap.inferred_endpoint || "");

      // Generate mock logic for this gap
      const mockLogic = template.executableCodeSnippet;

      // Update the gap with the inferred solution
      await base44.entities.CloneGap.update(gap.id, {
        status: "inferred",
        template_matched: template.id,
        mock_logic: mockLogic,
        inferred_endpoint: gap.inferred_endpoint || template.inferredEndpoint,
        inferred_method: gap.inferred_method || template.method,
        request_schema: gap.request_schema || template.defaultRequest,
        response_schema: template.defaultResponse,
        confidence_score: 75,
      });

      // Add to routes
      routes.push({
        endpoint: gap.inferred_endpoint || template.inferredEndpoint,
        method: gap.inferred_method || template.method,
        requestSchema: gap.request_schema || template.defaultRequest,
        responseSchema: template.defaultResponse,
        mockLogic,
        source: "inferred",
        template: template.id,
        gap_id: gap.id,
      });

      resolvedCount++;
    }

    // ═══════════════════════════════════════════
    // 4. GENERATE: Full mock backend code
    // ═══════════════════════════════════════════
    const mockBackendCode = generateMockBackendFile(stackType, routes, project.target_url);

    // Store the inferred architecture
    const architecture = {
      clone_project_id,
      stack_type: stackType,
      total_routes: routes.length,
      captured_routes: routes.filter((r) => r.source === "captured").length,
      inferred_routes: routes.filter((r) => r.source === "inferred").length,
      routes,
      mock_backend_code: mockBackendCode,
      generated_at: new Date().toISOString(),
    };

    const archBlob = new Blob([JSON.stringify(architecture, null, 2)], { type: "application/json" });
    const archUpload = await base44.integrations.Core.UploadFile({ file: archBlob });
    await base44.entities.CloneAsset.create({
      clone_project_id,
      asset_type: "inferred_architecture",
      file_url: archUpload.file_url,
      status: "captured",
      viewport: "none",
    });

    // Store the mock backend code as a separate asset
    const codeBlob = new Blob([mockBackendCode], { type: "text/javascript" });
    const codeUpload = await base44.integrations.Core.UploadFile({ file: codeBlob });
    await base44.entities.CloneAsset.create({
      clone_project_id,
      asset_type: "mock_backend",
      file_url: codeUpload.file_url,
      status: "inferred",
      viewport: "none",
    });

    // Update CloneProject
    await base44.entities.CloneProject.update(clone_project_id, {
      stack_type: stackType,
      inferred_architecture_url: archUpload.file_url,
      clone_code_url: codeUpload.file_url,
    });

    return Response.json({
      ok: true,
      clone_project_id,
      stack_type: stackType,
      total_routes: routes.length,
      captured_routes: routes.filter((r) => r.source === "captured").length,
      inferred_routes: routes.filter((r) => r.source === "inferred").length,
      gaps_resolved: resolvedCount,
      mock_backend_url: codeUpload.file_url,
      architecture_url: archUpload.file_url,
      __v: DEPLOYMENT_VERSION,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Generate a complete mock backend file from the inferred routes.
 */
function generateMockBackendFile(stackType, routes, targetUrl) {
  const imports = `/**
 * Auto-generated mock backend for ${targetUrl}
 * Stack: ${stackType}
 * Generated by DEEP reconstructBackend
 */

import express from 'express';
const app = express();
app.use(express.json());

const MOCK_DB = {};

`;

  const routeHandlers = routes.map((r) => {
    const path = r.endpoint.replace(/:id/g, ":id");
    const method = (r.method || "GET").toLowerCase();

    if (method === "ws") {
      return `// WebSocket endpoint: ${path}
// app.ws('${path}', (ws, req) => { ... });
`;
    }

    return `// ${method.toUpperCase()} ${path} — source: ${r.source}
app.${method}('${path}', (req, res) => {
  ${r.mockLogic || `res.status(200).json({ ok: true, endpoint: '${path}' });`}
});`;
  }).join("\n\n");

  const footer = `

app.listen(3000, () => console.log('Mock backend running on port 3000'));
`;

  return imports + routeHandlers + footer;
}