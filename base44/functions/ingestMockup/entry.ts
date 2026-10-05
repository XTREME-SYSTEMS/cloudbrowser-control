import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// High-quality ingestion system: accepts any file type (image, PDF, sketch,
// Figma export, etc.) via multipart/form-data OR a pre-uploaded file_uri.
// Stores the file privately and creates a MockupProject record.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let fileUri = '';
    let fileName = '';
    let fileType = '';
    let projectName = '';
    let submittedBy = '';

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      // File uploaded directly — upload to private storage
      const formData = await req.formData();
      const file = formData.get('file');
      projectName = String(formData.get('project_name') || '');
      submittedBy = String(formData.get('submitted_by') || '');

      if (!file || !(file instanceof File)) {
        return Response.json({ error: 'No file provided. Include a "file" field in the form data.' }, { status: 400 });
      }

      fileName = file.name || 'mockup';
      fileType = file.type || 'application/octet-stream';

      const uploadResult = await base44.asServiceRole.integrations.Core.UploadPrivateFile({ file });
      fileUri = uploadResult.file_uri;
    } else {
      // JSON body with pre-uploaded file_uri (frontend pre-uploaded via SDK)
      const body = await req.json();
      fileUri = String(body.file_uri || '').trim();
      fileName = String(body.file_name || 'mockup').trim();
      fileType = String(body.file_type || '').trim();
      projectName = String(body.project_name || '').trim();
      submittedBy = String(body.submitted_by || '');
    }

    if (!fileUri) {
      return Response.json({ error: 'No file provided. Upload a file or pass a file_uri.' }, { status: 400 });
    }

    // Create the MockupProject record
    const project = await base44.entities.MockupProject.create({
      project_name: projectName || `Mockup ${new Date().toLocaleString()}`,
      file_uri: fileUri,
      file_name: fileName,
      file_type: fileType,
      status: 'ingested',
      submitted_by: submittedBy || user.email || 'user',
    });

    return Response.json({
      project_id: project.id,
      file_uri: fileUri,
      status: 'ingested',
      message: 'File ingested successfully. Call scanMockup to analyze the design.',
    });
  } catch (error) {
    console.error('ingestMockup error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}