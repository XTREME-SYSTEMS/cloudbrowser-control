import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { buildScanPrompt, validateScanResult, familyForCategory } from '../../shared/mockupStudio.ts';

// Scans an uploaded mock-up image using AI vision. Extracts a complete
// structured design spec (layout, colors, typography, sections, components,
// project type, backend needs) and stores it on the MockupProject.
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

    // Update status to scanning
    await base44.entities.MockupProject.update(projectId, { status: 'scanning' });

    // Create a signed URL for the private file so the AI can see it
    const signedResult = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
      file_uri: project.file_uri,
      expires_in: 600,
    });
    const fileUrl = signedResult.signed_url;

    // Send the image to AI vision for analysis
    const scanPrompt = buildScanPrompt();
    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: scanPrompt,
      file_urls: [fileUrl],
      response_json_schema: {
        type: 'object',
        properties: {
          project_type: { type: 'string' },
          category: { type: 'string' },
          family: { type: 'string' },
          has_backend: { type: 'boolean' },
          backend_spec: { type: 'string' },
          design_style: { type: 'string' },
          color_palette: {
            type: 'object',
            properties: {
              primary: { type: 'string' },
              secondary: { type: 'string' },
              accent: { type: 'string' },
              background: { type: 'string' },
              text: { type: 'string' },
              muted: { type: 'string' },
            },
          },
          typography: {
            type: 'object',
            properties: {
              heading_font: { type: 'string' },
              body_font: { type: 'string' },
              heading_weight: { type: 'string' },
              scale: { type: 'string' },
            },
          },
          layout: {
            type: 'object',
            properties: {
              header_type: { type: 'string' },
              max_width: { type: 'string' },
              grid: { type: 'string' },
            },
          },
          sections: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                type: { type: 'string' },
                description: { type: 'string' },
              },
            },
          },
          components: { type: 'array', items: { type: 'string' } },
          content_summary: { type: 'string' },
          brand_name: { type: 'string' },
          responsive: { type: 'boolean' },
          notes: { type: 'string' },
        },
      },
    });

    // Validate the scan result
    if (!validateScanResult(result)) {
      await base44.entities.MockupProject.update(projectId, {
        status: 'failed',
        error_message: 'AI scan returned an invalid result structure.',
      });
      return Response.json({ error: 'AI scan returned an invalid result.' }, { status: 500 });
    }

    // Ensure family is set correctly based on category
    if (!result.family) {
      result.family = familyForCategory(result.category);
    }

    // Store the scan result and update project
    await base44.entities.MockupProject.update(projectId, {
      status: 'scanned',
      scan_result: result,
      project_type: result.project_type,
      has_backend: result.has_backend || false,
      backend_spec: result.backend_spec || '',
      file_url: fileUrl,
    });

    return Response.json({
      project_id: projectId,
      status: 'scanned',
      scan_result: result,
      message: 'Mock-up scanned successfully. Review and approve to generate code.',
    });
  } catch (error) {
    console.error('scanMockup error:', error);
    // Try to mark the project as failed
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