import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { buildGenerationPrompt } from '../../shared/mockupStudio.ts';

// Generates complete, production-ready code from an approved mock-up scan.
// Produces a self-contained HTML file (frontend) and optionally a Node.js
// backend if the scan determined backend is needed.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const projectId = String(body.project_id || '').trim();
    if (!projectId) return Response.json({ error: 'project_id is required.' }, { status: 400 });

    // Load the project
    const project = await base44.entities.MockupProject.get(projectId);
    if (!project) return Response.json({ error: 'Project not found.' }, { status: 404 });

    if (!project.scan_result) {
      return Response.json({ error: 'Project has not been scanned yet. Call scanMockup first.' }, { status: 400 });
    }

    // Allow user overrides
    const overrides = body.overrides || {};
    const scanResult = {
      ...project.scan_result,
      ...overrides,
      color_palette: { ...project.scan_result.color_palette, ...(overrides.color_palette || {}) },
    };

    const includeBackend = body.include_backend !== undefined ? body.include_backend : scanResult.has_backend;

    // Update status to generating
    await base44.entities.MockupProject.update(projectId, { status: 'generating' });

    // Build the generation prompt
    const genPrompt = buildGenerationPrompt(scanResult, { includeBackend });

    // Generate the code
    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: genPrompt,
      response_json_schema: {
        type: 'object',
        properties: {
          frontend_code: { type: 'string' },
          backend_code: { type: 'string' },
          file_structure: { type: 'string' },
          features_implemented: { type: 'array', items: { type: 'string' } },
          notes: { type: 'string' },
        },
      },
    });

    // Store the generated code
    await base44.entities.MockupProject.update(projectId, {
      status: 'complete',
      generated_code: result.frontend_code || '',
      generated_backend_code: result.backend_code || '',
      generation_notes: result.notes || '',
      generated_at: new Date().toISOString(),
    });

    return Response.json({
      project_id: projectId,
      status: 'complete',
      frontend_code: result.frontend_code,
      backend_code: result.backend_code || '',
      file_structure: result.file_structure,
      features_implemented: result.features_implemented,
      notes: result.notes,
      message: 'Code generated successfully.',
    });
  } catch (error) {
    console.error('generateFromMockup error:', error);
    try {
      const base44 = createClientFromRequest(req);
      const body = await req.clone().json();
      if (body.project_id) {
        await base44.entities.MockupProject.update(body.project_id, {
          status: 'failed',
          error_message: error.message,
        });
      }
    } catch {}
    return Response.json({ error: error.message }, { status: 500 });
  }
}